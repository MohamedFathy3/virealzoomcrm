'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X } from 'lucide-react';
import { StatusBadge } from '@/components/ui';
import { currency } from '@/lib/format';

export type FinanceTransactionDetails = {
  id: string;
  transactionNo: string;
  type: string;
  amount: number;
  dateValue: string;
  dateLabel: string;
  paymentMethod: string | null;
  category: string | null;
  description: string | null;
  createdAtLabel: string;
  client: {
    id: string;
    name: string;
    companyName: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  linkedClientPayment: boolean;
  employee: {
    fullName: string;
    employeeCode: string;
    email: string;
    phone: string | null;
    jobTitle: string | null;
    departmentName: string;
  } | null;
  createdBy: {
    name: string;
    email: string;
  };
};

const typeNames: Record<string, string> = {
  SERVICE_REVENUE: 'إيراد خدمة',
  ADDITIONAL_REVENUE: 'إيراد إضافي',
  OPERATING_EXPENSE: 'مصروف تشغيلي',
  EMPLOYEE_SALARY: 'راتب موظف',
  DIRECT_CLIENT_COST: 'تكلفة مباشرة لعميل',
  MARKETING_EXPENSE: 'مصروف تسويق',
  OTHER_EXPENSE: 'مصروف آخر'
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-[#faf9fc] p-3">
      <div className="label">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-[#241744]">{children || '—'}</div>
    </div>
  );
}

export function FinanceTransactions({
  transactions,
  clients
}: {
  transactions: FinanceTransactionDetails[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<FinanceTransactionDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const closeButton = useRef<HTMLButtonElement>(null);
  const isRevenue = (type: string) => ['SERVICE_REVENUE', 'ADDITIONAL_REVENUE'].includes(type);

  async function updateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;

    setSaving(true);
    setEditError('');
    try {
      const response = await fetch(`/api/finance/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تعذر تحديث الحركة');
      setSelected(null);
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'تعذر تحديث الحركة');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!selected) return;

    const previousFocus = document.activeElement;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };

    window.addEventListener('keydown', closeOnEscape);
    closeButton.current?.focus();

    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [selected]);

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>المرجع</th><th>النوع</th><th>العميل</th><th>التاريخ</th><th>المبلغ</th></tr>
          </thead>
          <tbody>
            {transactions.length ? transactions.map(transaction => (
              <tr
                key={transaction.id}
                tabIndex={0}
                aria-label={`عرض تفاصيل ${typeNames[transaction.type] || transaction.type} ${transaction.transactionNo}`}
                aria-haspopup="dialog"
                className="cursor-pointer transition-colors hover:bg-[#fcfbff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6d4bc3]"
                onClick={event => {
                  event.currentTarget.focus();
                  setSelected(transaction);
                  setIsEditing(false);
                  setEditError('');
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelected(transaction);
                    setIsEditing(false);
                    setEditError('');
                  }
                }}
              >
                <td>
                  <div className="text-xs font-black text-[#6d4bc3]">{transaction.transactionNo}</div>
                  <div className="mt-1 max-w-[170px] truncate text-[10px] text-[#a29aaa]">{transaction.description || 'بدون وصف'}</div>
                </td>
                <td><StatusBadge status={transaction.type} /></td>
                <td className="text-xs font-bold text-[#625c6d]">{transaction.client?.name || 'عام'}</td>
                <td className="text-xs text-[#625c6d]">{transaction.dateLabel}</td>
                <td className={`font-black ${isRevenue(transaction.type) ? 'text-[#217a5a]' : 'text-[#af3f53]'}`}>
                  {isRevenue(transaction.type) ? '+' : '-'} {currency(transaction.amount)}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5}><div className="py-16 text-center text-sm text-[#8a8396]">لا توجد معاملات. سجّل أول حركة لبدء كشف الحساب.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#150c23]/55 p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-transaction-title"
            className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 shadow-2xl sm:p-6"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow">تفاصيل الحركة المالية</div>
                <h2 id="finance-transaction-title" className="mt-1 text-xl font-black text-[#241744]">{selected.transactionNo}</h2>
                <div className="mt-2"><StatusBadge status={selected.type} /></div>
              </div>
              <div className="flex gap-2">
                {!selected.linkedClientPayment && !isEditing && (
                  <button type="button" className="btn btn-soft !min-h-9 !px-3" onClick={() => setIsEditing(true)}>
                    <Pencil size={15} /> تعديل
                  </button>
                )}
                <button
                  ref={closeButton}
                  type="button"
                  className="btn btn-ghost !min-h-9 !px-2"
                  aria-label="إغلاق تفاصيل الحركة"
                  onClick={() => setSelected(null)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {isEditing ? (
              <form className="mt-5 space-y-3" onSubmit={updateTransaction}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="label">نوع الحركة</span>
                    <select name="type" required className="input" defaultValue={selected.type}>
                      <option value="SERVICE_REVENUE">إيراد خدمة</option>
                      <option value="ADDITIONAL_REVENUE">إيراد إضافي</option>
                      <option value="OPERATING_EXPENSE">مصروف تشغيلي</option>
                      <option value="EMPLOYEE_SALARY">راتب موظف</option>
                      <option value="DIRECT_CLIENT_COST">تكلفة مباشرة لعميل</option>
                      <option value="MARKETING_EXPENSE">مصروف تسويق</option>
                      <option value="OTHER_EXPENSE">مصروف آخر</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="label">المبلغ بالجنيه</span>
                    <input name="amount" type="number" min="0.01" step="0.01" required className="input" defaultValue={selected.amount} />
                  </label>
                  <label className="space-y-1">
                    <span className="label">التاريخ</span>
                    <input name="date" type="date" required className="input" defaultValue={selected.dateValue} />
                  </label>
                  <label className="space-y-1">
                    <span className="label">طريقة الدفع</span>
                    <select name="paymentMethod" className="input" defaultValue={selected.paymentMethod || ''}>
                      <option value="">غير محددة</option>
                      <option value="تحويل بنكي">تحويل بنكي</option>
                      <option value="نقدي">نقدي / كاش</option>
                      <option value="بطاقة">بطاقة</option>
                      <option value="محفظة إلكترونية">محفظة إلكترونية</option>
                      <option value="إنستا باي">إنستا باي</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="label">العميل المرتبط</span>
                    <select name="clientId" className="input" defaultValue={selected.client?.id || ''}>
                      <option value="">بدون عميل</option>
                      {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="label">التصنيف</span>
                    <input name="category" className="input" defaultValue={selected.category || ''} />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="label">الوصف</span>
                  <textarea name="description" className="input" defaultValue={selected.description || ''} />
                </label>
                {editError && <p role="alert" className="text-xs font-bold text-[#af3f53]">{editError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setIsEditing(false)}>إلغاء</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}</button>
                </div>
              </form>
            ) : (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Detail label="المبلغ">
                    <span className={isRevenue(selected.type) ? 'text-[#217a5a]' : 'text-[#af3f53]'}>
                      {isRevenue(selected.type) ? '+' : '-'} {currency(selected.amount)}
                    </span>
                  </Detail>
                  <Detail label="التاريخ">{selected.dateLabel}</Detail>
                  <Detail label="طريقة الدفع">{selected.paymentMethod || 'غير محددة'}</Detail>
                  <Detail label="التصنيف">{selected.category}</Detail>
                  <Detail label="الوصف">{selected.description}</Detail>
                  <Detail label="سُجلت بواسطة">{selected.createdBy.name} · {selected.createdBy.email}</Detail>
                  <Detail label="تاريخ تسجيلها">{selected.createdAtLabel}</Detail>
                </div>

                {selected.linkedClientPayment && (
                  <p className="mt-4 rounded-xl bg-[#fff6df] p-3 text-xs leading-6 text-[#80590c]">
                    هذا القيد مرتبط بتحصيل عميل؛ عدّله من سجل تحصيلات العميل للحفاظ على تطابق السجلات.
                  </p>
                )}

                <div className="mt-5">
                  <h3 className="mb-2 text-sm font-black text-[#241744]">العميل المرتبط</h3>
                  {selected.client ? (
                    <div className="grid gap-3 rounded-xl border border-[#eeeaf4] p-3 sm:grid-cols-2">
                      <Detail label="الاسم">{selected.client.name}</Detail>
                      <Detail label="الشركة">{selected.client.companyName}</Detail>
                      <Detail label="الهاتف">{selected.client.phone}</Detail>
                      <Detail label="البريد الإلكتروني">{selected.client.email}</Detail>
                    </div>
                  ) : <p className="rounded-xl bg-[#faf9fc] p-3 text-sm text-[#756f82]">لا يوجد عميل مرتبط بهذه الحركة.</p>}
                </div>

                <div className="mt-5">
                  <h3 className="mb-2 text-sm font-black text-[#241744]">الموظف المرتبط</h3>
                  {selected.employee ? (
                    <div className="grid gap-3 rounded-xl border border-[#eeeaf4] p-3 sm:grid-cols-2">
                      <Detail label="الاسم">{selected.employee.fullName}</Detail>
                      <Detail label="كود الموظف">{selected.employee.employeeCode}</Detail>
                      <Detail label="المسمى الوظيفي">{selected.employee.jobTitle}</Detail>
                      <Detail label="القسم">{selected.employee.departmentName}</Detail>
                      <Detail label="الهاتف">{selected.employee.phone}</Detail>
                      <Detail label="البريد الإلكتروني">{selected.employee.email}</Detail>
                    </div>
                  ) : <p className="rounded-xl bg-[#faf9fc] p-3 text-sm text-[#756f82]">لا يوجد موظف مرتبط بهذه الحركة.</p>}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
