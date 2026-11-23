import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BriefcaseBusiness, CalendarClock } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { ServiceForm } from '@/components/forms';
import { SectionTitle, StatusBadge, currency } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { date, relativeDays } from '@/lib/format';
import { getEmployeeDepartment, isSalesDepartment } from '@/lib/team-access';

export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const employee = user.role === 'EMPLOYEE' ? await getEmployeeDepartment(user.id) : null;
  const manager = user.role === 'DEPARTMENT_MANAGER' ? await getEmployeeDepartment(user.id) : null;
  if (user.role === 'EMPLOYEE' && !(employee && isSalesDepartment(employee.department.name))) redirect('/');
  if (user.role === 'DEPARTMENT_MANAGER' && !manager?.managedDepartment) redirect('/notifications');
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const subscriptionsWhere = user.role === 'EMPLOYEE' ? { client: { createdById: user.id } } : undefined;
  const [services, subscriptions] = await Promise.all([
    prisma.service.findMany({ where: isAdmin ? undefined : { isActive: true }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { subscriptions: true } } } }),
    prisma.subscription.findMany({ where: subscriptionsWhere, orderBy: { expirationDate: 'asc' }, take: 12, include: { client: true, service: true } })
  ]);

  return <AppShell user={user}><div className="content">
    <div className="mb-8 flex items-end justify-between gap-4"><div><div className="eyebrow">CATALOG / RETENTION</div><h1 className="mt-2 text-[30px] font-black text-[#241744]">الخدمات والاشتراكات</h1><p className="muted mt-2">كتالوج الخدمات ومتابعة الاشتراكات المصرح بها.</p></div>{isAdmin && <ServiceForm />}</div>
    <div className="grid gap-4 sm:grid-cols-3">
      {services.map(service => <div key={service.id} className="card card-pad"><div className="flex items-start justify-between"><div className="rounded-xl bg-[#f0ebff] p-2.5 text-[#6245ad]"><BriefcaseBusiness size={18} /></div><StatusBadge status={service.isActive ? 'ACTIVE' : 'INACTIVE'} /></div><h3 className="mt-4 font-black text-[#241744]">{service.name}</h3><p className="muted mt-1 line-clamp-2 text-xs">{service.description || 'بدون وصف للخدمة'}</p><div className="mt-4 flex items-center justify-between border-t border-[#f0edf5] pt-3">{isAdmin && <span className="text-lg font-black text-[#6d4bc3]">{currency(service.defaultPrice)}</span>}<span className="text-[10px] text-[#8a8396]">{service.durationDays} يوم</span>{isAdmin && <span className="text-[10px] text-[#8a8396]">{service._count.subscriptions} اشتراك</span>}</div>{isAdmin && <div className="mt-3 border-t border-[#f0edf5] pt-3"><ServiceForm service={{ id: service.id, name: service.name, description: service.description, category: service.category, defaultPrice: Number(service.defaultPrice), durationDays: service.durationDays }} /></div>}</div>)}
      {!services.length && <div className="card card-pad sm:col-span-3"><div className="py-10 text-center text-sm text-[#8a8396]">لا توجد خدمات مسجلة. أضف أول خدمة من لوحة الإدارة.</div></div>}
    </div>
    <div className="card mt-5"><div className="card-pad pb-2"><SectionTitle eyebrow="SUBSCRIPTION WATCH" title="مراقبة الاشتراكات" action={<Link href="/subscriptions" className="text-xs font-bold text-[#6d4bc3]">فتح صفحة الاشتراكات</Link>} /></div><div className="table-wrap">
      <table className="table"><thead><tr><th>العميل</th><th>الخدمة</th>{isAdmin && <th>القيمة</th>}<th>الانتهاء</th><th>الحالة</th></tr></thead><tbody>
        {subscriptions.length ? subscriptions.map(subscription => <tr key={subscription.id}><td className="font-extrabold text-[#241744]">{subscription.client.name}</td><td className="text-xs text-[#625c6d]">{subscription.service.name}</td>{isAdmin && <td className="font-black">{currency(subscription.contractValue)}</td>}<td><div className="flex items-center gap-2 text-xs font-bold"><CalendarClock size={14} className="text-[#6d4bc3]" />{date(subscription.expirationDate)}</div><div className="mt-1 text-[10px] text-[#a29aaa]">{relativeDays(subscription.expirationDate)}</div></td><td><StatusBadge status={subscription.status} /></td></tr>) : <tr><td colSpan={isAdmin ? 5 : 4}><div className="py-12 text-center text-xs text-[#8a8396]">لا توجد اشتراكات.</div></td></tr>}
      </tbody></table>
    </div></div>
  </div></AppShell>;
}
