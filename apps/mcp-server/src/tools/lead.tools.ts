import { prisma, LeadStatus } from '@spark/database';
import { z } from 'zod';
import { ToolHandler } from '../server.js';

const searchLeadsSchema = z.object({
  clinicName: z.string().optional(),
  city: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['NEW', 'RESEARCHING', 'ANALYZED', 'MESSAGE_READY', 'WAITING_APPROVAL', 'CONTACTED', 'REPLIED', 'INTERESTED', 'MEETING', 'PROPOSAL', 'WON', 'LOST', 'WAITING_FOLLOWUP']).optional()
});

export const searchLeadsTool: ToolHandler = {
  tool: {
    name: 'search_leads',
    description: 'Search for leads based on clinic name, city, category, or status.',
    inputSchema: {
      type: 'object',
      properties: {
        clinicName: { type: 'string', description: 'Partial or full clinic name' },
        city: { type: 'string', description: 'Exact city name' },
        category: { type: 'string', description: 'Exact category name' },
        status: { type: 'string', description: 'Lead status (e.g. NEW, RESEARCHING, ANALYZED)' }
      }
    }
  },
  handler: async (args) => {
    const parsed = searchLeadsSchema.parse(args);
    const leads = await prisma.lead.findMany({
      where: {
        clinicName: parsed.clinicName ? { contains: parsed.clinicName, mode: 'insensitive' } : undefined,
        city: parsed.city ? { equals: parsed.city, mode: 'insensitive' } : undefined,
        category: parsed.category ? { equals: parsed.category, mode: 'insensitive' } : undefined,
        status: parsed.status ? (parsed.status as LeadStatus) : undefined
      },
      take: 20
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(leads, null, 2) }]
    };
  }
};

const getLeadSchema = z.object({
  id: z.string().uuid('Invalid lead ID format')
});

export const getLeadTool: ToolHandler = {
  tool: {
    name: 'get_lead',
    description: 'Get a specific lead by ID, including contacts and conversations.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    }
  },
  handler: async (args) => {
    const { id } = getLeadSchema.parse(args);
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        contacts: true,
        conversations: true
      }
    });
    
    if (!lead) {
      throw new Error(`Lead not found with id: ${id}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(lead, null, 2) }]
    };
  }
};

const createLeadSchema = z.object({
  clinicName: z.string().min(1, 'Clinic name cannot be empty'),
  phone: z.string().min(1, 'Phone cannot be empty'),
  city: z.string().min(1, 'City cannot be empty').optional(),
  category: z.string().min(1, 'Category cannot be empty').optional()
});

export const createLeadTool: ToolHandler = {
  tool: {
    name: 'create_lead',
    description: 'Create a new lead. Checks for duplicate phone numbers first.',
    inputSchema: {
      type: 'object',
      properties: {
        clinicName: { type: 'string' },
        phone: { type: 'string' },
        city: { type: 'string' },
        category: { type: 'string' }
      },
      required: ['clinicName', 'phone']
    }
  },
  handler: async (args) => {
    const parsed = createLeadSchema.parse(args);
    
    const existing = await prisma.lead.findFirst({
      where: { phone: parsed.phone }
    });
    
    if (existing) {
      throw new Error(`Lead with phone ${parsed.phone} already exists.`);
    }

    const lead = await prisma.lead.create({
      data: {
        clinicName: parsed.clinicName,
        phone: parsed.phone,
        phoneNumbers: [parsed.phone],
        city: parsed.city,
        category: parsed.category
      }
    });

    return {
      content: [{ type: 'text', text: `Lead created successfully. ID: ${lead.id}` }]
    };
  }
};

const updateLeadSchema = z.object({
  id: z.string().uuid('Invalid lead ID format'),
  clinicName: z.string().min(1, 'Clinic name cannot be empty').optional(),
  city: z.string().min(1, 'City cannot be empty').optional(),
  status: z.enum(['NEW', 'RESEARCHING', 'ANALYZED', 'MESSAGE_READY', 'WAITING_APPROVAL', 'CONTACTED', 'REPLIED', 'INTERESTED', 'MEETING', 'PROPOSAL', 'WON', 'LOST', 'WAITING_FOLLOWUP']).optional()
});

export const updateLeadTool: ToolHandler = {
  tool: {
    name: 'update_lead',
    description: 'Update an existing lead.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        clinicName: { type: 'string' },
        city: { type: 'string' },
        status: { type: 'string' }
      },
      required: ['id']
    }
  },
  handler: async (args) => {
    const parsed = updateLeadSchema.parse(args);
    
    const lead = await prisma.lead.update({
      where: { id: parsed.id },
      data: {
        clinicName: parsed.clinicName,
        city: parsed.city,
        status: parsed.status ? (parsed.status as LeadStatus) : undefined
      }
    });

    return {
      content: [{ type: 'text', text: `Lead updated successfully. ID: ${lead.id}` }]
    };
  }
};

export const leadTools = [searchLeadsTool, getLeadTool, createLeadTool, updateLeadTool];
