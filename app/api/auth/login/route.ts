import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sessionCookie, signSession, verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return NextResponse.redirect(new URL('/login?error=missing', request.url));

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.redirect(new URL('/login?error=invalid', request.url));
  }

  const signed = await signSession(user);
  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set(sessionCookie, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return response;
}
