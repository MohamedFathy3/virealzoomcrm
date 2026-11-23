import { cookies } from 'next/headers';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { prisma } from './db';
import type { Role, User } from '@prisma/client';

const sessionCookie = 'viralzoom_session';
const secret = () => {
  const value = process.env.APP_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('APP_SESSION_SECRET must contain at least 32 characters');
  return new TextEncoder().encode(value);
};

export type SessionUser = Pick<User, 'id' | 'openId' | 'email' | 'name' | 'role' | 'isActive'> & { departmentName: string | null };

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored?: string | null) {
  if (!stored?.startsWith('scrypt:')) return false;
  const [, salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return expectedBuffer.length === actual.length && timingSafeEqual(actual, expectedBuffer);
}

export async function readSession() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    const userId = String(payload.sub ?? '');
    return userId ? { userId } : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await readSession();
  if (!session?.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      openId: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      employee: { select: { department: { select: { name: true } } } }
    }
  });
  if (!user || !user.isActive) return null;
  const { employee, ...sessionUser } = user;
  return { ...sessionUser, departmentName: employee?.department.name ?? null };
}

export async function requireUser(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  if (roles && !roles.includes(user.role)) throw new Error('FORBIDDEN');
  return user;
}

export async function signSession(user: Pick<User, 'id'>) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret());
}

export { sessionCookie };
