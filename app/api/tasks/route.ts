import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { taskSchema } from '@/lib/validators';
import { code } from '@/lib/ids';
import { getManagedDepartmentId } from '@/lib/team-access';

export async function POST(request: Request) {
  try {
    const user = await requireUser(['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_MANAGER']);
    const parsed = taskSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'بيانات المهمة غير مكتملة' }, { status: 400 });
    if (parsed.data.assigneeId) {
      const assignee = await prisma.employee.findUnique({ where: { id: parsed.data.assigneeId }, select: { departmentId: true } });
      if (!assignee || assignee.departmentId !== parsed.data.departmentId) {
        return NextResponse.json({ error: 'الموظف المكلف يجب أن يكون من نفس القسم' }, { status: 400 });
      }
    }
    if (user.role === 'DEPARTMENT_MANAGER') {
      const managedDepartmentId = await getManagedDepartmentId(user.id);
      if (!managedDepartmentId || managedDepartmentId !== parsed.data.departmentId) return NextResponse.json({ error: 'يمكن لمدير القسم إنشاء مهام لقسمه فقط' }, { status: 403 });
    }
    const task = await prisma.$transaction(async tx => {
      const created = await tx.task.create({ data: { ...parsed.data, taskNo: code('TSK'), deadline: new Date(parsed.data.deadline), estimatedHours: parsed.data.estimatedHours, createdById: user.id, status: parsed.data.assigneeId ? 'ASSIGNED' : 'NEW' } });
      await tx.taskStatusHistory.create({ data: { taskId: created.id, to: created.status, changedBy: user.id } });
      if (parsed.data.assigneeId) await tx.taskAssignment.create({ data: { taskId: created.id, employeeId: parsed.data.assigneeId } });
      return created;
    });
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر إنشاء المهمة' }, { status: 500 });
  }
}
