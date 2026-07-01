import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/api/claude';
import { safeParseJson } from '@/lib/repairJson';
import { extractFileText, getExtension, SUPPORTED_EXTENSIONS } from '@/lib/parseFile';

const MAX_BYTES = 50 * 1024 * 1024; // 폼과 동일 50MB
const MAX_CHARS = 12000;

// 13개 표준 리더십 유형 (participantStore와 일치)
const VALID_TYPES = [
  '코칭형', '민주형', '서번트형', '비전형', '관계중심형',
  '독재형', '방관형', '불통형', '불명확형', '성과압박형', '감정기복형', '완벽주의형', '우유부단형',
] as const;

type LeadershipInfo = { type: string; definition?: string; characteristics: string; developmentPoints?: string };

const SYSTEM_PROMPT = `당신은 조직 리더십 다면진단 보고서 분석가입니다.
보고서에서 '이 기업에 존재하는 리더십 유형'과 각 유형의 특징·개발 포인트를 구조화해 추출합니다.
문서에 실제로 서술된 내용만 사용하고, 없는 내용은 절대 지어내지 마세요.`;

function buildPrompt(text: string): string {
  return `아래 다면진단 보고서에서 리더십 유형 정보를 추출하세요.

[표준 유형 13종 — 반드시 이 중 가장 가까운 값으로 매핑]
${VALID_TYPES.join(', ')}

[추출 규칙]
- 문서에 실제로 등장하는(또는 명확히 매핑되는) 유형만 포함하세요. 문서에 없는 유형은 넣지 마세요.
- type: 위 13종 중 하나로 정규화 (문서의 유형명이 조금 달라도 의미가 같으면 표준값으로).
- characteristics: 그 유형의 특징 설명을 문서 기준으로 1~3문장 요약 (없으면 문서 내 관련 서술을 간결히).
- developmentPoints: 그 유형의 개발 포인트/코칭 방향이 문서에 있으면 1~2문장으로, 없으면 빈 문자열("").
- 수치·창작·추정 금지. 문서에 근거 없는 내용은 쓰지 마세요.

[문서 내용]
${text.slice(0, MAX_CHARS)}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 금지:
{"info":[{"type":"독재형","characteristics":"...","developmentPoints":"..."}]}`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: '파일이 너무 큽니다.' }, { status: 413 });
    }
    if (!SUPPORTED_EXTENSIONS.includes(getExtension(file.name) as typeof SUPPORTED_EXTENSIONS[number])) {
      return NextResponse.json({ error: '지원하지 않는 형식입니다. (pdf / docx / txt / xlsx / csv)' }, { status: 415 });
    }

    const text = await extractFileText(file);
    if (!text.trim()) {
      return NextResponse.json({ error: '문서에서 텍스트를 추출하지 못했습니다.' }, { status: 422 });
    }

    const raw = await callClaude(buildPrompt(text), SYSTEM_PROMPT);
    const parsed = safeParseJson<{ info: LeadershipInfo[] }>(raw);

    // 표준 유형만 통과 + 정리
    const validSet = new Set<string>(VALID_TYPES);
    const info = (parsed.info ?? [])
      .filter(i => i && validSet.has(i.type) && (i.characteristics?.trim() || i.developmentPoints?.trim()))
      .map(i => ({
        type: i.type,
        characteristics: (i.characteristics ?? '').trim(),
        developmentPoints: (i.developmentPoints ?? '').trim(),
      }));

    return NextResponse.json({ info, fileName: file.name });
  } catch (err) {
    console.error('[admin/leadership-info/extract]', err);
    return NextResponse.json({ error: '보고서 분석 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
