import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ExternalLink, FileText } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { TaskWorkflowActions } from '@/components/forms';
import { SectionTitle, StatusBadge } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canViewSalesClientTask, getEmployeeDepartment, isSalesDepartment } from '@/lib/team-access';
import { getTaskAttachments } from '@/lib/task-attachments';
import { date, relativeDays } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function TaskDetailsPage({ params }: { params: Promise<{ taskId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { taskId } = await params;
  const [task, employee] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      include: {
        department: true,
        client: { select: { id: true, name: true, createdById: true } },
        service: { select: { name: true } },
        assignee: { include: { user: { select: { id: true } } } },
        assignments: { include: { employee: { include: { user: { select: { id: true } } } } } },
        submissions: {
          orderBy: { version: 'desc' },
          include: {
            submittedBy: { select: { name: true } },
            reviews: { orderBy: { reviewedAt: 'desc' }, include: { reviewer: { select: { name: true } } } }
          }
        }
      }
    }),
    user.role === 'EMPLOYEE' || user.role === 'DEPARTMENT_MANAGER' ? getEmployeeDepartment(user.id) : Promise.resolve(null)
  ]);
  if (!task) notFound();

  const isAssigned = task.assignee?.user?.id === user.id ||
    task.assignments.some(assignment => assignment.employee.user?.id === user.id);
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const canReview = isAdmin ||
    (user.role === 'DEPARTMENT_MANAGER' && employee?.managedDepartment?.id === task.departmentId);
  const canViewClientTask = canViewSalesClientTask(user.role, user.id, employee, task.client?.createdById ?? null);
  if (!isAssigned && !canReview && !canViewClientTask) notFound();

  const latest = task.submissions[0];
  const submission = latest ? {
    id: latest.id,
    completionNotes: latest.completionNotes,
    submittedAt: latest.submittedAt.toISOString(),
    attachments: getTaskAttachments(latest.attachments, task.id),
    reviews: task.submissions.flatMap(version => version.reviews.map(review => ({
      decision: review.decision,
      comments: review.comments,
      qualityScore: review.qualityScore
    })))
  } : null;
  const salesManager = user.role === 'DEPARTMENT_MANAGER' && Boolean(employee && isSalesDepartment(employee.department.name));

  return <AppShell user={user}><div className="content">
    <Link href={task.client ? `/clients/${task.client.id}` : '/tasks'} className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-[#6d4bc3]"><ArrowRight size={15} />{task.client ? `العودة لملف ${task.client.name}` : 'العودة للمهام'}</Link>
    <div className="card card-pad mb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="eyebrow">{task.taskNo} · {task.department.name}</div><h1 className="mt-2 text-2xl font-black text-[#241744]">{task.title}</h1><p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-[#625c6d]">{task.description || 'لا توجد تفاصيل إضافية للمهمة.'}</p></div>
        <StatusBadge status={task.status} />
      </div>
      <div className="mt-5 grid gap-3 border-t border-[#f0edf5] pt-4 sm:grid-cols-2 xl:grid-cols-5">
        <div><div className="label">العميل</div><div className="mt-1 text-sm font-bold text-[#241744]">{task.client?.name || 'مهمة داخلية'}</div></div>
        <div><div className="label">الخدمة المرتبطة</div><div className="mt-1 text-sm font-bold text-[#241744]">{task.service?.name || '—'}</div></div>
        <div><div className="label">المكلف</div><div className="mt-1 text-sm font-bold text-[#241744]">{task.assignee?.fullName || 'غير مسندة'}</div></div>
        <div><div className="label">الأولوية / التقدم</div><div className="mt-1 flex items-center gap-2"><StatusBadge status={task.priority} /><span className="text-xs font-bold text-[#625c6d]">{task.progress}%</span></div></div>
        <div><div className="label">الموعد النهائي</div><div className="mt-1 text-sm font-bold text-[#241744]">{date(task.deadline)}</div><div className="text-[10px] text-[#8a8396]">{relativeDays(task.deadline)}</div></div>
      </div>
    </div>

    {task.submissions.length > 0 && <div className="card mb-5">
      <div className="card-pad pb-2"><SectionTitle eyebrow="DELIVERABLES & REVIEW HISTORY" title="التسليمات وملاحظات المدير" description="كل نسخة تسليم ومرفقاتها وتعليقات المراجعة محفوظة هنا." /></div>
      <div className="divide-y divide-[#f0edf5]">
        {task.submissions.map(version => <div key={version.id} className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-black text-[#241744]">التسليم رقم {version.version}</div><div className="text-[11px] text-[#8a8396]">{date(version.submittedAt)} · بواسطة {version.submittedBy.name}</div></div>
          {version.completionNotes && <p className="whitespace-pre-wrap rounded-xl bg-[#faf9fc] p-3 text-sm leading-6 text-[#625c6d]">{version.completionNotes}</p>}
          {getTaskAttachments(version.attachments, task.id).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{getTaskAttachments(version.attachments, task.id).map(file => <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#eeeaf4] px-3 py-2 text-xs font-bold text-[#6245ad]"><FileText size={14} />{file.name}<ExternalLink size={12} /></a>)}</div>}
          {version.reviews.map(review => <div key={review.id} className="mt-3 rounded-xl border border-[#eeeaf4] p-3">
            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={review.decision} /><span className="text-[11px] text-[#8a8396]">مراجعة {review.reviewer.name}</span>{review.qualityScore !== null && <span className="text-[11px] font-bold text-[#a26a12]">الجودة {review.qualityScore}/5</span>}</div>
            {review.comments && <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-[#625c6d]">{review.comments}</p>}
          </div>)}
        </div>)}
      </div>
    </div>}

    {(isAssigned || canReview) && <div className="card card-pad"><SectionTitle eyebrow="TASK ACTION" title="تسليم أو مراجعة المهمة" /><TaskWorkflowActions taskId={task.id} isAssigned={isAssigned} canReview={canReview && !isAssigned} status={task.status} submission={submission} /></div>}
    {salesManager && <p className="mt-4 text-[11px] text-[#8a8396]">تظهر هذه التفاصيل لمدير المبيعات لمتابعة شغل عملائه؛ صلاحية تعديل المهمة تبقى للقسم المسؤول.</p>}
  </div></AppShell>;
}
