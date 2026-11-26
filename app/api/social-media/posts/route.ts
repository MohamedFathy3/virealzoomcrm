import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { SocialPlatform } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireSocialMediaUser } from '@/lib/social-media-server';
import { SOCIAL_PLATFORM_KEYS } from '@/lib/social-media-constants';

export const runtime = 'nodejs';

const maxFileSize = 30 * 1024 * 1024;
const maxTotalSize = 60 * 1024 * 1024;
const maxFiles = 8;
const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']);

type StoredMedia = { id: string; name: string; mimeType: string; size: number };

function matchesFileSignature(type: string, bytes: Buffer) {
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (type === 'image/gif') return ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString());
  if (type === 'video/mp4' || type === 'video/quicktime') return bytes.subarray(4, 8).toString() === 'ftyp';
  if (type === 'video/webm') return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return false;
}

function postSelect() {
  return {
    id: true,
    clientId: true,
    accountId: true,
    platform: true,
    title: true,
    content: true,
    scheduledAt: true,
    status: true,
    publishedAt: true,
    publishingAt: true,
    externalPostId: true,
    publishError: true,
    media: true,
    client: { select: { id: true, name: true } },
    account: { select: { id: true, displayName: true, username: true, platform: true, metaConnectionId: true } },
    createdAt: true,
    updatedAt: true
  } as const;
}

export async function GET(request: Request) {
  try {
    await requireSocialMediaUser();
    const url = new URL(request.url);
    const fromValue = url.searchParams.get('from');
    const toValue = url.searchParams.get('to');
    const clientId = url.searchParams.get('clientId');
    const from = fromValue ? new Date(fromValue) : null;
    const to = toValue ? new Date(toValue) : null;
    if ((fromValue && Number.isNaN(from?.getTime())) || (toValue && Number.isNaN(to?.getTime()))) {
      return NextResponse.json({ error: 'نطاق التاريخ غير صحيح' }, { status: 400 });
    }
    const posts = await prisma.socialPost.findMany({
      where: {
        ...(clientId ? { clientId } : {}),
        ...((from || to) ? { scheduledAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {})
      },
      select: postSelect(),
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      take: 500
    });
    return NextResponse.json({ posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'سجّل الدخول أولًا' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح لك برؤية تقويم السوشيال' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر تحميل المنشورات' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const savedFiles: string[] = [];
  let createdPostId: string | null = null;
  try {
    const user = await requireSocialMediaUser();
    const form = await request.formData();
    const clientIdValue = String(form.get('clientId') || '').trim();
    const accountIdValue = String(form.get('accountId') || '').trim();
    const platform = String(form.get('platform') || '').trim();
    const title = String(form.get('title') || '').trim();
    const content = String(form.get('content') || '').trim();
    const scheduledAtValue = String(form.get('scheduledAt') || '').trim();
    const clientId = clientIdValue || null;
    const accountId = accountIdValue || null;
    const scheduledAt = new Date(scheduledAtValue);
    if (!SOCIAL_PLATFORM_KEYS.includes(platform as typeof SOCIAL_PLATFORM_KEYS[number])) {
      return NextResponse.json({ error: 'اختَر منصة تواصل صحيحة' }, { status: 400 });
    }
    if (!content || Buffer.byteLength(content, 'utf8') > 60000) return NextResponse.json({ error: 'اكتب محتوى المنشور بحد أقصى 60 ألف بايت' }, { status: 400 });
    if (title.length > 191) return NextResponse.json({ error: 'عنوان المنشور طويل جدًا' }, { status: 400 });
    if (!scheduledAtValue || Number.isNaN(scheduledAt.getTime())) return NextResponse.json({ error: 'موعد النشر غير صحيح' }, { status: 400 });

    if (clientId && !(await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }))) {
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    }
    if (accountId) {
      const account = await prisma.socialAccount.findUnique({ where: { id: accountId }, select: { id: true, clientId: true, platform: true } });
      if (!account) return NextResponse.json({ error: 'حساب التواصل غير موجود' }, { status: 404 });
      if (account.clientId !== clientId || account.platform !== platform) {
        return NextResponse.json({ error: 'الحساب المختار لا يتبع نفس العميل أو المنصة' }, { status: 400 });
      }
    }

    const uploads = form.getAll('media').filter((file): file is File => file instanceof File && file.size > 0);
    if (uploads.length > maxFiles) return NextResponse.json({ error: `الحد الأقصى ${maxFiles} ملفات للمنشور` }, { status: 400 });
    if (uploads.some(file => !allowedTypes.has(file.type))) return NextResponse.json({ error: 'المسموح صور PNG/JPG/WEBP/GIF وفيديو MP4/WEBM/MOV' }, { status: 415 });
    if (uploads.some(file => file.size > maxFileSize)) return NextResponse.json({ error: 'حجم الملف الواحد يجب ألا يتجاوز 30MB' }, { status: 413 });
    const fileUploads = await Promise.all(uploads.map(async file => ({ file, bytes: Buffer.from(await file.arrayBuffer()) })));
    if (fileUploads.some(({ file, bytes }) => !matchesFileSignature(file.type, bytes))) {
      return NextResponse.json({ error: 'محتوى أحد الملفات لا يطابق نوعه' }, { status: 415 });
    }
    if (fileUploads.reduce((sum, item) => sum + item.file.size, 0) > maxTotalSize) {
      return NextResponse.json({ error: 'إجمالي المرفقات يجب ألا يتجاوز 60MB' }, { status: 413 });
    }

    const post = await prisma.socialPost.create({
      data: {
        clientId,
        accountId,
        platform: platform as SocialPlatform,
        title: title || null,
        content,
        scheduledAt,
        status: 'SCHEDULED',
        createdById: user.id,
        media: []
      },
      select: { id: true }
    });
    createdPostId = post.id;
    const directory = path.join(process.env.UPLOADS_DIR || path.join(process.cwd(), 'storage', 'uploads'), 'social', 'posts', post.id);
    await mkdir(directory, { recursive: true });
    const media: StoredMedia[] = [];
    for (const { file, bytes } of fileUploads) {
      const id = randomUUID();
      const destination = path.join(directory, id);
      await writeFile(destination, bytes, { flag: 'wx' });
      savedFiles.push(destination);
      media.push({ id, name: path.basename(file.name).slice(0, 180), mimeType: file.type, size: file.size });
    }
    const savedPost = await prisma.socialPost.update({ where: { id: post.id }, data: { media }, select: postSelect() });
    await prisma.auditLog.create({ data: { userId: user.id, action: 'CREATE', entity: 'SocialPost', entityId: post.id, metadata: { platform, owner: clientId ? 'CLIENT' : 'VIRAL_ZOOM', mediaCount: media.length } } });
    return NextResponse.json({ ok: true, post: savedPost }, { status: 201 });
  } catch (error) {
    await Promise.all(savedFiles.map(async file => {
      try { await unlink(file); } catch (cleanupError) { console.error('Unable to remove an uncommitted social upload', cleanupError); }
    }));
    if (createdPostId) {
      try { await prisma.socialPost.delete({ where: { id: createdPostId } }); } catch (cleanupError) { console.error('Unable to remove an uncommitted social post', cleanupError); }
    }
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'سجّل الدخول أولًا' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح لك بإضافة منشورات' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر حفظ المنشور؛ تحقق من اتصال قاعدة البيانات ومجلد التخزين' }, { status: 500 });
  }
}
