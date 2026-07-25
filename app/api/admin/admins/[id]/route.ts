import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

// DELETE /api/admin/admins/[id] — 관리자 삭제 (슈퍼관리자 전용)
// 안전장치: 본인 계정과 슈퍼관리자 계정은 삭제할 수 없다.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await getCurrentAdmin();
    if (!me) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    if (me.role !== 'super_admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const id = Number(params.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const target = await prisma.adminUser.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: '존재하지 않는 계정입니다.' }, { status: 404 });
    }
    if (target.id === me.id) {
      return NextResponse.json({ error: '본인 계정은 삭제할 수 없습니다.' }, { status: 400 });
    }
    if (target.role === 'super_admin') {
      return NextResponse.json({ error: '슈퍼관리자 계정은 삭제할 수 없습니다.' }, { status: 400 });
    }

    await prisma.adminUser.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/admins/[id] DELETE]', err);
    return NextResponse.json({ error: '관리자 삭제에 실패했습니다.' }, { status: 500 });
  }
}
