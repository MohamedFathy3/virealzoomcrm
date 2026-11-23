import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { salesRevenueSchema } from '@/lib/validators';
import { getEmployeeDepartment, isSalesDepartment } from '@/lib/team-access';

export async function POST(request: Request) {
  try {
    const user = await requireUser(['EMPLOYEE', 'DEPARTMENT_MANAGER']);
    const employee = await getEmployeeDepartment(user.id);
    const isSalesUser = Boolean(employee && isSalesDepartment(employee.department.name) &&
      (user.role === 'EMPLOYEE' || employee.managedDepartment?.id === employee.departmentId));
    if (!employee || !isSalesUser) {
      return NextResponse.json({ error: 'هذه العملية متاحة لفريق المبيعات فقط' }, { status: 403 });
    }

    const parsed = salesRevenueSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'بيانات التحصيل غير مكتملة' }, { status: 400 });
    const client = await prisma.client.findUnique({
      where: { id: parsed.data.clientId },
      select: { id: true, createdById: true }
    });
    if (!client || (user.role === 'EMPLOYEE' && client.createdById !== user.id)) return NextResponse.json({ error: 'لا يمكنك تسجيل تحصيل لهذا العميل' }, { status: 403 });
    const date = new Date(parsed.data.date);
    if (Number.isNaN(date.getTime())) return NextResponse.json({ error: 'تاريخ التحصيل غير صحيح' }, { status: 400 });
    const campaignName = parsed.data.campaignName?.trim();
    if (!campaignName) return NextResponse.json({ error: 'اسم الحملة مطلوب لميزانيتها' }, { status: 400 });

    await prisma.$transaction(async tx => {
      let wallet = await tx.adWallet.findFirst({
        where: { clientId: client.id },
        orderBy: { createdAt: 'asc' }
      });
      if (!wallet) {
        wallet = await tx.adWallet.create({
          data: { clientId: client.id, name: 'محفظة إعلانات العميل' }
        });
      }
      await tx.adTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'FUNDS_RECEIVED',
          amount: parsed.data.adBudget,
          description: `ميزانية الحملة: ${campaignName}`
        }
      });
      await tx.adWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: parsed.data.adBudget },
          totalReceived: { increment: parsed.data.adBudget }
        }
      });
      await tx.adCampaign.create({
        data: {
          walletId: wallet.id,
          name: campaignName,
          budget: parsed.data.adBudget,
          startDate: date,
          status: 'مخططة'
        }
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          entity: 'ClientRevenue',
          entityId: client.id,
          metadata: {
            campaignName,
            adBudgetAdded: true
          }
        }
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر تسجيل التحصيل' }, { status: 500 });
  }
}
