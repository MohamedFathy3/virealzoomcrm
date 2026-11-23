import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Plus, Search, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { ClientForm } from '@/components/forms';
import { SectionTitle, StatusBadge } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { date } from '@/lib/format';
import { canSeeAllClients, getEmployeeDepartment, isSalesDepartment } from '@/lib/team-access';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const employee = user.role === 'EMPLOYEE' ? await getEmployeeDepartment(user.id) : null;
  const managedDepartment = user.role === 'DEPARTMENT_MANAGER' ? await getEmployeeDepartment(user.id) : null;
  if (user.role === 'DEPARTMENT_MANAGER' && !managedDepartment?.managedDepartment) redirect('/notifications');
  const canSeeClients = canSeeAllClients(user.role) || Boolean(employee && isSalesDepartment(employee.department.name));
  if (!canSeeClients) redirect('/');
  const [clients, services] = await Promise.all([
    prisma.client.findMany({
      where: user.role === 'EMPLOYEE' ? { createdById: user.id } : undefined,
      orderBy: [{ nextFollowUpAt: 'asc' }, { updatedAt: 'desc' }],
      include: { _count: { select: { subscriptions: true, tasks: true } }, createdBy: { select: { name: true } } }
    }),
    prisma.service.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, description: true, defaultPrice: true } })
  ]);
  const canCreate = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' ||
    Boolean(employee && isSalesDepartment(employee.department.name)) ||
    Boolean(managedDepartment && isSalesDepartment(managedDepartment.department.name));
  const canEditClients = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' ||
    Boolean(employee && isSalesDepartment(employee.department.name)) ||
    Boolean(managedDepartment && isSalesDepartment(managedDepartment.department.name) && managedDepartment.managedDepartment?.id === managedDepartment.departmentId);

  return <AppShell user={user}><div className="content">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><div className="eyebrow">CRM / CLIENT PORTFOLIO</div><h1 className="mt-2 text-[30px] font-black tracking-tight text-[#241744]">العملاء وCRM</h1><p className="muted mt-2">ملف العميل يربط المتابعة والخدمات والمهام.</p></div>
      {canCreate && <Link href="#new-client" className="btn btn-primary"><Plus size={17} /> إضافة عميل</Link>}
    </div>
    <div className="mb-5 grid gap-4 sm:grid-cols-3">
      <div className="card card-pad"><div className="label">إجمالي العملاء</div><div className="mt-2 text-3xl font-black text-[#241744]">{clients.length}</div></div>
      <div className="card card-pad"><div className="label">نشطون</div><div className="mt-2 text-3xl font-black text-[#217a5a]">{clients.filter(c => c.status === 'ACTIVE').length}</div></div>
      <div className="card card-pad"><div className="label">متابعات مستحقة</div><div className="mt-2 text-3xl font-black text-[#a26a12]">{clients.filter(c => c.nextFollowUpAt && c.nextFollowUpAt <= new Date()).length}</div></div>
    </div>
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="card"><div className="card-pad border-b border-[#f0edf5]"><div className="flex items-center justify-between gap-3"><SectionTitle eyebrow="CLIENT DIRECTORY" title="دليل العملاء" description={`${clients.length} سجل`} /><div className="hidden items-center gap-2 rounded-xl border border-[#ece9f2] px-3 py-2 text-xs text-[#a29aaa] sm:flex"><Search size={14} /> العملاء والمتابعات</div></div></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>العميل</th><th>الحالة</th><th>المسؤول / المتابعة</th><th>الخدمات والمهام</th><th>التسجيل</th>{canEditClients && <th>إجراء</th>}</tr></thead><tbody>
          {clients.length ? clients.map(client => <tr key={client.id}>
            <td><Link href={`/clients/${client.id}`} className="group flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f0ebff] text-xs font-black text-[#6245ad]">{client.name.slice(0, 2)}</span><span><span className="block font-extrabold text-[#241744] group-hover:text-[#6d4bc3]">{client.name}</span><span className="mt-1 block text-[10px] text-[#a29aaa]">{client.clientCode}{client.companyName ? ` · ${client.companyName}` : ''}</span></span></Link></td>
            <td><StatusBadge status={client.status} /></td>
            <td><div className="text-xs font-bold text-[#625c6d]">{client.createdBy?.name || 'الإدارة'}</div><div className={`mt-1 text-[10px] ${client.nextFollowUpAt && client.nextFollowUpAt <= new Date() ? 'text-[#af3f53]' : 'text-[#a29aaa]'}`}>{client.nextFollowUpAt ? `${date(client.nextFollowUpAt)} · ${client.followUpNote || 'متابعة'}` : 'لا توجد متابعة محددة'}</div></td>
            <td><div className="text-sm font-black text-[#241744]">{client._count.subscriptions} اشتراك</div><div className="text-[10px] text-[#a29aaa]">{client._count.tasks} مهمة</div></td>
            <td className="text-xs text-[#625c6d]">{date(client.registeredAt)}</td>
            {canEditClients && <td><Link href={`/clients/${client.id}#edit-client`} className="inline-flex items-center gap-1 text-xs font-bold text-[#6245ad]"><Pencil size={13} /> تعديل</Link></td>}
          </tr>) : <tr><td colSpan={canEditClients ? 6 : 5}><div className="py-16 text-center"><UsersRound className="mx-auto mb-3 text-[#c8bfdb]" /><div className="font-extrabold text-[#241744]">لا يوجد عملاء بعد</div></div></td></tr>}
        </tbody></table></div>
      </div>
      {canCreate && <div id="new-client" className="card card-pad"><SectionTitle eyebrow="NEW CLIENT" title="إضافة عميل" description="سجّل احتياجات العميل وموعد المتابعة التالي." /><ClientForm services={services.map(service => ({ ...service, defaultPrice: Number(service.defaultPrice) }))} /></div>}
    </div>
  </div></AppShell>;
}
