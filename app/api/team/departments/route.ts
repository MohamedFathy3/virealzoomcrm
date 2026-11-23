import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { departmentSchema } from '@/lib/validators';

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  return null;
}

export async function POST(request: Request) {
  try {
    await requireUser(['SUPER_ADMIN', 'ADMIN']);
    const parsed = departmentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'بيانات القسم غير مكتملة' }, { status: 400 });
    const { name, description, managerId } = parsed.data;
    const department = await prisma.$transaction(async tx => {
      if (managerId) {
        const manager = await tx.employee.findUnique({ where: { id: managerId } });
        if (!manager) throw new Error('EMPLOYEE_NOT_FOUND');
        await tx.department.updateMany({ where: { managerId }, data: { managerId: null } });
      }
      const created = await tx.department.create({ data: { name: name.trim(), description: description?.trim() || null } });
      if (managerId) {
        const employee = await tx.employee.update({ where: { id: managerId }, data: { departmentId: created.id } });
        await tx.department.update({ where: { id: created.id }, data: { managerId } });
        if (employee.userId) await tx.user.update({ where: { id: employee.userId }, data: { role: 'DEPARTMENT_MANAGER' } });
      }
      return created;
    });
    return NextResponse.json({ ok: true, department });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    if (error instanceof Error && error.message === 'EMPLOYEE_NOT_FOUND') return NextResponse.json({ error: 'الموظف المحدد غير موجود' }, { status: 404 });
    return NextResponse.json({ error: 'تعذر حفظ القسم' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireUser(['SUPER_ADMIN', 'ADMIN']);
    const parsed = departmentSchema.safeParse(await request.json());
    if (!parsed.success || !parsed.data.id) return NextResponse.json({ error: 'بيانات القسم غير مكتملة' }, { status: 400 });
    const { id, name, description, managerId } = parsed.data;
    const department = await prisma.$transaction(async tx => {
      const current = await tx.department.findUnique({ where: { id }, select: { managerId: true } });
      if (!current) throw new Error('DEPARTMENT_NOT_FOUND');
      if (managerId) {
        const manager = await tx.employee.findUnique({ where: { id: managerId } });
        if (!manager) throw new Error('EMPLOYEE_NOT_FOUND');
      }
      await tx.department.update({ where: { id }, data: { name: name.trim(), description: description?.trim() || null, managerId: null } });
      if (current.managerId && current.managerId !== managerId) {
        const previousManager = await tx.employee.findUnique({ where: { id: current.managerId }, select: { userId: true } });
        if (previousManager?.userId) await tx.user.update({ where: { id: previousManager.userId }, data: { role: 'EMPLOYEE' } });
      }
      if (managerId) {
        await tx.department.updateMany({ where: { managerId, id: { not: id } }, data: { managerId: null } });
        const manager = await tx.employee.update({ where: { id: managerId }, data: { departmentId: id } });
        await tx.department.update({ where: { id }, data: { managerId } });
        if (manager.userId) await tx.user.update({ where: { id: manager.userId }, data: { role: 'DEPARTMENT_MANAGER' } });
      }
      return tx.department.findUniqueOrThrow({ where: { id } });
    });
    return NextResponse.json({ ok: true, department });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    if (error instanceof Error && error.message === 'EMPLOYEE_NOT_FOUND') return NextResponse.json({ error: 'الموظف المحدد غير موجود' }, { status: 404 });
    if (error instanceof Error && error.message === 'DEPARTMENT_NOT_FOUND') return NextResponse.json({ error: 'القسم غير موجود' }, { status: 404 });
    return NextResponse.json({ error: 'تعذر تعديل القسم' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireUser(['SUPER_ADMIN', 'ADMIN']);
    const { id } = await request.json() as { id?: string };
    if (!id) return NextResponse.json({ error: 'معرف القسم مطلوب' }, { status: 400 });
    const department = await prisma.department.findUnique({ where: { id }, include: { _count: { select: { employees: true, tasks: true } } } });
    if (!department) return NextResponse.json({ error: 'القسم غير موجود' }, { status: 404 });
    if (department._count.employees || department._count.tasks) return NextResponse.json({ error: 'لا يمكن حذف قسم مرتبط بموظفين أو مهام؛ عطله بدلاً من ذلك' }, { status: 409 });
    await prisma.department.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    return NextResponse.json({ error: 'تعذر حذف القسم' }, { status: 500 });
  }
}
