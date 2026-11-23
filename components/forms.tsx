'use client';

import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, Loader2, Trash2 } from 'lucide-react';
import { WalletCards } from 'lucide-react';
import { currencyPrecise } from '@/lib/format';
import { isAdvertisingPurchaseService } from '@/lib/client-ad-budget';

function useSubmit(url: string, success = 'تم الحفظ بنجاح', method: 'POST' | 'PATCH' = 'POST') {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async (body: unknown) => {
    setLoading(true); setMessage('');
    try { const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'تعذر الحفظ'); setMessage(success); router.refresh(); return true; } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر الحفظ'); return false; } finally { setLoading(false); }
  };
  return { loading, message, submit };
}

function Message({ value }: { value: string }) { return value ? <p className={`mt-3 text-xs font-bold ${value.startsWith('تم') ? 'text-[#217a5a]' : 'text-[#af3f53]'}`}>{value}</p> : null; }

type ClientServiceOption = { id: string; name: string; description: string | null; adBudgetAmount?: number; isActive?: boolean };

type ClientServiceSelectionFieldsProps = {
  services: ClientServiceOption[];
  selectedServiceIds: string[];
  setSelectedServiceIds: Dispatch<SetStateAction<string[]>>;
  servicePrices: Record<string, string>;
  setServicePrices: Dispatch<SetStateAction<Record<string, string>>>;
  adBudgetAmounts: Record<string, string>;
  setAdBudgetAmounts: Dispatch<SetStateAction<Record<string, string>>>;
};

function ClientServiceSelectionFields({
  services,
  selectedServiceIds,
  setSelectedServiceIds,
  servicePrices,
  setServicePrices,
  adBudgetAmounts,
  setAdBudgetAmounts,
}: ClientServiceSelectionFieldsProps) {
  const totalCents = selectedServiceIds.reduce(
    (sum, serviceId) => sum + Math.round((Number(servicePrices[serviceId]) || 0) * 100),
    0
  );

  return <fieldset className="space-y-3 rounded-xl border border-[#eeeaf4] p-3">
    <legend className="px-1 text-xs font-black text-[#241744]">الخدمات والأسعار المتفق عليها</legend>
    <p className="text-[11px] leading-5 text-[#8a8396]">اختَر الخدمات واكتب السعر المتفق عليه لكل خدمة. الإجمالي يُحسب تلقائيًا، وتُنشأ الاشتراكات بالقيم نفسها عند الحفظ.</p>
    {services.length ? <div className="space-y-2">{services.map(service => {
      const selected = selectedServiceIds.includes(service.id);
      const agreedPrice = servicePrices[service.id] ?? '';
      const maxAdBudget = agreedPrice !== '' && Number.isFinite(Number(agreedPrice)) ? Number(agreedPrice) : undefined;

      return <div key={service.id} className="rounded-lg bg-[#faf9fc] p-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[#625c6d]">
          <input type="checkbox" checked={selected} onChange={event => {
            const checked = event.currentTarget.checked;
            setSelectedServiceIds(current => checked
              ? current.includes(service.id) ? current : [...current, service.id]
              : current.filter(id => id !== service.id));
            setServicePrices(current => {
              const next = { ...current };
              if (checked) next[service.id] ??= '';
              else delete next[service.id];
              return next;
            });
            setAdBudgetAmounts(current => {
              const next = { ...current };
              if (checked) next[service.id] ??= '';
              else delete next[service.id];
              return next;
            });
          }} className="accent-[#6d4bc3]" />
          <span>{service.name}{service.isActive === false && <span className="mr-1 text-[10px] text-[#a26a12]">(خدمة غير مفعّلة)</span>}</span>
        </label>
        {selected && <div className="mt-3 space-y-3">
          {service.description && <p className="text-[11px] leading-5 text-[#8a8396]">{service.description}</p>}
          <label className="block space-y-1">
            <span className="label">السعر المتفق عليه للخدمة (ج.م) *</span>
            <input type="number" required min="0" max="9999999999.99" step="0.01" value={agreedPrice} onChange={event => setServicePrices(current => ({ ...current, [service.id]: event.target.value }))} className="input" placeholder="اكتب السعر المتفق عليه" />
          </label>
          {isAdvertisingPurchaseService(service.name) && <label className="block space-y-1">
            <span className="label">ميزانية الإعلانات من سعر الخدمة (اختياري)</span>
            <input type="number" min="0" max={maxAdBudget} step="0.01" value={adBudgetAmounts[service.id] ?? ''} onChange={event => setAdBudgetAmounts(current => ({ ...current, [service.id]: event.target.value }))} className="input" placeholder="0.00" />
            <span className="text-[10px] text-[#8a8396]">تُخصم هذه الميزانية من السعر المتفق عليه وتُضاف لمحفظة إعلانات العميل عند تسجيل الدفعة.</span>
          </label>}
        </div>}
      </div>;
    })}</div> : <p className="text-xs text-[#8a8396]">لا توجد خدمات مفعّلة في الكتالوج.</p>}
    {selectedServiceIds.length > 0 && <div className="flex items-center justify-between gap-3 border-t border-[#eeeaf4] pt-3 text-xs">
      <span className="font-bold text-[#625c6d]">إجمالي الأسعار المتفق عليها</span>
      <strong className="text-base font-black text-[#6245ad]">{currencyPrecise(totalCents / 100)}</strong>
    </div>}
  </fieldset>;
}

