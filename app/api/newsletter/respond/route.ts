import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

const KINDS = ['quiz', 'scenario', 'selfcheck', 'survey-always', 'survey-periodic'] as const;
type ResponseKind = typeof KINDS[number];

// 직책자 token → 참여자 해석 (by-token 라우트와 동일한 규칙: nl-<id> 폴백은 token 미설정자만)
async function resolveParticipant(token: string) {
  let participant = await prisma.participant.findFirst({ where: { token } });
  if (!participant && token.startsWith('nl-')) {
    const id = Number(token.slice(3));
    if (Number.isInteger(id)) {
      const byId = await prisma.participant.findUnique({ where: { id } });
      if (byId && !byId.token) participant = byId;
    }
  }
  return participant;
}

// POST /api/newsletter/respond — 직책자 응답 저장 (같은 요소 재응답 시 최신으로 갱신)
export async function POST(req: NextRequest) {
  try {
    const { token, kind, elementKey, response, newsletterId, roundIndex } = (await req.json()) as {
      token?: string;
      kind?: ResponseKind;
      elementKey?: string;
      response?: unknown;
      newsletterId?: number;
      roundIndex?: number;
    };

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: '유효하지 않은 요청입니다.' }, { status: 400 });
    }
    if (!kind || !KINDS.includes(kind) || !elementKey?.trim() || response == null || typeof response !== 'object') {
      return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 });
    }

    const participant = await resolveParticipant(token);
    if (!participant) {
      return NextResponse.json({ error: '유효하지 않은 링크입니다.' }, { status: 404 });
    }

    const key = {
      participantId: participant.id,
      newsletterId: Number.isInteger(newsletterId) ? (newsletterId as number) : 0,
      roundIndex: Number.isInteger(roundIndex) ? (roundIndex as number) : 0,
      kind,
      elementKey: elementKey.trim().slice(0, 200),
    };
    await prisma.participantResponse.upsert({
      where: { participantId_newsletterId_roundIndex_kind_elementKey: key },
      create: { ...key, response: response as Prisma.InputJsonValue },
      update: { response: response as Prisma.InputJsonValue },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[newsletter/respond]', err);
    return NextResponse.json({ error: '응답 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
