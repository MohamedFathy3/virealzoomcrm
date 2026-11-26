import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { publishMetaContent } from '@/lib/meta-publishing';
import { requireSocialMediaUser } from '@/lib/social-media-server';

export const runtime = 'nodejs';
export const maxDuration = 60;

function safeError(error: unknown) {
  const raw = error instanceof Error ? error.message : 'تعذر إتمام النشر عبر Meta.';
  const message = raw.replace(/\bEA[A-Za-z0-9]{20,}\b/g, '[token]').slice(0, 500);
  return message.startsWith('META_API_ERROR:') ? `رد Meta: ${message.slice('META_API_ERROR:'.length)}` : message;
}

export async function POST(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  let postId = '';
  let userId = '';
  try {
    const user = await requireSocialMediaUser();
    userId = user.id;
    postId = (await params).postId;
    const post = await prisma.socialPost.findUnique({
      where: { id: postId },
      include: {
        account: {
          include: {
            metaConnection: {
              select: {
                id: true,
                clientId: true,
                facebookPageId: true,
                pageAccessTokenEncrypted: true,
                instagramAccountId: true
              }
            }
          }
        }
      }
    });
    if (!post) return NextResponse.json({ error: 'المنشور غير موجود' }, { status: 404 });
    if (post.status !== 'SCHEDULED' || post.publishedAt || post.externalPostId) {
      return NextResponse.json({ error: 'هذا المنشور ليس في حالة تسمح بالنشر' }, { status: 409 });
    }

    const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
    const claim = await prisma.socialPost.updateMany({
      where: {
        id: post.id,
        status: 'SCHEDULED',
        publishedAt: null,
        externalPostId: null,
        OR: [{ publishingAt: null }, { publishingAt: { lt: staleBefore } }]
      },
      data: { publishingAt: new Date(), publishError: null }
    });
    if (claim.count !== 1) return NextResponse.json({ error: 'هناك محاولة نشر أخرى جارية لهذا المنشور؛ انتظر قليلًا.' }, { status: 409 });

    try {
      const externalPostId = await publishMetaContent(post);
      const publishedAt = new Date();
      const updated = await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: 'PUBLISHED', publishedAt, externalPostId, publishingAt: null, publishError: null },
        select: { id: true, status: true, publishedAt: true, externalPostId: true }
      });
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'META_PUBLISH',
          entity: 'SocialPost',
          entityId: post.id,
          metadata: { platform: post.platform, externalPostId }
        }
      });
      return NextResponse.json({ ok: true, post: updated });
    } catch (publishError) {
      const message = safeError(publishError);
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { publishingAt: null, publishError: message }
      });
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'META_PUBLISH_FAILED',
          entity: 'SocialPost',
          entityId: post.id,
          metadata: { platform: post.platform, reason: message.slice(0, 255) }
        }
      });
      return NextResponse.json({ error: message }, { status: 502 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'سجّل الدخول أولًا' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح لك بالنشر عبر Meta' }, { status: 403 });
    if (message.includes('APP_SESSION_SECRET')) return NextResponse.json({ error: 'إعداد APP_SESSION_SECRET غير صالح لفك تشفير ربط Meta' }, { status: 500 });
    if (postId) {
      try {
        await prisma.socialPost.updateMany({ where: { id: postId, status: 'SCHEDULED' }, data: { publishingAt: null, publishError: safeError(error) } });
      } catch { /* preserve the original request error */ }
    }
    if (userId) return NextResponse.json({ error: safeError(error) }, { status: 502 });
    return NextResponse.json({ error: 'تعذر تنفيذ النشر عبر Meta' }, { status: 500 });
  }
}