export function ClientForm({ services }: { services: ClientServiceOption[] }) {
  const { loading, message, submit } = useSubmit('/api/clients', 'تمت إضافة العميل وتوليد كوده');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [servicePrices, setServicePrices] = useState<Record<string, string>>({});
  const [adBudgetAmounts, setAdBudgetAmounts] = useState<Record<string, string>>({});

  return <form onSubmit={async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const raw = Object.fromEntries([...form.entries()].filter(([name]) => !['nextFollowUpAt', 'selectedServiceIds'].includes(name)));
    const serviceSelections = selectedServiceIds.map(serviceId => ({
      serviceId,
      agreedPrice: Number(servicePrices[serviceId]),
      adBudgetAmount: Number(adBudgetAmounts[serviceId]) || 0
    }));
    const ok = await submit({
      ...raw,
      serviceSelections,
      nextFollowUpAt: form.get('nextFollowUpAt') || undefined
    });
    if (ok) {
      event.currentTarget.reset();
      setSelectedServiceIds([]);
      setServicePrices({});
      setAdBudgetAmounts({});
    }
  }} className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1"><span className="label">اسم العميل *</span><input name="name" required className="input" placeholder="مثال: أحمد محمود" /></label>
      <label className="space-y-1"><span className="label">اسم الشركة</span><input name="companyName" className="input" placeholder="الشركة أو العلامة" /></label>
      <label className="space-y-1"><span className="label">الهاتف</span><input name="phone" className="input" placeholder="01xxxxxxxxx" /></label>
      <label className="space-y-1"><span className="label">البريد الإلكتروني</span><input type="email" name="email" className="input" placeholder="client@company.com" /></label>
      <label className="space-y-1"><span className="label">النشاط</span><input name="businessActivity" className="input" placeholder="مطاعم، تجارة، خدمات..." /></label>
      <label className="space-y-1"><span className="label">العنوان</span><input name="address" className="input" placeholder="عنوان العميل" /></label>
      <label className="space-y-1"><span className="label">مصدر العميل</span><select name="source" className="input"><option value="">اختر المصدر</option><option>إحالة</option><option>إعلان</option><option>موقع إلكتروني</option><option>تواصل مباشر</option></select></label>
    </div>
    <label className="block space-y-1"><span className="label">الحالة</span><select name="status" className="input"><option value="POTENTIAL">محتمل</option><option value="ACTIVE">نشط</option><option value="PAUSED">متوقف مؤقتًا</option></select></label>
    <ClientServiceSelectionFields
      services={services}
      selectedServiceIds={selectedServiceIds}
      setSelectedServiceIds={setSelectedServiceIds}
      servicePrices={servicePrices}
      setServicePrices={setServicePrices}
      adBudgetAmounts={adBudgetAmounts}
      setAdBudgetAmounts={setAdBudgetAmounts}
    />
    <label className="block space-y-1"><span className="label">ملاحظات</span><textarea name="notes" className="input" placeholder="ملاحظات مختصرة عن العميل" /></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="label">موعد المتابعة</span><input type="datetime-local" name="nextFollowUpAt" className="input" /></label><label className="space-y-1"><span className="label">سبب المتابعة</span><input name="followUpNote" className="input" placeholder="اتصال / عرض سعر..." /></label></div>
    <button className="btn btn-primary w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} حفظ العميل</button><Message value={message} />
  </form>;
}

type ClientEditService = ClientServiceOption;
type ClientEditDetails = {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  email: string;
  businessActivity: string;
  address: string;
  source: string;
  status: string;
  notes: string;
  nextFollowUpAt: Date | null;
  followUpNote: string;
  serviceIds: string[];
  servicePrices: Record<string, number>;
};

