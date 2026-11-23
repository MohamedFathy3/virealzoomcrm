import { redirect } from 'next/navigation';
import { Bell, CheckCheck, Clock3 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { SectionTitle, StatusBadge } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { date } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() { const user = await getCurrentUser(); if (!user) redirect('/login'); const notifications = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }); return <AppShell user={user}><div className="content"><div className="mb-8 flex items-end justify-between gap-4"><div><div className="eyebrow">CENTER / ACTIVITY</div><h1 className="mt-2 text-[30px] font-black text-[#241744]">الإشعارات</h1><p className="muted mt-2">تنبيهات المهام، المراجعات، الاشتراكات، والأحداث المهمة محفوظة هنا.</p></div><button className="btn btn-ghost"><CheckCheck size={16} /> تعليم الكل كمقروء</button></div><div className="card">{notifications.length ? <div className="divide-y divide-[#f0edf5]">{notifications.map(n => <div key={n.id} className="flex gap-4 p-5"><div className={`mt-1 rounded-xl p-2.5 ${n.readAt ? 'bg-[#f5f3f8] text-[#958da0]' : 'bg-[#f0ebff] text-[#6d4bc3]'}`}><Bell size={17} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className={`text-sm ${n.readAt ? 'font-bold text-[#625c6d]' : 'font-black text-[#241744]'}`}>{n.title}</h3><span className="text-[10px] text-[#a29aaa]">{date(n.createdAt)}</span></div><p className="muted mt-2 text-xs leading-6">{n.body}</p></div><StatusBadge status={n.readAt ? 'INACTIVE' : 'ACTIVE'} /></div>)}</div> : <div className="py-20 text-center"><div className="mx-auto mb-3 w-fit rounded-2xl bg-[#f0ebff] p-3 text-[#6d4bc3]"><Clock3 size={20} /></div><h3 className="font-black text-[#241744]">لا توجد إشعارات الآن</h3><p className="muted mt-2 text-xs">ستظهر هنا تنبيهات الأحداث المرتبطة بدورك.</p></div>}</div></div></AppShell>; }
