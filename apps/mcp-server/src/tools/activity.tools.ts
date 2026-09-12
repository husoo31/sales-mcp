import { prisma } from '@spark/database';
import { z } from 'zod';
import { ToolHandler } from '../server.js';

const getLeadActivitySchema = z.object({
  leadId: z.string().uuid('Invalid lead ID format')
});

export const getLeadActivityTool: ToolHandler = {
  tool: {
    name: 'get_lead_activity',
    description: 'Get activity logs for a specific lead.',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' }
      },
      required: ['leadId']
    }
  },
  handler: async (args) => {
    const { leadId } = getLeadActivitySchema.parse(args);
    
    const logs = await prisma.activityLog.findMany({
      where: { leadId },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(logs, null, 2) }]
    };
  }
};

export const activityTools = [getLeadActivityTool];
