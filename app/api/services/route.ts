import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { serviceSchema } from '@/lib/validators';

export async function POST(request: Request) {
  try {
    const user = await requireUser(['SUPER_ADMIN', 'ADMIN']);
    const parsed = serviceSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'راجع اسم الخدمة ومدتها' }, { status: 400 });

    const category = parsed.data.category?.trim() || null;
    const duplicate = await prisma.service.findFirst({
      where: { name: parsed.data.name, category },
      select: { id: true }
    });
    if (duplicate) return NextResponse.json({ error: 'توجد خدمة بنفس الاسم والتصنيف بالفعل' }, { status: 409 });

    const service = await prisma.service.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        category,
        defaultPrice: parsed.data.defaultPrice ?? 0,
        durationDays: parsed.data.durationDays
      }
    });
    return NextResponse.json({ ok: true, service });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'توجد خدمة بنفس الاسم والتصنيف بالفعل' }, { status: 409 });
    }
    return NextResponse.json({ error: 'تعذر إنشاء الخدمة' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireUser(['SUPER_ADMIN', 'ADMIN']);
    const body = await request.json() as { id?: string };
    if (!body.id) return NextResponse.json({ error: 'معرف الخدمة مطلوب' }, { status: 400 });
    const parsed = serviceSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'راجع بيانات الخدمة ومدتها' }, { status: 400 });

    const current = await prisma.service.findUnique({ where: { id: body.id }, select: { id: true, defaultPrice: true } });
    if (!current) return NextResponse.json({ error: 'الخدمة غير موجودة' }, { status: 404 });
    const category = parsed.data.category?.trim() || null;
    const duplicate = await prisma.service.findFirst({
      where: { name: parsed.data.name, category, id: { not: body.id } },
      select: { id: true }
    });
    if (duplicate) return NextResponse.json({ error: 'توجد خدمة بنفس الاسم والتصنيف بالفعل' }, { status: 409 });

    const service = await prisma.service.update({
      where: { id: body.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        category,
        defaultPrice: parsed.data.defaultPrice ?? Number(current.defaultPrice),
        durationDays: parsed.data.durationDays
      }
    });
    return NextResponse.json({ ok: true, service });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'توجد خدمة بنفس الاسم والتصنيف بالفعل' }, { status: 409 });
    }
    return NextResponse.json({ error: 'تعذر تحديث الخدمة' }, { status: 500 });
  }
}
