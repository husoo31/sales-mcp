import { prisma, LeadStatus } from '@spark/database';
import { z } from 'zod';
import { ToolHandler } from '../server.js';

const getUncontactedLeadsSchema = z.object({
  district: z.string().optional(),
  limit: z.number().int().positive().default(10)
});

export const getUncontactedLeadsTool: ToolHandler = {
  tool: {
    name: 'get_uncontacted_leads',
    description: 'Get uncontacted leads that are in NEW or RESEARCHING (ENRICHING) state, without any message drafts.',
    inputSchema: {
      type: 'object',
      properties: {
        district: { type: 'string', description: 'Optional district to filter leads' },
        limit: { type: 'number', description: 'Number of leads to return (default 10)' }
      }
    }
  },
  handler: async (args) => {
    const parsed = getUncontactedLeadsSchema.parse(args);
    const leads = await prisma.lead.findMany({
      where: {
        status: { in: ['NEW', 'RESEARCHING'] },
        district: parsed.district ? { equals: parsed.district, mode: 'insensitive' } : undefined,
        drafts: { none: {} }
      },
      take: parsed.limit,
      select: {
        id: true,
        clinicName: true,
        district: true,
        city: true,
        category: true,
        status: true,
        website: true,
        rating: true,
        reviews: true,
        problem: true,
        opportunity: true,
        offer: true
      }
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(leads, null, 2) }]
    };
  }
};

const analyzeClinicGapSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID')
});

export const analyzeClinicGapTool: ToolHandler = {
  tool: {
    name: 'analyze_clinic_gap',
    description: 'Analyze a clinic\'s rating, reviews, website presence, and technical gap/problem.',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID of the lead' }
      },
      required: ['leadId']
    }
  },
  handler: async (args) => {
    const { leadId } = analyzeClinicGapSchema.parse(args);
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        clinicName: true,
        rating: true,
        reviews: true,
        website: true,
        problem: true,
        opportunity: true,
        notes: true
      }
    });

    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    const hasWebsite = !!lead.website;
    const isLowRating = lead.rating !== null && lead.rating < 4.0;
    const hasFewReviews = lead.reviews !== null && lead.reviews < 10;
    
    let analysis = `Clinic Name: ${lead.clinicName}\n`;
    analysis += `Website: ${lead.website || 'None'} (${hasWebsite ? 'Has presence' : 'Missing online presence'})\n`;
    analysis += `Rating: ${lead.rating !== null ? lead.rating : 'N/A'} (${isLowRating ? 'Needs improvement' : 'Good'})\n`;
    analysis += `Reviews: ${lead.reviews !== null ? lead.reviews : 'N/A'} (${hasFewReviews ? 'Low visibility' : 'Established'})\n`;
    analysis += `Identified Problem: ${lead.problem || 'Not explicitly identified yet'}\n`;
    analysis += `Opportunity: ${lead.opportunity || 'Not identified'}\n`;
    
    if (lead.notes) {
      analysis += `Additional Notes: ${lead.notes}\n`;
    }

    return {
      content: [{ type: 'text', text: analysis }]
    };
  }
};

const savePersonalizedPitchSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID'),
  pitchText: z.string().min(1, 'Pitch text cannot be empty'),
  aiModel: z.string().min(1, 'AI Model name cannot be empty')
});

export const savePersonalizedPitchTool: ToolHandler = {
  tool: {
    name: 'save_personalized_pitch',
    description: `Save a personalized pitch for a lead as a MessageDraft.
CRITICAL: The pitchText MUST exactly follow this template logic:
1. Start with: "Merhaba [Klinik Adı] ekibi, [İlçe veya 'bölgenizdeki'] dijital görünürlüğünüzü ve hasta akışınızı incelerken önemli bir detaya rastladık:"
2. Then write 1-2 concrete sentences hitting their specific technical gap (lead.problem). Examples:
- If website HTTP/security issue: "Sitenizin SSL/güvenlik uyarısı vermesi ve mobil deneyiminin yavaş olması, reklam verdiğiniz veya arama yapan hastaların randevu almadan çıkmasına sebep oluyor."
- If missing website/7-24 clinic: "Özellikle bölgenizdeki acil aramalarda bağımsız bir landing page ve otomatik WhatsApp karşılama olmaması, gece arayan hastaların doğrudan rakip kliniklere kaymasına yol açıyor."
3. End with the value proposition: "Buna özel olarak hazırladığımız interaktif tedavi hesaplama ve WhatsApp hızlı randevu modülünün 2 dakikalık demosunu incelemeniz için paylaşabilirim. Müsait olduğunuzda kısaca aktarmak isterim, iyi çalışmalar dilerim."`,
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID of the lead' },
        pitchText: { type: 'string', description: 'The generated personalized message text' },
        aiModel: { type: 'string', description: 'The AI model used to generate the pitch' }
      },
      required: ['leadId', 'pitchText', 'aiModel']
    }
  },
  handler: async (args) => {
    const { leadId, pitchText, aiModel } = savePersonalizedPitchSchema.parse(args);
    
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const draft = await tx.messageDraft.create({
        data: {
          leadId,
          content: pitchText,
          status: 'WAITING_APPROVAL'
        }
      });

      await tx.lead.update({
        where: { id: leadId },
        data: { status: 'WAITING_APPROVAL' }
      });

      await tx.activityLog.create({
        data: {
          leadId,
          action: 'PITCH_GENERATED',
          details: `Personalized pitch generated by ${aiModel} and saved as draft ${draft.id}`,
          status: 'INFO'
        }
      });

      return draft;
    });

    return {
      content: [{ type: 'text', text: `Successfully saved personalized pitch as draft ${result.id}. Lead status is now WAITING_APPROVAL.` }]
    };
  }
};

export const aiTools = [
  getUncontactedLeadsTool,
  analyzeClinicGapTool,
  savePersonalizedPitchTool
];
