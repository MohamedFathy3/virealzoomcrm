'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarDays, Facebook, Instagram, Link2, Plus, Send } from 'lucide-react';
import { SOCIAL_PLATFORMS, type SocialPlatformKey } from '@/lib/social-media-constants';
import { SocialAccountCards, SocialPostCard, type SocialAccountView, type SocialClientOption, type SocialPostView } from '@/components/social-media-ui';

const weekdays = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
const platformOptions = Object.entries(SOCIAL_PLATFORMS) as [SocialPlatformKey, string][];

function dateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDay(day: string, amount: number) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + amount)).toISOString().slice(0, 10);
}

function cairoLocalDateTime(date: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(date));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function cairoDateTimeToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('صيغة التاريخ والوقت غير صحيحة.');
  const [, year, month, day, hour, minute] = match;
  const wallClockAsUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const cairoParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(wallClockAsUtc));
  const values = Object.fromEntries(cairoParts.map(part => [part.type, part.value]));
  const cairoRepresentationAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute));
  return new Date(wallClockAsUtc - (cairoRepresentationAsUtc - wallClockAsUtc)).toISOString();
}

function noticeText(meta?: string | null, metaError?: string | null) {
  if (meta?.startsWith('connected_')) {
    const count = Number(meta.slice('connected_'.length)) || 0;
    return { kind: 'success', text: `تم ربط ${count} صفحة Facebook وحساب Instagram المرتبط بها إن وُجد.` };
  }
  const messages: Record<string, string> = {
    cancelled: 'تم إلغاء ربط Meta قبل اكتمال التفويض.',
    invalid_callback: 'تعذر التحقق من رد Meta. ابدأ عملية الربط من جديد.',
    state_expired: 'انتهت صلاحية جلسة الربط. ابدأ OAuth مرة أخرى.',
    session_expired: 'انتهت جلسة تسجيل الدخول أثناء ربط Meta. سجّل الدخول ثم ابدأ الربط من جديد.',
    session_changed: 'تغير المستخدم أثناء التفويض. سجّل الدخول بالحساب نفسه ثم أعد الربط.',
    no_pages: 'لم يعثر النظام على صفحة Facebook بصلاحية إنشاء محتوى. تأكد من منح CREATE_CONTENT أو MANAGE.',
    permissions_missing: 'صلاحيات Meta غير كافية. راجع إعدادات Configuration ID واسمح بصلاحيات الصفحات وInstagram والنشر.',
    provider_error: 'رفض Meta أحد الطلبات. راجع نوع التطبيق والصلاحيات وإعدادات حساب الصفحة.',
    setup_error: 'إعدادات Meta أو إعداد التشفير غير مكتملة.',
    encryption_not_configured: 'إعداد APP_SESSION_SECRET غير صالح لتشفير التوكنات.',
    connection_failed: 'فشل ربط Meta. أعد المحاولة بعد مراجعة إعدادات التطبيق.',
    not_configured: 'أكمل إعداد META_APP_ID وMETA_APP_SECRET وMETA_CONFIG_ID وMETA_REDIRECT_URI على الخادم.',
    client_not_found: 'العميل المحدد غير موجود.',
    unauthenticated: 'سجّل الدخول أولًا لإدارة ربط Meta.',
    forbidden: 'هذه الوحدة متاحة لموظفي السوشيال والإدارة فقط.'
  };
  if (metaError) return { kind: 'error', text: messages[metaError] || 'تعذر بدء ربط Meta؛ راجع إعدادات الاتصال.' };
  if (meta && messages[meta]) return { kind: meta === 'cancelled' ? 'warning' : 'error', text: messages[meta] };
  return null;
}

function platformIcon(platform: SocialPlatformKey) {
  if (platform === 'FACEBOOK') return <Facebook size={13} />;
  if (platform === 'INSTAGRAM') return <Instagram size={13} />;
  return <span className="text-[10px] font-black">{SOCIAL_PLATFORMS[platform].slice(0, 1)}</span>;
}

