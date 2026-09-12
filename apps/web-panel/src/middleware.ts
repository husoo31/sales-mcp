import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === '/login';
  
  // API endpoints ve login sayfası için authentication check (eğer session/cookie yoksa)
  const authCookie = request.cookies.get('spark_auth_session');

  if (!authCookie && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (authCookie && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|screenshots).*)'],
};
