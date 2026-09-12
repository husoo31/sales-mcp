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

export default router;
