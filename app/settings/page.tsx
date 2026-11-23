import { redirect } from 'next/navigation';
import { Database, LockKeyhole, Palette, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { SectionTitle, StatusBadge } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') redirect('/');

  return (
    <AppShell user={user}>
      <div className="content">
        <div className="mb-8">
          <div className="eyebrow">SYSTEM / GOVERNANCE</div>
          <h1 className="mt-2 text-[30px] font-black text-[#241744]">الإعدادات</h1>
          <p className="muted mt-2">إعدادات الهوية، الوصول، وتكاملات النظام — الصلاحيات الحساسة لا تعتمد على إخفاء الواجهة فقط.</p>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="card card-pad">
            <SectionTitle eyebrow="WORKSPACE" title="هوية مساحة العمل" />
            <div className="flex items-center gap-4 rounded-2xl bg-[#faf9fc] p-4">
              <img src="/viral-zoom.webp" alt="Viral Zoom" className="h-12 w-auto max-w-[190px] object-contain" />
              <div>
                <div className="font-black text-[#241744]">Viral Zoom ERP</div>
                <div className="muted mt-1 text-xs">لوحة تشغيل وكالة التسويق والإعلان</div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#eeeaf4] p-3">
                <div className="label">اللغة الأساسية</div>
                <div className="mt-2 font-black text-[#241744]">العربية / RTL</div>
              </div>
              <div className="rounded-xl border border-[#eeeaf4] p-3">
                <div className="label">العملة</div>
                <div className="mt-2 font-black text-[#241744]">الجنيه المصري EGP</div>
              </div>
            </div>
          </div>
          <div className="card card-pad">
            <SectionTitle eyebrow="SECURITY POSTURE" title="الأمان والوصول" />
            <div className="space-y-3">
              {[
                [LockKeyhole, 'تسجيل الدخول', 'بريد وكلمة مرور داخليان'],
                [ShieldCheck, 'التحكم في الأدوار', 'تحقق server-side في كل عملية'],
                [Database, 'مصدر البيانات', 'MySQL مُدار عبر Prisma'],
                [Palette, 'حالة البيئة', 'واجهة تشغيلية جاهزة للتوسع'],
              ].map(([Icon, title, body]) => (
                <div key={title as string} className="flex items-center gap-3 rounded-xl border border-[#eeeaf4] p-3">
                  <div className="rounded-xl bg-[#f0ebff] p-2 text-[#6245ad]"><Icon size={16} /></div>
                  <div className="flex-1">
                    <div className="text-xs font-black text-[#241744]">{title as string}</div>
                    <div className="mt-1 text-[11px] text-[#8a8396]">{body as string}</div>
                  </div>
                  <StatusBadge status="ACTIVE" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {isAdmin(user.role) && (
          <div className="card mt-5 card-pad">
            <SectionTitle eyebrow="ADMIN ONLY" title="حدود الإدارة" description="إعدادات الأدوار والتكاليف والرواتب تُدار من طبقة الخادم وتحتاج صلاحية مسؤول." />
            <div className="rounded-2xl bg-[#241744] p-5 text-white">
              <div className="text-sm font-black">صلاحيتك الحالية: {user.role === 'SUPER_ADMIN' ? 'مدير عام' : 'مسؤول النظام'}</div>
              <p className="mt-2 text-xs leading-6 text-[#c8bee2]">يمكنك إدارة العملاء والمالية وميزانيات الإعلانات والفريق والمهام والتقارير. كل تغيير مهم ينشئ audit log محفوظًا.</p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
