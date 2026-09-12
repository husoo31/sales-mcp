import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: 'spark_auth_session',
    value: '',
    httpOnly: true,
    path: '/',
    maxAge: 0 // expire immediately
  });
  return response;
}
