import { prisma } from '@/lib/db';
import { sessionCookie, signSession, verifyPassword } from '@/lib/auth';
import { redirectToPath } from '@/lib/redirect';

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return redirectToPath('/login?error=missing');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return redirectToPath('/login?error=invalid');
  }

  const signed = await signSession(user);
  const response = redirectToPath('/');
  response.cookies.set(sessionCookie, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return response;
}
