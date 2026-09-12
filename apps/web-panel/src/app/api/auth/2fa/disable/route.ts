import { NextResponse } from 'next/server';
import { PrismaClient } from '@spark/database';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const authSession = (await cookies()).get('spark_auth_session')?.value;
    if (!authSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isTwoFactorEnabled: false }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('2FA Disable error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET() {
  try {
    const authSession = (await cookies()).get('spark_auth_session')?.value;
    if (!authSession) {
      return NextResponse.json({ success: false, isEnabled: false }, { status: 401 });
    }

    const user = await prisma.user.findFirst();
    return NextResponse.json({ 
      success: true, 
      isEnabled: user?.isTwoFactorEnabled || false 
    });
  } catch (error) {
    console.error('2FA Status error:', error);
    return NextResponse.json({ success: false, isEnabled: false }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
