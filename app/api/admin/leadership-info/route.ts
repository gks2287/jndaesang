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

// 버전 행 → 히스토리 항목 (rawText는 화면에 내려주지 않음)
function toHistory(v: { id: number; fileName: string; uploadedAt: string; info: Prisma.JsonValue }) {
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
      omit: { rawText: true },
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
    const { companyId, year, info, fileName, rawText, copyRawTextFromVersionId } = (await req.json()) as {
      companyId: number; year: number; info: LeadershipInfo[]; fileName?: string;
      rawText?: string; // 업로드 파일에서 추출한 원본 전체 텍스트
      copyRawTextFromVersionId?: number; // 히스토리 복원 시 해당 버전의 원문을 이어받음
    };
    if (!Number.isInteger(companyId) || !Number.isInteger(year) || !Array.isArray(info)) {
      return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
    }
    // 복원이면 원본 버전의 rawText를 복사 (직접 입력 등 rawText가 없는 경로는 빈 문자열)
    let resolvedRawText = typeof rawText === 'string' ? rawText : '';
    if (!resolvedRawText && Number.isInteger(copyRawTextFromVersionId)) {
      const source = await prisma.leadershipInfoVersion.findFirst({
        where: { id: copyRawTextFromVersionId, companyId },
      });
      resolvedRawText = source?.rawText ?? '';
    }
    await prisma.leadershipInfoVersion.create({
      data: {
        companyId,
        year,
        fileName: fileName ?? '직접 입력',
        uploadedAt: nowLabel(),
        info: info as unknown as Prisma.InputJsonValue,
        rawText: resolvedRawText,
      },
    });
    const versions = await prisma.leadershipInfoVersion.findMany({
      where: { companyId, year },
      orderBy: { createdAt: 'desc' },
      omit: { rawText: true },
    });
    const current = (versions[0].info ?? []) as LeadershipInfo[];
    return NextResponse.json({ current, history: versions.map(toHistory) }, { status: 201 });
  } catch (err) {
    console.error('[admin/leadership-info POST]', err);
    return NextResponse.json({ error: '리더십 정보 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