export function SocialMediaWorkspace({
  clients,
  accounts,
  posts,
  initialOwnerClientId,
  initialToday,
  defaultScheduledAt,
  metaConfigured,
  publicMediaReady,
  meta,
  metaError
}: {
  clients: SocialClientOption[];
  accounts: SocialAccountView[];
  posts: SocialPostView[];
  initialOwnerClientId: string | null;
  initialToday: string;
  defaultScheduledAt: string;
  metaConfigured: boolean;
  publicMediaReady: boolean;
  meta: string | null;
  metaError: string | null;
}) {
  const router = useRouter();
  const [ownerClientId, setOwnerClientId] = useState(initialOwnerClientId || '');
  const [editingAccount, setEditingAccount] = useState<SocialAccountView | null>(null);
  const [accountSaving, setAccountSaving] = useState(false);
  const [postSaving, setPostSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState('');
  const [postMessage, setPostMessage] = useState('');
  const [generalMessage, setGeneralMessage] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatformKey>('FACEBOOK');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedDate, setSelectedDate] = useState(initialToday);
  const [calendarMonth, setCalendarMonth] = useState(initialToday.slice(0, 7));

  const ownerId = ownerClientId || null;
  const ownerAccounts = accounts.filter(account => account.clientId === ownerId);
  const ownerPosts = posts.filter(post => post.clientId === ownerId);
  const availablePostAccounts = ownerAccounts.filter(account => account.platform === selectedPlatform);
  const todayPosts = ownerPosts.filter(post => dateKey(post.scheduledAt) === initialToday);
  const tomorrow = shiftDay(initialToday, 1);
  const tomorrowPosts = ownerPosts.filter(post => dateKey(post.scheduledAt) === tomorrow);
  const pastPosts = ownerPosts.filter(post => dateKey(post.scheduledAt) < initialToday).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  const selectedPosts = ownerPosts.filter(post => dateKey(post.scheduledAt) === selectedDate).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const ownerLabel = ownerId ? clients.find(client => client.id === ownerId)?.name || 'العميل' : 'Viral Zoom';
  const notice = noticeText(meta, metaError);

  const calendarCells = useMemo(() => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const startOffset = (firstWeekday + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(Date.UTC(year, month - 1, 1 - startOffset + index));
      return date.toISOString().slice(0, 10);
    });
  }, [calendarMonth]);

  const changeMonth = (delta: number) => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setCalendarMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  const submitAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountMessage('');
    setAccountSaving(true);
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const payload: Record<string, string> = {
      clientId: ownerClientId,
      platform: String(data.get('platform') || 'FACEBOOK'),
      displayName: String(data.get('displayName') || ''),
      username: String(data.get('username') || ''),
      password: String(data.get('password') || ''),
      profileUrl: String(data.get('profileUrl') || ''),
      notes: String(data.get('notes') || '')
    };
    try {
      const response = await fetch('/api/social-media/accounts', {
        method: editingAccount ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editingAccount ? { ...payload, id: editingAccount.id } : payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تعذر حفظ الحساب');
      setEditingAccount(null);
      setAccountMessage(editingAccount ? 'تم تحديث الحساب.' : 'تم حفظ الحساب يدويًا.');
      formElement.reset();
      router.refresh();
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : 'تعذر حفظ الحساب');
    } finally { setAccountSaving(false); }
  };

  const submitPost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPostMessage('');
    setPostSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const localDateTime = String(form.get('scheduledAt') || '');
    if (!localDateTime) {
      setPostMessage('حدد تاريخ ووقت النشر.');
      setPostSaving(false);
      return;
    }
    form.set('clientId', ownerClientId);
    form.set('platform', selectedPlatform);
    form.set('accountId', selectedAccountId);
    try {
      form.set('scheduledAt', cairoDateTimeToIso(localDateTime));
      const response = await fetch('/api/social-media/posts', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تعذر حفظ المنشور');
      setPostMessage('تم حفظ المنشور في التقويم. لن يُنشر تلقائيًا عند حلول الموعد.');
      formElement.reset();
      setSelectedAccountId('');
      router.refresh();
    } catch (error) {
      setPostMessage(error instanceof Error ? error.message : 'تعذر حفظ المنشور');
    } finally { setPostSaving(false); }
  };

  const updateStatus = async (post: SocialPostView, status: 'PUBLISHED' | 'CANCELLED') => {
    setGeneralMessage('');
    try {
      const response = await fetch(`/api/social-media/posts/${post.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تعذر تحديث الحالة');
      setGeneralMessage(status === 'PUBLISHED' ? 'تم تسجيل تأكيد النشر يدويًا.' : 'تم إلغاء المنشور.');
      router.refresh();
    } catch (error) { setGeneralMessage(error instanceof Error ? error.message : 'تعذر تحديث الحالة'); }
  };

  const publishNow = async (post: SocialPostView) => {
    setGeneralMessage('');
    setPublishingId(post.id);
    try {
      const response = await fetch(`/api/social-media/posts/${post.id}/publish`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تعذر النشر عبر Meta');
      setGeneralMessage(`تم النشر عبر Meta. رقم المنشور: ${result.post.externalPostId}`);
      router.refresh();
    } catch (error) { setGeneralMessage(error instanceof Error ? error.message : 'تعذر النشر عبر Meta'); }
    finally { setPublishingId(null); }
  };

  const monthLabel = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date(`${calendarMonth}-01T12:00:00Z`));
  const connectUrl = `/api/social-media/meta/start?clientId=${encodeURIComponent(ownerClientId || 'company')}`;
  const noAccountForPlatform = availablePostAccounts.length === 0;

  return <div className="content">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><div className="eyebrow">SOCIAL MEDIA / CONTENT DESK</div><h1 className="mt-2 text-[30px] font-black text-[#241744]">تقويم السوشيال ميديا</h1><p className="muted mt-2">الحسابات والمحتوى والجدولة اليدوية لـ {ownerLabel}.</p></div>
      <a href="#new-post" className="btn btn-primary"><Plus size={16} /> إضافة منشور</a>
    </div>

    <section className="card card-pad mb-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <label className="block"><span className="label">المالك / العميل</span><select className="input mt-2" value={ownerClientId} onChange={event => { setOwnerClientId(event.target.value); setEditingAccount(null); setSelectedAccountId(''); }}><option value="">شركة Viral Zoom</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <div className="flex flex-wrap gap-2">
          {ownerClientId && <a href={`/clients/${encodeURIComponent(ownerClientId)}`} className="btn btn-soft">فتح ملف العميل</a>}
          {metaConfigured ? <a href={connectUrl} className="btn btn-soft"><Link2 size={15} /> ربط صفحة Facebook / Instagram عبر Meta</a> : <span className="rounded-xl border border-[#f2d9a6] bg-[#fff8e8] px-3 py-2 text-[11px] font-bold text-[#93610d]">أكمل إعداد Meta على الخادم لبدء الربط.</span>}
        </div>
      </div>
      {notice && <div role="status" className={`mt-4 rounded-xl px-4 py-3 text-xs leading-6 ${notice.kind === 'success' ? 'bg-[#eaf8f1] text-[#217a5a]' : notice.kind === 'warning' ? 'bg-[#fff8e8] text-[#93610d]' : 'bg-[#fff0f3] text-[#af3f53]'}`}>{notice.text}</div>}
      {!publicMediaReady && <p className="mt-3 text-[10px] leading-5 text-[#8a8396]">النشر على Instagram يحتاج عنوان HTTPS عامًا مضبوطًا في META_APP_URL حتى يستطيع Meta جلب الوسائط الخاصة برابط مؤقت.</p>}
      <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-[#8a8396]"><span className="rounded-lg bg-[#f7f5fa] px-2.5 py-1.5">Facebook Page</span><span className="rounded-lg bg-[#f7f5fa] px-2.5 py-1.5">Instagram Business / Creator المرتبط بصفحة</span><span className="rounded-lg bg-[#f7f5fa] px-2.5 py-1.5">التقويم لا ينشر تلقائيًا</span></div>
    </section>

    <div className="mb-5 grid gap-4 xl:grid-cols-2">
      <section className="card card-pad">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><div className="eyebrow">CONNECTED ACCOUNTS</div><h2 className="mt-1 font-black text-[#241744]">حسابات {ownerLabel}</h2></div><div className="rounded-xl bg-[#f7f5fa] px-3 py-2 text-[10px] text-[#756f82]">{ownerAccounts.length} حساب</div></div>
        <SocialAccountCards accounts={ownerAccounts} onEdit={setEditingAccount} />
      </section>
      <section className="card card-pad">
        <div className="mb-4"><div className="eyebrow">ACCOUNT DETAILS</div><h2 className="mt-1 font-black text-[#241744]">{editingAccount ? 'تعديل حساب يدوي' : 'إضافة حساب يدوي'}</h2><p className="muted mt-1 text-[11px]">حسابات Meta تُربط بزر OAuth ولا تُحفظ كلمة مرورها في النظام.</p></div>
        {accountMessage && <p role="status" className="mb-3 rounded-lg bg-[#f7f5fa] p-2.5 text-xs text-[#625c6d]">{accountMessage}</p>}
        <form key={editingAccount?.id || `new-${ownerClientId}`} onSubmit={submitAccount} className="grid gap-3 sm:grid-cols-2">
          {!editingAccount && <label className="block"><span className="label">المنصة</span><select name="platform" className="input mt-1" defaultValue="FACEBOOK">{platformOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
          <label className="block"><span className="label">اسم ظاهر</span><input name="displayName" className="input mt-1" defaultValue={editingAccount?.displayName || ''} maxLength={191} placeholder="اختياري" /></label>
          <label className="block"><span className="label">اسم المستخدم</span><input name="username" className="input mt-1" required defaultValue={editingAccount?.username || ''} maxLength={255} /></label>
          <label className="block"><span className="label">كلمة المرور {editingAccount ? '(اختياري للتغيير)' : ''}</span><input name="password" type="password" className="input mt-1" required={!editingAccount} autoComplete="new-password" maxLength={1024} /></label>
          <label className="block sm:col-span-2"><span className="label">رابط الحساب</span><input name="profileUrl" type="url" className="input mt-1" defaultValue={editingAccount?.profileUrl || ''} placeholder="https://..." /></label>
          <label className="block sm:col-span-2"><span className="label">ملاحظات</span><textarea name="notes" rows={2} className="input mt-1" defaultValue={editingAccount?.notes || ''} maxLength={5000} /></label>
          <div className="flex flex-wrap gap-2 sm:col-span-2"><button className="btn btn-primary" disabled={accountSaving}>{accountSaving ? 'جارٍ الحفظ' : editingAccount ? 'حفظ التعديل' : 'حفظ الحساب'}</button>{editingAccount && <button type="button" onClick={() => setEditingAccount(null)} className="btn btn-soft">إلغاء التعديل</button>}</div>
        </form>
      </section>
    </div>

    <section id="new-post" className="card card-pad mb-5">
      <div className="mb-4"><div className="eyebrow">NEW CONTENT</div><h2 className="mt-1 font-black text-[#241744]">إنشاء منشور وجدولته</h2><p className="muted mt-1 text-[11px]">الموعد يسجل في تقويم Viral Zoom فقط؛ لا يحدث نشر آلي. استخدم «نشر الآن عبر Meta» بعد مراجعة المحتوى أو أكد النشر يدويًا.</p></div>
      {postMessage && <p role="status" className="mb-3 rounded-lg bg-[#f7f5fa] p-2.5 text-xs text-[#625c6d]">{postMessage}</p>}
      <form key={ownerClientId} onSubmit={submitPost} className="grid gap-3 lg:grid-cols-2">
        <label className="block"><span className="label">المنصة</span><select className="input mt-1" value={selectedPlatform} onChange={event => { setSelectedPlatform(event.target.value as SocialPlatformKey); setSelectedAccountId(''); }}>{platformOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="block"><span className="label">الحساب</span><select className="input mt-1" value={selectedAccountId} onChange={event => setSelectedAccountId(event.target.value)}><option value="">منشور غير مرتبط بحساب مسجل</option>{availablePostAccounts.map(account => <option key={account.id} value={account.id}>{account.displayName || account.username}{account.metaConnectionId ? ' · Meta' : ''}</option>)}</select></label>
        {noAccountForPlatform && <p className="text-[10px] text-[#9c6a11] lg:col-span-2">لا يوجد حساب محفوظ لهذه المنصة لدى {ownerLabel}؛ يمكنك تسجيل المنشور للتقويم، أو أضف الحساب أولًا.</p>}
        <label className="block"><span className="label">عنوان داخلي</span><input name="title" className="input mt-1" maxLength={191} placeholder="اختياري" /></label>
        <label className="block"><span className="label">تاريخ ووقت النشر المخطط</span><input name="scheduledAt" type="datetime-local" className="input mt-1" required defaultValue={defaultScheduledAt} /></label>
        <label className="block lg:col-span-2"><span className="label">نص المنشور</span><textarea name="content" className="input mt-1" rows={4} required maxLength={60000} placeholder="اكتب المحتوى والوسوم..." /></label>
        <label className="block lg:col-span-2"><span className="label">الصور أو الفيديوهات</span><input name="media" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="input mt-1" /><span className="mt-1 block text-[10px] text-[#8a8396]">حتى 8 ملفات، 30MB للملف و60MB إجمالًا. ملفات المشروع خاصة. إنستغرام: JPG أو MP4/MOV؛ Carousel متعدد الملفات مدعوم حتى 8 عناصر.</span></label>
        <div className="lg:col-span-2"><button className="btn btn-primary" disabled={postSaving}>{postSaving ? 'جارٍ الحفظ' : 'حفظ في التقويم'}</button></div>
      </form>
    </section>

    <section className="mb-5 grid gap-4 xl:grid-cols-3">
      {[{ key: initialToday, label: 'محتوى اليوم', items: todayPosts }, { key: tomorrow, label: 'محتوى الغد', items: tomorrowPosts }, { key: 'history', label: 'السجل السابق', items: pastPosts.slice(0, 4) }].map(bucket => <article key={bucket.key} className="card card-pad">
        <div className="flex items-center justify-between gap-2"><h2 className="font-black text-[#241744]">{bucket.label}</h2><span className="rounded-lg bg-[#f7f5fa] px-2 py-1 text-[10px] text-[#756f82]">{bucket.key === 'history' ? pastPosts.length : bucket.items.length}</span></div>
        <div className="mt-3 space-y-2">{bucket.items.length ? bucket.items.map(post => <button key={post.id} type="button" onClick={() => { const day = dateKey(post.scheduledAt); setSelectedDate(day); setCalendarMonth(day.slice(0, 7)); }} className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#eeeaf4] p-2.5 text-right hover:border-[#cfc2ed]"><span className="min-w-0"><span className="block truncate text-xs font-bold text-[#241744]">{post.title || post.content.slice(0, 48)}</span><span className="mt-1 flex items-center gap-1 text-[10px] text-[#8a8396]">{platformIcon(post.platform)}{SOCIAL_PLATFORMS[post.platform]} · {new Intl.DateTimeFormat('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(new Date(post.scheduledAt))}</span></span><span className="shrink-0 text-[10px] text-[#6d4bc3]">عرض</span></button>) : <p className="rounded-xl border border-dashed border-[#eeeaf4] px-3 py-5 text-center text-[11px] text-[#8a8396]">لا توجد منشورات هنا.</p>}</div>
        {bucket.key !== 'history' && <button type="button" onClick={() => { setSelectedDate(bucket.key); setCalendarMonth(bucket.key.slice(0, 7)); }} className="mt-3 text-[10px] font-bold text-[#6245ad]">فتح هذا اليوم في التقويم</button>}
      </article>)}
    </section>

    <section className="card card-pad">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><div className="eyebrow">CONTENT CALENDAR</div><h2 className="mt-1 font-black text-[#241744]">تقويم {ownerLabel}</h2></div><div className="flex items-center gap-2"><button type="button" className="rounded-lg border border-[#eeeaf4] p-2 text-[#6245ad]" onClick={() => changeMonth(-1)} aria-label="الشهر السابق"><ArrowRight size={16} /></button><span className="min-w-32 text-center text-sm font-black text-[#241744]">{monthLabel}</span><button type="button" className="rounded-lg border border-[#eeeaf4] p-2 text-[#6245ad]" onClick={() => changeMonth(1)} aria-label="الشهر التالي"><ArrowLeft size={16} /></button></div></div>
      <div className="grid grid-cols-7 gap-1.5">{weekdays.map(day => <div key={day} className="py-2 text-center text-[10px] font-black text-[#8a8396]">{day}</div>)}{calendarCells.map(day => {
        const count = ownerPosts.filter(post => dateKey(post.scheduledAt) === day).length;
        const outsideMonth = day.slice(0, 7) !== calendarMonth;
        return <button key={day} type="button" onClick={() => setSelectedDate(day)} className={`min-h-[68px] rounded-xl border p-2 text-right transition-colors ${selectedDate === day ? 'border-[#6d4bc3] bg-[#f0ebff]' : day === initialToday ? 'border-[#c5ead8] bg-[#f4fbf7]' : 'border-[#eeeaf4] bg-white hover:bg-[#faf9fc]'} ${outsideMonth ? 'opacity-45' : ''}`}><span className="block text-xs font-black text-[#241744]">{Number(day.slice(-2))}</span>{count > 0 && <span className="mt-2 inline-flex rounded-full bg-[#6245ad] px-1.5 py-0.5 text-[9px] font-bold text-white">{count} منشور</span>}</button>;
      })}</div>
      <div className="mt-5 border-t border-[#f0edf5] pt-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-[#241744]">{new Intl.DateTimeFormat('ar-EG', { dateStyle: 'full', timeZone: 'Africa/Cairo' }).format(new Date(`${selectedDate}T12:00:00Z`))}</h3><p className="mt-1 text-[10px] text-[#8a8396]">{selectedPosts.length} منشور في هذا اليوم</p></div>{selectedDate === initialToday && <span className="rounded-lg bg-[#eaf8f1] px-2 py-1 text-[10px] font-bold text-[#217a5a]">اليوم</span>}</div>
        {generalMessage && <p role="status" className="mb-3 rounded-lg bg-[#f7f5fa] p-2.5 text-xs text-[#625c6d]">{generalMessage}</p>}
        <div className="space-y-3">{selectedPosts.length ? selectedPosts.map(post => <SocialPostCard key={post.id} post={post} onStatusChange={updateStatus} onPublishNow={publishNow} publishing={publishingId === post.id} />) : <div className="rounded-xl border border-dashed border-[#e8e2f0] px-4 py-9 text-center text-xs text-[#8a8396]">لا توجد منشورات لهذا التاريخ.</div>}</div>
      </div>
    </section>
  </div>;
}