export function ClientEditForm({ client, services }: { client: ClientEditDetails; services: ClientEditService[] }) {
  const { loading, message, submit } = useSubmit(`/api/clients/${client.id}`, 'تم تحديث بيانات العميل', 'PATCH');
  const [editing, setEditing] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState(client.serviceIds);
  const [servicePrices, setServicePrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(client.servicePrices).map(([serviceId, price]) => [serviceId, price.toFixed(2)]))
  );
  const [adBudgetAmounts, setAdBudgetAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(services
      .filter(service => client.serviceIds.includes(service.id) && isAdvertisingPurchaseService(service.name))
      .map(service => [service.id, (service.adBudgetAmount ?? 0).toFixed(2)]))
  );
  useEffect(() => {
    const openEditor = () => setEditing(true);
    const openFromHash = () => {
      if (window.location.hash === '#edit-client') setEditing(true);
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    window.addEventListener('open-client-edit', openEditor);
    return () => {
      window.removeEventListener('hashchange', openFromHash);
      window.removeEventListener('open-client-edit', openEditor);
    };
  }, []);
  const followUpDate = client.nextFollowUpAt
    ? new Date(client.nextFollowUpAt.getTime() - client.nextFollowUpAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : '';

  return <section id="edit-client" className="card card-pad mb-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="eyebrow">CLIENT PROFILE</div><h2 className="mt-1 text-lg font-black text-[#241744]">بيانات العميل</h2></div>
      <button type="button" onClick={() => setEditing(value => !value)} className="btn btn-ghost">{editing ? 'إلغاء التعديل' : 'تعديل بيانات العميل'}</button>
    </div>
    {editing && <form onSubmit={async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = new FormData(form);
      const raw = Object.fromEntries([...values.entries()].filter(([name]) => !['serviceIds', 'nextFollowUpAt'].includes(name)));
      await submit({
        ...raw,
        serviceSelections: selectedServiceIds.map(serviceId => ({
          serviceId,
          agreedPrice: Number(servicePrices[serviceId]),
          adBudgetAmount: Number(adBudgetAmounts[serviceId]) || 0
        })),
        nextFollowUpAt: values.get('nextFollowUpAt') || undefined
      });
    }} className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="label">اسم العميل *</span><input name="name" required minLength={2} defaultValue={client.name} className="input" /></label>
        <label className="space-y-1"><span className="label">اسم الشركة</span><input name="companyName" defaultValue={client.companyName} className="input" /></label>
        <label className="space-y-1"><span className="label">الهاتف</span><input name="phone" defaultValue={client.phone} className="input" /></label>
        <label className="space-y-1"><span className="label">البريد الإلكتروني</span><input type="email" name="email" defaultValue={client.email} className="input" /></label>
        <label className="space-y-1"><span className="label">النشاط</span><input name="businessActivity" defaultValue={client.businessActivity} className="input" /></label>
        <label className="space-y-1"><span className="label">العنوان</span><input name="address" defaultValue={client.address} className="input" /></label>
        <label className="space-y-1"><span className="label">مصدر العميل</span><input name="source" defaultValue={client.source} className="input" /></label>
        <label className="space-y-1"><span className="label">حالة العميل</span><select name="status" defaultValue={client.status} className="input"><option value="POTENTIAL">محتمل</option><option value="ACTIVE">نشط</option><option value="PAUSED">متوقف مؤقتًا</option><option value="INACTIVE">غير نشط</option></select></label>
        <label className="space-y-1"><span className="label">موعد المتابعة</span><input type="datetime-local" name="nextFollowUpAt" defaultValue={followUpDate} className="input" /></label>
        <label className="space-y-1"><span className="label">سبب المتابعة</span><input name="followUpNote" defaultValue={client.followUpNote} className="input" /></label>
      </div>
      <label className="block space-y-1"><span className="label">ملاحظات العميل</span><textarea name="notes" defaultValue={client.notes} className="input" /></label>
      <ClientServiceSelectionFields
        services={services}
        selectedServiceIds={selectedServiceIds}
        setSelectedServiceIds={setSelectedServiceIds}
        servicePrices={servicePrices}
        setServicePrices={setServicePrices}
        adBudgetAmounts={adBudgetAmounts}
        setAdBudgetAmounts={setAdBudgetAmounts}
      />
      <div className="flex justify-end"><button className="btn btn-primary" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} حفظ التعديلات</button></div>
      <Message value={message} />
    </form>}
    {!editing && <Message value={message} />}
  </section>;
}

export function TaskForm({ departments, employees, clients, services, defaultClientId }: { departments: { id: string; name: string }[]; employees: { id: string; fullName: string; departmentId: string }[]; clients: { id: string; name: string }[]; services: { id: string; name: string }[]; defaultClientId?: string }) {
  const { loading, message, submit } = useSubmit('/api/tasks', 'تم إنشاء المهمة وإسنادها');
  const [departmentId, setDepartmentId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const departmentEmployees = employees.filter(employee => employee.departmentId === departmentId);
  return <form onSubmit={async e => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = Object.fromEntries(form);
    const body = { ...raw, clientId: raw.clientId || undefined, serviceId: raw.serviceId || undefined, assigneeId: raw.assigneeId || undefined };
    const ok = await submit(body);
    if (ok) {
      e.currentTarget.reset();
      setDepartmentId('');
      setAssigneeId('');
    }
  }} className="space-y-3">
    <label className="space-y-1 block"><span className="label">عنوان المهمة *</span><input name="title" required className="input" placeholder="مثال: خطة محتوى شهر ديسمبر" /></label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1"><span className="label">القسم *</span><select name="departmentId" required value={departmentId} onChange={event => { setDepartmentId(event.target.value); setAssigneeId(''); }} className="input"><option value="">اختر القسم</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
      <label className="space-y-1"><span className="label">المكلف</span><select name="assigneeId" value={assigneeId} onChange={event => setAssigneeId(event.target.value)} disabled={!departmentId} className="input"><option value="">{departmentId ? 'بدون إسناد الآن' : 'اختر القسم أولًا'}</option>{departmentEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}{departmentId && departmentEmployees.length === 0 && <option value="" disabled>لا يوجد موظفون نشطون في هذا القسم</option>}</select></label>
      <label className="space-y-1"><span className="label">العميل</span><select name="clientId" defaultValue={defaultClientId || ''} className="input"><option value="">مهمة داخلية</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      <label className="space-y-1"><span className="label">الخدمة</span><select name="serviceId" className="input"><option value="">اختر الخدمة</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
      <label className="space-y-1"><span className="label">الأولوية</span><select name="priority" className="input"><option value="MEDIUM">متوسطة</option><option value="LOW">منخفضة</option><option value="HIGH">عالية</option><option value="URGENT">عاجلة</option></select></label>
      <label className="space-y-1"><span className="label">الموعد النهائي *</span><input type="date" name="deadline" required className="input" /></label>
      <label className="space-y-1"><span className="label">الساعات المقدرة</span><input type="number" min="0" step="0.5" name="estimatedHours" className="input" placeholder="0" /></label>
      <label className="space-y-1"><span className="label">نقاط الإنتاجية</span><input type="number" min="0" name="productivityPoints" className="input" placeholder="0" /></label>
    </div>
    <label className="space-y-1 block"><span className="label">الوصف</span><textarea name="description" className="input" placeholder="ما المطلوب إنجازه؟" /></label>
    <button className="btn btn-primary w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} إنشاء المهمة</button><Message value={message} />
  </form>;
}

