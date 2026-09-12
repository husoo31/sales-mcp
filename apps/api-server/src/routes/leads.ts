import { Router } from 'express';
import { prisma, LeadStatus } from '@spark/database';

const router = Router();

// GET /api/leads
router.get('/', async (req, res) => {
  try {
    const { status, district, search } = req.query;

    const where: any = {};
    if (status) {
      where.status = status as LeadStatus;
    }
    if (district) {
      where.district = { contains: String(district) };
    }
    if (search) {
      where.clinicName = { contains: String(search) };
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        contacts: true,
        drafts: {
          select: { screenshotUrl: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leads', details: String(error) });
  }
});

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        contacts: true,
        logs: {
          orderBy: { timestamp: 'desc' }
        },
        drafts: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lead details', details: String(error) });
  }
});

// PATCH /api/leads/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatus = status as LeadStatus;

    // Update the lead status
    const lead = await prisma.lead.update({
      where: { id },
      data: { status: validStatus }
    });

    // Update associated MessageDrafts if any
    let draftStatus = null;
    if (validStatus === 'WON' || validStatus === 'PREPARED_FOR_SEND') {
      draftStatus = 'APPROVED_MANUAL_SEND_PENDING';
    } else if (validStatus === 'LOST') {
      draftStatus = 'REJECTED';
    }

    if (draftStatus) {
      await prisma.messageDraft.updateMany({
        where: { leadId: id },
        data: { status: draftStatus as any }
      });
    }

    res.json({ success: true, lead });
  } catch (error) {
    console.error('[STATUS_UPDATE_ERROR]:', error);
    res.status(500).json({ error: 'Failed to update lead status', details: String(error) });
  }
});

export default router;
