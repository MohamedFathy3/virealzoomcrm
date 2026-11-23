import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const user = await requireUser(['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_MANAGER']);
    const { taskId } = await params;
    const data = await request.json() as { decision?: string; comments?: string; qualityScore?: string | number };
    if (!['APPROVED', 'REVISION_REQUIRED'].includes(data.decision || '')) {
      return NextResponse.json({ error: 'قرار المراجعة غير صحيح' }, { status: 400 });
    }
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        department: { include: { manager: true } },
        submissions: { orderBy: { version: 'desc' }, take: 1 }
      }
    });
    if (!task) return NextResponse.json({ error: 'المهمة غير موجودة' }, { status: 404 });
    if (user.role === 'DEPARTMENT_MANAGER') {
      const manager = await prisma.employee.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!manager || task.department.managerId !== manager.id) return NextResponse.json({ error: 'يمكنك مراجعة مهام قسمك فقط' }, { status: 403 });
    }
    const latest = task.submissions[0];
    if (!latest || !['SUBMITTED', 'UNDER_REVIEW'].includes(task.status)) {
      return NextResponse.json({ error: 'لا يوجد تسليم ينتظر المراجعة' }, { status: 409 });
    }
    if (latest.submittedById === user.id) return NextResponse.json({ error: 'لا يمكن اعتماد تسليمك بنفسك' }, { status: 403 });
    const qualityScore = data.qualityScore === '' || data.qualityScore === undefined ? null : Number(data.qualityScore);
    if (qualityScore !== null && (!Number.isInteger(qualityScore) || qualityScore < 1 || qualityScore > 5)) {
      return NextResponse.json({ error: 'تقييم الجودة يجب أن يكون من 1 إلى 5' }, { status: 400 });
    }
    const comments = typeof data.comments === 'string' ? data.comments.trim() : '';
    if (comments.length > 10000) return NextResponse.json({ error: 'تعليق المراجعة يتجاوز الحد المسموح' }, { status: 400 });
    if (data.decision === 'REVISION_REQUIRED' && !comments) {
      return NextResponse.json({ error: 'اكتب المطلوب تعديله قبل إرسال الملاحظة' }, { status: 400 });
    }
    const newStatus = data.decision === 'APPROVED' ? 'APPROVED' : 'REVISION_REQUIRED';

    await prisma.$transaction(async tx => {
      await tx.taskReview.create({
        data: {
          taskId,
          submissionId: latest.id,
          reviewerId: user.id,
          decision: data.decision === 'APPROVED' ? 'APPROVED' : 'REVISION_REQUIRED',
          comments: comments || null,
          qualityScore
        }
      });
      await tx.task.update({ where: { id: taskId }, data: { status: newStatus, progress: newStatus === 'APPROVED' ? 100 : 80 } });
      await tx.taskStatusHistory.create({ data: { taskId, from: task.status, to: newStatus, changedBy: user.id, reason: comments.slice(0, 191) || undefined } });
      const submittingEmployee = await tx.employee.findUnique({ where: { userId: latest.submittedById }, select: { id: true } });
      if (newStatus === 'APPROVED' && submittingEmployee) {
        await tx.productivityRecord.upsert({
          where: { employeeId_taskId: { employeeId: submittingEmployee.id, taskId } },
          create: {
            employeeId: submittingEmployee.id,
            taskId,
            points: task.productivityPoints,
            onTime: latest.submittedAt <= task.deadline,
            qualityScore,
            estimatedHours: task.estimatedHours,
            actualHours: latest.actualHours
          },
          update: { points: task.productivityPoints, onTime: latest.submittedAt <= task.deadline, qualityScore, estimatedHours: task.estimatedHours, actualHours: latest.actualHours }
        });
      }
      if (latest.submittedById !== user.id) {
        await tx.notification.create({
          data: {
            userId: latest.submittedById,
            title: newStatus === 'APPROVED' ? 'تم اعتماد المهمة' : 'المهمة تحتاج إلى تعديل',
            body: (comments || task.title).slice(0, 191),
            type: newStatus === 'APPROVED' ? 'TASK_APPROVED' : 'TASK_REVISION'
          }
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    return NextResponse.json({ error: 'تعذرت مراجعة المهمة' }, { status: 500 });
  }
}
