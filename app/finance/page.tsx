import { redirect } from 'next/navigation';
import { CircleDollarSign, Download, Plus, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { FinanceForm } from '@/components/forms';
import { FinanceTransactions } from '@/components/finance-transactions';
import { Icons, KpiCard, SectionTitle, currency } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { canAccessFinance } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { date } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function FinancePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canAccessFinance(user.role)) redirect('/');

  const [transactions, clients, totals] = await Promise.all([
    prisma.financeTransaction.findMany({
      orderBy: { date: 'desc' },
      take: 30,
      select: {
        id: true,
        transactionNo: true,
        type: true,
        amount: true,
        date: true,
        paymentMethod: true,
        category: true,
        description: true,
        createdAt: true,
        client: { select: { id: true, name: true, companyName: true, phone: true, email: true } },
        employee: {
          select: {
            fullName: true,
            employeeCode: true,
            email: true,
            phone: true,
            jobTitle: true,
            department: { select: { name: true } }
          }
        },
        createdBy: { select: { name: true, email: true } },
        clientPayment: { select: { id: true } }
      }
    }),
    prisma.client.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.financeTransaction.groupBy({ by: ['type'], _sum: { amount: true } })
  ]);
  const amount = (type: string) => Number(totals.find(t => t.type === type)?._sum.amount ?? 0);
  const revenue = amount('SERVICE_REVENUE') + amount('ADDITIONAL_REVENUE');
  const expenses = totals
    .filter(t => !['SERVICE_REVENUE', 'ADDITIONAL_REVENUE'].includes(t.type))
    .reduce((sum, t) => sum + Number(t._sum.amount ?? 0), 0);
  const transactionDetails = transactions.map(transaction => ({
    id: transaction.id,
    transactionNo: transaction.transactionNo,
    type: transaction.type,
    amount: Number(transaction.amount),
    dateValue: transaction.date.toISOString().slice(0, 10),
    dateLabel: date(transaction.date),
    paymentMethod: transaction.paymentMethod,
    category: transaction.category,
    description: transaction.description,
    createdAtLabel: date(transaction.createdAt),
    linkedClientPayment: Boolean(transaction.clientPayment),
    client: transaction.client,
    employee: transaction.employee ? {
      fullName: transaction.employee.fullName,
      employeeCode: transaction.employee.employeeCode,
      email: transaction.employee.email,
      phone: transaction.employee.phone,
      jobTitle: transaction.employee.jobTitle,
      departmentName: transaction.employee.department.name
    } : null,
    createdBy: transaction.createdBy
  }));

  return (
    <AppShell user={user}>
      <div className="content">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">FINANCE / COMPANY LEDGER</div>
            <h1 className="mt-2 text-[30px] font-black text-[#241744]">المالية والمحاسبة</h1>
            <p className="muted mt-2">إيراد الشركة منفصل تمامًا عن أموال الإعلان المقيدة للعملاء.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost"><Download size={16} /> تصدير</button>
            <button className="btn btn-primary"><Plus size={17} /> تسجيل حركة</button>
          </div>
        </div>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="إجمالي الإيرادات" value={currency(revenue)} hint="خدمات وإيرادات إضافية" icon={Icons.revenue} tone="purple" />
          <KpiCard label="إجمالي المصروفات" value={currency(expenses)} hint="كل بنود الشركة" icon={<CircleDollarSign size={19} />} tone="orange" />
          <KpiCard label="صافي الربح" value={currency(revenue - expenses)} hint="قبل أي أموال إعلانية" icon={Icons.check} tone="green" />
          <KpiCard label="سلامة الفصل المحاسبي" value="مفعل" hint="محافظ الإعلانات في وحدة مستقلة" icon={<ShieldCheck size={19} />} tone="blue" />
        </div>
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="card">
            <div className="card-pad pb-2">
              <SectionTitle eyebrow="TRANSACTION REGISTER" title="سجل المعاملات" description={`${transactions.length} حركة حديثة`} />
            </div>
            <FinanceTransactions transactions={transactionDetails} clients={clients} />
          </div>
          <div className="card card-pad">
            <SectionTitle eyebrow="NEW ENTRY" title="تسجيل حركة" description="كل إدخال يضيف سجل تدقيق غير قابل للمحو." />
            <FinanceForm clients={clients} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
