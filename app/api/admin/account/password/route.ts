import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

type Body = {
  currentPassword?: string;
  newPassword?: string;
};

// PATCH /api/admin/account/password — 본인 비밀번호 변경
// 현재 비밀번호를 bcrypt로 검증한 뒤에만 교체한다.
export async function PATCH(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { currentPassword, newPassword } = (await req.json()) as Body;
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: '새 비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
    }

    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/account/password PATCH]', err);
    return NextResponse.json({ error: '비밀번호 변경에 실패했습니다.' }, { status: 500 });
  }
}
