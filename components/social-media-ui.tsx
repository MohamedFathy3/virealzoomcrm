'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Check, Eye, EyeOff, ExternalLink, Image as ImageIcon, LockKeyhole, Pencil, Video, Send } from 'lucide-react';
import { SOCIAL_PLATFORMS, SOCIAL_POST_STATUS_LABELS, type SocialPlatformKey } from '@/lib/social-media-constants';

export type SocialClientOption = { id: string; name: string };
export type SocialAccountView = {
  id: string;
  clientId: string | null;
  platform: SocialPlatformKey;
  displayName: string | null;
  username: string;
  profileUrl: string | null;
  notes: string | null;
  metaConnectionId: string | null;
  client: SocialClientOption | null;
};
export type SocialMediaFile = { id: string; name: string; mimeType: string; size: number };
export type SocialPostView = {
  id: string;
  clientId: string | null;
  accountId: string | null;
  platform: SocialPlatformKey;
  title: string | null;
  content: string;
  scheduledAt: string;
  status: keyof typeof SOCIAL_POST_STATUS_LABELS;
  publishedAt: string | null;
  publishingAt: string | null;
  externalPostId: string | null;
  publishError: string | null;
  media: unknown;
  client: SocialClientOption | null;
  account: { id: string; displayName: string | null; username: string; platform: SocialPlatformKey; metaConnectionId: string | null } | null;
};

export function socialMediaFiles(value: unknown): SocialMediaFile[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SocialMediaFile => Boolean(item && typeof item === 'object' &&
    typeof (item as Record<string, unknown>).id === 'string' &&
    typeof (item as Record<string, unknown>).name === 'string' &&
    typeof (item as Record<string, unknown>).mimeType === 'string' &&
    typeof (item as Record<string, unknown>).size === 'number'));
}

export function socialDate(value: string | Date, includeTime = false) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('ar-EG', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }
    : { dateStyle: 'medium', timeZone: 'Africa/Cairo' }).format(date);
}

function cairoDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function SocialAccountCards({ accounts, onEdit }: { accounts: SocialAccountView[]; onEdit?: (account: SocialAccountView) => void }) {
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const togglePassword = async (account: SocialAccountView) => {
    if (revealed[account.id] !== undefined) {
      setRevealed(current => { const next = { ...current }; delete next[account.id]; return next; });
      return;
    }
    setLoadingId(account.id);
    setError('');
    try {
      const response = await fetch(`/api/social-media/accounts/${account.id}/password`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر كشف كلمة المرور');
      setRevealed(current => ({ ...current, [account.id]: String(data.password) }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر كشف كلمة المرور');
    } finally {
      setLoadingId(null);
    }
  };

  if (!accounts.length) return <div className="rounded-xl border border-dashed border-[#e8e2f0] px-4 py-7 text-center text-xs text-[#8a8396]">لا توجد حسابات تواصل مسجلة هنا حتى الآن.</div>;
  return <div className="space-y-3">
    {error && <p role="alert" className="text-xs font-bold text-[#af3f53]">{error}</p>}
    {accounts.map(account => <article key={account.id} className="rounded-2xl border border-[#eeeaf4] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-[#f0ebff] px-2 py-1 text-[10px] font-black text-[#6245ad]">{SOCIAL_PLATFORMS[account.platform]}</span>{account.metaConnectionId && <span className="rounded-lg bg-[#eaf8f1] px-2 py-1 text-[10px] font-bold text-[#217a5a]">متصل عبر Meta</span>}<span className="font-black text-[#241744]">{account.displayName || account.username}</span></div>
          <div className="mt-2 text-xs text-[#625c6d]">اسم الحساب: <b dir="ltr">{account.username}</b></div>
          {account.metaConnectionId
            ? <div className="mt-1 flex items-center gap-1 text-[11px] text-[#217a5a]"><LockKeyhole size={12} /> التفويض محفوظ مشفرًا في النظام؛ لا تُخزن كلمة مرور المنصة.</div>
            : <div className="mt-1 flex items-center gap-1 text-[11px] text-[#8a8396]"><LockKeyhole size={12} /> كلمة المرور: <span dir="ltr" className="font-mono">{revealed[account.id] ?? '••••••••••••'}</span></div>}
          <div className="mt-1 text-[10px] text-[#a29aaa]">{account.client?.name || 'حساب شركة Viral Zoom'}</div>
          {account.notes && <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-[#756f82]">{account.notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!account.metaConnectionId && <button type="button" onClick={() => void togglePassword(account)} disabled={loadingId === account.id} className="inline-flex items-center gap-1 rounded-lg border border-[#ece9f2] px-2.5 py-2 text-[10px] font-bold text-[#6245ad] disabled:opacity-50">{revealed[account.id] !== undefined ? <EyeOff size={13} /> : <Eye size={13} />}{loadingId === account.id ? 'جارٍ التحميل' : revealed[account.id] !== undefined ? 'إخفاء' : 'كشف كلمة المرور'}</button>}
          {onEdit && !account.metaConnectionId && <button type="button" onClick={() => onEdit(account)} aria-label="تعديل بيانات الحساب" title="تعديل بيانات الحساب" className="rounded-lg border border-[#ece9f2] p-2 text-[#625c6d]"><Pencil size={14} /></button>}
          {account.profileUrl && <a href={account.profileUrl} target="_blank" rel="noreferrer" aria-label="فتح الحساب على المنصة" title="فتح الحساب على المنصة" className="rounded-lg border border-[#ece9f2] p-2 text-[#625c6d]"><ExternalLink size={14} /></a>}
        </div>
      </div>
    </article>)}
  </div>;
}

export function SocialPostCard({ post, onStatusChange, onPublishNow, publishing = false, compact = false }: {
  post: SocialPostView;
  onStatusChange?: (post: SocialPostView, status: 'PUBLISHED' | 'CANCELLED') => void;
  onPublishNow?: (post: SocialPostView) => void;
  publishing?: boolean;
  compact?: boolean;
}) {
  const media = socialMediaFiles(post.media);
  const overdue = post.status === 'SCHEDULED' && cairoDateKey(post.scheduledAt) < cairoDateKey(new Date());
  const metaReady = Boolean(post.account?.metaConnectionId && ['FACEBOOK', 'INSTAGRAM'].includes(post.platform));
  return <article className={`rounded-2xl border border-[#eeeaf4] bg-white ${compact ? 'p-3' : 'p-4'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-[#f0ebff] px-2 py-1 text-[10px] font-black text-[#6245ad]">{SOCIAL_PLATFORMS[post.platform]}</span><span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${post.status === 'PUBLISHED' ? 'bg-[#eaf8f1] text-[#217a5a]' : post.status === 'CANCELLED' ? 'bg-[#f3f1f5] text-[#756f82]' : overdue ? 'bg-[#fff0f3] text-[#af3f53]' : 'bg-[#fff6df] text-[#9c6a11]'}`}>{overdue ? 'متأخر — بانتظار التأكيد' : SOCIAL_POST_STATUS_LABELS[post.status]}</span>{post.publishingAt && <span className="text-[10px] font-bold text-[#9c6a11]">محاولة نشر جارية</span>}</div>
        {post.title && <h3 className="mt-2 font-black text-[#241744]">{post.title}</h3>}
        <p className={`mt-2 whitespace-pre-wrap text-xs leading-6 text-[#625c6d] ${compact ? 'line-clamp-3' : ''}`}>{post.content}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#8a8396]"><span>{post.client?.name || 'Viral Zoom'}</span><span>{socialDate(post.scheduledAt, true)}</span>{post.account && <span dir="ltr">{post.account.displayName || post.account.username}</span>}</div>
        {post.publishError && post.status === 'SCHEDULED' && <p role="alert" className="mt-2 rounded-lg bg-[#fff0f3] px-2.5 py-2 text-[10px] leading-5 text-[#af3f53]">آخر محاولة Meta: {post.publishError}</p>}
        {post.externalPostId && <p className="mt-1 text-[10px] text-[#217a5a]">معرّف المنشور في Meta: <span dir="ltr">{post.externalPostId}</span></p>}
      </div>
      {post.status === 'SCHEDULED' && <div className="flex shrink-0 flex-wrap gap-2">
        {onPublishNow && metaReady && <button type="button" onClick={() => onPublishNow(post)} disabled={publishing || Boolean(post.publishingAt)} className="inline-flex items-center gap-1 rounded-lg bg-[#6245ad] px-2.5 py-2 text-[10px] font-bold text-white disabled:opacity-50"><Send size={13} />{publishing || post.publishingAt ? 'جارٍ النشر' : 'نشر الآن عبر Meta'}</button>}
        {onStatusChange && <button type="button" onClick={() => onStatusChange(post, 'PUBLISHED')} disabled={Boolean(post.publishingAt)} className="inline-flex items-center gap-1 rounded-lg bg-[#eaf8f1] px-2.5 py-2 text-[10px] font-bold text-[#217a5a] disabled:opacity-50"><Check size={13} />تم النشر يدويًا</button>}
        {onStatusChange && <button type="button" onClick={() => onStatusChange(post, 'CANCELLED')} disabled={Boolean(post.publishingAt)} className="rounded-lg px-2 py-2 text-[10px] font-bold text-[#8a8396] disabled:opacity-50">إلغاء</button>}
      </div>}
    </div>
    {media.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{media.map(file => {
      const src = `/api/social-media/posts/${post.id}/media/${file.id}`;
      return file.mimeType.startsWith('video/')
        ? <div key={file.id} className="overflow-hidden rounded-xl bg-[#171421]"><video src={src} controls preload="metadata" className="max-h-48 w-full" aria-label={file.name} /><div className="flex items-center gap-1 truncate px-2 py-1 text-[10px] text-white"><Video size={12} />{file.name}</div></div>
        : <a key={file.id} href={src} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-[#eeeaf4] bg-[#faf9fc]"><Image src={src} alt={file.name} width={640} height={360} unoptimized className="h-32 w-full object-cover" /><span className="flex items-center gap-1 truncate px-2 py-1 text-[10px] text-[#625c6d]"><ImageIcon size={12} />{file.name}</span></a>;
    })}</div>}
  </article>;
}

export function SocialMediaClientPanel({ clientId, clientName, accounts, posts }: { clientId: string; clientName: string; accounts: SocialAccountView[]; posts: SocialPostView[] }) {
  const [currentPosts, setCurrentPosts] = useState(posts);
  const [message, setMessage] = useState('');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const updateStatus = async (post: SocialPostView, status: 'PUBLISHED' | 'CANCELLED') => {
    setMessage('');
    const response = await fetch(`/api/social-media/posts/${post.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || 'تعذر تحديث حالة المنشور'); return; }
    setCurrentPosts(items => items.map(item => item.id === post.id ? { ...item, status, publishedAt: status === 'PUBLISHED' ? String(data.post.publishedAt) : null } : item));
  };
  const publishNow = async (post: SocialPostView) => {
    setMessage('');
    setPublishingId(post.id);
    try {
      const response = await fetch(`/api/social-media/posts/${post.id}/publish`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر النشر عبر Meta');
      setCurrentPosts(items => items.map(item => item.id === post.id ? { ...item, status: 'PUBLISHED', publishedAt: String(data.post.publishedAt), externalPostId: data.post.externalPostId, publishError: null } : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر النشر عبر Meta');
      setCurrentPosts(items => items.map(item => item.id === post.id ? { ...item, publishError: error instanceof Error ? error.message : 'تعذر النشر عبر Meta' } : item));
    } finally { setPublishingId(null); }
  };
  return <section className="card card-pad mb-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="eyebrow">SOCIAL MEDIA / CLIENT</div><h2 className="mt-1 text-lg font-black text-[#241744]">حسابات ومنشورات السوشيال ميديا</h2><p className="muted mt-1 text-xs">محتوى وحسابات {clientName} فقط.</p></div><Link href={`/social-media?clientId=${encodeURIComponent(clientId)}`} className="btn btn-soft min-h-[36px] text-xs">فتح تقويم وجدولة</Link></div>
    <div className="mt-5 grid gap-5 xl:grid-cols-2"><div><h3 className="mb-3 text-xs font-black text-[#241744]">الحسابات المرتبطة</h3><SocialAccountCards accounts={accounts} /></div><div><h3 className="mb-3 text-xs font-black text-[#241744]">المنشورات المجدولة والسابقة</h3>{message && <p role="alert" className="mb-2 text-xs font-bold text-[#af3f53]">{message}</p>}<div className="space-y-3">{currentPosts.length ? currentPosts.map(post => <SocialPostCard key={post.id} post={post} onStatusChange={(item, status) => void updateStatus(item, status)} onPublishNow={publishNow} publishing={publishingId === post.id} compact />) : <div className="rounded-xl border border-dashed border-[#e8e2f0] px-4 py-7 text-center text-xs text-[#8a8396]">لا توجد منشورات لهذا العميل بعد.</div>}</div></div></div>
  </section>;
}
