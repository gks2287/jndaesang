import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

type LeadershipInfo = {
  type: string;
  definition?: string;
  characteristics: string;
  developmentPoints?: string;
};

function nowLabel(): string {
  return new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// 버전 행 → 히스토리 항목
function toHistory(v: Prisma.LeadershipInfoVersionGetPayload<object>) {
  return { id: v.id, fileName: v.fileName, uploadedAt: v.uploadedAt, info: (v.info ?? []) as LeadershipInfo[] };
}

// GET /api/admin/leadership-info?companyId=&year= — 현재(최신) + 히스토리
export async function GET(req: NextRequest) {
  try {
    const companyId = Number(req.nextUrl.searchParams.get('companyId'));
    const year = Number(req.nextUrl.searchParams.get('year'));
    if (!Number.isInteger(companyId) || !Number.isInteger(year)) {
      return NextResponse.json({ error: 'companyId·year가 필요합니다.' }, { status: 400 });
    }
    const versions = await prisma.leadershipInfoVersion.findMany({
      where: { companyId, year },
      orderBy: { createdAt: 'desc' },
    });
    const current = versions.length > 0 ? ((versions[0].info ?? []) as LeadershipInfo[]) : [];
    return NextResponse.json({ current, history: versions.map(toHistory) });
  } catch (err) {
    console.error('[admin/leadership-info GET]', err);
    return NextResponse.json({ error: '리더십 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

// POST /api/admin/leadership-info — 새 버전 저장 후 최신 current + 히스토리 반환
export async function POST(req: NextRequest) {
  try {
    const { companyId, year, info, fileName } = (await req.json()) as {
      companyId: number; year: number; info: LeadershipInfo[]; fileName?: string;
    };
    if (!Number.isInteger(companyId) || !Number.isInteger(year) || !Array.isArray(info)) {
      return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
    }
    await prisma.leadershipInfoVersion.create({
      data: {
        companyId,
        year,
        fileName: fileName ?? '직접 입력',
        uploadedAt: nowLabel(),
        info: info as unknown as Prisma.InputJsonValue,
      },
    });
    const versions = await prisma.leadershipInfoVersion.findMany({
      where: { companyId, year },
      orderBy: { createdAt: 'desc' },
    });
    const current = (versions[0].info ?? []) as LeadershipInfo[];
    return NextResponse.json({ current, history: versions.map(toHistory) }, { status: 201 });
  } catch (err) {
    console.error('[admin/leadership-info POST]', err);
    return NextResponse.json({ error: '리더십 정보 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
