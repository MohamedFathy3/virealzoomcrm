import { cookies } from 'next/headers';
import { sessionCookie } from '@/lib/auth';
import { redirectToPath } from '@/lib/redirect';

export async function POST(request: Request) {
  const response = redirectToPath('/login');
  response.cookies.set(sessionCookie, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' });
  (await cookies()).delete(sessionCookie);
  return response;
}
