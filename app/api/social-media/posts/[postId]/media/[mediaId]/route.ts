import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSocialMediaUser } from '@/lib/social-media-server';

export const runtime = 'nodejs';

type StoredMedia = { id: string; name: string; mimeType: string; size: number };
function isStoredMedia(value: unknown): value is StoredMedia {
  if (!value || typeof value !== 'object') return false;
  const media = value as Record<string, unknown>;
  return typeof media.id === 'string' && typeof media.name === 'string' &&
    typeof media.mimeType === 'string' && typeof media.size === 'number';
}

export async function GET(_request: Request, { params }: { params: Promise<{ postId: string; mediaId: string }> }) {
  try {
    await requireSocialMediaUser();
    const { postId, mediaId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(mediaId)) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
    const post = await prisma.socialPost.findUnique({ where: { id: postId }, select: { media: true } });
    if (!post || !Array.isArray(post.media)) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
    const media = post.media.find(item => isStoredMedia(item) && item.id === mediaId);
    if (!isStoredMedia(media)) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
    const root = process.env.UPLOADS_DIR || path.join(process.cwd(), 'storage', 'uploads');
    const filePath = path.join(root, 'social', 'posts', postId, mediaId);
    const file = await readFile(filePath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'content-type': media.mimeType,
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(media.name)}`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'سجّل الدخول أولًا' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح بفتح مرفقات السوشيال' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر فتح الملف' }, { status: 500 });
  }
}
