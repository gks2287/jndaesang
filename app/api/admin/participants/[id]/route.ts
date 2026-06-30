import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type UpdateBody = Partial<{
  companyId: number;
  year: number;
  name: string;
  department: string;
  position: string;
  email: string;
  leadershipType: string;
  assessmentRound: number;
  deliveryStatus: string;
  lastOpenedAt: string | null;
  stepCurrent: number;
  stepTotal: number;
  token: string | null;
}>;

// PATCH /api/admin/participants/[id] — 직책자 수정
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: '잘못된 직책자 ID입니다.' }, { status: 400 });
    }
    const data = (await req.json()) as UpdateBody;
    const updated = await prisma.participant.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[admin/participants PATCH]', err);
    return NextResponse.json({ error: '직책자 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/admin/participants/[id] — 직책자 삭제
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: '잘못된 직책자 ID입니다.' }, { status: 400 });
    }
    await prisma.participant.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/participants DELETE]', err);
    return NextResponse.json({ error: '직책자 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
