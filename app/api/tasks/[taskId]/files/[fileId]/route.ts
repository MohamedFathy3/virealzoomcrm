import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canViewSalesClientTask, getEmployeeDepartment } from '@/lib/team-access';

export const runtime = 'nodejs';

function isStoredAttachment(value: unknown): value is { id: string; name: string; mimeType: string } {
  if (!value || typeof value !== 'object') return false;
  const attachment = value as Record<string, unknown>;
  return typeof attachment.id === 'string' && typeof attachment.name === 'string' &&
    typeof attachment.mimeType === 'string' && attachment.mimeType !== 'text/uri-list';
}

export async function GET(_request: Request, { params }: { params: Promise<{ taskId: string; fileId: string }> }) {
  try {
    const user = await requireUser();
    const { taskId, fileId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { userId: true } },
        assignments: { include: { employee: { select: { userId: true } } } },
        department: { include: { manager: { select: { userId: true } } } },
        client: { select: { createdById: true } },
        submissions: { select: { attachments: true } }
      }
    });
    if (!task) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
    const assigned = task.assignee?.userId === user.id || task.assignments.some(a => a.employee.userId === user.id);
    const canReview = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' ||
      (user.role === 'DEPARTMENT_MANAGER' && task.department.manager?.userId === user.id);
    const employee = user.role === 'EMPLOYEE' || user.role === 'DEPARTMENT_MANAGER' ? await getEmployeeDepartment(user.id) : null;
    const canViewClientTask = canViewSalesClientTask(user.role, user.id, employee, task.client?.createdById ?? null);
    if (!assigned && !canReview && !canViewClientTask) return NextResponse.json({ error: 'غير مصرح بفتح الملف' }, { status: 403 });
    const attachment = task.submissions.flatMap(submission => Array.isArray(submission.attachments) ? submission.attachments : [])
      .find(item => isStoredAttachment(item) && item.id === fileId);
    if (!isStoredAttachment(attachment)) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });

    const root = process.env.UPLOADS_DIR || path.join(process.cwd(), 'storage', 'uploads');
    const filePath = path.join(root, 'tasks', taskId, fileId);
    const file = await readFile(filePath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'content-type': attachment.mimeType,
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر قراءة الملف' }, { status: 500 });
  }
}
