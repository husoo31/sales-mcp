import { PrismaClient, LeadStatus } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed process...');
  
  const leadsFilePath = path.join(__dirname, '../../../leads.json');
  
  if (!fs.existsSync(leadsFilePath)) {
    console.error(`Error: Could not find leads.json at ${leadsFilePath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(leadsFilePath, 'utf-8');
  const leadsData = JSON.parse(fileContent);

  console.log(`Found ${leadsData.length} leads in JSON file. Starting import...`);

  let addedCount = 0;
  let updatedCount = 0;

  for (const data of leadsData) {
    // Check if lead already exists by phone or clinicName
    const existingLead = await prisma.lead.findFirst({
      where: {
        OR: [
          { phone: data.phone },
          { clinicName: data.clinicName }
        ]
      }
    });

    const leadInput = {
      clinicName: data.clinicName,
      district: data.district || null,
      city: data.city || null,
      rating: data.rating || null,
      reviews: data.reviews || null,
      website: data.website || null,
      phone: data.phone,
      phoneNumbers: [data.phone], // Array of phones
      category: data.category || null,
      leadScore: data.leadScore || null,
      problem: data.problem || null,
      status: LeadStatus.NEW,
    };

    let lead;

    if (existingLead) {
      // Update existing lead
      lead = await prisma.lead.update({
        where: { id: existingLead.id },
        data: leadInput
      });
      updatedCount++;
    } else {
      // Create new lead
      lead = await prisma.lead.create({
        data: leadInput
      });
      addedCount++;
    }

    // Handle LeadContact
    if (data.phone) {
      // Check if this contact already exists for this lead
      const existingContact = await prisma.leadContact.findFirst({
        where: {
          leadId: lead.id,
          phone: data.phone
        }
      });

      if (!existingContact) {
        await prisma.leadContact.create({
          data: {
            leadId: lead.id,
            phone: data.phone,
            isPrimary: true,
            // isWhatsApp is requested but doesn't exist in schema.prisma. 
            // Adhering strictly to schema.prisma fields.
          }
        });
      }
    }
  }

  // --- ADDED DRAFTS FOR TESTING ---
  console.log('Creating sample MessageDrafts...');
  const firstThreeLeads = await prisma.lead.findMany({ take: 3 });
  
  let draftsAdded = 0;
  for (const lead of firstThreeLeads) {
    const existingDraft = await prisma.messageDraft.findFirst({
      where: { leadId: lead.id }
    });
    
    if (existingDraft) {
      await prisma.messageDraft.delete({ where: { id: existingDraft.id } });
    }

    {
      let personalizedPitch = "";
      const isSecurityOrMobileProblem = lead.problem?.toLowerCase().includes('http') || lead.problem?.toLowerCase().includes('php') || lead.problem?.toLowerCase().includes('mobil');
      const isMissingWebsiteProblem = lead.problem?.toLowerCase().includes('web sitesi bulunmuyor') || lead.problem?.toLowerCase().includes('bağımsız');

      const districtText = lead.district ? `${lead.district} bölgesindeki` : 'bölgenizdeki';
      const intro = `Merhaba ${lead.clinicName} ekibi, ${districtText} dijital görünürlüğünüzü ve hasta akışınızı incelerken önemli bir detaya rastladık:\n\n`;
      
      let problemHit = "";
      if (isMissingWebsiteProblem) {
        problemHit = "Özellikle bölgenizdeki acil aramalarda bağımsız bir landing page ve otomatik WhatsApp karşılama olmaması, gece arayan hastaların doğrudan rakip kliniklere kaymasına yol açıyor.\n\n";
      } else if (isSecurityOrMobileProblem) {
        problemHit = "Sitenizin SSL/güvenlik uyarısı vermesi ve mobil deneyiminin yavaş olması, reklam verdiğiniz veya arama yapan hastaların randevu almadan çıkmasına sebep oluyor.\n\n";
      } else {
        problemHit = `Mevcut dijital altyapınızdaki bazı eksiklikler (${lead.problem || 'dönüşüm sorunları'}) hastaların randevu almadan sitenizden ayrılmasına sebep oluyor.\n\n`;
      }
      
      const outro = "Buna özel olarak hazırladığımız interaktif tedavi hesaplama ve WhatsApp hızlı randevu modülünün 2 dakikalık demosunu incelemeniz için paylaşabilirim. Müsait olduğunuzda kısaca aktarmak isterim, iyi çalışmalar dilerim.";
      
      personalizedPitch = intro + problemHit + outro;

      await prisma.messageDraft.create({
        data: {
          leadId: lead.id,
          content: personalizedPitch,
          screenshotUrl: `/screenshots/${lead.id}.png`,
          status: 'WAITING_APPROVAL'
        }
      });
      draftsAdded++;
    }
  }

  // --- MOCK FOLLOW-UP ---
  console.log('Mocking a follow-up lead...');
  const followUpLead = await prisma.lead.findFirst();
  if (followUpLead) {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3); // 3 days ago
    
    await prisma.lead.update({
      where: { id: followUpLead.id },
      data: {
        followUpStatus: 'WAITING_REPLY',
        scheduledFollowUpAt: pastDate,
        followUpCount: 1
      }
    });
    console.log(`Mocked follow-up for lead: ${followUpLead.clinicName}`);
  }

  console.log('-------------------------------------------');
  console.log(`Seed completed successfully.`);
  console.log(`Added leads: ${addedCount}`);
  console.log(`Updated leads: ${updatedCount}`);
  console.log(`Added drafts: ${draftsAdded}`);
  console.log('-------------------------------------------');
}

main()
  .catch((e) => {
    console.error('Seed script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
