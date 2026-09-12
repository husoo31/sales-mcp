import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@spark/database';

const prisma = new PrismaClient();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Lead ID bulunamadı' }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status alanı zorunlu' }, { status: 400 });
    }

    console.log(`[STATUS_UPDATE] Lead ID: ${id}, Gelen Statü: ${status}`);

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: { status: status as any },
    });

    // İlgili taslak mesajın durumunu da senkronize et
    const draftStatus =
      status === 'WON' ? 'APPROVED_MANUAL_SEND_PENDING' :
      status === 'LOST' ? 'REJECTED' :
      null;

    if (draftStatus) {
      await prisma.messageDraft.updateMany({
        where: { leadId: id },
        data: { status: draftStatus as any },
      });
    }

    return NextResponse.json({ success: true, lead: updatedLead });
  } catch (error: any) {
    console.error('[STATUS_UPDATE_CRASH]:', error);
    return NextResponse.json(
      { error: error.message || 'Veritabanı güncelleme hatası' },
      { status: 500 }
    );
  }
}
