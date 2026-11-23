'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function FinanceChart({ data }: { data: { month: string; revenue: number; expenses: number }[] }) {
  if (!data.length) return <div className="flex h-[260px] items-center justify-center text-sm text-[#8a8396]">لا توجد معاملات مالية كافية لعرض الرسم البياني.</div>;
  return <div className="h-[260px] w-full" dir="ltr"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} barGap={8}><CartesianGrid vertical={false} stroke="#eeeaf4" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#8a8396', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#8a8396', fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}k`} /><Tooltip cursor={{ fill: '#faf8ff' }} formatter={(value: number) => [`${value.toLocaleString('ar-EG')} ج.م`, '']} contentStyle={{ border: '1px solid #ece9f2', borderRadius: 12, fontFamily: 'inherit' }} /><Bar dataKey="revenue" name="الإيرادات" fill="#6d4bc3" radius={[5, 5, 0, 0]} /><Bar dataKey="expenses" name="المصروفات" fill="#d9d2e8" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>;
}
