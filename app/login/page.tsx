import Link from 'next/link';
import { ArrowUpLeft, ShieldCheck, BarChart3, Layers3 } from 'lucide-react';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error === 'invalid'
    ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
    : error === 'missing'
      ? 'أدخل البريد الإلكتروني وكلمة المرور.'
      : null;

  return (
    <main className="min-h-screen bg-[#241744] p-5 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-40px)] max-w-6xl overflow-hidden rounded-[28px] bg-[#fbfaff] text-[#15121d] shadow-2xl lg:grid-cols-[.9fr_1.1fr]">
        <section className="relative hidden overflow-hidden bg-[#241744] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-[#6d4bc3]/35 blur-3xl" />
          <div className="absolute -bottom-36 -right-20 h-96 w-96 rounded-full bg-[#956fe8]/25 blur-3xl" />
          <div className="relative">
            <img src="/viral-zoom.webp" alt="Viral Zoom" className="h-16 w-auto max-w-[260px] object-contain object-right brightness-0 invert" />
            <p className="mt-10 max-w-sm text-3xl font-black leading-[1.35]">كل قرار تشغيلي مهم، في مساحة واحدة.</p>
            <p className="mt-4 max-w-sm text-sm leading-7 text-[#c8bee2]">نظام Viral Zoom الداخلي لإدارة العملاء، المال، الإنتاج، والفريق بدون تشتيت.</p>
          </div>
          <div className="relative grid grid-cols-3 gap-3">
            {[['12+', 'وحدة تشغيل'], ['100%', 'صلاحيات خادمية'], ['RTL', 'تجربة عربية']].map(([v, l]) => (
              <div key={l} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xl font-black">{v}</div>
                <div className="mt-1 text-[10px] text-[#c8bee2]">{l}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="flex flex-col justify-center p-7 sm:p-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <img src="/viral-zoom.webp" alt="Viral Zoom" className="h-12 w-auto max-w-[210px] object-contain" />
            </div>
            <div className="eyebrow mb-3">VIRAL ZOOM / SECURE ACCESS</div>
            <h1 className="text-3xl font-black tracking-tight text-[#241744]">تسجيل الدخول إلى مساحة العمل</h1>
            <p className="muted mt-3 leading-7">ادخل ببيانات حسابك الداخلي في Viral Zoom.</p>
            <div className="mt-8 space-y-3">
              {[
                [ShieldCheck, 'صلاحيات بحسب دور المستخدم'],
                [BarChart3, 'بيانات حقيقية وتقارير قابلة للتتبع'],
                [Layers3, 'كل الأقسام والعمليات في مكان واحد'],
              ].map(([Icon, text]) => (
                <div key={text as string} className="flex items-center gap-3 rounded-xl bg-[#f8f6fc] p-3 text-sm font-bold text-[#4d4658]">
                  <Icon size={17} className="text-[#6d4bc3]" />{text as string}
                </div>
              ))}
            </div>
            {message && <div className="mt-5 rounded-xl border border-[#f1cbd3] bg-[#fff5f7] px-4 py-3 text-sm font-bold text-[#a23b51]">{message}</div>}
            <form action="/api/auth/login" method="post" className="mt-6 space-y-4">
              <label className="block">
                <span className="label">البريد الإلكتروني</span>
                <input name="email" type="email" required autoComplete="email" className="input mt-2 w-full" placeholder="name@viralzoom.local" />
              </label>
              <label className="block">
                <span className="label">كلمة المرور</span>
                <input name="password" type="password" required autoComplete="current-password" className="input mt-2 w-full" />
              </label>
              <button type="submit" className="btn btn-primary w-full">
                <span>تسجيل الدخول</span>
                <ArrowUpLeft size={17} />
              </button>
            </form>
            <p className="muted mt-5 text-center text-[11px]">الوصول داخلي لفريق Viral Zoom فقط. العملاء لا يملكون حسابات للنظام.</p>
            <Link href="/" className="mt-6 block text-center text-xs font-bold text-[#6d4bc3]">العودة للرئيسية</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
