import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.set(sessionCookie, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' });
  (await cookies()).delete(sessionCookie);
  return response;
}
