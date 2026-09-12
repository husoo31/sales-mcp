import { Router } from 'express';
import { prisma, MessageDraftStatus, ApprovalStatus } from '@spark/database';

const router = Router();

// GET /api/approvals
router.get('/', async (req, res) => {
  try {
    const drafts = await prisma.messageDraft.findMany({
      where: {
        status: MessageDraftStatus.WAITING_APPROVAL
      },
      select: {
        id: true,
        leadId: true,
        content: true,
        screenshotUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lead: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(drafts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch approvals', details: String(error) });
  }
});

// POST /api/approvals/:id/approve
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const draft = await prisma.messageDraft.findUnique({ where: { id } });
    if (!draft) {
      return res.status(404).json({ error: 'Message draft not found' });
    }

    // Update draft status and create approval record in a transaction
    const result = await prisma.$transaction([
      prisma.messageDraft.update({
        where: { id },
        data: { status: MessageDraftStatus.APPROVED_MANUAL_SEND_PENDING }
      }),
      prisma.approval.upsert({
        where: { draftId: id },
        update: { status: ApprovalStatus.APPROVED, approvedAt: new Date() },
        create: {
          draftId: id,
          status: ApprovalStatus.APPROVED,
          approvedAt: new Date()
        }
      })
    ]);

    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve message draft', details: String(error) });
  }
});

// POST /api/approvals/:id/reject
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const draft = await prisma.messageDraft.findUnique({ where: { id } });
    if (!draft) {
      return res.status(404).json({ error: 'Message draft not found' });
    }

    const result = await prisma.$transaction([
      prisma.messageDraft.update({
        where: { id },
        data: { status: MessageDraftStatus.REJECTED }
      }),
      prisma.approval.upsert({
        where: { draftId: id },
        update: { status: ApprovalStatus.REJECTED },
        create: {
          draftId: id,
          status: ApprovalStatus.REJECTED
        }
      })
    ]);

    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject message draft', details: String(error) });
  }
});

// PUT /api/approvals/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const updatedDraft = await prisma.messageDraft.update({
      where: { id },
      data: { content }
    });

    res.json(updatedDraft);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update message draft', details: String(error) });
  }
});

export default router;
