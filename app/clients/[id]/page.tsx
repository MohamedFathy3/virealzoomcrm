import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, Phone, Mail, MapPin, Plus, Download } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { SectionTitle, StatusBadge, currency } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { currencyPrecise, date, relativeDays } from '@/lib/format';
import { allocateContractTotalByCatalogPrice } from '@/lib/client-contracts';
import { ClientEditForm, ClientEditShortcut, ClientFollowUpForm, ClientPaymentForm, SalesRevenueForm } from '@/components/forms';
import { canSeeAllClients, getEmployeeDepartment, isSalesDepartment } from '@/lib/team-access';
import { canAccessFinance } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function ClientDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const employee = user.role === 'EMPLOYEE' ? await getEmployeeDepartment(user.id) : null;
  const manager = user.role === 'DEPARTMENT_MANAGER' ? await getEmployeeDepartment(user.id) : null;
  if (user.role === 'DEPARTMENT_MANAGER' && !manager?.managedDepartment) redirect('/notifications');
  const canSeeClients = canSeeAllClients(user.role) || Boolean(employee && isSalesDepartment(employee.department.name));
  if (!canSeeClients) redirect('/');
  const client = await prisma.client.findUnique({ where: { id }, include: { createdBy: { select: { id: true, name: true } }, serviceInterests: { include: { service: true }, orderBy: { createdAt: 'desc' } }, subscriptions: { include: { service: true }, orderBy: { expirationDate: 'desc' } }, tasks: { include: { department: true, assignee: true, submissions: { orderBy: { version: 'desc' }, take: 1 } }, orderBy: { updatedAt: 'desc' }, take: 8 }, adWallets: true } });
  if (!client) notFound();
  if (user.role === 'EMPLOYEE' && client.createdById !== user.id) notFound();
  const transactions = canAccessFinance(user.role) ? await prisma.financeTransaction.findMany({ where: { clientId: client.id }, orderBy: { date: 'desc' }, take: 8 }) : [];
  const outstanding = client.subscriptions.reduce((sum, s) => sum + (s.status === 'CANCELLED' ? 0 : Number(s.outstanding)), 0);
  const hasActiveSubscriptions = client.subscriptions.some(subscription => subscription.status !== 'CANCELLED');
  const adBalance = client.adWallets.reduce((sum, w) => sum + Number(w.balance), 0);
  const salesEmployee = Boolean(employee && isSalesDepartment(employee.department.name));
  const salesManager = Boolean(manager && isSalesDepartment(manager.department.name) && manager.managedDepartment?.id === manager.departmentId);
  const canViewClientPayments = canAccessFinance(user.role) || salesEmployee || salesManager;
  const [clientPayments, legacyServicePayments] = canViewClientPayments
    ? await Promise.all([
      prisma.clientPayment.findMany({
      where: { clientId: client.id },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, paymentNo: true, amount: true, date: true, paymentMethod: true, adBudgetAmount: true }
      }),
      prisma.financeTransaction.findMany({
        where: { clientId: client.id, type: 'SERVICE_REVENUE', clientPayment: null },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, transactionNo: true, amount: true, date: true, paymentMethod: true }
      })
    ])
    : [[], []];
  const servicePayments = [
    ...clientPayments.map(payment => ({
      id: payment.id,
      paymentNo: payment.paymentNo,
      amount: Number(payment.amount),
      date: payment.date,
      paymentMethod: payment.paymentMethod,
      adBudgetAmount: Number(payment.adBudgetAmount),
      deletable: true
    })),
    ...legacyServicePayments.map(payment => ({
      id: payment.id,
      paymentNo: payment.transactionNo,
      amount: Number(payment.amount),
      date: payment.date,
      paymentMethod: payment.paymentMethod,
      adBudgetAmount: 0,
      deletable: false
    }))
  ].sort((left, right) => right.date.getTime() - left.date.getTime());
  const totalPaid = servicePayments.reduce((sum, item) => sum + Number(item.amount), 0);
  const plannedAdBudget = client.serviceInterests.reduce((sum, interest) => sum + Number(interest.adBudgetAmount), 0);
  const collectedAdBudget = clientPayments.reduce((sum, payment) => sum + Number(payment.adBudgetAmount), 0);
  const remainingAdBudget = Math.max(0, plannedAdBudget - collectedAdBudget);
  const paymentsByMethod = servicePayments.reduce((totals, payment) => {
    const key = payment.paymentMethod || 'طريقة دفع غير محددة';
    totals.set(key, (totals.get(key) ?? 0) + Number(payment.amount));
    return totals;
  }, new Map<string, number>());
  const canEditClient = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || salesEmployee || salesManager;
  const canManageClientPayments = canEditClient || canAccessFinance(user.role);
  const canCreateTask = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'DEPARTMENT_MANAGER';
  const canViewProposalPrices = canAccessFinance(user.role) || salesEmployee || salesManager;
  const legacyProposalTotal = client.serviceInterests.length > 0 && client.serviceInterests.every(item => item.finalPrice !== null)
    ? client.serviceInterests.reduce((sum, item) => sum + Number(item.finalPrice), 0)
    : null;
  const proposalTotal = client.proposalTotal === null ? legacyProposalTotal : Number(client.proposalTotal);
  const hasPrintableQuote = client.serviceInterests.length > 0 && proposalTotal !== null;
  const activeSubscriptions = client.subscriptions.filter(subscription => subscription.status !== 'CANCELLED');
  const expectedContractValues = client.serviceInterests.every(interest => interest.finalPrice !== null)
    ? client.serviceInterests.map(interest => Number(interest.finalPrice))
    : proposalTotal === null
      ? []
      : allocateContractTotalByCatalogPrice(
        proposalTotal,
        client.serviceInterests.map(interest => Number(interest.catalogPrice ?? interest.service.defaultPrice))
      );
  const expectedValuesByServiceId = new Map(client.serviceInterests.map((interest, index) => [interest.serviceId, expectedContractValues[index]]));
  const hasMisallocatedContract = proposalTotal !== null && (
    activeSubscriptions.length !== client.serviceInterests.length ||
    client.serviceInterests.some(interest => {
      const subscription = activeSubscriptions.find(item => item.serviceId === interest.serviceId);
      return !subscription || Math.round(Number(subscription.contractValue) * 100) !== Math.round((expectedValuesByServiceId.get(interest.serviceId) ?? 0) * 100);
    })
  );
  const editableServices = canEditClient
    ? await prisma.service.findMany({
      where: { OR: [{ isActive: true }, { id: { in: client.serviceInterests.map(item => item.serviceId) } }] },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true, isActive: true }
    })
    : [];
  const editServiceOptions = editableServices.map(service => {
    const interest = client.serviceInterests.find(item => item.serviceId === service.id);
    return {
      ...service,
      agreedPrice: interest?.finalPrice === null || interest?.finalPrice === undefined
        ? Number(interest?.catalogPrice ?? 0)
        : Number(interest.finalPrice),
      adBudgetAmount: interest ? Number(interest.adBudgetAmount) : undefined
    };
  });
  return <AppShell user={user}><div className="content"><Link href="/clients" className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-[#6d4bc3]"><ArrowRight size={15} /> العودة للعملاء</Link>
    <div className="card card-pad mb-5"><div className="flex flex-wrap items-start justify-between gap-5"><div className="flex items-start gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#241744] text-lg font-black text-white">{client.name.slice(0, 2)}</div><div><div className="eyebrow">{client.clientCode}</div><h1 className="mt-1 text-2xl font-black text-[#241744]">{client.name}</h1><p className="muted mt-1">{client.companyName || 'ملف عميل مستقل'} · أُضيف {date(client.registeredAt)} · المسؤول: {client.createdBy?.name || 'الإدارة'}</p><div className="mt-3"><StatusBadge status={client.status} /></div></div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{canAccessFinance(user.role) && <div className="rounded-xl bg-[#faf9fc] p-3"><div className="label">المتبقي</div><div className="mt-1 text-lg font-black text-[#a26a12]">{currency(outstanding)}</div></div>}{canAccessFinance(user.role) && <div className="rounded-xl bg-[#faf9fc] p-3"><div className="label">رصيد الإعلانات</div><div className="mt-1 text-lg font-black text-[#2e6aa3]">{currency(adBalance)}</div></div>}<div className="rounded-xl bg-[#faf9fc] p-3"><div className="label">المهام</div><div className="mt-1 text-lg font-black text-[#6245ad]">{client.tasks.length}</div></div></div></div><div className="mt-6 flex flex-wrap gap-4 border-t border-[#f0edf5] pt-4 text-xs text-[#625c6d]"><span className="inline-flex items-center gap-2"><Phone size={14} className="text-[#6d4bc3]" />{client.phone || 'بدون هاتف'}</span><span className="inline-flex items-center gap-2"><Mail size={14} className="text-[#6d4bc3]" />{client.email || 'بدون بريد'}</span><span className="inline-flex items-center gap-2"><MapPin size={14} className="text-[#6d4bc3]" />{client.address || 'بدون عنوان'}</span></div></div>
    {canEditClient && <ClientEditForm client={{ id: client.id, name: client.name, companyName: client.companyName || '', phone: client.phone || '', email: client.email || '', businessActivity: client.businessActivity || '', address: client.address || '', source: client.source || '', status: client.status, notes: client.notes || '', nextFollowUpAt: client.nextFollowUpAt, followUpNote: client.followUpNote || '', serviceIds: client.serviceInterests.map(item => item.serviceId), servicePrices: Object.fromEntries(client.serviceInterests.map(item => [item.serviceId, Number(item.finalPrice ?? item.catalogPrice ?? item.service.defaultPrice)])) }} services={editServiceOptions} />}
    <div className="mb-5 grid gap-5 xl:grid-cols-2">
      <div className="card card-pad"><SectionTitle eyebrow="FOLLOW-UP" title="حالة العميل والتذكير" /><ClientFollowUpForm client={{ id: client.id, status: client.status, nextFollowUpAt: client.nextFollowUpAt, followUpNote: client.followUpNote }} /></div>
      {(salesEmployee || salesManager) && <div className="card card-pad"><SectionTitle eyebrow="ADVERTISING BUDGET" title="إيداع ميزانية إضافية" description="ميزانية خدمة شراء الإعلانات تنتقل تلقائيًا للمحفظة عند تحصيل الدفعات؛ استخدم هذا النموذج لأي إيداع إضافي." /><SalesRevenueForm clientId={client.id} /></div>}
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="card">
        <div className="card-pad pb-2"><SectionTitle eyebrow="SERVICES & CONTRACTS" title="الخدمات والاشتراكات" action={hasPrintableQuote && canViewProposalPrices ? <Link href={`/clients/${client.id}/proposal`} className="btn btn-ghost"><Download size={15} /> عرض PDF</Link> : undefined} /></div>
        {client.serviceInterests.length > 0 && <div className="space-y-3 border-b border-[#f0edf5] p-5">
          <div className="text-[11px] font-black text-[#625c6d]">الخدمات المختارة في العرض المبدئي</div>
          {client.serviceInterests.map(interest => <div key={interest.serviceId} className="rounded-xl bg-[#faf9fc] p-3"><div className="font-extrabold text-[#241744]">{interest.service.name}</div><p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-[#756f82]">{interest.serviceDescription || interest.service.description || 'لا توجد تفاصيل للخدمة.'}</p>{canViewProposalPrices && Number(interest.adBudgetAmount) > 0 && <div className="mt-2 text-[10px] font-bold text-[#2e6aa3]">المخصص من سعر الخدمة لميزانية الإعلانات: {currencyPrecise(interest.adBudgetAmount)}</div>}</div>)}
          {canViewProposalPrices && proposalTotal !== null && <div className="space-y-1 rounded-xl border border-[#eeeaf4] p-3 text-xs">
            {client.serviceInterests.map(interest => <div key={interest.serviceId} className="flex justify-between gap-3"><span className="text-[#625c6d]">{interest.service.name}</span><span>{interest.finalPrice === null ? '—' : currencyPrecise(interest.finalPrice)}</span></div>)}
            <div className="flex justify-between gap-3 border-t border-[#eeeaf4] pt-2 font-black text-[#6245ad]"><span>الإجمالي النهائي</span><span>{currencyPrecise(proposalTotal)}</span></div>
          </div>}
        </div>}
        {canViewClientPayments && <div className="mx-5 mb-4 rounded-xl border border-[#eeeaf4] bg-[#faf9fc] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-bold text-[#625c6d]">إجمالي المدفوع للخدمات</span><strong className="text-lg font-black text-[#217a5a]">{currencyPrecise(totalPaid)}</strong></div>
          <p className="mt-1 text-[10px] text-[#8a8396]">لا يشمل ميزانية الإعلانات؛ فهي رصيد منفصل للعميل.</p>
          {paymentsByMethod.size > 0 ? <div className="mt-3 space-y-2 border-t border-[#eeeaf4] pt-3">
            {[...paymentsByMethod].map(([method, total]) => <div key={method} className="flex justify-between gap-3 text-xs"><span className="text-[#625c6d]">{method}</span><span className="font-bold text-[#241744]">{currencyPrecise(total)}</span></div>)}
          </div> : <p className="mt-3 border-t border-[#eeeaf4] pt-3 text-xs text-[#8a8396]">لا توجد تحصيلات خدمات مسجلة حتى الآن.</p>}
          {(salesEmployee || salesManager || canAccessFinance(user.role)) && client.status === 'ACTIVE' && outstanding > 0 && <div className="mt-4 border-t border-[#eeeaf4] pt-4"><ClientPaymentForm clientId={client.id} outstanding={outstanding} remainingAdBudget={remainingAdBudget} payments={servicePayments} canDelete={canManageClientPayments} /></div>}
          {canManageClientPayments && hasMisallocatedContract && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeaf4] pt-4"><p className="text-xs text-[#8a8396]">قيم الاشتراكات لا تطابق الأسعار المتفق عليها للخدمات. افتح التعديل واحفظ لتصحيحها.</p><ClientEditShortcut label="تصحيح الأسعار" className="btn btn-ghost" /></div>}
          {canManageClientPayments && client.status === 'ACTIVE' && outstanding <= 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeaf4] pt-4"><p className="text-xs text-[#8a8396]">{hasActiveSubscriptions ? 'تم سداد كامل قيمة الاشتراكات الحالية.' : hasPrintableQuote ? 'لا توجد اشتراكات جاهزة لاستقبال دفعة. احفظ بيانات العميل لتجهيز اشتراكاته.' : 'اختر خدمات للعميل واحفظها قبل تسجيل الدفعة.'}</p>{!hasActiveSubscriptions && <ClientEditShortcut label={hasPrintableQuote ? 'تجهيز الاشتراكات' : 'اختيار الخدمات'} />}</div>}
          {canManageClientPayments && client.status !== 'ACTIVE' && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeaf4] pt-3"><p className="text-xs font-bold text-[#a26a12]">حوّل حالة العميل إلى «نشط» أولًا لتسجيل الدفعة.</p><ClientEditShortcut label="تعديل حالة العميل" className="btn btn-ghost" /></div>}
        </div>}
        <div className="table-wrap"><table className="table"><thead><tr><th>الخدمة</th>{canAccessFinance(user.role) && <><th>القيمة</th><th>المتبقي</th></>}<th>الانتهاء</th></tr></thead><tbody>{client.subscriptions.length ? client.subscriptions.map(s => <tr key={s.id}><td><div className="flex items-center gap-2"><BriefcaseBusiness size={15} className="text-[#6d4bc3]" /><div><div className="font-extrabold text-[#241744]">{s.service.name}</div><div className="mt-1 text-[10px] text-[#a29aaa]">{s.durationDays} يوم</div></div></div></td>{canAccessFinance(user.role) && <><td className="text-xs font-bold">{currency(s.contractValue)}</td><td className="text-xs font-bold text-[#a26a12]">{currency(s.outstanding)}</td></>}<td><div className="text-xs font-bold">{date(s.expirationDate)}</div><div className="mt-1 text-[10px] text-[#a29aaa]">{relativeDays(s.expirationDate)}</div></td></tr>) : <tr><td colSpan={canAccessFinance(user.role) ? 4 : 2}><div className="py-10 text-center text-xs text-[#8a8396]">لا توجد اشتراكات فعلية لهذا العميل.</div></td></tr>}</tbody></table></div>
      </div>
    <div className="card"><div className="card-pad pb-2"><SectionTitle eyebrow="OPERATIONS" title="مهام العميل وتفاصيل التنفيذ" action={canCreateTask ? <Link href={`/tasks?clientId=${client.id}#new-task`} className="btn btn-primary"><Plus size={15} /> إنشاء مهمة</Link> : undefined} /></div><div className="table-wrap"><table className="table"><thead><tr><th>المهمة</th><th>القسم</th><th>المكلف</th><th>الحالة</th><th>إنجاز / موعد</th></tr></thead><tbody>{client.tasks.length ? client.tasks.map(task => { const latestSubmission = task.submissions[0]; const filesCount = Array.isArray(latestSubmission?.attachments) ? latestSubmission.attachments.length : 0; return <tr key={task.id}><td><Link href={`/tasks/${task.id}`} className="font-extrabold text-[#241744] hover:text-[#6d4bc3]">{task.title}</Link><div className="mt-1 text-[10px] text-[#6d4bc3]">فتح تفاصيل الشغل</div></td><td className="text-xs text-[#625c6d]">{task.department.name}</td><td className="text-xs text-[#625c6d]">{task.assignee?.fullName || '—'}</td><td><StatusBadge status={task.status} /></td><td><div className="max-w-[260px] whitespace-pre-wrap text-xs text-[#625c6d]">{latestSubmission?.completionNotes || 'لم يُسجل تسليم بعد'}</div>{filesCount > 0 && <div className="mt-1 text-[10px] font-bold text-[#6245ad]">{filesCount} ملف / رابط مرفق</div>}<div className="mt-1 text-[10px] text-[#a29aaa]">{date(task.deadline)}</div></td></tr>; }) : <tr><td colSpan={5}><div className="py-10 text-center text-xs text-[#8a8396]">لا توجد مهام مرتبطة.</div></td></tr>}</tbody></table></div></div></div>
    {canAccessFinance(user.role) && <div className="card mt-5"><div className="card-pad pb-2"><SectionTitle eyebrow="FINANCIAL STATEMENT" title="كشف حركات العميل" /></div><div className="table-wrap"><table className="table"><thead><tr><th>التاريخ</th><th>المرجع</th><th>النوع</th><th>المبلغ</th><th>التصنيف</th></tr></thead><tbody>{transactions.length ? transactions.map(t => <tr key={t.id}><td className="text-xs text-[#625c6d]">{date(t.date)}</td><td className="text-xs font-bold text-[#6d4bc3]">{t.transactionNo}</td><td><StatusBadge status={t.type} /></td><td className="font-black text-[#241744]">{currency(t.amount)}</td><td className="text-xs text-[#625c6d]">{t.category || t.description || '—'}</td></tr>) : <tr><td colSpan={5}><div className="py-10 text-center text-xs text-[#8a8396]">لا توجد معاملات مالية مرتبطة.</div></td></tr>}</tbody></table></div></div>}
  </div></AppShell>;
}
