import { NextResponse } from 'next/server';
import { PrismaClient } from '@spark/database';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    // Fallback if DB is empty or missing user, though we seeded it
    const validPasswordFallback = process.env.ADMIN_PASSWORD || 'admin123';
    
    const user = await prisma.user.findFirst();
    if (!user || !user.passwordHash) {
      // Fallback logic
      if (password === validPasswordFallback) {
        const response = NextResponse.json({ success: true, requires2FA: false });
        response.cookies.set({
          name: 'spark_auth_session',
          value: 'true',
          httpOnly: true,
          path: '/',
          maxAge: 60 * 60 * 24 * 7
        });
        return response;
      }
      return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
    }

    // Verify bcrypt hash
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (isValid) {
      if (user.isTwoFactorEnabled) {
        // Require 2FA, do NOT set cookie yet
        return NextResponse.json({ success: true, requires2FA: true });
      } else {
        // Log in immediately
        const response = NextResponse.json({ success: true, requires2FA: false });
        response.cookies.set({
          name: 'spark_auth_session',
          value: 'true',
          httpOnly: true,
          path: '/',
          maxAge: 60 * 60 * 24 * 7
        });
        return response;
      }
    }

    return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
