import express from 'express';
import { prisma } from '@spark/database';

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const totalLeads = await prisma.lead.count();
    const pendingApprovals = await prisma.messageDraft.count({
      where: { status: 'WAITING_APPROVAL' }
    });
    const sentMessages = await prisma.messageDraft.count({
      where: { status: 'SENT' } 
    });
    const followUps = await prisma.lead.count({
      where: { status: 'WAITING_FOLLOWUP' }
    });

    // Compute basic conversion
    const conversionRate = sentMessages > 0 ? Math.round((followUps / sentMessages) * 100) : 0;

    res.json({
      totalLeads,
      pendingApprovals,
      sentMessages,
      followUps,
      conversionRate
    });
  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/recent-leads', async (req, res) => {
  try {
    const recentLeads = await prisma.lead.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        drafts: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const mappedLeads = recentLeads.map(lead => ({
      id: lead.id,
      clinicName: lead.clinicName,
      district: lead.district,
      problem: lead.problem || 'Bilinmiyor',
      status: lead.drafts[0]?.status || lead.status,
      updatedAt: lead.updatedAt,
      phone: lead.phone,
      website: lead.website,
      drafts: lead.drafts
    }));

    res.json(mappedLeads);
  } catch (error) {
    console.error('Dashboard Recent Leads Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;