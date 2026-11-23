import type { ReactNode } from 'react';
import { ArrowUpLeft, CheckCircle2, Clock3, AlertTriangle, CircleDollarSign, Users, ListTodo, WalletCards } from 'lucide-react';
import { currency, number } from '@/lib/format';

export function KpiCard({ label, value, hint, icon, tone = 'purple' }: { label: string; value: string | number; hint?: string; icon?: ReactNode; tone?: 'purple' | 'green' | 'orange' | 'blue' }) {
  const tones = { purple: 'bg-[#f0ebff] text-[#6245ad]', green: 'bg-[#eaf8f1] text-[#217a5a]', orange: 'bg-[#fff5df] text-[#a26a12]', blue: 'bg-[#eaf4ff] text-[#2e6aa3]' };
  return <div className="card card-pad relative overflow-hidden"><div className="absolute -left-5 -top-6 h-20 w-20 rounded-full bg-[#f9f7ff]" /><div className="relative flex items-start justify-between gap-3"><div><p className="label mb-2">{label}</p><p className="text-[28px] font-black tracking-tight text-[#241744]">{typeof value === 'number' ? number(value) : value}</p>{hint && <p className="muted mt-2 text-[11px]">{hint}</p>}</div><div className={`rounded-2xl p-3 ${tones[tone]}`}>{icon}</div></div></div>;
}

export function SectionTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div>{eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}<h2 className="text-[20px] font-black tracking-tight text-[#241744]">{title}</h2>{description && <p className="muted mt-1 text-[12px]">{description}</p>}</div>{action}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    ACTIVE: ['نشط', 'success'], PAUSED: ['متوقف مؤقتًا', 'warning'], INACTIVE: ['غير نشط', 'neutral'], POTENTIAL: ['محتمل', 'purple'],
    NEW: ['جديدة', 'neutral'], ASSIGNED: ['مُسندة', 'purple'], IN_PROGRESS: ['قيد التنفيذ', 'warning'], SUBMITTED: ['مُرسلة', 'purple'], UNDER_REVIEW: ['قيد المراجعة', 'warning'], REVISION_REQUIRED: ['تحتاج تعديل', 'danger'], APPROVED: ['معتمدة', 'success'], CANCELLED: ['ملغاة', 'neutral'],
    EXPIRING: ['تنتهي قريبًا', 'warning'], EXPIRED: ['منتهية', 'danger'], DRAFT: ['مسودة', 'neutral'], CONFIRMED: ['مؤكدة', 'success']
  };
  const [label, tone] = map[status] ?? [status, 'neutral'];
  return <span className={`status status-${tone}`}>{label}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) { return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#ddd7e9] bg-[#fcfbff] px-6 py-14 text-center"><div className="mb-3 rounded-2xl bg-[#f0ebff] p-3 text-[#6d4bc3]"><Clock3 size={20} /></div><h3 className="font-extrabold text-[#241744]">{title}</h3><p className="muted mt-1 max-w-sm text-xs leading-6">{description}</p></div>; }

export const Icons = { revenue: <CircleDollarSign size={19} />, clients: <Users size={19} />, tasks: <ListTodo size={19} />, wallet: <WalletCards size={19} />, check: <CheckCircle2 size={19} />, alert: <AlertTriangle size={19} />, arrow: <ArrowUpLeft size={16} /> };
export { currency };
