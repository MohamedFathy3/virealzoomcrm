import { redirect } from 'next/navigation';
import { CalendarClock, AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { SectionTitle, StatusBadge, currency } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { date, relativeDays } from '@/lib/format';
import { getEmployeeDepartment, isSalesDepartment } from '@/lib/team-access';
import { canAccessFinance } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const employee = user.role === 'EMPLOYEE' ? await getEmployeeDepartment(user.id) : null;
  const manager = user.role === 'DEPARTMENT_MANAGER' ? await getEmployeeDepartment(user.id) : null;
  if (user.role === 'EMPLOYEE' && !(employee && isSalesDepartment(employee.department.name))) redirect('/');
  if (user.role === 'DEPARTMENT_MANAGER' && !manager?.managedDepartment) redirect('/notifications');
  const isAdmin = canAccessFinance(user.role);
  const where = user.role === 'EMPLOYEE' ? { client: { createdById: user.id } } : undefined;
  const subscriptions = await prisma.subscription.findMany({ where, orderBy: { expirationDate: 'asc' }, include: { client: true, service: true } });
  const expiring = subscriptions.filter(subscription => {
    const days = Math.ceil((subscription.expirationDate.getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 7;
  });
  const expired = subscriptions.filter(subscription => subscription.expirationDate < new Date());

  return <AppShell user={user}><div className="content">
    <div className="mb-8"><div className="eyebrow">RETENTION / RENEWALS</div><h1 className="mt-2 text-[30px] font-black text-[#241744]">الاشتراكات</h1><p className="muted mt-2">كل موظف مبيعات يرى اشتراكات عملائه فقط؛ تفاصيل المبالغ للإدارة.</p></div>
    <div className="mb-5 grid gap-4 sm:grid-cols-3"><div className="card card-pad"><div className="label">كل الاشتراكات</div><div className="mt-2 text-3xl font-black text-[#241744]">{subscriptions.length}</div></div><div className="card card-pad"><div className="label">تنتهي خلال 7 أيام</div><div className="mt-2 text-3xl font-black text-[#a26a12]">{expiring.length}</div></div><div className="card card-pad"><div className="label">منتهية</div><div className="mt-2 text-3xl font-black text-[#af3f53]">{expired.length}</div></div></div>
    <div className="card"><div className="card-pad pb-2"><SectionTitle eyebrow="RENEWAL QUEUE" title="قائمة المتابعة" /></div><div className="table-wrap">
      <table className="table"><thead><tr><th>العميل</th><th>الخدمة</th>{isAdmin && <th>قيمة التعاقد</th>}{isAdmin && <th>المدفوع/المتبقي</th>}<th>الانتهاء</th><th>الحالة</th></tr></thead><tbody>
        {subscriptions.length ? subscriptions.map(subscription => <tr key={subscription.id}><td className="font-extrabold text-[#241744]">{subscription.client.name}</td><td className="text-xs text-[#625c6d]">{subscription.service.name}</td>{isAdmin && <td className="font-black">{currency(subscription.contractValue)}</td>}{isAdmin && <td><div className="text-xs font-bold">{currency(subscription.amountPaid)} مدفوع</div><div className="mt-1 text-[10px] text-[#a26a12]">{currency(subscription.outstanding)} متبقي</div></td>}<td><div className="flex items-center gap-2 text-xs font-bold"><CalendarClock size={14} className="text-[#6d4bc3]" />{date(subscription.expirationDate)}</div><div className="mt-1 text-[10px] text-[#a29aaa]">{relativeDays(subscription.expirationDate)}</div></td><td><StatusBadge status={subscription.status} /></td></tr>) : <tr><td colSpan={isAdmin ? 6 : 4}><div className="py-16 text-center"><AlertTriangle className="mx-auto mb-3 text-[#c8bfdb]" /><p className="text-sm font-bold text-[#241744]">لا توجد اشتراكات لمتابعتها.</p></div></td></tr>}
      </tbody></table>
    </div></div>
  </div></AppShell>;
}
