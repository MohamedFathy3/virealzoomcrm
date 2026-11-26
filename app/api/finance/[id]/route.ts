import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { financeSchema } from '@/lib/validators';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(['SUPER_ADMIN', 'ADMIN']);
    const { id } = await params;
    const parsed = financeSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'بيانات المعاملة غير مكتملة' }, { status: 400 });

    const date = new Date(parsed.data.date);
    if (Number.isNaN(date.getTime())) return NextResponse.json({ error: 'تاريخ المعاملة غير صحيح' }, { status: 400 });

    const existing = await prisma.financeTransaction.findUnique({
      where: { id },
      select: {
        id: true,
        transactionNo: true,
        type: true,
        amount: true,
        clientPayment: { select: { id: true } }
      }
    });
    if (!existing) return NextResponse.json({ error: 'المعاملة غير موجودة' }, { status: 404 });
    if (existing.clientPayment) {
      return NextResponse.json({ error: 'عدّل تحصيل العميل من سجل تحصيلاته للحفاظ على تطابق القيود' }, { status: 409 });
    }

    const transaction = await prisma.$transaction(async tx => {
      const updated = await tx.financeTransaction.update({
        where: { id },
        data: {
          type: parsed.data.type,
          amount: parsed.data.amount,
          date,
          paymentMethod: parsed.data.paymentMethod?.trim() || null,
          category: parsed.data.category?.trim() || null,
          clientId: parsed.data.clientId || null,
          description: parsed.data.description?.trim() || null
        }
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entity: 'FinanceTransaction',
          entityId: updated.id,
          metadata: {
            transactionNo: updated.transactionNo,
            previousType: existing.type,
            type: updated.type,
            previousAmount: Number(existing.amount),
            amount: Number(updated.amount)
          }
        }
      });
      return updated;
    });

    return NextResponse.json({ ok: true, transaction });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر تحديث المعاملة' }, { status: 500 });
  }
}
