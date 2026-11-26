import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SocialPlatform } from '@prisma/client';
import { metaGet, metaPost, metaPublicOrigin } from '@/lib/meta-api';
import { createSocialMediaSignature, decryptSocialCredential } from '@/lib/social-media-crypto';

type StoredMedia = { id: string; name: string; mimeType: string; size: number };
type PublishablePost = {
  id: string;
  content: string;
  platform: SocialPlatform;
  clientId: string | null;
  accountId: string | null;
  media: unknown;
  account: null | {
    id: string;
    clientId: string | null;
    platform: SocialPlatform;
    externalAccountId: string | null;
    metaConnectionId: string | null;
    metaConnection: null | {
      clientId: string | null;
      facebookPageId: string;
      pageAccessTokenEncrypted: string;
      instagramAccountId: string | null;
    };
  };
};

type MetaIdResponse = { id?: string; post_id?: string };
type ContainerStatus = { status_code?: string };

function isStoredMedia(value: unknown): value is StoredMedia {
  if (!value || typeof value !== 'object') return false;
  const media = value as Record<string, unknown>;
  return typeof media.id === 'string' && typeof media.name === 'string' &&
    typeof media.mimeType === 'string' && typeof media.size === 'number';
}

async function loadMedia(post: PublishablePost) {
  const entries = Array.isArray(post.media) ? post.media.filter(isStoredMedia) : [];
  if (entries.length > 8) throw new Error('عدد المرفقات يتجاوز الحد المسموح للنشر');
  const root = process.env.UPLOADS_DIR || path.join(process.cwd(), 'storage', 'uploads');
  const loaded = [];
  for (const entry of entries) {
    if (!/^[0-9a-f-]{36}$/i.test(entry.id)) throw new Error('بيانات أحد المرفقات غير صحيحة');
    const bytes = await readFile(path.join(root, 'social', 'posts', post.id, entry.id));
    if (bytes.byteLength !== entry.size) throw new Error('حجم أحد المرفقات لا يطابق بياناته المحفوظة');
    loaded.push({ ...entry, bytes });
  }
  return loaded;
}

function publicMediaUrl(postId: string, mediaId: string) {
  const origin = metaPublicOrigin();
  const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60;
  const signature = createSocialMediaSignature(postId, mediaId, expiresAt);
  const url = new URL(`/api/social-media/public-media/${encodeURIComponent(postId)}/${encodeURIComponent(mediaId)}`, origin);
  url.searchParams.set('signature', signature);
  return url.toString();
}

function assertImageVideoTypes(files: Awaited<ReturnType<typeof loadMedia>>) {
  for (const file of files) {
    if (!['image/jpeg', 'video/mp4', 'video/quicktime'].includes(file.mimeType)) {
      throw new Error('لنشر Instagram استخدم صور JPG أو فيديو MP4/MOV؛ الصيغ الأخرى تبقى محفوظة في التقويم لكنها غير مدعومة من Meta هنا');
    }
  }
}

async function waitForContainer(containerId: string, pageToken: string, graphVersion: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const status = await metaGet<ContainerStatus>(containerId, graphVersion, pageToken, { fields: 'status_code' });
    if (status.status_code === 'FINISHED') return;
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
      throw new Error('Meta لم يتمكن من تجهيز محتوى Instagram. راجع صيغة الملف أو إعداد الحساب.');
    }
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  throw new Error('استغرق تجهيز ملف Instagram أكثر من الوقت المتاح. أعد المحاولة بعد دقائق.');
}

async function publishInstagram(post: PublishablePost, files: Awaited<ReturnType<typeof loadMedia>>, pageToken: string, graphVersion: string) {
  const instagramId = post.account?.externalAccountId;
  if (!instagramId || post.account?.platform !== 'INSTAGRAM' || post.account.metaConnection?.instagramAccountId !== instagramId) {
    throw new Error('حساب Instagram غير مرتبط بصفحة Meta صالحة. أعد ربط الحساب.');
  }
  if (files.length === 0) throw new Error('Instagram يتطلب صورة أو فيديو للنشر.');
  if (post.content.length > 2200) throw new Error('نص Instagram أطول من الحد المتاح البالغ 2200 حرفًا.');
  assertImageVideoTypes(files);

  let creationId: string;
  if (files.length === 1) {
    const file = files[0];
    const form = new URLSearchParams();
    form.set(file.mimeType === 'image/jpeg' ? 'image_url' : 'video_url', publicMediaUrl(post.id, file.id));
    if (file.mimeType !== 'image/jpeg') form.set('media_type', 'REELS');
    form.set('caption', post.content);
    const container = await metaPost<MetaIdResponse>(`${instagramId}/media`, graphVersion, pageToken, form);
    if (!container.id) throw new Error('Meta لم يُرجع رقم ملف Instagram.');
    creationId = container.id;
  } else {
    if (files.length > 20) throw new Error('منشور Carousel في Instagram يقبل بحد أقصى 20 ملفًا.');
    const childIds: string[] = [];
    for (const file of files) {
      const child = new URLSearchParams();
      child.set(file.mimeType === 'image/jpeg' ? 'image_url' : 'video_url', publicMediaUrl(post.id, file.id));
      child.set('is_carousel_item', 'true');
      if (file.mimeType !== 'image/jpeg') child.set('media_type', 'VIDEO');
      const response = await metaPost<MetaIdResponse>(`${instagramId}/media`, graphVersion, pageToken, child);
      if (!response.id) throw new Error('Meta لم يُرجع رقم أحد عناصر Carousel.');
      await waitForContainer(response.id, pageToken, graphVersion);
      childIds.push(response.id);
    }
    const carousel = new URLSearchParams();
    carousel.set('media_type', 'CAROUSEL');
    carousel.set('children', childIds.join(','));
    carousel.set('caption', post.content);
    const response = await metaPost<MetaIdResponse>(`${instagramId}/media`, graphVersion, pageToken, carousel);
    if (!response.id) throw new Error('Meta لم يُرجع رقم Carousel.');
    creationId = response.id;
  }

  await waitForContainer(creationId, pageToken, graphVersion);
  const publishBody = new URLSearchParams({ creation_id: creationId });
  const published = await metaPost<MetaIdResponse>(`${instagramId}/media_publish`, graphVersion, pageToken, publishBody);
  if (!published.id) throw new Error('Meta لم يؤكد نشر محتوى Instagram.');
  return published.id;
}

