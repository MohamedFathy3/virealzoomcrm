import { redirect } from 'next/navigation';
import { ArrowUpLeft, Megaphone, Plus, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { AdTransactionForm } from '@/components/forms';
import { KpiCard, SectionTitle, StatusBadge, currency } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { canAccessAdvertising } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { date } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdvertisingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canAccessAdvertising(user.role)) redirect('/');
  const [wallets, transactions, campaigns] = await Promise.all([
    prisma.adWallet.findMany({ include: { client: true, _count: { select: { campaigns: true, transactions: true } } }, orderBy: { updatedAt: 'desc' } }),
    prisma.adTransaction.findMany({ take: 25, orderBy: { createdAt: 'desc' }, include: { wallet: { include: { client: true } } } }),
    prisma.adCampaign.findMany({ take: 50, orderBy: { updatedAt: 'desc' }, include: { wallet: { include: { client: true } } } })
  ]);
  const totalBalance = wallets.reduce((sum, wallet) => sum + Number(wallet.balance), 0);
  const totalReceived = wallets.reduce((sum, wallet) => sum + Number(wallet.totalReceived), 0);
  const totalSpent = wallets.reduce((sum, wallet) => sum + Number(wallet.totalSpent), 0);

  return <AppShell user={user}><div className="content">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><div className="eyebrow">MEDIA BUYING / RESTRICTED FUNDS</div><h1 className="mt-2 text-[30px] font-black text-[#241744]">ميزانيات الإعلانات</h1><p className="muted mt-2">أموال العملاء منفصلة عن إيراد الشركة، وكل حملة مرتبطة بميزانيتها ومحفظتها.</p></div><button className="btn btn-primary"><Plus size={17} /> حركة جديدة</button></div>
    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><KpiCard label="الرصيد المتاح" value={currency(totalBalance)} hint="إجمالي محافظ العملاء" icon={<ShieldCheck size={19} />} tone="blue" /><KpiCard label="إجمالي المستلم" value={currency(totalReceived)} hint="أموال إعلانية مقيدة" icon={<Megaphone size={19} />} tone="purple" /><KpiCard label="إجمالي المنفق" value={currency(totalSpent)} hint="حملات مسجلة" icon={<ArrowUpLeft size={19} />} tone="orange" /><KpiCard label="عدد المحافظ" value={wallets.length} hint="عميل لديه محفظة" icon={<ShieldCheck size={19} />} tone="green" /></div>
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]"><div className="card"><div className="card-pad pb-2"><SectionTitle eyebrow="CLIENT WALLETS" title="محافظ الإعلانات" description="الرصيد يحسب: المستلم − المنفق − المرتجعات + التعديلات." /></div><div className="table-wrap"><table className="table"><thead><tr><th>العميل</th><th>المستلم</th><th>المنفق</th><th>المتاح</th><th>الحملات</th></tr></thead><tbody>{wallets.length ? wallets.map(wallet => <tr key={wallet.id}><td><div className="font-extrabold text-[#241744]">{wallet.client.name}</div><div className="mt-1 text-[10px] text-[#a29aaa]">{wallet.name}</div></td><td className="text-xs font-bold text-[#217a5a]">{currency(wallet.totalReceived)}</td><td className="text-xs font-bold text-[#af3f53]">{currency(wallet.totalSpent)}</td><td><div className="text-sm font-black text-[#2e6aa3]">{currency(wallet.balance)}</div><div className="mt-1"><StatusBadge status={Number(wallet.balance) > 0 ? 'ACTIVE' : 'PAUSED'} /></div></td><td className="text-xs text-[#625c6d]">{wallet._count.campaigns} حملة</td></tr>) : <tr><td colSpan={5}><div className="py-16 text-center text-sm text-[#8a8396]">لا توجد محافظ إعلانية بعد.</div></td></tr>}</tbody></table></div></div><div className="card card-pad"><SectionTitle eyebrow="WALLET MOVEMENT" title="تسجيل حركة" description="المصروف يتوقف تلقائيًا عند نفاد الرصيد." /><AdTransactionForm wallets={wallets.map(wallet => ({ id: wallet.id, label: `${wallet.client.name} · ${currency(wallet.balance)}` }))} /></div></div>
    <div className="card mt-5"><div className="card-pad pb-2"><SectionTitle eyebrow="CLIENT CAMPAIGNS" title="الحملات المسجلة" /></div><div className="table-wrap"><table className="table"><thead><tr><th>الحملة</th><th>العميل</th><th>الميزانية</th><th>المنفق</th><th>الحالة</th></tr></thead><tbody>{campaigns.length ? campaigns.map(campaign => <tr key={campaign.id}><td className="font-extrabold text-[#241744]">{campaign.name}</td><td className="text-xs text-[#625c6d]">{campaign.wallet.client.name}</td><td className="font-black text-[#2e6aa3]">{currency(campaign.budget)}</td><td className="font-bold text-[#af3f53]">{currency(campaign.spent)}</td><td><StatusBadge status={campaign.status} /></td></tr>) : <tr><td colSpan={5}><div className="py-12 text-center text-xs text-[#8a8396]">لا توجد حملات مسجلة بعد.</div></td></tr>}</tbody></table></div></div>
    <div className="card mt-5"><div className="card-pad pb-2"><SectionTitle eyebrow="AUDIT TRAIL" title="آخر حركات المحافظ" /></div><div className="table-wrap"><table className="table"><thead><tr><th>الوقت</th><th>العميل</th><th>النوع</th><th>المبلغ</th><th>الوصف</th></tr></thead><tbody>{transactions.length ? transactions.map(transaction => <tr key={transaction.id}><td className="text-xs text-[#625c6d]">{date(transaction.createdAt)}</td><td className="text-xs font-bold text-[#241744]">{transaction.wallet.client.name}</td><td><StatusBadge status={transaction.type} /></td><td className="font-black text-[#241744]">{currency(transaction.amount)}</td><td className="text-xs text-[#625c6d]">{transaction.description || '—'}</td></tr>) : <tr><td colSpan={5}><div className="py-10 text-center text-xs text-[#8a8396]">لا توجد حركات.</div></td></tr>}</tbody></table></div></div>
  </div></AppShell>;
}
