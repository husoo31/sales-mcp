import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  activityLog: {
    findMany: vi.fn(),
  }
}));

vi.mock('@spark/database', () => ({
  prisma: prismaMock,
}));

import { getLeadActivityTool } from '../src/tools/activity.tools.js';

describe('Activity Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get_lead_activity', () => {
    it('should return activities in descending order', async () => {
      const mockLogs = [{ id: '1' }, { id: '2' }];
      prismaMock.activityLog.findMany.mockResolvedValue(mockLogs);

      const result = await getLeadActivityTool.handler({ leadId: '12345678-1234-4234-a234-123456789012' });
      
      expect(prismaMock.activityLog.findMany).toHaveBeenCalledWith({
        where: { leadId: '12345678-1234-4234-a234-123456789012' },
        orderBy: { timestamp: 'desc' },
        take: 50
      });
      expect(result.content[0].text).toBe(JSON.stringify(mockLogs, null, 2));
    });

    it('should validate inputs', async () => {
      await expect(getLeadActivityTool.handler({}))
        .rejects
        .toThrow();
    });
  });
});
