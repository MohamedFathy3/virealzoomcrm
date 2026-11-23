import type { Role } from '@prisma/client';

export const canAccessFinance = (role: Role) => role === 'SUPER_ADMIN' || role === 'ADMIN';
export const canAccessAdvertising = (role: Role) => role === 'SUPER_ADMIN' || role === 'ADMIN';
export const canManageTeam = (role: Role) => role === 'SUPER_ADMIN' || role === 'ADMIN';
export const canCreateTask = (role: Role) => role !== 'EMPLOYEE';
export const canReviewTask = (role: Role) => role !== 'EMPLOYEE';
export const canViewReports = (role: Role) => role !== 'EMPLOYEE';
export const isAdmin = (role: Role) => role === 'SUPER_ADMIN' || role === 'ADMIN';
