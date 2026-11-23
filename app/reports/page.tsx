import { redirect } from 'next/navigation';
import { BarChart3, Download, FileText, TrendingUp } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { FinanceChart } from '@/components/finance-chart';
import { KpiCard, SectionTitle, StatusBadge } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { getMonthlyFinance } from '@/lib/dashboard';
import { canViewReports, isAdmin } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { getEmployeeDepartment } from '@/lib/team-access';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canViewReports(user.role)) redirect('/tasks');
  const manager = user.role === 'DEPARTMENT_MANAGER' ? await getEmployeeDepartment(user.id) : null;
  if (user.role === 'DEPARTMENT_MANAGER' && !manager?.managedDepartment) redirect('/notifications');
  const isAdministrator = isAdmin(user.role);
  const departmentId = manager?.managedDepartment?.id;
  const [monthly, employees, tasks] = await Promise.all([
    isAdministrator ? getMonthlyFinance() : Promise.resolve([]),
    prisma.employee.findMany({
      where: { employmentStatus: 'ACTIVE', ...(departmentId ? { departmentId } : {}) },
      include: { department: true, productivityRecords: true },
      orderBy: { fullName: 'asc' }
    }),
    prisma.task.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: { department: true },
      orderBy: { updatedAt: 'desc' }
    })
  ]);
  const approved = tasks.filter(task => task.status === 'APPROVED').length;
  const onTime = tasks.filter(task => task.status === 'APPROVED' && task.deadline >= task.updatedAt).length;
  const departmentCount = new Set(tasks.map(task => task.departmentId)).size;

  return <AppShell user={user}><div className="content">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><div className="eyebrow">REPORTING / DECISIONS</div><h1 className="mt-2 text-[30px] font-black text-[#241744]">التقارير والتحليلات</h1><p className="muted mt-2">{isAdministrator ? 'تقارير الإدارة المالية والتشغيلية.' : 'مؤشرات أداء فريق قسمك فقط.'}</p></div>{isAdministrator && <button className="btn btn-ghost"><Download size={16} /> تصدير التقرير</button>}</div>
    <div className="mb-5 grid gap-4 sm:grid-cols-3">
      <KpiCard label="المهام المعتمدة" value={approved} icon={<TrendingUp size={19} />} tone="green" />
      <KpiCard label="نسبة التسليم في الموعد" value={approved ? `${Math.round(onTime / approved * 100)}%` : '0%'} icon={<BarChart3 size={19} />} tone="purple" />
      <KpiCard label="الأقسام المعروضة" value={departmentCount} icon={<FileText size={19} />} tone="blue" />
    </div>
    {isAdministrator && <div className="card card-pad mb-5"><SectionTitle eyebrow="MONTHLY FINANCE" title="الإيرادات مقابل المصروفات" /><FinanceChart data={monthly} /></div>}
    <div className="card mb-5"><div className="card-pad pb-2"><SectionTitle eyebrow="DEPARTMENT PERFORMANCE" title="أداء الأقسام" /></div><div className="space-y-3 px-5 pb-5">
      {Array.from(new Set(tasks.map(task => task.departmentId))).map(id => { const departmentTasks = tasks.filter(task => task.departmentId === id); const departmentApproved = departmentTasks.filter(task => task.status === 'APPROVED').length; const department = departmentTasks[0]?.department; return <div key={id}><div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold text-[#241744]">{department?.name}</span><span className="text-[#8a8396]">{departmentApproved}/{departmentTasks.length} معتمدة</span></div><div className="h-2 overflow-hidden rounded-full bg-[#f0edf5]"><div className="h-full rounded-full bg-[#6d4bc3]" style={{ width: `${departmentTasks.length ? departmentApproved / departmentTasks.length * 100 : 0}%` }} /></div></div>; })}
      {!tasks.length && <p className="py-10 text-center text-xs text-[#8a8396]">لا توجد بيانات مهام كافية.</p>}
    </div></div>
    <div className="card"><div className="card-pad pb-2"><SectionTitle eyebrow="PRODUCTIVITY / APPROVED ONLY" title="الإنتاجية حسب الموظف" /></div><div className="table-wrap"><table className="table"><thead><tr><th>الموظف</th><th>القسم</th><th>المهام المعتمدة</th><th>الحالة</th></tr></thead><tbody>
      {employees.length ? employees.map(employee => <tr key={employee.id}><td className="font-extrabold text-[#241744]">{employee.fullName}</td><td className="text-xs text-[#625c6d]">{employee.department.name}</td><td className="font-black text-[#6d4bc3]">{employee.productivityRecords.length}</td><td><StatusBadge status={employee.productivityRecords.length ? 'ACTIVE' : 'NEW'} /></td></tr>) : <tr><td colSpan={4}><div className="py-12 text-center text-xs text-[#8a8396]">لا يوجد موظفون لعرض الإنتاجية.</div></td></tr>}
    </tbody></table></div></div>
  </div></AppShell>;
}
