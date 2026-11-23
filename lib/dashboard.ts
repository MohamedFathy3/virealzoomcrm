import { prisma } from './db';

export async function getDashboardData() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const soon = new Date(now.getTime() + 7 * 86400000);
  const [
    clientCount, activeClients, pausedClients, newClients,
    subscriptionExpiring, expiredSubscriptions,
    taskCount, inProgressTasks, reviewTasks, approvedTasks, overdueTasks,
    employeeCount, departmentCount,
    revenue, expenses, payroll, adFunds,
    recentTasks, recentTransactions, departments
  ] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({ where: { status: 'ACTIVE' } }),
    prisma.client.count({ where: { status: 'PAUSED' } }),
    prisma.client.count({ where: { registeredAt: { gte: monthStart } } }),
    prisma.subscription.count({ where: { expirationDate: { gte: now, lte: soon }, status: { not: 'CANCELLED' } } }),
    prisma.subscription.count({ where: { expirationDate: { lt: now }, status: { not: 'CANCELLED' } } }),
    prisma.task.count(),
    prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.task.count({ where: { status: 'APPROVED' } }),
    prisma.task.count({ where: { deadline: { lt: now }, status: { notIn: ['APPROVED', 'CANCELLED'] } } }),
    prisma.employee.count({ where: { employmentStatus: 'ACTIVE' } }),
    prisma.department.count({ where: { isActive: true } }),
    prisma.financeTransaction.aggregate({ where: { type: { in: ['SERVICE_REVENUE', 'ADDITIONAL_REVENUE'] } }, _sum: { amount: true } }),
    prisma.financeTransaction.aggregate({ where: { type: { in: ['OPERATING_EXPENSE', 'EMPLOYEE_SALARY', 'DIRECT_CLIENT_COST', 'MARKETING_EXPENSE', 'OTHER_EXPENSE'] } }, _sum: { amount: true } }),
    prisma.financeTransaction.aggregate({ where: { type: 'EMPLOYEE_SALARY', date: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.adWallet.aggregate({ _sum: { balance: true } }),
    prisma.task.findMany({ take: 5, orderBy: { updatedAt: 'desc' }, include: { department: true, client: true, assignee: true } }),
    prisma.financeTransaction.findMany({ take: 5, orderBy: { date: 'desc' }, include: { client: true } }),
    prisma.department.findMany({ where: { isActive: true }, include: { _count: { select: { employees: true, tasks: true } } }, orderBy: { name: 'asc' } })
  ]);
  const revenueValue = Number(revenue._sum.amount ?? 0);
  const expensesValue = Number(expenses._sum.amount ?? 0);
  return {
    financial: { revenue: revenueValue, expenses: expensesValue, profit: revenueValue - expensesValue, payroll: Number(payroll._sum.amount ?? 0), adFunds: Number(adFunds._sum.balance ?? 0) },
    clients: { total: clientCount, active: activeClients, paused: pausedClients, newThisMonth: newClients, expiring: subscriptionExpiring, expired: expiredSubscriptions },
    operations: { total: taskCount, inProgress: inProgressTasks, review: reviewTasks, approved: approvedTasks, overdue: overdueTasks },
    team: { employees: employeeCount, departments: departmentCount },
    recentTasks, recentTransactions, departments
  };
}

export async function getMonthlyFinance() {
  const rows = await prisma.financeTransaction.findMany({ orderBy: { date: 'asc' }, select: { amount: true, type: true, date: true } });
  const map = new Map<string, { month: string; revenue: number; expenses: number }>();
  rows.forEach(row => {
    const key = `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, '0')}`;
    const item = map.get(key) ?? { month: key, revenue: 0, expenses: 0 };
    if (row.type === 'SERVICE_REVENUE' || row.type === 'ADDITIONAL_REVENUE') item.revenue += Number(row.amount);
    else item.expenses += Number(row.amount);
    map.set(key, item);
  });
  return Array.from(map.values()).slice(-6);
}
