import { NextResponse } from 'next/server';
import { PrismaClient } from '@spark/database';
import { authenticator } from 'otplib';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const authSession = (await cookies()).get('spark_auth_session')?.value;
    if (!authSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
    }

    const user = await prisma.user.findFirst();
    if (!user || !user.twoFactorSecret) {
      return NextResponse.json({ success: false, error: 'Setup 2FA first' }, { status: 400 });
    }

    const isValid = authenticator.check(token, user.twoFactorSecret);
    
    if (isValid) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isTwoFactorEnabled: true }
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid 2FA code' }, { status: 400 });
  } catch (error) {
    console.error('2FA Enable error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
