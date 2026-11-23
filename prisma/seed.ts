import { PrismaClient, Prisma } from '@prisma/client';
import { loadEnvConfig } from '@next/env';
import { randomBytes, scryptSync } from 'node:crypto';

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const d = (value: string | number) => new Prisma.Decimal(value);
const daysFromNow = (days: number) => new Date(Date.now() + days * 86400000);

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

async function main() {
  const adminEmail = (process.env.AUTH_ADMIN_EMAIL || 'admin@viralzoom.local').trim().toLowerCase();
  const adminPassword = process.env.AUTH_ADMIN_PASSWORD || 'ChangeMe123!';
  const admin = await prisma.user.upsert({ where: { email: adminEmail }, update: { passwordHash: hashPassword(adminPassword) }, create: { openId: 'seed-admin', email: adminEmail, name: 'مدير Viral Zoom', role: 'SUPER_ADMIN', passwordHash: hashPassword(adminPassword) } });
  const managerUser = await prisma.user.upsert({ where: { openId: 'seed-manager' }, update: { passwordHash: hashPassword('Manager123!') }, create: { openId: 'seed-manager', email: 'manager@viralzoom.local', name: 'مدير المحتوى', role: 'DEPARTMENT_MANAGER', passwordHash: hashPassword('Manager123!') } });
  const departments = await Promise.all([
    ['صناعة المحتوى', 'المحتوى والخطط التحريرية'], ['شراء الإعلانات', 'التخطيط والتنفيذ الإعلامي'], ['المبيعات', 'إدارة الفرص والعلاقات'], ['المونتاج', 'تحرير الفيديو والريلز'], ['التصميم', 'التصميم والهوية البصرية']
  ].map(async ([name, description]) => prisma.department.upsert({ where: { name }, update: { description }, create: { name, description } })));
  const contentDept = departments[0];
  const manager = await prisma.employee.upsert({ where: { email: 'manager@viralzoom.local' }, update: { departmentId: contentDept.id, userId: managerUser.id }, create: { employeeCode: 'EMP-001', fullName: 'مدير المحتوى', email: 'manager@viralzoom.local', jobTitle: 'Department Manager', monthlySalary: d(18000), departmentId: contentDept.id, userId: managerUser.id } });
  await prisma.department.update({ where: { id: contentDept.id }, data: { managerId: manager.id } });
  const employee = await prisma.employee.upsert({ where: { email: 'designer@viralzoom.local' }, update: {}, create: { employeeCode: 'EMP-002', fullName: 'سارة محمود', email: 'designer@viralzoom.local', jobTitle: 'Graphic Designer', monthlySalary: d(12000), departmentId: departments[4].id } });
  const editor = await prisma.employee.upsert({ where: { email: 'editor@viralzoom.local' }, update: {}, create: { employeeCode: 'EMP-003', fullName: 'عمر حسن', email: 'editor@viralzoom.local', jobTitle: 'Video Editor', monthlySalary: d(14000), departmentId: departments[3].id } });
  const clients = await Promise.all([
    prisma.client.upsert({ where: { clientCode: 'CL-ALPHA' }, update: {}, create: { clientCode: 'CL-ALPHA', name: 'أحمد رجب', companyName: 'Alpha Fitness', phone: '01001234567', email: 'hello@alphafitness.eg', businessActivity: 'نادي رياضي', source: 'إحالة', status: 'ACTIVE', createdById: admin.id } }),
    prisma.client.upsert({ where: { clientCode: 'CL-NOVA' }, update: {}, create: { clientCode: 'CL-NOVA', name: 'نورهان علي', companyName: 'Nova Home', phone: '01009876543', email: 'marketing@novahome.eg', businessActivity: 'أثاث منزلي', source: 'إعلان', status: 'ACTIVE', createdById: admin.id } }),
    prisma.client.upsert({ where: { clientCode: 'CL-MINT' }, update: {}, create: { clientCode: 'CL-MINT', name: 'محمود سالم', companyName: 'Mint Dental', phone: '01112345678', businessActivity: 'عيادات أسنان', source: 'موقع إلكتروني', status: 'POTENTIAL', createdById: admin.id } })
  ]);
  const services = await Promise.all([
    ['إدارة سوشيال ميديا', 'إدارة المحتوى والتفاعل الشهري', 15000, 'Retainer'], ['إنتاج فيديو قصير', 'تصوير ومونتاج ريلز وحملات', 8500, 'Production'], ['شراء إعلانات', 'إدارة الحملات وتحسين الأداء', 12000, 'Media Buying'], ['هوية بصرية', 'نظام بصري وعناصر العلامة', 22000, 'Branding']
  ].map(([name, description, price, category]) => prisma.service.upsert({ where: { name_category: { name: String(name), category: String(category) } }, update: {}, create: { name: String(name), description: String(description), defaultPrice: d(Number(price)), category: String(category) } })));
  const sub = await prisma.subscription.upsert({ where: { id: 'seed-sub-alpha' }, update: {}, create: { id: 'seed-sub-alpha', clientId: clients[0].id, serviceId: services[0].id, contractValue: d(15000), startDate: daysFromNow(-18), durationDays: 30, expirationDate: daysFromNow(12), amountPaid: d(10000), outstanding: d(5000), paymentTerms: '50% مقدم / 50% عند التسليم', status: 'ACTIVE' } });
  await prisma.subscription.upsert({ where: { id: 'seed-sub-nova' }, update: {}, create: { id: 'seed-sub-nova', clientId: clients[1].id, serviceId: services[2].id, contractValue: d(12000), startDate: daysFromNow(-27), durationDays: 30, expirationDate: daysFromNow(3), amountPaid: d(12000), outstanding: d(0), paymentTerms: 'شهري', status: 'EXPIRING' } });
  await prisma.financeTransaction.upsert({ where: { transactionNo: 'FIN-SEED-001' }, update: {}, create: { transactionNo: 'FIN-SEED-001', type: 'SERVICE_REVENUE', amount: d(10000), date: daysFromNow(-12), paymentMethod: 'تحويل بنكي', category: 'اشتراك', clientId: clients[0].id, description: 'دفعة اشتراك إدارة السوشيال', createdById: admin.id } });
  await prisma.financeTransaction.upsert({ where: { transactionNo: 'FIN-SEED-002' }, update: {}, create: { transactionNo: 'FIN-SEED-002', type: 'OPERATING_EXPENSE', amount: d(3200), date: daysFromNow(-8), paymentMethod: 'بطاقة', category: 'أدوات تشغيل', description: 'اشتراكات أدوات الإنتاج', createdById: admin.id } });
  const wallet = await prisma.adWallet.upsert({ where: { id: 'seed-wallet-alpha' }, update: { balance: d(2500), totalReceived: d(10000), totalSpent: d(7500) }, create: { id: 'seed-wallet-alpha', clientId: clients[0].id, name: 'محفظة حملة الشتاء', totalReceived: d(10000), totalSpent: d(7500), balance: d(2500) } });
  await prisma.adTransaction.upsert({ where: { id: 'seed-ad-received' }, update: {}, create: { id: 'seed-ad-received', walletId: wallet.id, type: 'FUNDS_RECEIVED', amount: d(10000), description: 'إيداع ميزانية إعلان' } });
  await prisma.adTransaction.upsert({ where: { id: 'seed-ad-spent' }, update: {}, create: { id: 'seed-ad-spent', walletId: wallet.id, type: 'CAMPAIGN_SPENDING', amount: d(7500), description: 'إنفاق حملة الشتاء' } });
  const task = await prisma.task.upsert({ where: { taskNo: 'TSK-SEED-001' }, update: {}, create: { taskNo: 'TSK-SEED-001', title: 'خطة محتوى ديسمبر', description: 'إعداد خطة محتوى شهرية مع أفكار المنشورات ومحاور الريلز.', clientId: clients[0].id, serviceId: services[0].id, departmentId: contentDept.id, assigneeId: employee.id, priority: 'HIGH', status: 'IN_PROGRESS', deadline: daysFromNow(5), estimatedHours: d(12), productivityPoints: 6, progress: 65, createdById: admin.id } });
  await prisma.taskAssignment.upsert({ where: { taskId_employeeId: { taskId: task.id, employeeId: employee.id } }, update: {}, create: { taskId: task.id, employeeId: employee.id } });
  await prisma.taskStatusHistory.create({ data: { taskId: task.id, to: 'IN_PROGRESS', changedBy: admin.id, reason: 'بداية العمل' } }).catch(() => undefined);
  await prisma.task.upsert({ where: { taskNo: 'TSK-SEED-002' }, update: {}, create: { taskNo: 'TSK-SEED-002', title: 'مراجعة إعلانات Nova Home', description: 'تحليل أداء الحملات وتوصية التوزيع القادم.', clientId: clients[1].id, serviceId: services[2].id, departmentId: departments[1].id, assigneeId: editor.id, priority: 'MEDIUM', status: 'UNDER_REVIEW', deadline: daysFromNow(1), estimatedHours: d(5), productivityPoints: 4, progress: 100, createdById: admin.id } });
  await prisma.notification.createMany({ data: [{ userId: admin.id, title: 'اشتراك يقترب من الانتهاء', body: `اشتراك ${clients[1].name} ينتهي خلال 3 أيام.`, type: 'SUBSCRIPTION_EXPIRING' }, { userId: admin.id, title: 'مهمة في انتظار المراجعة', body: 'مراجعة إعلانات Nova Home جاهزة.', type: 'TASK_REVIEW' }] }).catch(() => undefined);
  console.log('Seed complete', { admin: admin.email, subscription: sub.id, wallet: wallet.balance.toString() });
}

main().catch(error => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());
