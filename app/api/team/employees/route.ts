import { NextResponse } from 'next/server';
import { requireUser, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { employeeSchema } from '@/lib/validators';
import { code } from '@/lib/ids';

export async function POST(request: Request) {
  try {
    await requireUser(['SUPER_ADMIN', 'ADMIN']);
    const parsed = employeeSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'بيانات الموظف غير مكتملة' }, { status: 400 });
    const data = parsed.data;
    const employee = await prisma.$transaction(async tx => {
      let userId: string | undefined;
      if (data.password) {
        const user = await tx.user.upsert({
          where: { email: data.email.trim().toLowerCase() },
          update: { name: data.fullName.trim(), passwordHash: hashPassword(data.password), role: data.role, isActive: true },
          create: { openId: `employee-${code('USR')}`, email: data.email.trim().toLowerCase(), name: data.fullName.trim(), passwordHash: hashPassword(data.password), role: data.role }
        });
        userId = user.id;
      }
      const created = await tx.employee.create({
        data: {
          employeeCode: data.employeeCode?.trim() || code('EMP'),
          fullName: data.fullName.trim(),
          email: data.email.trim().toLowerCase(),
          phone: data.phone?.trim() || null,
          jobTitle: data.jobTitle?.trim() || null,
          hireDate: data.hireDate ? new Date(data.hireDate) : null,
          monthlySalary: data.monthlySalary,
          employmentStatus: data.employmentStatus,
          departmentId: data.departmentId,
          userId
        }
      });
      if (data.role === 'DEPARTMENT_MANAGER') await tx.department.update({ where: { id: data.departmentId }, data: { managerId: created.id } });
      return created;
    });
    return NextResponse.json({ ok: true, employee });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر إضافة الموظف' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireUser(['SUPER_ADMIN', 'ADMIN']);
    const parsed = employeeSchema.safeParse(await request.json());
    if (!parsed.success || !parsed.data.id) return NextResponse.json({ error: 'بيانات الموظف غير مكتملة' }, { status: 400 });
    const data = parsed.data;
    const employee = await prisma.$transaction(async tx => {
      const current = await tx.employee.findUnique({ where: { id: data.id }, select: { id: true } });
      if (!current) throw new Error('NOT_FOUND');
      const updated = await tx.employee.update({
        where: { id: data.id },
        data: {
          employeeCode: data.employeeCode?.trim() || undefined,
          fullName: data.fullName.trim(),
          email: data.email.trim().toLowerCase(),
          phone: data.phone?.trim() || null,
          jobTitle: data.jobTitle?.trim() || null,
          hireDate: data.hireDate ? new Date(data.hireDate) : null,
          monthlySalary: data.monthlySalary,
          employmentStatus: data.employmentStatus,
          departmentId: data.departmentId
        }
      });
      if (updated.userId) {
        await tx.user.update({ where: { id: updated.userId }, data: { name: data.fullName.trim(), email: data.email.trim().toLowerCase(), role: data.role, isActive: data.employmentStatus !== 'INACTIVE', ...(data.password ? { passwordHash: hashPassword(data.password) } : {}) } });
      } else if (data.password) {
        const user = await tx.user.upsert({
          where: { email: data.email.trim().toLowerCase() },
          update: { name: data.fullName.trim(), role: data.role, isActive: true, passwordHash: hashPassword(data.password) },
          create: { openId: `employee-${code('USR')}`, email: data.email.trim().toLowerCase(), name: data.fullName.trim(), role: data.role, passwordHash: hashPassword(data.password) }
        });
        await tx.employee.update({ where: { id: updated.id }, data: { userId: user.id } });
      }
      await tx.department.updateMany({ where: { managerId: updated.id }, data: { managerId: null } });
      if (data.role === 'DEPARTMENT_MANAGER') await tx.department.update({ where: { id: data.departmentId }, data: { managerId: updated.id } });
      return updated;
    });
    return NextResponse.json({ ok: true, employee });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر تعديل الموظف' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireUser(['SUPER_ADMIN', 'ADMIN']);
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'معرف الموظف مطلوب' }, { status: 400 });
    await prisma.$transaction(async tx => {
      const employee = await tx.employee.findUnique({ where: { id } });
      if (!employee) throw new Error('NOT_FOUND');
      await tx.employee.update({ where: { id }, data: { employmentStatus: 'INACTIVE' } });
      if (employee.userId) await tx.user.update({ where: { id: employee.userId }, data: { isActive: false } });
      await tx.department.updateMany({ where: { managerId: id }, data: { managerId: null } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر حذف الموظف' }, { status: 500 });
  }
}
