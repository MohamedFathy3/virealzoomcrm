import { redirect } from 'next/navigation';
import { Building2, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { DepartmentActions, DepartmentForm, EmployeeActions, EmployeeForm } from '@/components/forms';
import { SectionTitle, StatusBadge, currency } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getEmployeeDepartment } from '@/lib/team-access';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && user.role !== 'DEPARTMENT_MANAGER') redirect('/');
  const manager = user.role === 'DEPARTMENT_MANAGER' ? await getEmployeeDepartment(user.id) : null;
  if (user.role === 'DEPARTMENT_MANAGER' && !manager?.managedDepartment) redirect('/notifications');
  const managedDepartmentId = manager?.managedDepartment?.id;

  const [departments, employees] = await Promise.all([
    prisma.department.findMany({
      where: managedDepartmentId ? { isActive: true, id: managedDepartmentId } : { isActive: true },
      include: { manager: true, _count: { select: { employees: true, tasks: true } } },
      orderBy: { name: 'asc' }
    }),
    prisma.employee.findMany({
      where: managedDepartmentId ? { employmentStatus: 'ACTIVE', departmentId: managedDepartmentId } : { employmentStatus: 'ACTIVE' },
      include: { department: true, user: true },
      orderBy: { fullName: 'asc' }
    })
  ]);

  const canManage = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const totalSalary = employees.reduce((sum, employee) => sum + Number(employee.monthlySalary), 0);

  return (
    <AppShell user={user}>
      <div className="content">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">PEOPLE / ORGANIZATION</div>
            <h1 className="mt-2 text-[30px] font-black text-[#241744]">الفريق والأقسام</h1>
            <p className="muted mt-2">هيكل واضح يربط المديرين والموظفين بالمهام والإنتاجية والرواتب.</p>
          </div>
        </div>

        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <div className="card card-pad"><div className="label">موظفون نشطون</div><div className="mt-2 text-3xl font-black text-[#241744]">{employees.length}</div></div>
          <div className="card card-pad"><div className="label">أقسام فعالة</div><div className="mt-2 text-3xl font-black text-[#6245ad]">{departments.length}</div></div>
          {canManage && <div className="card card-pad"><div className="label">إجمالي الرواتب الشهرية</div><div className="mt-2 text-3xl font-black text-[#217a5a]">{currency(totalSalary)}</div></div>}
        </div>

        <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
          <div className="card">
            <div className="card-pad pb-2"><SectionTitle eyebrow="DEPARTMENT MAP" title="الأقسام" /></div>
            <div className="space-y-3 px-5 pb-5">
              {departments.map(department => (
                <div key={department.id} className="rounded-2xl border border-[#eeeaf4] p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-[#f0ebff] p-2.5 text-[#6245ad]"><Building2 size={17} /></div>
                      <div><div className="font-black text-[#241744]">{department.name}</div><div className="muted mt-1 text-[11px]">{department.description || 'قسم تشغيلي'}</div></div>
                    </div>
                    {canManage && <DepartmentActions department={department} />}
                  </div>
                  <div className="mt-4 flex gap-5 border-t border-[#f2eff6] pt-3 text-[11px] text-[#756f82]">
                    <span><b className="text-[#241744]">{department._count.employees}</b> موظف</span>
                    <span><b className="text-[#241744]">{department._count.tasks}</b> مهمة</span>
                    <span>المدير: <b className="text-[#241744]">{department.manager?.fullName || 'غير محدد'}</b></span>
                  </div>
                </div>
              ))}
            </div>
            {canManage && <div className="card-pad border-t border-[#f2eff6]"><SectionTitle eyebrow="NEW DEPARTMENT" title="إضافة قسم" /><DepartmentForm employees={employees.map(employee => ({ id: employee.id, fullName: employee.fullName }))} /></div>}
          </div>

          <div className="card">
            <div className="card-pad pb-2"><SectionTitle eyebrow="EMPLOYEE DIRECTORY" title="دليل الموظفين" /></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>الموظف</th><th>القسم</th><th>المسمى</th>{canManage && <th>الراتب الشهري</th>}<th>الحالة</th>{canManage && <th>إجراءات</th>}</tr></thead>
                <tbody>
                  {employees.length ? employees.map(employee => (
                    <tr key={employee.id}>
                      <td><div className="font-extrabold text-[#241744]">{employee.fullName}</div><div className="mt-1 text-[10px] text-[#a29aaa]">{employee.employeeCode} · {employee.email}</div></td>
                      <td className="text-xs font-bold text-[#625c6d]">{employee.department.name}</td>
                      <td className="text-xs text-[#625c6d]">{employee.jobTitle || '—'}</td>
                      {canManage && <td className="font-black text-[#241744]">{currency(employee.monthlySalary)}</td>}
                      <td><StatusBadge status="ACTIVE" /></td>
                      {canManage && <td><EmployeeActions employee={{ id: employee.id, fullName: employee.fullName, email: employee.email, phone: employee.phone, jobTitle: employee.jobTitle, hireDate: employee.hireDate, monthlySalary: Number(employee.monthlySalary), employmentStatus: employee.employmentStatus, departmentId: employee.departmentId, role: employee.user?.role === 'DEPARTMENT_MANAGER' ? 'DEPARTMENT_MANAGER' : 'EMPLOYEE' }} /></td>}
                    </tr>
                  )) : <tr><td colSpan={canManage ? 6 : 4}><div className="py-14 text-center"><UsersRound className="mx-auto mb-3 text-[#c8bfdb]" /><p className="text-sm font-bold text-[#241744]">لا يوجد موظفون مسجلون</p></div></td></tr>}
                </tbody>
              </table>
            </div>
            {canManage && <div className="card-pad border-t border-[#f2eff6]"><SectionTitle eyebrow="NEW EMPLOYEE" title="إضافة موظف وربطه بالقسم" /><EmployeeForm departments={departments.map(department => ({ id: department.id, name: department.name }))} /></div>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
