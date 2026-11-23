import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { clientFollowUpSchema, clientSchema } from '@/lib/validators';
import { code } from '@/lib/ids';
import { getEmployeeDepartment, isSalesDepartment } from '@/lib/team-access';
import { getSubscriptionExpirationDate } from '@/lib/client-contracts';
import { isAdvertisingPurchaseService } from '@/lib/client-ad-budget';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const employee = user.role === 'EMPLOYEE' || user.role === 'DEPARTMENT_MANAGER' ? await getEmployeeDepartment(user.id) : null;
    const isSalesMember = Boolean(employee && isSalesDepartment(employee.department.name) &&
      (user.role === 'EMPLOYEE' || (user.role === 'DEPARTMENT_MANAGER' && employee.managedDepartment?.id === employee.departmentId)));
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && !isSalesMember) {
      return NextResponse.json({ error: 'غير مصرح بإضافة العملاء' }, { status: 403 });
    }
    const parsed = clientSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'بيانات العميل غير مكتملة' }, { status: 400 });
    const { nextFollowUpAt, serviceSelections, ...clientData } = parsed.data;
    const followUpDate = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
    if (followUpDate && Number.isNaN(followUpDate.getTime())) return NextResponse.json({ error: 'تاريخ المتابعة غير صحيح' }, { status: 400 });
    const services = serviceSelections.length
      ? await prisma.service.findMany({ where: { id: { in: serviceSelections.map(selection => selection.serviceId) }, isActive: true }, select: { id: true, name: true, description: true, durationDays: true } })
      : [];
    if (services.length !== serviceSelections.length) return NextResponse.json({ error: 'توجد خدمة غير متاحة ضمن الاختيارات' }, { status: 400 });
    const serviceInterestData: Array<{
      serviceId: string;
      catalogPrice: null;
      finalPrice: number;
      adBudgetAmount: number;
      serviceDescription: string | null;
    }> = [];
    for (const selection of serviceSelections) {
      const service = services.find(item => item.id === selection.serviceId);
      if (!service) return NextResponse.json({ error: 'توجد خدمة غير متاحة ضمن الاختيارات' }, { status: 400 });
      const agreedPriceCents = Math.round(selection.agreedPrice * 100);
      if (selection.adBudgetAmount > 0 && !isAdvertisingPurchaseService(service.name)) {
        return NextResponse.json({ error: 'ميزانية الإعلانات مسموحة لخدمة شراء الإعلانات فقط' }, { status: 400 });
      }
      if (Math.round(selection.adBudgetAmount * 100) > agreedPriceCents) {
        return NextResponse.json({ error: 'ميزانية الإعلانات لا يمكن أن تتجاوز سعر الخدمة' }, { status: 400 });
      }
      serviceInterestData.push({
        serviceId: selection.serviceId,
        catalogPrice: null,
        finalPrice: agreedPriceCents / 100,
        adBudgetAmount: selection.adBudgetAmount,
        serviceDescription: service.description
      });
    }
    const proposalTotal = serviceSelections.reduce((sum, selection) => sum + Math.round(selection.agreedPrice * 100), 0) / 100;
    const client = await prisma.$transaction(async tx => {
      const created = await tx.client.create({
        data: { ...clientData, clientCode: code('CL'), createdById: user.id, nextFollowUpAt: followUpDate, proposalTotal: serviceSelections.length ? proposalTotal : null }
      });
      if (serviceInterestData.length) {
        await tx.clientServiceInterest.createMany({
          data: serviceInterestData.map(item => ({ ...item, clientId: created.id }))
        });
        const startDate = new Date();
        await tx.subscription.createMany({
          data: serviceSelections.map((selection, index) => {
            const service = services.find(item => item.id === selection.serviceId);
            if (!service) throw new Error('SERVICE_SELECTION_MISMATCH');
            const agreedPrice = Math.round(selection.agreedPrice * 100) / 100;
            return {
              clientId: created.id,
              serviceId: service.id,
              contractValue: agreedPrice,
              startDate,
              durationDays: service.durationDays,
              expirationDate: getSubscriptionExpirationDate(startDate, service.durationDays),
              amountPaid: 0,
              outstanding: agreedPrice
            };
          })
        });
      }
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          entity: 'Client',
          entityId: created.id,
          metadata: { clientCode: created.clientCode, quotedServiceCount: serviceInterestData.length }
        }
      });
      return created;
    });
    return NextResponse.json({ ok: true, client: { id: client.id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    if (message === 'SERVICE_SELECTION_MISMATCH') return NextResponse.json({ error: 'توجد خدمة غير متاحة ضمن الاختيارات' }, { status: 400 });
    return NextResponse.json({ error: 'تعذر إنشاء العميل' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const { id, ...raw } = await request.json() as { id?: string; status?: string; nextFollowUpAt?: string; followUpNote?: string };
    if (!id) return NextResponse.json({ error: 'معرف العميل مطلوب' }, { status: 400 });
    const parsed = clientFollowUpSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: 'بيانات المتابعة غير صحيحة' }, { status: 400 });

    const client = await prisma.client.findUnique({ where: { id }, select: { id: true, createdById: true } });
    if (!client) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    const employee = user.role === 'EMPLOYEE' ? await getEmployeeDepartment(user.id) : null;
    const isOwnerSalesperson = employee && isSalesDepartment(employee.department.name) && client.createdById === user.id;
    const manager = user.role === 'DEPARTMENT_MANAGER' ? await getEmployeeDepartment(user.id) : null;
    const canEdit = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || Boolean(manager?.managedDepartment) || Boolean(isOwnerSalesperson);
    if (!canEdit) return NextResponse.json({ error: 'غير مصرح بتعديل هذا العميل' }, { status: 403 });

    const nextFollowUpAt = parsed.data.nextFollowUpAt ? new Date(parsed.data.nextFollowUpAt) : null;
    if (nextFollowUpAt && Number.isNaN(nextFollowUpAt.getTime())) return NextResponse.json({ error: 'تاريخ المتابعة غير صحيح' }, { status: 400 });
    await prisma.client.update({
      where: { id },
      data: { status: parsed.data.status, nextFollowUpAt, followUpNote: parsed.data.followUpNote?.trim() || null }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر حفظ متابعة العميل' }, { status: 500 });
  }
}
