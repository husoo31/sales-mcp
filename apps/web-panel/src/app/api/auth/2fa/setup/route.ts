import { NextResponse } from 'next/server';
import { PrismaClient } from '@spark/database';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const authSession = (await cookies()).get('spark_auth_session')?.value;
    if (!authSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Generate new secret for setup
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'Spark Platform', secret);
    
    // Generate QR code Data-URI
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

    // Temporarily store secret in user record (but don't enable yet)
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret }
    });

    return NextResponse.json({ 
      success: true, 
      secret, 
      qrCode: qrCodeDataUrl 
    });
  } catch (error) {
    console.error('2FA Setup error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
