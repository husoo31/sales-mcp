import { NextResponse } from 'next/server';
import { PrismaClient } from '@spark/database';
import { authenticator } from 'otplib';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
    }

    const user = await prisma.user.findFirst();
    if (!user || !user.twoFactorSecret || !user.isTwoFactorEnabled) {
      return NextResponse.json({ success: false, error: '2FA is not enabled or setup correctly' }, { status: 400 });
    }

    const isValid = authenticator.check(token, user.twoFactorSecret);
    
    if (isValid) {
      const response = NextResponse.json({ success: true });
      response.cookies.set({
        name: 'spark_auth_session',
        value: 'true',
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7
      });
      return response;
    }

    return NextResponse.json({ success: false, error: 'Invalid 2FA code' }, { status: 401 });
  } catch (error) {
    console.error('2FA Verify error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
