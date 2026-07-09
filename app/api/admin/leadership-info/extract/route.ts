import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/api/claude';
import { safeParseJson } from '@/lib/repairJson';
import { extractFileText, getExtension, SUPPORTED_EXTENSIONS } from '@/lib/parseFile';

const MAX_BYTES = 50 * 1024 * 1024; // 폼과 동일 50MB
const MAX_CHARS = 12000;

type LeadershipInfo = { type: string; definition?: string; characteristics: string; developmentPoints?: string };

const SYSTEM_PROMPT = `당신은 조직 리더십 다면진단 보고서 분석가입니다.
보고서에서 '이 기업에 존재하는 리더십 유형'과 각 유형의 특징·개발 포인트를 구조화해 추출합니다.
문서에 실제로 서술된 내용만 사용하고, 없는 내용은 절대 지어내지 마세요.
가장 중요한 규칙: 유형 이름은 문서에 적힌 워딩을 절대 바꾸지 말고 그대로 사용하세요. 표준 유형으로 변환·정규화·매핑하지 마세요.`;

function buildPrompt(text: string): string {
  return `아래 다면진단 보고서에서 리더십 유형 정보를 추출하세요.

[추출 규칙]
- type: 문서에 적힌 리더십 유형 이름을 "있는 그대로" 사용하세요. 표준화/정규화/매핑 금지. 문서에 "○○형", "○○ 리더", "○○ 스타일" 등으로 적혀 있으면 그 표기를 그대로 씁니다. 임의로 다른 이름으로 바꾸지 마세요.
- 문서에 실제로 등장하는 유형만 포함하세요. 문서에 없는 유형은 절대 넣지 마세요.
- characteristics: 그 유형의 특징 설명을 문서 기준으로 1~3문장 요약 (없으면 문서 내 관련 서술을 간결히).
- developmentPoints: 그 유형의 개발 포인트/코칭 방향이 문서에 있으면 1~2문장으로, 없으면 빈 문자열("").
- definition: 그 유형의 정의가 문서에 있으면 1문장으로, 없으면 빈 문자열("").
- 수치·창작·추정 금지. 문서에 근거 없는 내용은 쓰지 마세요.

[문서 내용]
${text.slice(0, MAX_CHARS)}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 금지 (type은 예시일 뿐, 반드시 문서의 실제 유형명을 사용):
{"info":[{"type":"문서에 적힌 유형명 그대로","definition":"...","characteristics":"...","developmentPoints":"..."}]}`;
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

    // 문서에 적힌 유형명을 그대로 유지 (표준 유형 매핑/필터 없음) — 유형명과 내용이 있으면 통과
    const info = (parsed.info ?? [])
      .filter(i => i && i.type?.trim() && (i.characteristics?.trim() || i.developmentPoints?.trim() || i.definition?.trim()))
      .map(i => ({
        type: i.type.trim(),
        definition: (i.definition ?? '').trim(),
        characteristics: (i.characteristics ?? '').trim(),
        developmentPoints: (i.developmentPoints ?? '').trim(),
      }));

    // rawText: 추출된 원본 전체 텍스트 — 저장 후 뉴스레터 생성 시 근거 자료로 사용
    return NextResponse.json({ info, fileName: file.name, rawText: text });
  } catch (err) {
    console.error('[admin/leadership-info/extract]', err);
    return NextResponse.json({ error: '보고서 분석 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
