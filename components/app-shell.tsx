'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronDown, LayoutDashboard, UsersRound, BriefcaseBusiness, WalletCards, Building2, ListTodo, BarChart3, Settings, LogOut, Search, CircleDollarSign, Megaphone, X } from 'lucide-react';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { SessionUser } from '@/lib/auth';
import { initials } from '@/lib/format';

const items: { href: string; label: string; icon: LucideIcon; admin?: boolean; managers?: boolean; adminOrManager?: boolean; clients?: boolean; managersAndSales?: boolean }[] = [
  { href: '/', label: 'نظرة عامة', icon: LayoutDashboard, admin: true },
  { href: '/clients', label: 'العملاء وCRM', icon: UsersRound, clients: true },
  { href: '/services', label: 'الخدمات والاشتراكات', icon: BriefcaseBusiness, managersAndSales: true },
  { href: '/finance', label: 'المالية', icon: CircleDollarSign, admin: true },
  { href: '/advertising', label: 'ميزانيات الإعلانات', icon: Megaphone, admin: true },
  { href: '/team', label: 'الفريق والأقسام', icon: Building2, managers: true },
  { href: '/tasks', label: 'المهام والتسليمات', icon: ListTodo },
  { href: '/reports', label: 'التقارير', icon: BarChart3, adminOrManager: true },
  { href: '/notifications', label: 'الإشعارات', icon: Bell },
  { href: '/settings', label: 'الإعدادات', icon: Settings, admin: true }
];

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const isManager = user.role === 'DEPARTMENT_MANAGER';
  const isSales = Boolean(user.departmentName && (user.departmentName.toLowerCase().includes('sales') || user.departmentName.includes('مبيعات')));
  const visibleItems = items.filter(item =>
    (!item.admin || isAdmin) &&
    (!item.managers || isAdmin || isManager) &&
    (!item.adminOrManager || isAdmin || isManager) &&
    (!item.clients || isAdmin || isManager || isSales) &&
    (!item.managersAndSales || isAdmin || isManager || isSales)
  );
  return <div className="shell">
    <aside className={`sidebar ${mobile ? 'block' : ''}`}>
      <div className="flex h-[76px] items-center justify-between border-b border-[#ece9f2] px-5"><Link href="/" className="flex items-center gap-3"><img src="/viral-zoom.webp" alt="Viral Zoom" className="h-10 w-auto max-w-[170px] object-contain" /></Link><button className="rounded-lg p-2 text-[#8a8396] md:hidden" onClick={() => setMobile(false)}><X size={18} /></button></div>
      <div className="border-b border-[#f0edf5] px-5 py-4"><div className="eyebrow">VIRAL ZOOM / OPERATIONS</div><p className="mt-1 text-xs font-bold text-[#716b7e]">لوحة تشغيل الوكالة</p></div>
      <nav className="flex-1 py-3">{visibleItems.map(item => { const Icon = item.icon; const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} onClick={() => setMobile(false)} className={`nav-item ${active ? 'active' : ''}`}><Icon size={17} /><span>{item.label}</span></Link>; })}</nav>
      <div className="m-4 rounded-2xl bg-[#241744] p-4 text-white"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold text-[#b9a7ea]">حالة النظام</span><span className="h-2 w-2 rounded-full bg-[#65d9a7]" /></div><p className="text-xs leading-5 text-[#e8e1fb]">بياناتك متصلة بقاعدة MySQL ومحمية بصلاحيات الدور.</p></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="flex items-center gap-3"><button className="rounded-xl bg-white p-2 text-[#6d4bc3] shadow-sm md:hidden" onClick={() => setMobile(true)}><LayoutDashboard size={18} /></button><div className="hidden items-center gap-2 rounded-xl border border-[#ece9f2] bg-white px-3 py-2 text-xs text-[#8a8396] md:flex"><Search size={15} /><span>ابحث في العمليات...</span><kbd className="mr-4 rounded bg-[#f4f1f8] px-1.5 py-0.5 text-[10px]">⌘ K</kbd></div><div className="md:hidden text-sm font-black text-[#241744]">Viral Zoom ERP</div></div><div className="flex items-center gap-3"><Link href="/notifications" className="relative rounded-xl border border-[#ece9f2] bg-white p-2.5 text-[#6d6476]"><Bell size={17} /><span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#6d4bc3] ring-2 ring-[#f8f7fb]" /></Link><div className="h-7 w-px bg-[#ece9f2]" /><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e9e0ff] text-xs font-black text-[#6245ad]">{initials(user.name)}</div><div className="hidden leading-tight md:block"><div className="text-xs font-black text-[#241744]">{user.name}</div><div className="text-[10px] text-[#8a8396]">{user.role === 'SUPER_ADMIN' ? 'مدير عام' : user.role === 'ADMIN' ? 'مسؤول النظام' : user.role === 'DEPARTMENT_MANAGER' ? 'مدير قسم' : 'موظف'}</div></div><form action="/api/auth/logout" method="post"><button className="rounded-lg p-1.5 text-[#8a8396] hover:bg-[#f2eff7]" title="تسجيل الخروج"><LogOut size={15} /></button></form><ChevronDown size={14} className="hidden text-[#b2acba] md:block" /></div></div></header>
      {children}
    </main>
  </div>;
}
