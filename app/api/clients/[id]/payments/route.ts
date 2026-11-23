import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { code } from '@/lib/ids';
import { getEmployeeDepartment, isSalesDepartment } from '@/lib/team-access';
import { clientPaymentSchema } from '@/lib/validators';
import { syncClientSubscriptionPayments } from '@/lib/client-contracts';

type RouteContext = { params: Promise<{ id: string }> };

async function getPaymentAccess(user: Awaited<ReturnType<typeof requireUser>>, clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, status: true, createdById: true }
  });
  if (!client) return { client: null, allowed: false };

  const isFinanceAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const employee = user.role === 'EMPLOYEE' || user.role === 'DEPARTMENT_MANAGER'
    ? await getEmployeeDepartment(user.id)
    : null;
  const isSalesEmployee = user.role === 'EMPLOYEE' && Boolean(employee && isSalesDepartment(employee.department.name));
  const isSalesManager = user.role === 'DEPARTMENT_MANAGER' && Boolean(
    employee && isSalesDepartment(employee.department.name) &&
    employee.managedDepartment?.id === employee.departmentId
  );
  const allowed = isFinanceAdmin || isSalesManager || Boolean(isSalesEmployee && client.createdById === user.id);
  return { client, allowed };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const access = await getPaymentAccess(user, id);
    if (!access.client) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ error: 'غير مصرح بتسجيل دفعة لهذا العميل' }, { status: 403 });
    if (access.client.status !== 'ACTIVE') return NextResponse.json({ error: 'يمكن تسجيل الدفعات للعملاء النشطين فقط' }, { status: 400 });

    const parsed = clientPaymentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'بيانات الدفعة غير صحيحة' }, { status: 400 });
    const date = new Date(parsed.data.date);
    if (Number.isNaN(date.getTime())) return NextResponse.json({ error: 'تاريخ الدفعة غير صحيح' }, { status: 400 });

    await prisma.$transaction(async tx => {
      const currentClient = await tx.client.findUnique({ where: { id }, select: { status: true } });
      if (!currentClient || currentClient.status !== 'ACTIVE') throw new Error('CLIENT_NOT_ACTIVE');
      const subscriptions = await tx.subscription.findMany({
        where: { clientId: id, status: { not: 'CANCELLED' } },
        select: { outstanding: true }
      });
      const outstandingCents = subscriptions.reduce((sum, subscription) => sum + Math.round(Number(subscription.outstanding) * 100), 0);
      const paymentCents = Math.round(parsed.data.amount * 100);
      if (outstandingCents <= 0) throw new Error('NO_OUTSTANDING_BALANCE');
      if (paymentCents > outstandingCents) throw new Error('PAYMENT_EXCEEDS_BALANCE');

      const [plannedAdBudget, collectedAdBudget] = await Promise.all([
        tx.clientServiceInterest.aggregate({
          where: { clientId: id },
          _sum: { adBudgetAmount: true }
        }),
        tx.clientPayment.aggregate({
          where: { clientId: id },
          _sum: { adBudgetAmount: true }
        })
      ]);
      const remainingAdBudgetCents = Math.max(
        0,
        Math.round(Number(plannedAdBudget._sum.adBudgetAmount ?? 0) * 100) -
        Math.round(Number(collectedAdBudget._sum.adBudgetAmount ?? 0) * 100)
      );
      const adBudgetCents = Math.min(paymentCents, remainingAdBudgetCents);
      const serviceRevenueCents = paymentCents - adBudgetCents;
      const financeTransaction = serviceRevenueCents > 0
        ? await tx.financeTransaction.create({
          data: {
            transactionNo: code('FIN'),
            type: 'SERVICE_REVENUE',
            amount: serviceRevenueCents / 100,
            date,
            paymentMethod: parsed.data.paymentMethod,
            category: 'دفعة عميل',
            description: `دفعة خدمات - ${access.client.name}`,
            clientId: id,
            createdById: user.id
          }
        })
        : null;
      const payment = await tx.clientPayment.create({
        data: {
          paymentNo: code('PAY'),
          clientId: id,
          amount: paymentCents / 100,
          serviceRevenueAmount: serviceRevenueCents / 100,
          adBudgetAmount: adBudgetCents / 100,
          date,
          paymentMethod: parsed.data.paymentMethod,
          createdById: user.id,
          financeTransactionId: financeTransaction?.id
        }
      });
      if (adBudgetCents > 0) {
        let wallet = await tx.adWallet.findFirst({
          where: { clientId: id },
          orderBy: { createdAt: 'asc' }
        });
        if (!wallet) {
          wallet = await tx.adWallet.create({
            data: { clientId: id, name: 'محفظة إعلانات العميل' }
          });
        }
        await tx.adTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'FUNDS_RECEIVED',
            amount: adBudgetCents / 100,
            referenceNo: payment.id,
            description: `من دفعة العميل ${payment.paymentNo} - ميزانية شراء الإعلانات`
          }
        });
        await tx.adWallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: adBudgetCents / 100 },
            totalReceived: { increment: adBudgetCents / 100 }
          }
        });
      }
      await syncClientSubscriptionPayments(tx, id);
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          entity: 'ClientPayment',
          entityId: payment.id,
          metadata: {
            paymentNo: payment.paymentNo,
            amount: paymentCents / 100,
            serviceRevenueAmount: serviceRevenueCents / 100,
            adBudgetAmount: adBudgetCents / 100,
            paymentMethod: parsed.data.paymentMethod
          }
        }
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    if (message === 'CLIENT_NOT_ACTIVE') return NextResponse.json({ error: 'يمكن تسجيل الدفعات للعملاء النشطين فقط' }, { status: 400 });
    if (message === 'NO_OUTSTANDING_BALANCE') return NextResponse.json({ error: 'لا يوجد اشتراك بمبلغ مستحق لهذا العميل' }, { status: 400 });
    if (message === 'PAYMENT_EXCEEDS_BALANCE') return NextResponse.json({ error: 'مبلغ الدفعة أكبر من المبلغ المتبقي على العميل' }, { status: 400 });
    return NextResponse.json({ error: 'تعذر تسجيل الدفعة' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const access = await getPaymentAccess(user, id);
    if (!access.client) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ error: 'غير مصرح بحذف دفعة هذا العميل' }, { status: 403 });

    const body = await request.json() as { transactionId?: string };
    if (!body.transactionId) return NextResponse.json({ error: 'معرف الدفعة مطلوب' }, { status: 400 });
    await prisma.$transaction(async tx => {
      const payment = await tx.clientPayment.findFirst({
        where: { id: body.transactionId, clientId: id },
        select: { id: true, paymentNo: true, amount: true, paymentMethod: true, adBudgetAmount: true, financeTransactionId: true }
      });
      if (!payment) throw new Error('PAYMENT_NOT_FOUND');
      if (Number(payment.adBudgetAmount) > 0) {
        const wallet = await tx.adWallet.findFirst({
          where: { clientId: id },
          orderBy: { createdAt: 'asc' }
        });
        if (!wallet || Math.round(Number(wallet.balance) * 100) < Math.round(Number(payment.adBudgetAmount) * 100)) {
          throw new Error('AD_BUDGET_ALREADY_SPENT');
        }
        await tx.adTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'REFUND',
            amount: payment.adBudgetAmount,
            referenceNo: payment.id,
            description: `عكس دفعة العميل ${payment.paymentNo} المحذوفة`
          }
        });
        await tx.adWallet.update({
          where: { id: wallet.id },
          data: {
            balance: { decrement: payment.adBudgetAmount },
            totalRefunds: { increment: payment.adBudgetAmount }
          }
        });
      }
      if (payment.financeTransactionId) {
        await tx.financeTransaction.delete({ where: { id: payment.financeTransactionId } });
      }
      await tx.clientPayment.delete({ where: { id: payment.id } });
      await syncClientSubscriptionPayments(tx, id);
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'DELETE',
          entity: 'ClientPayment',
          entityId: payment.id,
          metadata: {
            paymentNo: payment.paymentNo,
            amount: Number(payment.amount),
            adBudgetAmount: Number(payment.adBudgetAmount),
            paymentMethod: payment.paymentMethod
          }
        }
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    if (message === 'PAYMENT_NOT_FOUND') return NextResponse.json({ error: 'الدفعة غير موجودة' }, { status: 404 });
    if (message === 'AD_BUDGET_ALREADY_SPENT') return NextResponse.json({ error: 'لا يمكن حذف الدفعة لأن جزء ميزانية الإعلانات منها تم إنفاقه' }, { status: 409 });
    return NextResponse.json({ error: 'تعذر حذف الدفعة' }, { status: 500 });
  }
}
