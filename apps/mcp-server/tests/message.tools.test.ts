import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  lead: {
    findUnique: vi.fn(),
  },
  messageDraft: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  approval: {
    create: vi.fn(),
    update: vi.fn(),
  },
  activityLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((operations) => Promise.all(operations)),
}));

vi.mock('@spark/database', () => ({
  prisma: prismaMock,
}));

import { draftMessageTool, getMessageDraftsTool, approveMessageTool } from '../src/tools/message.tools.js';

describe('Message Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('draft_message', () => {
    it('should create a draft, approval, and activity log', async () => {
      prismaMock.lead.findUnique.mockResolvedValue({ id: '12345678-1234-4234-a234-123456789012' });
      prismaMock.messageDraft.create.mockResolvedValue({ id: '87654321-4321-4321-a321-210987654321' });

      const result = await draftMessageTool.handler({ leadId: '12345678-1234-4234-a234-123456789012', messageContent: 'Hello!' });
      
      expect(prismaMock.lead.findUnique).toHaveBeenCalledWith({ where: { id: '12345678-1234-4234-a234-123456789012' } });
      expect(prismaMock.messageDraft.create).toHaveBeenCalledWith({
        data: {
          leadId: '12345678-1234-4234-a234-123456789012',
          content: 'Hello!',
          status: 'WAITING_APPROVAL'
        }
      });
      expect(prismaMock.approval.create).toHaveBeenCalledWith({
        data: { draftId: '87654321-4321-4321-a321-210987654321', status: 'WAITING_APPROVAL' }
      });
      expect(prismaMock.activityLog.create).toHaveBeenCalled();
      
      expect(result.content[0].text).toContain('87654321-4321-4321-a321-210987654321');
    });

    it('should fail if lead does not exist', async () => {
      prismaMock.lead.findUnique.mockResolvedValue(null);

      await expect(draftMessageTool.handler({ leadId: '12345678-1234-4234-a234-123456789012', messageContent: 'test' }))
        .rejects
        .toThrow();
    });
  });

  describe('get_message_drafts', () => {
    it('should return pending drafts', async () => {
      const mockDrafts = [{ id: '87654321-4321-4321-a321-210987654321' }];
      prismaMock.messageDraft.findMany.mockResolvedValue(mockDrafts);

      const result = await getMessageDraftsTool.handler({});
      
      expect(prismaMock.messageDraft.findMany).toHaveBeenCalledWith({
        where: { status: 'WAITING_APPROVAL', leadId: undefined },
        include: { approval: true },
        take: 50
      });
      expect(result.content[0].text).toBe(JSON.stringify(mockDrafts, null, 2));
    });
  });

  describe('approve_message', () => {
    it('should update status to APPROVED_MANUAL_SEND_PENDING but NOT send', async () => {
      prismaMock.messageDraft.findUnique.mockResolvedValue({
        id: '87654321-4321-4321-a321-210987654321',
        leadId: '12345678-1234-4234-a234-123456789012',
        status: 'WAITING_APPROVAL'
      });

      const result = await approveMessageTool.handler({ draftId: '87654321-4321-4321-a321-210987654321' });
      
      expect(prismaMock.messageDraft.update).toHaveBeenCalledWith({
        where: { id: '87654321-4321-4321-a321-210987654321' },
        data: { status: 'APPROVED_MANUAL_SEND_PENDING' }
      });
      expect(prismaMock.approval.update).toHaveBeenCalledWith({
        where: { draftId: '87654321-4321-4321-a321-210987654321' },
        data: { status: 'APPROVED' }
      });
      expect(prismaMock.$transaction).toHaveBeenCalled();
      
      expect(result.content[0].text).toContain('waiting for manual send');
    });

    it('should fail if draft does not exist', async () => {
      prismaMock.messageDraft.findUnique.mockResolvedValue(null);

      await expect(approveMessageTool.handler({ draftId: '87654321-4321-4321-a321-210987654321' }))
        .rejects
        .toThrow();
    });

    it('should fail if draft is not in WAITING_APPROVAL state', async () => {
      prismaMock.messageDraft.findUnique.mockResolvedValue({
        id: '87654321-4321-4321-a321-210987654321',
        status: 'SENT'
      });

      await expect(approveMessageTool.handler({ draftId: '87654321-4321-4321-a321-210987654321' }))
        .rejects
        .toThrow();
    });
  });
});
