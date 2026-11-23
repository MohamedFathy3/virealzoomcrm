import type { Prisma } from '@prisma/client';

export function getSubscriptionExpirationDate(startDate: Date, durationDays: number) {
  const expirationDate = new Date(startDate);
  expirationDate.setDate(expirationDate.getDate() + durationDays);
  return expirationDate;
}

export function splitContractTotalEqually(total: number, count: number) {
  if (count < 1) return [];
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents % count;
  return Array.from({ length: count }, (_, index) => (baseCents + (index < remainderCents ? 1 : 0)) / 100);
}

export function allocateContractTotalByCatalogPrice(total: number, catalogPrices: number[]) {
  if (!catalogPrices.length) return [];
  const totalCents = Math.round(total * 100);
  const weights = catalogPrices.map(price => Math.max(0, Math.round(price * 100)));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightTotal === 0) return splitContractTotalEqually(total, catalogPrices.length);

  const allocations = weights.map(weight => {
    const exactCents = totalCents * weight / weightTotal;
    return { cents: Math.floor(exactCents), remainder: exactCents - Math.floor(exactCents) };
  });
  let remainingCents = totalCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
  const remainderOrder = allocations
    .map((allocation, index) => ({ index, remainder: allocation.remainder }))
    .sort((left, right) => right.remainder - left.remainder);
  for (let index = 0; index < remainingCents; index += 1) {
    allocations[remainderOrder[index].index].cents += 1;
  }
  return allocations.map(allocation => allocation.cents / 100);
}

export async function syncClientSubscriptionPayments(tx: Prisma.TransactionClient, clientId: string) {
  const [subscriptions, payments, legacyPayments] = await Promise.all([
    tx.subscription.findMany({
      where: { clientId, status: { not: 'CANCELLED' } },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, contractValue: true }
    }),
    tx.clientPayment.findMany({
      where: { clientId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: { amount: true, date: true, createdAt: true }
    }),
    tx.financeTransaction.findMany({
      where: { clientId, type: 'SERVICE_REVENUE', clientPayment: null },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: { amount: true, date: true, createdAt: true }
    })
  ]);
  const paymentEvents = [
    ...payments.map(payment => ({ amount: payment.amount, date: payment.date, createdAt: payment.createdAt })),
    ...legacyPayments.map(payment => ({ amount: payment.amount, date: payment.date, createdAt: payment.createdAt }))
  ].sort((left, right) =>
    left.date.getTime() - right.date.getTime() || left.createdAt.getTime() - right.createdAt.getTime()
  );
  const paidCentsBySubscription = new Map(subscriptions.map(subscription => [subscription.id, 0]));

  for (const payment of paymentEvents) {
    let unallocatedCents = Math.round(Number(payment.amount) * 100);
    for (const subscription of subscriptions) {
      if (unallocatedCents === 0) break;
      const contractCents = Math.round(Number(subscription.contractValue) * 100);
      const paidCents = paidCentsBySubscription.get(subscription.id) ?? 0;
      const appliedCents = Math.min(unallocatedCents, Math.max(0, contractCents - paidCents));
      paidCentsBySubscription.set(subscription.id, paidCents + appliedCents);
      unallocatedCents -= appliedCents;
    }
  }

  for (const subscription of subscriptions) {
    const contractCents = Math.round(Number(subscription.contractValue) * 100);
    const amountPaidCents = paidCentsBySubscription.get(subscription.id) ?? 0;
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { amountPaid: amountPaidCents / 100, outstanding: (contractCents - amountPaidCents) / 100 }
    });
  }
}
