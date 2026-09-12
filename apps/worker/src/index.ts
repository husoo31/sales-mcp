import { prisma } from '@spark/database';
import { prepareWhatsAppMessage } from './whatsapp.js';
import dotenv from 'dotenv';

dotenv.config();

const POLL_INTERVAL = 5000;

async function processDrafts() {
  try {
    const drafts = await prisma.messageDraft.findMany({
      where: {
        status: 'APPROVED_MANUAL_SEND_PENDING'
      },
      include: {
        lead: true
      },
      take: 1 // Process one by one to avoid Playwright conflicts
    });

    for (const draft of drafts) {
      console.log(`Processing draft ${draft.id} for lead ${draft.lead.clinicName}`);
      
      try {
        await prepareWhatsAppMessage(draft.lead.phone, draft.content);
        
        // Update statuses
        await prisma.$transaction(async (tx) => {
          await tx.messageDraft.update({
            where: { id: draft.id },
            data: { status: 'PREPARED_FOR_SEND' }
          });
          
          await tx.lead.update({
            where: { id: draft.leadId },
            data: { status: 'PREPARED_FOR_SEND' }
          });
          
          await tx.activityLog.create({
            data: {
              leadId: draft.leadId,
              action: 'WHATSAPP_PREPARED',
              details: `WhatsApp message prepared for manual sending. Draft ID: ${draft.id}`,
              status: 'INFO'
            }
          });
        });
        
        console.log(`Successfully prepared WhatsApp message for lead ${draft.lead.clinicName}`);
      } catch (error) {
        console.error(`Failed to process draft ${draft.id}:`, error);
        // Optionally, update status to REJECTED or add to error log.
      }
    }
  } catch (error) {
    console.error('Error polling for drafts:', error);
  } finally {
    setTimeout(processDrafts, POLL_INTERVAL);
  }
}

async function main() {
  console.log('Worker started. Polling for approved drafts...');
  processDrafts();
}

main().catch((error) => {
  console.error('Worker crashed:', error);
  process.exit(1);
});
