import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';

export async function getEmployeeDepartment(userId: string) {
  return prisma.employee.findUnique({
    where: { userId },
    select: {
      id: true,
      departmentId: true,
      department: { select: { name: true } },
      managedDepartment: { select: { id: true } }
    }
  });
}

export async function getManagedDepartmentId(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { managedDepartment: { select: { id: true } } }
  });
  return employee?.managedDepartment?.id ?? null;
}

export function isSalesDepartment(name: string) {
  const normalized = name.toLowerCase();
  return normalized.includes('sales') || normalized.includes('مبيعات');
}

export function canViewSalesClientTask(role: Role, userId: string, employee: Awaited<ReturnType<typeof getEmployeeDepartment>>, clientCreatedById: string | null) {
  if (!employee || !clientCreatedById || !isSalesDepartment(employee.department.name)) return false;
  if (role === 'EMPLOYEE') return clientCreatedById === userId;
  return role === 'DEPARTMENT_MANAGER' && employee.managedDepartment?.id === employee.departmentId;
}

export function canSeeAllClients(role: Role) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'DEPARTMENT_MANAGER';
}
