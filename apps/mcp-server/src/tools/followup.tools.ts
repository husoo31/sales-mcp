import { prisma } from '@spark/database';
import { z } from 'zod';
import { ToolHandler } from '../server.js';

const scheduleFollowUpSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID format'),
  reason: z.string().min(1, 'Reason cannot be empty'),
  scheduledForISO: z.string().datetime({ message: 'Must be a valid ISO-8601 date string' })
});

export const scheduleFollowUpTool: ToolHandler = {
  tool: {
    name: 'schedule_followup',
    description: 'Schedule a follow up for a lead.',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        reason: { type: 'string' },
        scheduledForISO: { type: 'string', description: 'ISO-8601 format date string' }
      },
      required: ['leadId', 'reason', 'scheduledForISO']
    }
  },
  handler: async (args) => {
    const { leadId, reason, scheduledForISO } = scheduleFollowUpSchema.parse(args);
    
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new Error(`Lead not found with id: ${leadId}`);
    }

    const scheduledDate = new Date(scheduledForISO);

    const followUp = await prisma.followUp.create({
      data: {
        leadId,
        reason,
        scheduledFor: scheduledDate,
        status: 'PENDING'
      }
    });

    await prisma.activityLog.create({
      data: {
        leadId,
        action: 'FOLLOWUP_SCHEDULED',
        details: `Follow-up scheduled for ${scheduledForISO}. Reason: ${reason}`,
        status: 'SUCCESS'
      }
    });

    return {
      content: [{ type: 'text', text: `Follow-up scheduled successfully. ID: ${followUp.id}` }]
    };
  }
};

const getFollowUpsSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID format').optional()
});

export const getFollowUpsTool: ToolHandler = {
  tool: {
    name: 'get_followups',
    description: 'Get pending follow-ups. Optionally filter by lead ID.',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' }
      }
    }
  },
  handler: async (args) => {
    const { leadId } = getFollowUpsSchema.parse(args);
    
    const followUps = await prisma.followUp.findMany({
      where: {
        status: 'PENDING',
        leadId: leadId ? leadId : undefined
      },
      orderBy: { scheduledFor: 'asc' },
      take: 50
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(followUps, null, 2) }]
    };
  }
};

export const followUpTools = [scheduleFollowUpTool, getFollowUpsTool];
