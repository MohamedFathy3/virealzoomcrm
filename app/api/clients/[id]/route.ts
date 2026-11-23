import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { clientSchema } from '@/lib/validators';
import { getEmployeeDepartment, isSalesDepartment } from '@/lib/team-access';
import { getSubscriptionExpirationDate, syncClientSubscriptionPayments } from '@/lib/client-contracts';
import { isAdvertisingPurchaseService } from '@/lib/client-ad-budget';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const parsed = clientSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'بيانات العميل غير صحيحة' }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        serviceInterests: { select: { serviceId: true, catalogPrice: true, finalPrice: true, adBudgetAmount: true, serviceDescription: true } },
        subscriptions: { select: { id: true, serviceId: true, startDate: true, status: true } }
      }
    });
    if (!client) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });

    const employee = user.role === 'EMPLOYEE' || user.role === 'DEPARTMENT_MANAGER'
      ? await getEmployeeDepartment(user.id)
      : null;
    const isOwnerSalesperson = user.role === 'EMPLOYEE' && Boolean(
      employee && isSalesDepartment(employee.department.name) && client.createdById === user.id
    );
    const isSalesManager = user.role === 'DEPARTMENT_MANAGER' && Boolean(
      employee && isSalesDepartment(employee.department.name) &&
      employee.managedDepartment?.id === employee.departmentId
    );
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && !isOwnerSalesperson && !isSalesManager) {
      return NextResponse.json({ error: 'غير مصرح بتعديل هذا العميل' }, { status: 403 });
    }

    const { nextFollowUpAt, serviceSelections, ...data } = parsed.data;
    const followUpDate = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
    if (followUpDate && Number.isNaN(followUpDate.getTime())) {
      return NextResponse.json({ error: 'موعد المتابعة غير صحيح' }, { status: 400 });
    }

    const serviceIds = serviceSelections.map(selection => selection.serviceId);
    const services = serviceIds.length
      ? await prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, name: true, description: true, isActive: true, durationDays: true }
      })
      : [];
    if (services.length !== serviceIds.length) {
      return NextResponse.json({ error: 'توجد خدمة غير متاحة ضمن الاختيارات' }, { status: 400 });
    }
    const existingInterests = new Map(client.serviceInterests.map(interest => [interest.serviceId, interest]));
    if (services.some(service => !service.isActive && !existingInterests.has(service.id))) {
      return NextResponse.json({ error: 'لا يمكن إضافة خدمة غير مفعّلة' }, { status: 400 });
    }
    for (const selection of serviceSelections) {
      const service = services.find(item => item.id === selection.serviceId);
      if (!service) return NextResponse.json({ error: 'توجد خدمة غير متاحة ضمن الاختيارات' }, { status: 400 });
      if (selection.adBudgetAmount > 0 && !isAdvertisingPurchaseService(service.name)) {
        return NextResponse.json({ error: 'ميزانية الإعلانات مسموحة لخدمة شراء الإعلانات فقط' }, { status: 400 });
      }
      if (Math.round(selection.adBudgetAmount * 100) > Math.round(selection.agreedPrice * 100)) {
        return NextResponse.json({ error: 'ميزانية الإعلانات لا يمكن أن تتجاوز سعر الخدمة' }, { status: 400 });
      }
    }
    const newInterests = services
      .filter(service => !existingInterests.has(service.id))
      .map(service => {
        const selection = serviceSelections.find(item => item.serviceId === service.id);
        if (!selection) throw new Error('SERVICE_SELECTION_MISMATCH');
        return {
          clientId: id,
          serviceId: service.id,
          catalogPrice: null,
          finalPrice: Math.round(selection.agreedPrice * 100) / 100,
          adBudgetAmount: selection.adBudgetAmount,
          serviceDescription: service.description
        };
      });
    const requestedAdBudget = serviceSelections.reduce((sum, selection) => sum + selection.adBudgetAmount, 0);
      const paidAdBudget = await prisma.clientPayment.aggregate({
        where: { clientId: id },
        _sum: { adBudgetAmount: true }
      });
      if (requestedAdBudget < Number(paidAdBudget._sum.adBudgetAmount ?? 0)) {
        return NextResponse.json({ error: 'لا يمكن تقليل ميزانية الإعلانات عن المبلغ الذي تم إيداعه بالفعل' }, { status: 409 });
      }
    const proposalTotal = serviceSelections.reduce((sum, selection) => sum + Math.round(selection.agreedPrice * 100), 0) / 100;

    await prisma.$transaction(async tx => {
      await tx.client.update({
        where: { id },
        data: {
          name: data.name.trim(),
          companyName: data.companyName?.trim() || null,
          phone: data.phone?.trim() || null,
          email: data.email?.trim() || null,
          businessActivity: data.businessActivity?.trim() || null,
          address: data.address?.trim() || null,
          source: data.source?.trim() || null,
          status: data.status,
          notes: data.notes?.trim() || null,
          nextFollowUpAt: followUpDate,
          followUpNote: data.followUpNote?.trim() || null,
          proposalTotal: serviceIds.length ? proposalTotal : null
        }
      });

      await tx.clientServiceInterest.deleteMany({
        where: {
          clientId: id,
          ...(serviceIds.length ? { serviceId: { notIn: serviceIds } } : {})
        }
      });
      if (newInterests.length) {
        await tx.clientServiceInterest.createMany({ data: newInterests });
      }
      for (const selection of serviceSelections) {
        if (existingInterests.has(selection.serviceId)) {
          await tx.clientServiceInterest.updateMany({
            where: { clientId: id, serviceId: selection.serviceId },
            data: { adBudgetAmount: selection.adBudgetAmount, finalPrice: Math.round(selection.agreedPrice * 100) / 100 }
          });
        }
      }
      const selectedIds = new Set(serviceIds);
      const activeSubscriptions = client.subscriptions.filter(subscription => subscription.status !== 'CANCELLED');
      const subscriptionsByService = new Map<string, typeof activeSubscriptions[number]>();
      for (const subscription of activeSubscriptions) {
        const existing = subscriptionsByService.get(subscription.serviceId);
        if (!existing || subscription.startDate > existing.startDate) {
          subscriptionsByService.set(subscription.serviceId, subscription);
        }
      }
      const toCancel = activeSubscriptions.filter(subscription =>
        !selectedIds.has(subscription.serviceId) || subscriptionsByService.get(subscription.serviceId)?.id !== subscription.id
      );
      if (toCancel.length) {
        await tx.subscription.updateMany({
          where: { id: { in: toCancel.map(subscription => subscription.id) } },
          data: { status: 'CANCELLED' }
        });
      }

      const subscriptionsToCreate: Array<{
        clientId: string;
        serviceId: string;
        contractValue: number;
        startDate: Date;
        durationDays: number;
        expirationDate: Date;
        amountPaid: number;
        outstanding: number;
      }> = [];
      for (const serviceId of serviceIds) {
        const service = services.find(item => item.id === serviceId);
        const selection = serviceSelections.find(item => item.serviceId === serviceId);
        if (!service || !selection) throw new Error('SERVICE_SELECTION_MISMATCH');
        const agreedPrice = Math.round(selection.agreedPrice * 100) / 100;
        const activeSubscription = subscriptionsByService.get(serviceId);
        if (activeSubscription && !toCancel.some(item => item.id === activeSubscription.id)) {
          await tx.subscription.update({
            where: { id: activeSubscription.id },
            data: { contractValue: agreedPrice }
          });
        } else {
          const startDate = new Date();
          subscriptionsToCreate.push({
            clientId: id,
            serviceId,
            contractValue: agreedPrice,
            startDate,
            durationDays: service.durationDays,
            expirationDate: getSubscriptionExpirationDate(startDate, service.durationDays),
            amountPaid: 0,
            outstanding: agreedPrice
          });
        }
      }
      if (subscriptionsToCreate.length) {
        await tx.subscription.createMany({ data: subscriptionsToCreate });
      }
      await syncClientSubscriptionPayments(tx, id);
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entity: 'Client',
          entityId: id,
          metadata: { selectedServiceCount: serviceIds.length }
        }
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    if (message === 'SERVICE_SELECTION_MISMATCH') return NextResponse.json({ error: 'توجد خدمة غير متاحة ضمن الاختيارات' }, { status: 400 });
    if (error instanceof Error && error.message.includes('Unknown argument') && error.message.includes('proposalTotal')) {
      return NextResponse.json({ error: 'نسخة Prisma غير محدثة. أوقف سيرفر التطوير، شغّل pnpm db:generate، ثم أعد تشغيله.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'تعذر تحديث بيانات العميل' }, { status: 500 });
  }
}