export function ClientEditShortcut({ label, className = 'btn btn-primary' }: { label: string; className?: string }) {
  return <button type="button" className={className} onClick={() => {
    window.dispatchEvent(new Event('open-client-edit'));
    document.getElementById('edit-client')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }}>{label}</button>;
}

export function FinanceForm({ clients }: { clients: { id: string; name: string }[] }) {
  const { loading, message, submit } = useSubmit('/api/finance', 'تم تسجيل المعاملة المالية');
  return <form onSubmit={async e => { e.preventDefault(); const form = new FormData(e.currentTarget); const raw = Object.fromEntries(form); const ok = await submit({ ...raw, clientId: raw.clientId || undefined }); if (ok) e.currentTarget.reset(); }} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="label">نوع الحركة *</span><select name="type" required className="input"><option value="SERVICE_REVENUE">إيراد خدمة</option><option value="ADDITIONAL_REVENUE">إيراد إضافي</option><option value="OPERATING_EXPENSE">مصروف تشغيلي</option><option value="EMPLOYEE_SALARY">راتب موظف</option><option value="DIRECT_CLIENT_COST">تكلفة مباشرة لعميل</option><option value="MARKETING_EXPENSE">مصروف تسويق</option><option value="OTHER_EXPENSE">مصروف آخر</option></select></label><label className="space-y-1"><span className="label">المبلغ بالجنيه *</span><input type="number" min="0.01" step="0.01" name="amount" required className="input" placeholder="0.00" /></label><label className="space-y-1"><span className="label">التاريخ *</span><input type="date" name="date" required className="input" defaultValue={new Date().toISOString().slice(0,10)} /></label><label className="space-y-1"><span className="label">طريقة الدفع</span><select name="paymentMethod" className="input"><option value="تحويل بنكي">تحويل بنكي</option><option value="نقدي">نقدي / كاش</option><option value="بطاقة">بطاقة</option><option value="محفظة إلكترونية">محفظة إلكترونية</option><option value="إنستا باي">إنستا باي</option></select></label><label className="space-y-1"><span className="label">العميل المرتبط</span><select name="clientId" className="input"><option value="">بدون عميل</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="space-y-1"><span className="label">التصنيف</span><input name="category" className="input" placeholder="اشتراك، أدوات، رواتب..." /></label></div><label className="space-y-1 block"><span className="label">الوصف</span><textarea name="description" className="input" placeholder="سبب الحركة أو ملاحظات المراجعة" /></label><button className="btn btn-primary w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} تسجيل الحركة</button><Message value={message} /></form>;
}

