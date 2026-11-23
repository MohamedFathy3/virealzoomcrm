import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const maxFileSize = 10 * 1024 * 1024;
const allowedTypes = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

type StoredAttachment = { id: string; name: string; mimeType: string; size: number };

function matchesFileSignature(type: string, bytes: Buffer) {
  if (type === 'application/pdf') return bytes.subarray(0, 5).toString() === '%PDF-';
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216;
  if (type === 'image/webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  return false;
}

export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const savedFiles: string[] = [];
  try {
    const user = await requireUser();
    const { taskId } = await params;
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { userId: true } },
        assignments: { include: { employee: { select: { userId: true } } } },
        department: { include: { manager: { select: { userId: true } } } }
      }
    });
    if (!task) return NextResponse.json({ error: 'المهمة غير موجودة' }, { status: 404 });
    const isAssigned = task.assignee?.userId === user.id || task.assignments.some(a => a.employee.userId === user.id);
    if (!isAssigned) return NextResponse.json({ error: 'يمكن تسليم المهام المسندة إليك فقط' }, { status: 403 });
    if (!['NEW', 'ASSIGNED', 'IN_PROGRESS', 'REVISION_REQUIRED'].includes(task.status)) {
      return NextResponse.json({ error: 'المهمة ليست في حالة تسمح بتسليم جديد' }, { status: 409 });
    }

    const form = await request.formData();
    const completionNotes = String(form.get('completionNotes') || '').trim();
    if (Buffer.byteLength(completionNotes, 'utf8') > 60000) return NextResponse.json({ error: 'نص التسليم طويل جدًا؛ أرفق السكربت كملف PDF' }, { status: 413 });
    const videoUrl = String(form.get('videoUrl') || '').trim();
    if (videoUrl) {
      try {
        const url = new URL(videoUrl);
        if (!['http:', 'https:'].includes(url.protocol)) return NextResponse.json({ error: 'استخدم رابط HTTPS أو HTTP صالح' }, { status: 400 });
      } catch { return NextResponse.json({ error: 'رابط التسليم غير صحيح' }, { status: 400 }); }
    }
    const files = form.getAll('files').filter((file): file is File => file instanceof File && file.size > 0);
    if (files.length > 5) return NextResponse.json({ error: 'الحد الأقصى 5 ملفات لكل تسليم' }, { status: 400 });
    if (files.some(file => !allowedTypes.has(file.type))) return NextResponse.json({ error: 'المسموح PDF أو PNG أو JPG أو WEBP فقط' }, { status: 415 });
    if (files.some(file => file.size > maxFileSize)) return NextResponse.json({ error: 'حجم الملف الواحد يجب ألا يتجاوز 10MB' }, { status: 413 });
    const graphicsDepartment = /graphic|design|جرافيك|تصميم/i.test(task.department.name);
    if (graphicsDepartment && files.some(file => !file.type.startsWith('image/'))) {
      return NextResponse.json({ error: 'قسم الجرافيك يرفع الصور فقط' }, { status: 415 });
    }
    if (!completionNotes && !videoUrl && !files.length) return NextResponse.json({ error: 'أضف ملاحظة أو رابطًا أو ملفًا قبل التسليم' }, { status: 400 });
    const actualHoursRaw = form.get('actualHours');
    const actualHours = actualHoursRaw ? Number(actualHoursRaw) : null;
    if (actualHours !== null && (!Number.isFinite(actualHours) || actualHours < 0)) {
      return NextResponse.json({ error: 'ساعات التنفيذ يجب أن تكون رقمًا موجبًا أو صفرًا' }, { status: 400 });
    }
    const fileUploads = await Promise.all(files.map(async file => ({ file, bytes: Buffer.from(await file.arrayBuffer()) })));
    if (fileUploads.some(upload => !matchesFileSignature(upload.file.type, upload.bytes))) {
      return NextResponse.json({ error: 'محتوى أحد الملفات لا يطابق نوعه' }, { status: 415 });
    }
    const totalSize = fileUploads.reduce((sum, upload) => sum + upload.file.size, 0);
    if (totalSize > 30 * 1024 * 1024) return NextResponse.json({ error: 'إجمالي ملفات التسليم لا يتجاوز 30MB' }, { status: 413 });

    const directory = path.join(process.env.UPLOADS_DIR || path.join(process.cwd(), 'storage', 'uploads'), 'tasks', task.id);
    await mkdir(directory, { recursive: true });
    const attachments: StoredAttachment[] = [];
    for (const { file, bytes } of fileUploads) {
      const id = randomUUID();
      const destination = path.join(directory, id);
      await writeFile(destination, bytes, { flag: 'wx' });
      savedFiles.push(destination);
      attachments.push({ id, name: path.basename(file.name).slice(0, 180), mimeType: file.type, size: file.size });
    }
    const payload = [...attachments, ...(videoUrl ? [{ id: randomUUID(), name: 'رابط الفيديو', mimeType: 'text/uri-list', size: 0, url: videoUrl }] : [])];
    const submission = await prisma.$transaction(async tx => {
      const latest = await tx.taskSubmission.aggregate({ where: { taskId }, _max: { version: true } });
      const created = await tx.taskSubmission.create({
        data: {
          taskId,
          version: (latest._max.version || 0) + 1,
          completionNotes: completionNotes || null,
          actualHours,
          submittedById: user.id,
          attachments: payload
        }
      });
      const updated = await tx.task.update({ where: { id: taskId }, data: { status: 'SUBMITTED', progress: 100 } });
      await tx.taskStatusHistory.create({ data: { taskId, from: task.status, to: updated.status, changedBy: user.id } });
      if (task.department.manager?.userId) {
        await tx.notification.create({
          data: { userId: task.department.manager.userId, title: 'تسليم مهمة للمراجعة', body: `تم تسليم المهمة: ${task.title}`, type: 'TASK_REVIEW' }
        });
      }
      return created;
    });
    return NextResponse.json({ ok: true, submission: { id: submission.id } });
  } catch (error) {
    await Promise.all(savedFiles.map(async file => {
      try {
        await unlink(file);
      } catch (cleanupError) {
        console.error('Unable to remove an uncommitted task upload', cleanupError);
      }
    }));
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    return NextResponse.json({ error: 'تعذر حفظ التسليم' }, { status: 500 });
  }
}
