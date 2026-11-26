import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSocialMediaUser } from '@/lib/social-media-server';

const schema = z.object({ status: z.enum(['PUBLISHED', 'CANCELLED']) });

export async function PATCH(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const user = await requireSocialMediaUser();
    const { postId } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'الحالة المطلوبة غير صحيحة' }, { status: 400 });
    const existing = await prisma.socialPost.findUnique({ where: { id: postId }, select: { id: true, status: true, platform: true, publishingAt: true } });
    if (!existing) return NextResponse.json({ error: 'المنشور غير موجود' }, { status: 404 });
    if (existing.publishingAt) return NextResponse.json({ error: 'هناك محاولة نشر خارجية جارية؛ انتظر حتى تنتهي' }, { status: 409 });
    if (existing.status !== 'SCHEDULED') return NextResponse.json({ error: 'لا يمكن تغيير منشور تم نشره أو إلغاؤه' }, { status: 409 });
    const post = await prisma.socialPost.update({
      where: { id: postId },
      data: { status: parsed.data.status, publishedAt: parsed.data.status === 'PUBLISHED' ? new Date() : null },
      select: { id: true, status: true, publishedAt: true }
    });
    await prisma.auditLog.create({ data: { userId: user.id, action: parsed.data.status, entity: 'SocialPost', entityId: postId, metadata: { platform: existing.platform } } });
    return NextResponse.json({ ok: true, post });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'سجّل الدخول أولًا' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح لك بتحديث حالة المنشور' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر تحديث المنشور' }, { status: 500 });
  }
}
