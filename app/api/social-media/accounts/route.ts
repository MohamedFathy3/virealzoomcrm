import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { encryptSocialCredential } from '@/lib/social-media-crypto';
import { requireSocialMediaUser } from '@/lib/social-media-server';
import { SOCIAL_PLATFORM_KEYS } from '@/lib/social-media-constants';

const accountSchema = z.object({
  clientId: z.string().optional(),
  platform: z.enum(SOCIAL_PLATFORM_KEYS as [typeof SOCIAL_PLATFORM_KEYS[number], ...typeof SOCIAL_PLATFORM_KEYS[number][]]),
  displayName: z.string().trim().max(191).optional(),
  username: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(1024),
  profileUrl: z.string().trim().max(2048).optional().or(z.literal('')),
  notes: z.string().max(5000).optional()
});

const accountSelect = {
  id: true,
  clientId: true,
  platform: true,
  displayName: true,
  username: true,
  profileUrl: true,
  notes: true,
  metaConnectionId: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } }
} as const;

function isHttpUrl(value: string) {
  if (!value) return true;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

export async function GET() {
  try {
    await requireSocialMediaUser();
    const accounts = await prisma.socialAccount.findMany({
      select: accountSelect,
      orderBy: [{ client: { name: 'asc' } }, { platform: 'asc' }, { displayName: 'asc' }]
    });
    return NextResponse.json({ accounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'سجّل الدخول أولًا' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح لك بإدارة حسابات السوشيال' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر تحميل حسابات التواصل' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSocialMediaUser();
    const parsed = accountSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'راجع اسم المستخدم وكلمة المرور والمنصة' }, { status: 400 });
    const data = parsed.data;
    if (!isHttpUrl(data.profileUrl || '')) return NextResponse.json({ error: 'رابط الحساب يجب أن يبدأ بـ HTTP أو HTTPS' }, { status: 400 });
    const clientId = data.clientId || null;
    if (clientId && !(await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }))) {
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    }
    const account = await prisma.socialAccount.create({
      data: {
        clientId,
        platform: data.platform,
        displayName: data.displayName?.trim() || null,
        username: data.username,
        passwordEncrypted: encryptSocialCredential(data.password),
        profileUrl: data.profileUrl || null,
        notes: data.notes?.trim() || null,
        createdById: user.id
      },
      select: accountSelect
    });
    await prisma.auditLog.create({ data: { userId: user.id, action: 'CREATE', entity: 'SocialAccount', entityId: account.id, metadata: { platform: account.platform, owner: clientId ? 'CLIENT' : 'VIRAL_ZOOM' } } });
    return NextResponse.json({ ok: true, account }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'سجّل الدخول أولًا' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح لك بإضافة حسابات' }, { status: 403 });
    if (message.includes('APP_SESSION_SECRET')) return NextResponse.json({ error: 'إعداد APP_SESSION_SECRET غير صالح لحماية كلمة المرور' }, { status: 500 });
    return NextResponse.json({ error: 'تعذر حفظ الحساب' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireSocialMediaUser();
    const schema = accountSchema.omit({ clientId: true, platform: true }).extend({ password: z.string().max(1024).optional().or(z.literal('')) });
    const body = await request.json() as { id?: string } & Record<string, unknown>;
    const parsed = schema.safeParse(body);
    if (!parsed.success || typeof body.id !== 'string') return NextResponse.json({ error: 'بيانات تعديل الحساب غير مكتملة' }, { status: 400 });
    if (!isHttpUrl(parsed.data.profileUrl || '')) return NextResponse.json({ error: 'رابط الحساب يجب أن يبدأ بـ HTTP أو HTTPS' }, { status: 400 });
    const exists = await prisma.socialAccount.findUnique({ where: { id: body.id }, select: { id: true, metaConnectionId: true } });
    if (!exists) return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 });
    if (exists.metaConnectionId) return NextResponse.json({ error: 'يتم تحديث الحساب المتصل عبر إعادة ربط Meta' }, { status: 409 });
    const account = await prisma.socialAccount.update({
      where: { id: body.id },
      data: {
        displayName: parsed.data.displayName?.trim() || null,
        username: parsed.data.username,
        profileUrl: parsed.data.profileUrl || null,
        notes: parsed.data.notes?.trim() || null,
        ...(parsed.data.password ? { passwordEncrypted: encryptSocialCredential(parsed.data.password) } : {})
      },
      select: accountSelect
    });
    await prisma.auditLog.create({ data: { userId: user.id, action: 'UPDATE', entity: 'SocialAccount', entityId: account.id, metadata: { platform: account.platform, passwordChanged: Boolean(parsed.data.password) } } });
    return NextResponse.json({ ok: true, account });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'سجّل الدخول أولًا' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح لك بتعديل الحسابات' }, { status: 403 });
    if (message.includes('APP_SESSION_SECRET')) return NextResponse.json({ error: 'إعداد APP_SESSION_SECRET غير صالح لحماية كلمة المرور' }, { status: 500 });
    return NextResponse.json({ error: 'تعذر تعديل الحساب' }, { status: 500 });
  }
}
