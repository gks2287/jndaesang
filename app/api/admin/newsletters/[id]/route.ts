import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

function serialize(n: Prisma.NewsletterGetPayload<object>) {
  return {
    ...n,
    createdAt: n.createdAt.toISOString().slice(0, 10),
    updatedAt: n.updatedAt.toISOString().slice(0, 10),
  };
}

// 부분 수정 — id/createdAt/updatedAt 제외 필드. Json/배열 필드 포함.
type UpdateBody = Partial<{
  title: string;
  companyName: string;
  leadershipType: string;
  status: string;
  stepCount: number;
  positiveLeaders: unknown;
  negativeLeaders: unknown;
  totalRounds: number;
  completedRounds: number;
  type: string;
  leaderType: string;
  totalLeaders: number;
  savedRounds: number[];
  generatedContent: unknown;
  authoring: unknown;
}>;

// PATCH /api/admin/newsletters/[id] — 수정 (savedRounds 토글/제작완료 저장 등)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: '잘못된 뉴스레터 ID입니다.' }, { status: 400 });
    }
    const b = (await req.json()) as UpdateBody;
    const data: Prisma.NewsletterUpdateInput = {};
    if (b.title !== undefined) data.title = b.title;
    if (b.companyName !== undefined) data.companyName = b.companyName;
    if (b.leadershipType !== undefined) data.leadershipType = b.leadershipType;
    if (b.status !== undefined) data.status = b.status;
    if (b.stepCount !== undefined) data.stepCount = b.stepCount;
    if (b.positiveLeaders !== undefined) data.positiveLeaders = b.positiveLeaders as Prisma.InputJsonValue;
    if (b.negativeLeaders !== undefined) data.negativeLeaders = b.negativeLeaders as Prisma.InputJsonValue;
    if (b.totalRounds !== undefined) data.totalRounds = b.totalRounds;
    if (b.completedRounds !== undefined) data.completedRounds = b.completedRounds;
    if (b.type !== undefined) data.type = b.type;
    if (b.leaderType !== undefined) data.leaderType = b.leaderType;
    if (b.totalLeaders !== undefined) data.totalLeaders = b.totalLeaders;
    if (b.savedRounds !== undefined) data.savedRounds = b.savedRounds;
    if (b.generatedContent !== undefined) {
      data.generatedContent = (b.generatedContent ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    }
    if (b.authoring !== undefined) {
      data.authoring = (b.authoring ?? Prisma.JsonNull) as Prisma.InputJsonValue;
    }
    const updated = await prisma.newsletter.update({ where: { id }, data });
    return NextResponse.json(serialize(updated));
  } catch (err) {
    console.error('[admin/newsletters PATCH]', err);
    return NextResponse.json({ error: '뉴스레터 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/admin/newsletters/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: '잘못된 뉴스레터 ID입니다.' }, { status: 400 });
    }
    await prisma.newsletter.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/newsletters DELETE]', err);
    return NextResponse.json({ error: '뉴스레터 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
