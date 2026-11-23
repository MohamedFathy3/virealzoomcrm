export const currency = (value: unknown) => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(amount);
};

export const currencyPrecise = (value: unknown) => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};

export const number = (value: unknown) => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(Number(value ?? 0));

export const date = (value: Date | string | null | undefined) => value ? new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';

export const relativeDays = (value: Date | string) => {
  const diff = Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
  return diff < 0 ? `متأخر ${Math.abs(diff)} يوم` : diff === 0 ? 'اليوم' : `متبقي ${diff} يوم`;
};

export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
