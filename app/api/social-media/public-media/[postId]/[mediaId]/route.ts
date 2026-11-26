import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifySocialMediaSignature } from '@/lib/social-media-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StoredMedia = { id: string; name: string; mimeType: string; size: number };
function isStoredMedia(value: unknown): value is StoredMedia {
  if (!value || typeof value !== 'object') return false;
  const media = value as Record<string, unknown>;
  return typeof media.id === 'string' && typeof media.name === 'string' &&
    typeof media.mimeType === 'string' && typeof media.size === 'number';
}

function notFound() {
  return new NextResponse('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
}

export async function GET(request: Request, { params }: { params: Promise<{ postId: string; mediaId: string }> }) {
  try {
    const { postId, mediaId } = await params;
    const signature = new URL(request.url).searchParams.get('signature') || '';
    if (!/^[a-z0-9_-]{1,64}$/i.test(postId) || !/^[0-9a-f-]{36}$/i.test(mediaId) ||
      !verifySocialMediaSignature(postId, mediaId, signature)) return notFound();

    const post = await prisma.socialPost.findUnique({ where: { id: postId }, select: { media: true, status: true } });
    if (!post || post.status !== 'SCHEDULED' || !Array.isArray(post.media)) return notFound();
    const media = post.media.find(item => isStoredMedia(item) && item.id === mediaId);
    if (!isStoredMedia(media)) return notFound();
    const allowedTypes = new Set(['image/jpeg', 'video/mp4', 'video/quicktime']);
    if (!allowedTypes.has(media.mimeType)) return notFound();

    const root = process.env.UPLOADS_DIR || path.join(process.cwd(), 'storage', 'uploads');
    const file = await readFile(path.join(root, 'social', 'posts', postId, mediaId));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'content-type': media.mimeType,
        'content-length': String(file.byteLength),
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(path.basename(media.name))}`,
        'cache-control': 'private, no-store, max-age=0',
        'x-content-type-options': 'nosniff',
        'x-robots-tag': 'noindex, nofollow'
      }
    });
  } catch {
    return notFound();
  }
}