async function publishFacebook(post: PublishablePost, files: Awaited<ReturnType<typeof loadMedia>>, pageToken: string, graphVersion: string) {
  const pageId = post.account?.metaConnection?.facebookPageId;
  if (!pageId || post.account?.platform !== 'FACEBOOK' || post.account.externalAccountId !== pageId) {
    throw new Error('حساب Facebook غير مرتبط بصفحة Meta صالحة. أعد ربط الحساب.');
  }
  if (files.some(file => !['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime'].includes(file.mimeType))) {
    throw new Error('صيغة أحد الملفات غير مدعومة للنشر على Facebook.');
  }
  if (files.some(file => file.mimeType.startsWith('video/')) && files.length > 1) {
    throw new Error('انشر فيديو Facebook في منشور منفصل عن الصور.');
  }

  if (files.length === 1 && files[0].mimeType.startsWith('video/')) {
    const file = files[0];
    const form = new FormData();
    form.set('source', new Blob([new Uint8Array(file.bytes)], { type: file.mimeType }), path.basename(file.name));
    form.set('description', post.content);
    const response = await metaPost<MetaIdResponse>(`${pageId}/videos`, graphVersion, pageToken, form);
    if (!response.id) throw new Error('Meta لم يؤكد نشر فيديو Facebook.');
    return response.id;
  }

  if (files.length === 1 && files[0].mimeType.startsWith('image/')) {
    const file = files[0];
    const form = new FormData();
    form.set('source', new Blob([new Uint8Array(file.bytes)], { type: file.mimeType }), path.basename(file.name));
    form.set('message', post.content);
    const response = await metaPost<MetaIdResponse>(`${pageId}/photos`, graphVersion, pageToken, form);
    const externalId = response.post_id || response.id;
    if (!externalId) throw new Error('Meta لم يؤكد نشر صورة Facebook.');
    return externalId;
  }

  if (files.length > 1) {
    const photoIds: string[] = [];
    for (const file of files) {
      if (!file.mimeType.startsWith('image/')) throw new Error('انشر مجموعة صور Facebook دون فيديو في المنشور نفسه.');
      const form = new FormData();
      form.set('source', new Blob([new Uint8Array(file.bytes)], { type: file.mimeType }), path.basename(file.name));
      form.set('published', 'false');
      const uploaded = await metaPost<MetaIdResponse>(`${pageId}/photos`, graphVersion, pageToken, form);
      if (!uploaded.id) throw new Error('Meta لم يقبل إحدى صور المنشور.');
      photoIds.push(uploaded.id);
    }
    const feed = new URLSearchParams({ message: post.content });
    photoIds.forEach((id, index) => feed.set(`attached_media[${index}]`, JSON.stringify({ media_fbid: id })));
    const published = await metaPost<MetaIdResponse>(`${pageId}/feed`, graphVersion, pageToken, feed);
    if (!published.id) throw new Error('Meta لم يؤكد نشر منشور الصور على Facebook.');
    return published.id;
  }

  const feed = new URLSearchParams({ message: post.content });
  const published = await metaPost<MetaIdResponse>(`${pageId}/feed`, graphVersion, pageToken, feed);
  if (!published.id) throw new Error('Meta لم يؤكد نشر منشور Facebook.');
  return published.id;
}

export async function publishMetaContent(post: PublishablePost) {
  const connection = post.account?.metaConnection;
  if (!connection || !post.account?.metaConnectionId) throw new Error('الحساب غير متصل بـMeta.');
  if (connection.clientId !== post.clientId || post.account.clientId !== post.clientId) {
    throw new Error('حساب المنصة لا يطابق مالك المنشور.');
  }
  if (!['FACEBOOK', 'INSTAGRAM'].includes(post.platform) || post.account.platform !== post.platform) {
    throw new Error('النشر عبر Meta متاح فقط لحساب Facebook أو Instagram المتصل.');
  }
  const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || 'v27.0';
  if (!/^v\d+\.\d+$/.test(graphVersion)) throw new Error('إعداد إصدار Meta API غير صحيح.');
  const pageToken = decryptSocialCredential(connection.pageAccessTokenEncrypted);
  const files = await loadMedia(post);
  return post.platform === 'INSTAGRAM'
    ? publishInstagram(post, files, pageToken, graphVersion)
    : publishFacebook(post, files, pageToken, graphVersion);
}
