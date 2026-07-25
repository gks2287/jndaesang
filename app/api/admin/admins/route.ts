import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

// 관리자 계정 관리는 슈퍼관리자(대표님) 전용.
async function requireSuperAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) };
  if (admin.role !== 'super_admin') {
    return { error: NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 }) };
  }
  return { admin };
}

// GET /api/admin/admins — 관리자 목록 (최신순, 비밀번호 해시 제외)
export async function GET() {
  const gate = await requireSuperAdmin();
  if (gate.error) return gate.error;
  try {
    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    return NextResponse.json(admins);
  } catch (err) {
    console.error('[admin/admins GET]', err);
    return NextResponse.json({ error: '관리자 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

type CreateBody = {
  email?: string;
  name?: string;
  password?: string;
};

// POST /api/admin/admins — 관리자(manager) 생성. 역할은 항상 'manager'로 고정.
export async function POST(req: NextRequest) {
  const gate = await requireSuperAdmin();
  if (gate.error) return gate.error;
  try {
    const { email, name, password } = (await req.json()) as CreateBody;
    const id = email?.trim();
    if (!id || !password) {
      return NextResponse.json({ error: '아이디와 초기 비밀번호는 필수입니다.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: '초기 비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
    }

    const exists = await prisma.adminUser.findUnique({ where: { email: id } });
    if (exists) {
      return NextResponse.json({ error: '이미 존재하는 아이디입니다.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const created = await prisma.adminUser.create({
      data: { email: id, name: name?.trim() || '', passwordHash, role: 'manager' },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[admin/admins POST]', err);
    return NextResponse.json({ error: '관리자 생성에 실패했습니다.' }, { status: 500 });
  }
}