export function AdTransactionForm({ wallets }: { wallets: { id: string; label: string }[] }) {
  const { loading, message, submit } = useSubmit('/api/advertising', 'تم تحديث محفظة الإعلانات');
  return <form onSubmit={async e => { e.preventDefault(); const form = new FormData(e.currentTarget); const ok = await submit(Object.fromEntries(form)); if (ok) e.currentTarget.reset(); }} className="space-y-3"><label className="space-y-1 block"><span className="label">المحفظة *</span><select name="walletId" required className="input"><option value="">اختر المحفظة</option>{wallets.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="label">نوع الحركة</span><select name="type" className="input"><option value="FUNDS_RECEIVED">استلام أموال من العميل</option><option value="CAMPAIGN_SPENDING">إنفاق حملة</option><option value="REFUND">مرتجع</option><option value="ADJUSTMENT">تعديل معتمد</option></select></label><label className="space-y-1"><span className="label">المبلغ *</span><input type="number" min="0.01" step="0.01" required name="amount" className="input" placeholder="0.00" /></label></div><label className="space-y-1 block"><span className="label">الوصف</span><input name="description" className="input" placeholder="وصف الحركة أو اسم الحملة" /></label><button className="btn btn-primary w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={16} /> : <WalletCards size={16} />} تسجيل حركة المحفظة</button><Message value={message} /></form>;
}

export function DepartmentForm({ employees }: { employees: { id: string; fullName: string }[] }) {
  const { loading, message, submit } = useSubmit('/api/team/departments', 'تم إضافة القسم');
  return <form onSubmit={async e => { e.preventDefault(); const form = new FormData(e.currentTarget); const raw = Object.fromEntries(form); const ok = await submit({ ...raw, managerId: raw.managerId || undefined }); if (ok) e.currentTarget.reset(); }} className="space-y-3">
    <label className="space-y-1 block"><span className="label">اسم القسم *</span><input name="name" required className="input" placeholder="مثال: التسويق الرقمي" /></label>
    <label className="space-y-1 block"><span className="label">الوصف</span><textarea name="description" className="input" placeholder="اختصار مسؤوليات القسم" /></label>
    <label className="space-y-1 block"><span className="label">مدير القسم</span><select name="managerId" className="input"><option value="">غير محدد</option>{employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}</select></label>
    <button className="btn btn-primary w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} إضافة قسم</button>
    <Message value={message} />
  </form>;
}

export function EmployeeForm({ departments }: { departments: { id: string; name: string }[] }) {
  const { loading, message, submit } = useSubmit('/api/team/employees', 'تمت إضافة الموظف وربطه بالقسم');
  return <form onSubmit={async e => { e.preventDefault(); const form = new FormData(e.currentTarget); const raw = Object.fromEntries(form); const body = { ...raw, phone: raw.phone || undefined, jobTitle: raw.jobTitle || undefined, hireDate: raw.hireDate || undefined, password: raw.password || undefined }; const ok = await submit(body); if (ok) e.currentTarget.reset(); }} className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1"><span className="label">الاسم الكامل *</span><input name="fullName" required className="input" /></label>
      <label className="space-y-1"><span className="label">البريد الإلكتروني *</span><input type="email" name="email" required className="input" /></label>
      <label className="space-y-1"><span className="label">القسم *</span><select name="departmentId" required className="input"><option value="">اختر القسم</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label className="space-y-1"><span className="label">المسمى الوظيفي</span><input name="jobTitle" className="input" /></label>
      <label className="space-y-1"><span className="label">الراتب الشهري *</span><input type="number" min="0" step="0.01" name="monthlySalary" required className="input" /></label>
      <label className="space-y-1"><span className="label">الهاتف</span><input name="phone" className="input" /></label>
      <label className="space-y-1"><span className="label">دور النظام</span><select name="role" className="input"><option value="EMPLOYEE">موظف</option><option value="DEPARTMENT_MANAGER">مدير قسم</option></select></label>
      <label className="space-y-1"><span className="label">حالة التوظيف</span><select name="employmentStatus" className="input"><option value="ACTIVE">نشط</option><option value="ON_LEAVE">إجازة</option><option value="INACTIVE">غير نشط</option></select></label>
      <label className="space-y-1"><span className="label">تاريخ التعيين</span><input type="date" name="hireDate" className="input" /></label>
      <label className="space-y-1"><span className="label">كلمة مرور الدخول</span><input type="password" minLength={8} name="password" className="input" placeholder="اختياري لإنشاء حساب" /></label>
    </div>
    <button className="btn btn-primary w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} حفظ الموظف</button>
    <Message value={message} />
  </form>;
}

export function DepartmentActions({ department }: { department: { id: string; name: string; description: string | null; managerId: string | null } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const editDepartment = async () => {
    const name = window.prompt('اسم القسم', department.name)?.trim();
    if (!name) return;
    const description = window.prompt('وصف القسم', department.description || '') ?? '';
    setLoading(true);
    try {
      const response = await fetch('/api/team/departments', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: department.id, name, description, managerId: department.managerId || undefined }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر تعديل القسم');
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'تعذر تعديل القسم');
    } finally {
      setLoading(false);
    }
  };
  const deleteDepartment = async () => {
    if (!window.confirm(`تعطيل القسم "${department.name}"؟`)) return;
    setLoading(true);
    const response = await fetch('/api/team/departments', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: department.id }) });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) window.alert(data.error || 'تعذر تعطيل القسم');
    else router.refresh();
  };
  return <div className="flex gap-2"><button type="button" disabled={loading} onClick={editDepartment} className="text-[11px] font-bold text-[#6245ad]">تعديل</button><button type="button" disabled={loading} onClick={deleteDepartment} className="text-[11px] font-bold text-[#af3f53]">تعطيل</button></div>;
}

