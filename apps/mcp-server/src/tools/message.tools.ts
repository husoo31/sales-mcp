import { prisma } from '@spark/database';
import { z } from 'zod';
import { ToolHandler } from '../server.js';

const draftMessageSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID format'),
  messageContent: z.string().min(1, 'Message content cannot be empty')
});

export const draftMessageTool: ToolHandler = {
  tool: {
    name: 'draft_message',
    description: 'Drafts a WhatsApp message for a lead and sends it to the manual approval queue.',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        messageContent: { type: 'string' }
      },
      required: ['leadId', 'messageContent']
    }
  },
  handler: async (args) => {
    const { leadId, messageContent } = draftMessageSchema.parse(args);
    
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new Error(`Lead not found with id: ${leadId}`);
    }

    const draft = await prisma.messageDraft.create({
      data: {
        leadId,
        content: messageContent,
        status: 'WAITING_APPROVAL'
      }
    });

    await prisma.approval.create({
      data: {
        draftId: draft.id,
        status: 'WAITING_APPROVAL'
      }
    });

    await prisma.activityLog.create({
      data: {
        leadId,
        action: 'MESSAGE_DRAFTED',
        details: 'AI drafted a message and sent for human approval.',
        status: 'SUCCESS'
      }
    });

    return {
      content: [{ type: 'text', text: `Message drafted successfully and requires human approval. Draft ID: ${draft.id}` }]
    };
  }
};

const getMessageDraftsSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID format').optional()
});

export const getMessageDraftsTool: ToolHandler = {
  tool: {
    name: 'get_message_drafts',
    description: 'Get pending message drafts (waiting for approval). Optionally filter by lead ID.',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' }
      }
    }
  },
  handler: async (args) => {
    const { leadId } = getMessageDraftsSchema.parse(args);
    
    const drafts = await prisma.messageDraft.findMany({
      where: {
        status: 'WAITING_APPROVAL',
        leadId: leadId ? leadId : undefined
      },
      include: {
        approval: true
      },
      take: 50
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(drafts, null, 2) }]
    };
  }
};

const approveMessageSchema = z.object({
  draftId: z.string().uuid('Invalid draft ID format')
});

export const approveMessageTool: ToolHandler = {
  tool: {
    name: 'approve_message',
    description: 'Approve a message draft. Moves it to APPROVED_MANUAL_SEND_PENDING status. Does NOT send it.',
    inputSchema: {
      type: 'object',
      properties: {
        draftId: { type: 'string' }
      },
      required: ['draftId']
    }
  },
  handler: async (args) => {
    const { draftId } = approveMessageSchema.parse(args);
    
    const draft = await prisma.messageDraft.findUnique({ where: { id: draftId }, include: { approval: true } });
    if (!draft) {
      throw new Error(`Draft not found with id: ${draftId}`);
    }

    if (draft.status !== 'WAITING_APPROVAL') {
      throw new Error(`Draft is not in WAITING_APPROVAL state. Current state: ${draft.status}`);
    }

    await prisma.$transaction([
      prisma.messageDraft.update({
        where: { id: draftId },
        data: { status: 'APPROVED_MANUAL_SEND_PENDING' }
      }),
      prisma.approval.update({
        where: { draftId: draftId },
        data: { status: 'APPROVED' }
      }),
      prisma.activityLog.create({
        data: {
          leadId: draft.leadId,
          action: 'MESSAGE_APPROVED',
          details: 'Message draft was approved manually via MCP.',
          status: 'SUCCESS'
        }
      })
    ]);

    return {
      content: [{ type: 'text', text: `Message draft ${draftId} approved and waiting for manual send.` }]
    };
  }
};

export const messageTools = [draftMessageTool, getMessageDraftsTool, approveMessageTool];
