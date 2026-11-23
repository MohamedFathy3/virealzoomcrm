import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { ProposalPrintButton } from '@/components/proposal-print-button';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getEmployeeDepartment, isSalesDepartment } from '@/lib/team-access';
import { date } from '@/lib/format';

export const dynamic = 'force-dynamic';

function formatProposalTotal(amount: number) {
  const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const amountInCents = Math.round(amount * 100);
  return amount >= 1000 && amountInCents % 1000 === 0
    ? `${format.format(amount / 1000)} ألف جنيه`
    : `${format.format(amount)} جنيه`;
}

export default async function ClientProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      serviceInterests: {
        orderBy: { createdAt: 'asc' },
        include: { service: { select: { name: true, description: true } } }
      }
    }
  });
  if (!client) notFound();

  const employee = user.role === 'EMPLOYEE' || user.role === 'DEPARTMENT_MANAGER'
    ? await getEmployeeDepartment(user.id)
    : null;
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const isSalesEmployee = user.role === 'EMPLOYEE' && Boolean(
    employee && isSalesDepartment(employee.department.name) && client.createdById === user.id
  );
  const isSalesManager = user.role === 'DEPARTMENT_MANAGER' && Boolean(
    employee && isSalesDepartment(employee.department.name) &&
    employee.managedDepartment?.id === employee.departmentId
  );
  if (!isAdmin && !isSalesEmployee && !isSalesManager) notFound();
  const legacyTotal = client.serviceInterests.length > 0 && client.serviceInterests.every(item => item.finalPrice !== null)
    ? client.serviceInterests.reduce((sum, item) => sum + Number(item.finalPrice), 0)
    : null;
  const total = client.proposalTotal === null ? legacyTotal : Number(client.proposalTotal);
  if (!client.serviceInterests.length || total === null) notFound();

  return <main dir="rtl" className="proposal-document min-h-screen bg-[#f8f7fb] px-4 py-8 sm:px-8">
    <div className="print-hide mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3">
      <Link href={`/clients/${client.id}`} className="inline-flex items-center gap-2 text-xs font-bold text-[#6d4bc3]"><ArrowRight size={15} /> العودة لملف العميل</Link>
      <ProposalPrintButton />
    </div>
    <article className="proposal-sheet proposal-cover mx-auto">
      <div className="proposal-cover-top" dir="ltr">
        <Image src="/viral-zoom.webp" alt="Viral Zoom" width={2048} height={713} priority unoptimized className="proposal-cover-logo" />
        <div className="proposal-cover-ribbon"><span>↗</span><strong>CREATE<br />CREATIVE SOLUTIONS</strong></div>
      </div>
      <div className="proposal-cover-art" aria-hidden="true"><div className="proposal-cover-art-shape" /></div>
      <div className="proposal-cover-title" dir="ltr">
        <span>DIGITAL</span>
        <strong>MARKETING</strong>
        <em>AGENCY</em>
      </div>
      <div className="proposal-cover-footer" dir="ltr">
        <span>Al-Mohandessin, 1 Ahmed Orabi</span>
        <span>◉ 01222291024</span>
      </div>
    </article>

    <article className="proposal-sheet proposal-details mx-auto">
      <header className="proposal-details-header">
        <Image src="/viral-zoom.webp" alt="Viral Zoom" width={2048} height={713} unoptimized className="proposal-details-logo" />
        <div className="proposal-document-meta"><span>عرض سعر مبدئي</span><span>{date(client.serviceInterests[0].createdAt)}</span><span>{client.clientCode}</span></div>
      </header>

      <section className="proposal-intro">
        <div className="proposal-eyebrow">عرض فني ومالي</div>
        <h1>عرض الخدمات المقترحة</h1>
        <p className="proposal-client-name">السادة / {client.companyName || client.name}</p>
        {client.companyName && <p className="proposal-client-contact">{client.name}</p>}
        {(client.phone || client.email) && <p className="proposal-client-contact">{[client.phone, client.email].filter(Boolean).join(' · ')}</p>}
        <p className="proposal-intro-copy">يسعد فريق VIRAL ZOOM أن يقدم لكم هذا العرض للخدمات المختارة، متضمنًا نطاق العمل المقترح والإجمالي النهائي.</p>
      </section>

      <section className="proposal-quote-box">
        <div className="proposal-total-label">إجمالي العرض</div>
        <strong className="proposal-total">{formatProposalTotal(total)}</strong>
        <div className="proposal-total-caption">إجمالي واحد للخدمات الموضحة أدناه</div>
        <div className="proposal-services">
          <h2>الخدمات ونطاق العمل</h2>
          {client.serviceInterests.map((item, index) => <div key={item.serviceId} className="proposal-service">
            <span className="proposal-service-index">{String(index + 1).padStart(2, '0')}</span>
            <div><h3>{item.service.name}</h3><p>{item.serviceDescription || item.service.description || 'تفاصيل نطاق العمل تُحدد مع العميل.'}</p></div>
          </div>)}
        </div>
      </section>

      <p className="proposal-disclaimer">هذا العرض مبدئي ويشمل الخدمات الموضحة أعلاه. لا يتضمن هذا المستند تفاصيل أسعار الوحدات أو الخصومات الداخلية.</p>
      <footer className="proposal-details-footer"><span>VIRAL ZOOM</span><span>CREATE CREATIVE SOLUTIONS</span><span>01222291024</span></footer>
    </article>
  </main>;
}
