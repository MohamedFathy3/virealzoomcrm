import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ListTodo, Plus, TimerReset } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { TaskForm, TaskWorkflowActions } from '@/components/forms';
import { KpiCard, SectionTitle, StatusBadge } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getEmployeeDepartment } from '@/lib/team-access';
import { getTaskAttachments } from '@/lib/task-attachments';
import { date, relativeDays } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { clientId } = await searchParams;
  const managerEmployee = user.role === 'DEPARTMENT_MANAGER' ? await getEmployeeDepartment(user.id) : null;
  if (user.role === 'DEPARTMENT_MANAGER' && !managerEmployee?.managedDepartment) redirect('/notifications');
  const isEmployee = user.role === 'EMPLOYEE';
  const managedDepartmentId = managerEmployee?.managedDepartment?.id;
  const employeeWhere = managedDepartmentId
    ? { employmentStatus: 'ACTIVE' as const, departmentId: managedDepartmentId }
    : { employmentStatus: 'ACTIVE' as const };
  const departmentWhere = managedDepartmentId ? { isActive: true, id: managedDepartmentId } : { isActive: true };
  const taskWhere = isEmployee
    ? { OR: [{ assignee: { userId: user.id } }, { assignments: { some: { employee: { userId: user.id } } } }] }
    : managedDepartmentId ? { departmentId: managedDepartmentId } : {};

  const [tasks, departments, employees, clients, services, performance] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        department: true,
        assignee: { include: { user: { select: { id: true } } } },
        assignments: { include: { employee: { include: { user: { select: { id: true } } } } } },
        client: true,
        submissions: { orderBy: { version: 'desc' }, take: 5, include: { reviews: { orderBy: { reviewedAt: 'desc' } } } }
      }
    }),
    prisma.department.findMany({ where: departmentWhere, orderBy: { name: 'asc' } }),
    prisma.employee.findMany({ where: employeeWhere, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, departmentId: true } }),
    user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'DEPARTMENT_MANAGER'
      ? prisma.client.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })
      : Promise.resolve([]),
    prisma.service.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    isEmployee
      ? prisma.productivityRecord.findMany({ where: { employee: { userId: user.id } }, select: { points: true, onTime: true } })
      : Promise.resolve([])
  ]);
  const overdue = tasks.filter(task => task.deadline < new Date() && !['APPROVED', 'CANCELLED'].includes(task.status)).length;
  const canCreate = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'DEPARTMENT_MANAGER';
  const approvedCount = performance.length;
  const onTimeCount = performance.filter(record => record.onTime).length;

  return <AppShell user={user}><div className="content">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><div className="eyebrow">WORKFLOW / DELIVERY</div><h1 className="mt-2 text-[30px] font-black text-[#241744]">المهام والتسليمات</h1><p className="muted mt-2">كل موظف يرى مهامه، ومدير القسم يتابع مهام فريقه ومراجعاته.</p></div>{canCreate && <a href="#new-task" className="btn btn-primary"><Plus size={17} /> إنشاء مهمة</a>}</div>
    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="المهام المعروضة" value={tasks.length} icon={<ListTodo size={19} />} tone="purple" />
      <KpiCard label="قيد التنفيذ" value={tasks.filter(task => task.status === 'IN_PROGRESS').length} icon={<TimerReset size={19} />} tone="orange" />
      <KpiCard label="بانتظار المراجعة" value={tasks.filter(task => ['SUBMITTED', 'UNDER_REVIEW'].includes(task.status)).length} icon={<TimerReset size={19} />} tone="blue" />
      <KpiCard label="متأخرة" value={overdue} icon={<TimerReset size={19} />} tone="orange" />
    </div>
    {isEmployee && <div className="mb-5 grid gap-4 sm:grid-cols-3">
      <div className="card card-pad"><div className="label">مهام تم تقييمها</div><div className="mt-2 text-2xl font-black text-[#241744]">{approvedCount}</div></div>
      <div className="card card-pad"><div className="label">نقاط الإنجاز</div><div className="mt-2 text-2xl font-black text-[#6245ad]">{performance.reduce((sum, record) => sum + record.points, 0)}</div></div>
      <div className="card card-pad"><div className="label">نسبة الالتزام بالموعد</div><div className="mt-2 text-2xl font-black text-[#217a5a]">{approvedCount ? `${Math.round(onTimeCount / approvedCount * 100)}%` : '—'}</div></div>
    </div>}
    <div className="grid gap-5">
      <div className="card"><div className="card-pad pb-2"><SectionTitle eyebrow="TASK BOARD" title={isEmployee ? 'مهامي' : 'مهام القسم والفريق'} description="تسليم الروابط والملفات، ملاحظات المراجعة، وحالة كل مهمة." /></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>المهمة</th><th>القسم / العميل</th><th>المكلف</th><th>الأولوية</th><th>الحالة</th><th>الموعد</th><th>التسليم والمراجعة</th></tr></thead><tbody>
          {tasks.length ? tasks.map(task => {
            const latest = task.submissions[0];
            const submission = latest ? {
              id: latest.id,
              completionNotes: latest.completionNotes,
              submittedAt: latest.submittedAt.toISOString(),
              attachments: getTaskAttachments(latest.attachments, task.id),
              reviews: task.submissions.flatMap(version => version.reviews.map(review => ({ decision: review.decision, comments: review.comments, qualityScore: review.qualityScore })))
            } : null;
            const isAssigned = task.assignee?.user?.id === user.id || task.assignments.some(a => a.employee.user?.id === user.id);
            return <tr key={task.id}>
              <td><Link href={`/tasks/${task.id}`} className="font-extrabold text-[#241744] hover:text-[#6d4bc3]">{task.title}</Link>{task.description && <div className="mt-1 max-w-[260px] text-[11px] leading-5 text-[#756f82]">{task.description}</div>}<div className="mt-1 text-[10px] text-[#a29aaa]">{task.taskNo} · {task.progress}% مكتمل</div></td>
              <td><div className="text-xs font-bold text-[#625c6d]">{task.department.name}</div><div className="mt-1 text-[10px] text-[#a29aaa]">{task.client?.name || 'داخلي'}</div></td>
              <td className="text-xs font-bold text-[#625c6d]">{task.assignee?.fullName || 'غير مسندة'}</td>
              <td><StatusBadge status={task.priority} /></td>
              <td><StatusBadge status={task.status} /></td>
              <td><div className="text-xs font-bold text-[#625c6d]">{date(task.deadline)}</div><div className={`mt-1 text-[10px] ${task.deadline < new Date() && !['APPROVED', 'CANCELLED'].includes(task.status) ? 'text-[#af3f53]' : 'text-[#a29aaa]'}`}>{relativeDays(task.deadline)}</div></td>
              <td className="min-w-[250px]"><TaskWorkflowActions taskId={task.id} isAssigned={isAssigned} canReview={canCreate && !isAssigned} status={task.status} submission={submission} /></td>
            </tr>;
          }) : <tr><td colSpan={7}><div className="py-16 text-center text-sm text-[#8a8396]">{isEmployee ? 'لا توجد مهام مسندة إليك.' : 'لا توجد مهام مسجلة.'}</div></td></tr>}
        </tbody></table></div>
      </div>
      {canCreate && <div id="new-task" className="card card-pad"><SectionTitle eyebrow="NEW WORK ITEM" title="إنشاء مهمة" description="مدير القسم ينشئ داخل قسمه فقط، والإدارة ترى كل الأقسام." /><TaskForm departments={departments} employees={employees} clients={clients} services={services} defaultClientId={clientId} /></div>}
    </div>
  </div></AppShell>;
}
