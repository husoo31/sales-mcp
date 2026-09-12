import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  lead: {
    findUnique: vi.fn(),
  },
  followUp: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  activityLog: {
    create: vi.fn(),
  }
}));

vi.mock('@spark/database', () => ({
  prisma: prismaMock,
}));

import { scheduleFollowUpTool, getFollowUpsTool } from '../src/tools/followup.tools.js';

describe('FollowUp Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('schedule_followup', () => {
    it('should schedule a followup', async () => {
      prismaMock.lead.findUnique.mockResolvedValue({ id: '12345678-1234-4234-a234-123456789012' });
      prismaMock.followUp.create.mockResolvedValue({ id: 'f-1' });

      const dateStr = new Date().toISOString();
      const result = await scheduleFollowUpTool.handler({
        leadId: '12345678-1234-4234-a234-123456789012',
        reason: 'Call back',
        scheduledForISO: dateStr
      });
      
      expect(prismaMock.lead.findUnique).toHaveBeenCalledWith({ where: { id: '12345678-1234-4234-a234-123456789012' } });
      expect(prismaMock.followUp.create).toHaveBeenCalled();
      expect(prismaMock.activityLog.create).toHaveBeenCalled();
      
      expect(result.content[0].text).toContain('f-1');
    });

    it('should fail on invalid date format', async () => {
      prismaMock.lead.findUnique.mockResolvedValue({ id: '12345678-1234-4234-a234-123456789012' });

      await expect(scheduleFollowUpTool.handler({
        leadId: '12345678-1234-4234-a234-123456789012', // Need a valid UUID here though, oh wait lead-1 is not a UUID.
        reason: 'Call back',
        scheduledForISO: 'invalid-date'
      })).rejects.toThrow();
    });

    it('should fail on invalid lead', async () => {
      prismaMock.lead.findUnique.mockResolvedValue(null);

      await expect(scheduleFollowUpTool.handler({
        leadId: '12345678-1234-4234-a234-123456789012',
        reason: 'Call back',
        scheduledForISO: new Date().toISOString()
      })).rejects.toThrow();
    });
  });

  describe('get_followups', () => {
    it('should list pending followups', async () => {
      const mockFollowUps = [{ id: 'f-1' }];
      prismaMock.followUp.findMany.mockResolvedValue(mockFollowUps);

      const result = await getFollowUpsTool.handler({});
      
      expect(prismaMock.followUp.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING', leadId: undefined },
        orderBy: { scheduledFor: 'asc' },
        take: 50
      });
      expect(result.content[0].text).toBe(JSON.stringify(mockFollowUps, null, 2));
    });
  });
});
