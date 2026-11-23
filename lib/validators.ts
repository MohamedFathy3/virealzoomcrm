import { z } from 'zod';

const clientServiceSelectionSchema = z.object({
  serviceId: z.string().min(1),
  agreedPrice: z.coerce.number().finite().nonnegative().max(9999999999.99)
    .refine(amount => Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001, 'سعر الخدمة يجب ألا يتجاوز منزلتين عشريتين'),
  adBudgetAmount: z.coerce.number().finite().nonnegative().max(9999999999.99)
    .refine(amount => Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001, 'ميزانية الإعلانات يجب ألا تتجاوز منزلتين عشريتين')
    .default(0)
});

export const clientSchema = z.object({
  name: z.string().trim().min(2),
  companyName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  businessActivity: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'INACTIVE', 'POTENTIAL']).default('POTENTIAL'),
  source: z.string().optional(),
  notes: z.string().optional(),
  nextFollowUpAt: z.string().optional(),
  followUpNote: z.string().optional(),
  serviceSelections: z.array(clientServiceSelectionSchema).max(25).default([])
}).superRefine((data, context) => {
  const serviceIds = data.serviceSelections.map(selection => selection.serviceId);
  if (new Set(serviceIds).size !== serviceIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['serviceSelections'], message: 'لا يمكن اختيار الخدمة أكثر من مرة' });
  }
  const totalCents = data.serviceSelections.reduce((sum, selection) => sum + Math.round(selection.agreedPrice * 100), 0);
  if (totalCents > 999999999999) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['serviceSelections'], message: 'إجمالي أسعار الخدمات أكبر من الحد المسموح' });
  }
});

export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(191),
  description: z.string().max(5000).optional(),
  category: z.string().max(191).optional(),
  defaultPrice: z.coerce.number().finite().nonnegative().max(9999999999.99).optional(),
  durationDays: z.coerce.number().int().positive().max(3650).default(30)
});

export const taskSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  departmentId: z.string().min(1),
  assigneeId: z.string().optional(),
  clientId: z.string().optional(),
  serviceId: z.string().optional(),
  deadline: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  estimatedHours: z.coerce.number().nonnegative().optional(),
  productivityPoints: z.coerce.number().int().nonnegative().default(0)
});

export const financeSchema = z.object({
  type: z.enum(['SERVICE_REVENUE', 'ADDITIONAL_REVENUE', 'OPERATING_EXPENSE', 'EMPLOYEE_SALARY', 'DIRECT_CLIENT_COST', 'MARKETING_EXPENSE', 'OTHER_EXPENSE']),
  amount: z.coerce.number().positive(),
  date: z.string().min(1),
  paymentMethod: z.string().optional(),
  category: z.string().optional(),
  clientId: z.string().optional(),
  description: z.string().optional()
});

export const adTransactionSchema = z.object({
  walletId: z.string().min(1),
  type: z.enum(['FUNDS_RECEIVED', 'CAMPAIGN_SPENDING', 'REFUND', 'ADJUSTMENT']),
  amount: z.coerce.number().positive(),
  description: z.string().optional()
});

export const departmentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  description: z.string().optional(),
  managerId: z.string().optional()
});

export const employeeSchema = z.object({
  id: z.string().optional(),
  employeeCode: z.string().optional(),
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  hireDate: z.string().optional(),
  monthlySalary: z.coerce.number().nonnegative(),
  employmentStatus: z.enum(['ACTIVE', 'ON_LEAVE', 'INACTIVE']).default('ACTIVE'),
  departmentId: z.string().min(1),
  role: z.enum(['EMPLOYEE', 'DEPARTMENT_MANAGER']).default('EMPLOYEE'),
  password: z.string().min(8).optional().or(z.literal(''))
});

export const salesRevenueSchema = z.object({
  clientId: z.string().min(1),
  date: z.string().min(1),
  campaignName: z.string().max(191).optional(),
  adBudget: z.coerce.number().nonnegative().default(0)
}).superRefine((data, context) => {
  if (data.adBudget <= 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['adBudget'], message: 'أدخل ميزانية الإعلان' });
  }
  if (data.adBudget > 0 && !data.campaignName?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['campaignName'], message: 'اسم الحملة مطلوب لميزانية الإعلان' });
  }
});

export const clientPaymentSchema = z.object({
  amount: z.coerce.number().finite().positive().max(9999999999.99)
    .refine(amount => Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001, 'مبلغ الدفعة يجب ألا يتجاوز منزلتين عشريتين'),
  date: z.string().min(1),
  paymentMethod: z.enum(['إنستا باي', 'محفظة إلكترونية', 'نقدي', 'تحويل بنكي', 'بطاقة', 'أخرى'])
});

export const clientFollowUpSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'INACTIVE', 'POTENTIAL']),
  nextFollowUpAt: z.string().optional(),
  followUpNote: z.string().optional()
});