export function EmployeeActions({ employee }: { employee: { id: string; fullName: string; email: string; phone: string | null; jobTitle: string | null; hireDate: Date | null; monthlySalary: unknown; employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE'; departmentId: string; role?: 'EMPLOYEE' | 'DEPARTMENT_MANAGER' } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const editEmployee = async () => {
    const fullName = window.prompt('الاسم الكامل', employee.fullName)?.trim();
    if (!fullName) return;
    const jobTitle = window.prompt('المسمى الوظيفي', employee.jobTitle || '') ?? '';
    const salaryValue = window.prompt('الراتب الشهري', String(employee.monthlySalary));
    if (salaryValue === null) return;
    const monthlySalary = Number(salaryValue);
    if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
      window.alert('الراتب يجب أن يكون رقمًا غير سالب');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/team/employees', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: employee.id, fullName, email: employee.email, phone: employee.phone || undefined, jobTitle: jobTitle || undefined, hireDate: employee.hireDate ? employee.hireDate.toISOString().slice(0, 10) : undefined, monthlySalary, employmentStatus: employee.employmentStatus, departmentId: employee.departmentId, role: employee.role || 'EMPLOYEE' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر تعديل الموظف');
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'تعذر تعديل الموظف');
    } finally {
      setLoading(false);
    }
  };
  const deleteEmployee = async () => {
    if (!window.confirm(`تعطيل الموظف "${employee.fullName}"؟`)) return;
    setLoading(true);
    try {
      const response = await fetch('/api/team/employees', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: employee.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر تعطيل الموظف');
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'تعذر تعطيل الموظف');
    } finally {
      setLoading(false);
    }
  };
  return <div className="flex gap-2"><button type="button" disabled={loading} onClick={editEmployee} className="text-[11px] font-bold text-[#6245ad]">تعديل</button><button type="button" disabled={loading} onClick={deleteEmployee} className="text-[11px] font-bold text-[#af3f53]">تعطيل</button></div>;
}

export function ClientFollowUpForm({ client }: { client: { id: string; status: string; nextFollowUpAt: Date | null; followUpNote: string | null } }) {
  const { loading, message, submit } = useSubmit('/api/clients', 'تم حفظ المتابعة', 'PATCH');
  const defaultDate = client.nextFollowUpAt ? new Date(client.nextFollowUpAt.getTime() - client.nextFollowUpAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  return <form onSubmit={async e => { e.preventDefault(); const raw = Object.fromEntries(new FormData(e.currentTarget)); await submit({ id: client.id, status: raw.status, nextFollowUpAt: raw.nextFollowUpAt || undefined, followUpNote: raw.followUpNote }); }} className="space-y-3">
    <label className="space-y-1 block"><span className="label">حالة العميل</span><select name="status" defaultValue={client.status} className="input"><option value="POTENTIAL">محتمل</option><option value="ACTIVE">نشط</option><option value="PAUSED">متوقف مؤقتًا</option><option value="INACTIVE">غير نشط</option></select></label>
    <label className="space-y-1 block"><span className="label">موعد التذكير التالي</span><input type="datetime-local" name="nextFollowUpAt" defaultValue={defaultDate} className="input" /></label>
    <label className="space-y-1 block"><span className="label">ملاحظة المتابعة</span><textarea name="followUpNote" defaultValue={client.followUpNote || ''} className="input" placeholder="اتصال، إرسال عرض سعر..." /></label>
    <button className="btn btn-primary w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} حفظ الحالة والتذكير</button><Message value={message} />
  </form>;
}

export function SalesRevenueForm({ clientId }: { clientId: string }) {
  const { loading, message, submit } = useSubmit('/api/sales/revenue', 'تمت إضافة ميزانية الحملة للمحفظة');
  return <form onSubmit={async e => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await submit({ clientId, date: form.get('date'), campaignName: form.get('campaignName') || undefined, adBudget: Number(form.get('adBudget')) || 0 });
  }} className="space-y-3">
    <div className="rounded-xl border border-[#eeeaf4] p-3"><div className="mb-3 text-xs font-black text-[#241744]">ميزانية إعلانات العميل (ليست إيرادًا للشركة)</div><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="label">اسم الحملة *</span><input name="campaignName" required className="input" placeholder="مثال: حملة عروض الصيف" /></label><label className="space-y-1"><span className="label">ميزانية الإعلانات *</span><input type="number" min="0.01" step="0.01" name="adBudget" required className="input" placeholder="0.00" /></label></div></div>
    <label className="block space-y-1"><span className="label">تاريخ الإيداع *</span><input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></label>
    <button className="btn btn-primary w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} إضافة ميزانية الإعلان</button><Message value={message} />
  </form>;
}

type ClientPaymentItem = { id: string; paymentNo: string; amount: number; date: Date | string; paymentMethod: string | null; adBudgetAmount: number; deletable: boolean };

