import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decryptSocialCredential } from '@/lib/social-media-crypto';
import { requireSocialMediaUser } from '@/lib/social-media-server';

export async function GET(_request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    const user = await requireSocialMediaUser();
    const { accountId } = await params;
    const account = await prisma.socialAccount.findUnique({ where: { id: accountId }, select: { id: true, platform: true, passwordEncrypted: true } });
    if (!account) return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 });
    if (!account.passwordEncrypted) return NextResponse.json({ error: 'هذا الحساب متصل بـMeta ولا تُحفظ له كلمة مرور داخل النظام' }, { status: 409 });
    const password = decryptSocialCredential(account.passwordEncrypted);
    await prisma.auditLog.create({ data: { userId: user.id, action: 'REVEAL_CREDENTIAL', entity: 'SocialAccount', entityId: account.id, metadata: { platform: account.platform } } });
    return NextResponse.json({ password }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'سجّل الدخول أولًا' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح لك بكشف بيانات الدخول' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر كشف كلمة المرور' }, { status: 500 });
  }
}
