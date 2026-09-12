import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  lead: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }
}));

vi.mock('@spark/database', () => ({
  prisma: prismaMock,
  LeadStatus: {
    NEW: 'NEW',
    ANALYZED: 'ANALYZED'
  }
}));

import { searchLeadsTool, getLeadTool, createLeadTool, updateLeadTool } from '../src/tools/lead.tools.js';

describe('Lead Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search_leads', () => {
    it('should return found leads successfully', async () => {
      const mockLeads = [{ id: '1', clinicName: 'Test Clinic' }];
      prismaMock.lead.findMany.mockResolvedValue(mockLeads);

      const result = await searchLeadsTool.handler({ clinicName: 'Test' });
      
      expect(prismaMock.lead.findMany).toHaveBeenCalledWith({
        where: {
          clinicName: { contains: 'Test', mode: 'insensitive' },
          city: undefined,
          category: undefined,
          status: undefined
        },
        take: 20
      });
      expect(result.content[0].text).toBe(JSON.stringify(mockLeads, null, 2));
    });

    it('should validate inputs', async () => {
      await expect(searchLeadsTool.handler({ status: 'INVALID_STATUS' }))
        .rejects
        .toThrow();
    });
  });

  describe('get_lead', () => {
    it('should return a lead by ID', async () => {
      const mockLead = { id: '12345678-1234-4234-a234-123456789012', clinicName: 'Test Clinic' };
      prismaMock.lead.findUnique.mockResolvedValue(mockLead);

      const result = await getLeadTool.handler({ id: '12345678-1234-4234-a234-123456789012' });
      
      expect(prismaMock.lead.findUnique).toHaveBeenCalledWith({
        where: { id: '12345678-1234-4234-a234-123456789012' },
        include: { contacts: true, conversations: true }
      });
      expect(result.content[0].text).toBe(JSON.stringify(mockLead, null, 2));
    });

    it('should throw if lead not found', async () => {
      prismaMock.lead.findUnique.mockResolvedValue(null);

      await expect(getLeadTool.handler({ id: '12345678-1234-4234-a234-123456789012' }))
        .rejects
        .toThrow();
    });

    it('should fail on missing id', async () => {
      await expect(getLeadTool.handler({}))
        .rejects
        .toThrow();
    });
  });

  describe('create_lead', () => {
    it('should create a lead if not duplicate', async () => {
      prismaMock.lead.findFirst.mockResolvedValue(null);
      prismaMock.lead.create.mockResolvedValue({ id: 'new-id' });

      const result = await createLeadTool.handler({ clinicName: 'New Clinic', phone: '123456' });
      
      expect(prismaMock.lead.findFirst).toHaveBeenCalledWith({ where: { phone: '123456' } });
      expect(prismaMock.lead.create).toHaveBeenCalled();
      expect(result.content[0].text).toContain('new-id');
    });

    it('should throw on duplicate lead', async () => {
      prismaMock.lead.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(createLeadTool.handler({ clinicName: 'New Clinic', phone: '123456' }))
        .rejects
        .toThrow('already exists');
    });
  });

  describe('update_lead', () => {
    it('should update lead successfully', async () => {
      prismaMock.lead.update.mockResolvedValue({ id: '12345678-1234-4234-a234-123456789012' });

      const result = await updateLeadTool.handler({ id: '12345678-1234-4234-a234-123456789012', city: 'Istanbul' });
      
      expect(prismaMock.lead.update).toHaveBeenCalledWith({
        where: { id: '12345678-1234-4234-a234-123456789012' },
        data: {
          clinicName: undefined,
          city: 'Istanbul',
          status: undefined
        }
      });
      expect(result.content[0].text).toContain('updated successfully');
    });

    it('should throw on invalid enum status', async () => {
      await expect(updateLeadTool.handler({ id: '12345678-1234-4234-a234-123456789012', status: 'INVALID' }))
        .rejects
        .toThrow();
    });
  });
});