export function ClientPaymentForm({ clientId, payments, outstanding, remainingAdBudget, canDelete }: { clientId: string; payments: ClientPaymentItem[]; outstanding: number; remainingAdBudget: number; canDelete: boolean }) {
  const { loading, message, submit } = useSubmit(`/api/clients/${clientId}/payments`, 'تم تسجيل الدفعة');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState('');
  const router = useRouter();

  const deletePayment = async (payment: ClientPaymentItem) => {
    if (!window.confirm(`حذف الدفعة ${currencyPrecise(payment.amount)}؟ سيتم تسجيل الحذف في سجل المراجعة.`)) return;
    setDeletingId(payment.id);
    setDeleteMessage('');
    try {
      const response = await fetch(`/api/clients/${clientId}/payments`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transactionId: payment.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر حذف الدفعة');
      setDeleteMessage('تم حذف الدفعة وتحديث المتبقي');
      router.refresh();
    } catch (error) {
      setDeleteMessage(error instanceof Error ? error.message : 'تعذر حذف الدفعة');
    } finally {
      setDeletingId(null);
    }
  };

  return <div className="space-y-4">
    {outstanding > 0 && <form onSubmit={async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const fields = new FormData(form);
      const saved = await submit({ amount: fields.get('amount'), date: fields.get('date'), paymentMethod: fields.get('paymentMethod') });
      if (saved) form.reset();
    }} className="rounded-xl border border-[#eeeaf4] bg-white p-3">
      <div className="mb-3 text-xs font-black text-[#241744]">تسجيل دفعة على الاشتراك</div>
      {remainingAdBudget > 0 && <p className="mb-3 rounded-lg bg-[#eef6fb] p-2 text-[10px] leading-5 text-[#2e6aa3]">من الدفعة، حتى {currencyPrecise(remainingAdBudget)} سيُضاف لمحفظة الإعلانات أولًا؛ والباقي فقط يُسجل إيراد خدمات.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="label">المبلغ المدفوع *</span><input type="number" name="amount" min="0.01" max={outstanding.toFixed(2)} step="0.01" required className="input" placeholder={`المتبقي ${currencyPrecise(outstanding)}`} /></label>
        <label className="space-y-1"><span className="label">طريقة الدفع *</span><select name="paymentMethod" required className="input"><option value="">اختر طريقة الدفع</option><option value="إنستا باي">إنستا باي</option><option value="محفظة إلكترونية">محفظة إلكترونية</option><option value="نقدي">كاش / نقدي</option><option value="تحويل بنكي">تحويل بنكي</option><option value="بطاقة">بطاقة</option><option value="أخرى">أخرى</option></select></label>
        <label className="space-y-1 sm:col-span-2"><span className="label">تاريخ الدفع *</span><input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></label>
      </div>
      <button className="btn btn-primary mt-3 w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} تسجيل الدفعة كإيراد خدمات</button>
      <Message value={message} />
    </form>}
    {payments.length > 0 && <div className="space-y-2">
      {payments.map(payment => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs">
        <div><div className="font-black text-[#241744]">{currencyPrecise(payment.amount)} · {payment.paymentMethod || 'طريقة دفع غير محددة'}</div><div className="mt-1 text-[10px] text-[#8a8396]">{new Date(payment.date).toLocaleDateString('ar-EG')} · {payment.paymentNo}{payment.adBudgetAmount > 0 ? ` · منها ${currencyPrecise(payment.adBudgetAmount)} للإعلانات` : ''}</div></div>
        {canDelete && payment.deletable && <button type="button" disabled={deletingId === payment.id} onClick={() => deletePayment(payment)} className="inline-flex items-center gap-1 text-[10px] font-bold text-[#af3f53] disabled:opacity-50">{deletingId === payment.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} حذف</button>}
      </div>)}
    </div>}
    {deleteMessage && <Message value={deleteMessage} />}
  </div>;
}

type TaskAttachment = { id: string; name: string; mimeType: string; url: string };
type TaskSubmissionView = {
  id: string;
  completionNotes: string | null;
  submittedAt: string;
  attachments: TaskAttachment[];
  reviews: { decision: string; comments: string | null; qualityScore: number | null }[];
};

export function TaskWorkflowActions({ taskId, isAssigned, canReview, status, submission }: { taskId: string; isAssigned: boolean; canReview: boolean; status: string; submission: TaskSubmissionView | null }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const submitWork = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`/api/tasks/${taskId}/submissions`, { method: 'POST', body: new FormData(event.currentTarget) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذر تسليم المهمة');
      setMessage('تم تسليم المهمة للمراجعة');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تسليم المهمة');
    } finally {
      setLoading(false);
    }
  };

  const review = async (decision: 'APPROVED' | 'REVISION_REQUIRED', form: HTMLFormElement) => {
    setLoading(true);
    setMessage('');
    try {
      const fields = new FormData(form);
      const response = await fetch(`/api/tasks/${taskId}/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, comments: fields.get('comments'), qualityScore: fields.get('qualityScore') })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'تعذرت مراجعة المهمة');
      setMessage(decision === 'APPROVED' ? 'تم اعتماد المهمة' : 'تم إرسال طلب التعديل للموظف');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذرت مراجعة المهمة');
    } finally {
      setLoading(false);
    }
  };

  return <div className="mt-3 space-y-3 border-t border-[#f0edf5] pt-3">
    {submission && <div className="space-y-2 rounded-xl bg-[#faf9fc] p-3 text-xs">
      <div className="font-bold text-[#241744]">آخر تسليم</div>
      {submission.completionNotes && <p className="whitespace-pre-wrap text-[#625c6d]">{submission.completionNotes}</p>}
      <div className="flex flex-wrap gap-2">{submission.attachments.map(file => <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="font-bold text-[#6245ad] underline">{file.name}</a>)}</div>
      {submission.reviews.map((review, index) => review.comments ? <p key={index} className="border-r-2 border-[#b39ce8] pr-2 text-[#625c6d]">ملاحظة المدير: {review.comments}</p> : null)}
    </div>}
    {isAssigned && !['APPROVED', 'CANCELLED'].includes(status) && <form onSubmit={submitWork} className="space-y-2">
      <label className="space-y-1 block"><span className="label">ملاحظات أو نص السكربت</span><textarea name="completionNotes" className="input" placeholder="اكتب السكربت أو ملخص ما تم إنجازه" /></label>
      <label className="space-y-1 block"><span className="label">رابط الفيديو / التسليم</span><input type="url" name="videoUrl" className="input" placeholder="https://..." /></label>
      <label className="space-y-1 block"><span className="label">ساعات التنفيذ</span><input type="number" min="0" step="0.25" name="actualHours" className="input" placeholder="اختياري" /></label>
      <label className="space-y-1 block"><span className="label">ملفات PDF أو صور (حتى 5 ملفات، 10MB للملف)</span><input type="file" name="files" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" className="input" /></label>
      <button className="btn btn-primary w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} تم التنفيذ وإرسال التسليم</button>
    </form>}
    {canReview && submission && ['SUBMITTED', 'UNDER_REVIEW'].includes(status) && <form onSubmit={event => event.preventDefault()} className="space-y-2">
      <label className="space-y-1 block"><span className="label">تعليق التعديل / المراجعة</span><textarea name="comments" className="input" placeholder="حدد المطلوب تعديله بوضوح" /></label>
      <label className="space-y-1 block"><span className="label">تقييم الجودة (1–5)</span><input name="qualityScore" type="number" min="1" max="5" className="input" /></label>
      <div className="grid grid-cols-2 gap-2"><button type="button" disabled={loading} onClick={event => review('REVISION_REQUIRED', event.currentTarget.form!)} className="btn btn-soft">طلب تعديل</button><button type="button" disabled={loading} onClick={event => review('APPROVED', event.currentTarget.form!)} className="btn btn-primary">اعتماد المهمة</button></div>
    </form>}
    {message && <Message value={message} />}
  </div>;
}

type ServiceFormDetails = { id: string; name: string; description: string | null; category: string | null; durationDays: number };

export function ServiceForm({ service }: { service?: ServiceFormDetails }) {
  const { loading, message, submit } = useSubmit('/api/services', service ? 'تم تحديث الخدمة' : 'تم إنشاء الخدمة', service ? 'PATCH' : 'POST');
  const [open, setOpen] = useState(false);

  return <>
    <button type="button" onClick={() => setOpen(true)} className={service ? 'text-[11px] font-bold text-[#6245ad]' : 'btn btn-primary'}>{service ? 'تعديل الخدمة' : <><Plus size={17} /> خدمة جديدة</>}</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#150b20]/55 p-4" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="new-service-title" className="card w-full max-w-lg p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 id="new-service-title" className="text-lg font-black text-[#241744]">{service ? 'تعديل خدمة الكتالوج' : 'إضافة خدمة للكتالوج'}</h2><p className="muted mt-1 text-xs">سعر الخدمة يُحدّد عند إضافتها لملف العميل حسب الاتفاق، والمدة تُستخدم عند إنشاء الاشتراك.</p></div>
          <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost min-h-9 px-3" aria-label="إغلاق">×</button>
        </div>
        <form onSubmit={async event => {
          event.preventDefault();
          const form = event.currentTarget;
          const values = Object.fromEntries(new FormData(form));
          const ok = await submit({ ...values, ...(service ? { id: service.id } : {}) });
          if (ok) {
            form.reset();
            setOpen(false);
          }
        }} className="space-y-3">
          <label className="block space-y-1"><span className="label">اسم الخدمة *</span><input name="name" required minLength={2} maxLength={191} defaultValue={service?.name} className="input" placeholder="مثال: إدارة صفحات التواصل" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1"><span className="label">مدة الاشتراك بالأيام *</span><input type="number" name="durationDays" min="1" max="3650" step="1" required defaultValue={service?.durationDays ?? 30} className="input" /></label>
            <div className="flex items-center rounded-xl bg-[#faf9fc] p-3 text-xs font-bold text-[#6d4bc3]">السعر حسب الاتفاق مع كل عميل</div>
          </div>
          <label className="block space-y-1"><span className="label">التصنيف</span><input name="category" maxLength={191} defaultValue={service?.category || ''} className="input" placeholder="تسويق، تصميم..." /></label>
          <label className="block space-y-1"><span className="label">وصف الخدمة</span><textarea name="description" maxLength={5000} defaultValue={service?.description || ''} className="input" placeholder="تفاصيل مختصرة عما تتضمنه الخدمة" /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">إلغاء</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} {service ? 'حفظ الخدمة' : 'إنشاء الخدمة'}</button></div>
          <Message value={message} />
        </form>
      </div>
    </div>}
    {!open && <Message value={message} />}
  </>;
}
