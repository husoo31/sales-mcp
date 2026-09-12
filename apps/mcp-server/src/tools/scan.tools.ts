import { prisma } from '@spark/database';
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ToolHandler } from '../server.js';

const execFileAsync = promisify(execFile);

// Resolve the path to live-audit-base64.js relative to this file's location.
// Built output: apps/mcp-server/dist/tools/scan.tools.js
// Script path:  apps/worker/live-audit-base64.js
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_SCRIPT = path.resolve(__dirname, '../../../../worker/live-audit-base64.js');

// ─── scan_clinics ─────────────────────────────────────────────────────────────

const scanClinicsSchema = z.object({
  district: z.string().min(1, 'district cannot be empty'),
  count: z.number().int().min(1).max(20).default(3),
});

export const scanClinicsTool: ToolHandler = {
  tool: {
    name: 'scan_clinics',
    description:
      "Google Maps üzerinden belirtilen ilçedeki diş kliniklerini tarar, mobil audit yapar ve sonuçları DB'ye yazar. Taranan kliniklerin adı, telefonu ve tespit edilen problemi döner.",
    inputSchema: {
      type: 'object',
      properties: {
        district: {
          type: 'string',
          description: 'Taranacak ilçe adı (örn: "Kadıköy", "Beşiktaş")',
        },
        count: {
          type: 'number',
          description: 'Taranacak klinik sayısı (varsayılan: 3, max: 20)',
        },
      },
      required: ['district'],
    },
  },
  handler: async (args) => {
    const { district, count } = scanClinicsSchema.parse(args);

    // Snapshot existing WAITING_APPROVAL lead IDs before the scan
    const beforeIds = await prisma.lead.findMany({
      where: { status: 'WAITING_APPROVAL' },
      select: { id: true },
    });
    const beforeIdSet = new Set(beforeIds.map((l) => l.id));

    // Run the audit engine as a child process
    await execFileAsync('node', ['--input-type=module', AUDIT_SCRIPT, district, String(count)], {
      timeout: 5 * 60 * 1000,
      env: { ...process.env },
    }).catch(async (err) => {
      // Re-run without --input-type flag for plain node invocation
      await execFileAsync('node', [AUDIT_SCRIPT, district, String(count)], {
        timeout: 5 * 60 * 1000,
        env: { ...process.env },
      });
    });

    // Fetch newly inserted leads
    const newLeads = await prisma.lead.findMany({
      where: {
        status: 'WAITING_APPROVAL',
        id: { notIn: [...beforeIdSet] },
      },
      include: { drafts: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });

    if (newLeads.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `"${district}" taraması tamamlandı ancak yeni uygun klinik bulunamadı (telefon yok veya zaten kayıtlı).`,
          },
        ],
      };
    }

    const summary = newLeads.map((l) => ({
      id: l.id,
      clinicName: l.clinicName,
      phone: l.phone,
      website: l.website ?? null,
      problem: l.problem ?? null,
      draftId: l.drafts[0]?.id ?? null,
    }));

    return {
      content: [
        {
          type: 'text',
          text: [
            `✅ "${district}" taraması tamamlandı — ${newLeads.length} klinik DB'ye eklendi.`,
            '',
            JSON.stringify(summary, null, 2),
          ].join('\n'),
        },
      ],
    };
  },
};

// ─── get_pending_approvals ────────────────────────────────────────────────────

export const getPendingApprovalsTool: ToolHandler = {
  tool: {
    name: 'get_pending_approvals',
    description:
      "Onay bekleyen (WAITING_APPROVAL) lead'leri ve yapay zeka taslak mesajlarını listeler.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  handler: async () => {
    const leads = await prisma.lead.findMany({
      where: { status: 'WAITING_APPROVAL' },
      include: {
        drafts: {
          where: { status: 'WAITING_APPROVAL' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (leads.length === 0) {
      return {
        content: [{ type: 'text', text: 'Onay bekleyen lead bulunamadı.' }],
      };
    }

    const result = leads.map((l) => ({
      leadId: l.id,
      clinicName: l.clinicName,
      phone: l.phone,
      district: l.district ?? null,
      website: l.website ?? null,
      problem: l.problem ?? null,
      draft: l.drafts[0]
        ? { draftId: l.drafts[0].id, content: l.drafts[0].content }
        : null,
    }));

    return {
      content: [
        {
          type: 'text',
          text: [
            `📋 ${result.length} lead onay bekliyor:`,
            '',
            JSON.stringify(result, null, 2),
          ].join('\n'),
        },
      ],
    };
  },
};

// ─── approve_lead ─────────────────────────────────────────────────────────────

const approveLeadSchema = z.object({
  leadId: z.string().uuid('Geçersiz leadId formatı'),
});

function buildWhatsAppUrl(phone: string, message: string): string {
  // Normalize Turkish phone to international format (90XXXXXXXXXX)
  let normalized = phone.replace(/[\s\-().+]/g, '');
  if (normalized.startsWith('0')) {
    normalized = '90' + normalized.slice(1);
  } else if (!normalized.startsWith('90')) {
    normalized = '90' + normalized;
  }
  return `https://web.whatsapp.com/send?phone=${normalized}&text=${encodeURIComponent(message)}`;
}

export const approveLeadTool: ToolHandler = {
  tool: {
    name: 'approve_lead',
    description:
      "Lead'i WON, taslak mesajı APPROVED_MANUAL_SEND_PENDING durumuna alır ve hazır WhatsApp Web gönderim linki döner.",
    inputSchema: {
      type: 'object',
      properties: {
        leadId: {
          type: 'string',
          description: "Onaylanacak lead'in UUID'si",
        },
      },
      required: ['leadId'],
    },
  },
  handler: async (args) => {
    const { leadId } = approveLeadSchema.parse(args);

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        drafts: {
          where: { status: 'WAITING_APPROVAL' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!lead) {
      throw new Error(`Lead bulunamadı: ${leadId}`);
    }

    if (lead.drafts.length === 0) {
      throw new Error(`Lead ${leadId} için onay bekleyen taslak mesaj bulunamadı.`);
    }

    const draft = lead.drafts[0]!;

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: leadId },
        data: { status: 'WON' },
      }),
      prisma.messageDraft.update({
        where: { id: draft.id },
        data: { status: 'APPROVED_MANUAL_SEND_PENDING' },
      }),
      prisma.activityLog.create({
        data: {
          leadId,
          action: 'LEAD_APPROVED',
          details: `Lead WON, taslak APPROVED_MANUAL_SEND_PENDING. Draft ID: ${draft.id}`,
          status: 'SUCCESS',
        },
      }),
    ]);

    // Upsert approval record
    const existingApproval = await prisma.approval.findUnique({
      where: { draftId: draft.id },
    });

    if (existingApproval) {
      await prisma.approval.update({
        where: { draftId: draft.id },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });
    } else {
      await prisma.approval.create({
        data: {
          draftId: draft.id,
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      });
    }

    const whatsappUrl = buildWhatsAppUrl(lead.phone, draft.content);

    return {
      content: [
        {
          type: 'text',
          text: [
            '✅ Lead onaylandı!',
            '',
            `🏥 Klinik   : ${lead.clinicName}`,
            `📞 Telefon  : ${lead.phone}`,
            `📝 Draft ID : ${draft.id}`,
            '📌 Durum    : Lead → WON | Taslak → APPROVED_MANUAL_SEND_PENDING',
            '',
            '🔗 WhatsApp Gönderim Linki:',
            whatsappUrl,
          ].join('\n'),
        },
      ],
    };
  },
};

export const scanTools = [scanClinicsTool, getPendingApprovalsTool, approveLeadTool];
