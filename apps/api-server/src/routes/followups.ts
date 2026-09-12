import { Router } from 'express';
import { prisma } from '@spark/database';

const router = Router();

// GET /api/follow-ups (or /api/followups)
router.get('/', async (req, res) => {
  try {
    const leadsToFollowUp = await prisma.lead.findMany({
      where: {
        scheduledFollowUpAt: {
          lte: new Date()
        },
        followUpStatus: {
          not: 'COMPLETED'
        }
      },
      orderBy: { scheduledFollowUpAt: 'asc' }
    });

    res.json(leadsToFollowUp);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch follow-ups', details: String(error) });
  }
});

// POST /api/follow-ups/schedule (or /api/followups/schedule)
router.post('/schedule', async (req, res) => {
  try {
    const { leadId, days } = req.body;
    
    if (!leadId || typeof days !== 'number') {
      return res.status(400).json({ error: 'leadId and days are required' });
    }

    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + days);

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        scheduledFollowUpAt: scheduledDate,
        followUpStatus: 'WAITING_REPLY'
      }
    });

    res.json(updatedLead);
  } catch (error) {
    res.status(500).json({ error: 'Failed to schedule follow-up', details: String(error) });
  }
});

// POST /api/follow-ups/:id/draft
router.post('/:id/draft', async (req, res) => {
  try {
    const { id } = req.params;
    
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const followUpMessage = `Merhaba ${lead.clinicName}, hafta başında ilettiğimiz mobil arayüz/teknik analiz ve 2 dakikalık tedavi demo akışı hakkında değerlendirme yapma fırsatınız oldu mu acaba? Kısa bir geri bildiriminizi rica ederiz.`;

    const draft = await prisma.messageDraft.create({
      data: {
        leadId: id,
        content: followUpMessage,
        status: 'WAITING_APPROVAL'
      }
    });

    // Optionally update lead followUpStatus
    await prisma.lead.update({
      where: { id },
      data: { followUpStatus: 'DRAFT_CREATED', followUpCount: { increment: 1 } }
    });

    res.json(draft);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create follow-up draft', details: String(error) });
  }
});

export default router;
