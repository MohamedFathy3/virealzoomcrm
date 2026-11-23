import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { adTransactionSchema } from '@/lib/validators';

export async function POST(request: Request) {
  try {
    const user = await requireUser(['SUPER_ADMIN', 'ADMIN']);
    const parsed = adTransactionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'بيانات حركة الإعلان غير مكتملة' }, { status: 400 });
    const result = await prisma.$transaction(async tx => {
      const wallet = await tx.adWallet.findUnique({ where: { id: parsed.data.walletId } });
      if (!wallet) throw new Error('WALLET_NOT_FOUND');
      const amount = parsed.data.amount;
      const delta = parsed.data.type === 'FUNDS_RECEIVED' || parsed.data.type === 'ADJUSTMENT' ? amount : -amount;
      const nextBalance = Number(wallet.balance) + delta;
      if (nextBalance < 0) throw new Error('INSUFFICIENT_BALANCE');
      const txRow = await tx.adTransaction.create({ data: { walletId: wallet.id, type: parsed.data.type, amount, description: parsed.data.description } });
      const updated = await tx.adWallet.update({ where: { id: wallet.id }, data: { balance: nextBalance, totalReceived: parsed.data.type === 'FUNDS_RECEIVED' ? { increment: amount } : undefined, totalSpent: parsed.data.type === 'CAMPAIGN_SPENDING' ? { increment: amount } : undefined, totalRefunds: parsed.data.type === 'REFUND' ? { increment: amount } : undefined } });
      await tx.auditLog.create({ data: { userId: user.id, action: 'CREATE', entity: 'AdTransaction', entityId: txRow.id, metadata: { walletId: wallet.id, type: parsed.data.type, amount } } });
      return { txRow, updated };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'INSUFFICIENT_BALANCE') return NextResponse.json({ error: 'الرصيد المتاح لا يسمح بهذه الحركة' }, { status: 409 });
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر تسجيل حركة الإعلانات' }, { status: 500 });
  }
}
