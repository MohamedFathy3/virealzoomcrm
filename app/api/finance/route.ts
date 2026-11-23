import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { financeSchema } from '@/lib/validators';
import { code } from '@/lib/ids';

export async function POST(request: Request) {
  try {
    const user = await requireUser(['SUPER_ADMIN', 'ADMIN']);
    const parsed = financeSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'بيانات المعاملة غير مكتملة' }, { status: 400 });
    const transaction = await prisma.$transaction(async tx => {
      const row = await tx.financeTransaction.create({ data: { ...parsed.data, transactionNo: code('FIN'), amount: parsed.data.amount, date: new Date(parsed.data.date), clientId: parsed.data.clientId || undefined, createdById: user.id } });
      await tx.auditLog.create({ data: { userId: user.id, action: 'CREATE', entity: 'FinanceTransaction', entityId: row.id, metadata: { transactionNo: row.transactionNo, amount: parsed.data.amount } } });
      return row;
    });
    return NextResponse.json({ ok: true, transaction });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر تسجيل المعاملة' }, { status: 500 });
  }
}
