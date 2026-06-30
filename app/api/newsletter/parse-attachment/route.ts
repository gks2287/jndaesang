import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/api/claude';
import { extractFileText, getExtension, SUPPORTED_EXTENSIONS } from '@/lib/parseFile';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_EXTRACTED_CHARS = 4000;   // 본문 프롬프트에 주입할 추출 텍스트 상한

const SYSTEM_PROMPT = `당신은 조직 진단·리더십 데이터 분석가입니다.
주어진 문서(보고서/엑셀 표 등)에서 뉴스레터 본문에 인용할 수 있는 '사실 데이터'만 간결하게 추출합니다.
반드시 문서에 실제로 존재하는 값만 사용하고, 없는 수치는 절대 지어내지 마세요.`;

function buildUserPrompt(text: string): string {
  const truncated = text.slice(0, 8000);
  return `아래 문서에서 뉴스레터에 인용할 핵심 데이터를 추출하세요.

[추출 규칙]
- 수치·비율·분포·순위·표의 값을 그대로 보존하세요 (예: "독재형 38%, 불통형 22%").
- 문서에 명시된 값만 쓰고, 추정·창작·반올림 보정을 하지 마세요. 없으면 적지 마세요.
- 불릿(-) 목록으로 간결하게. 해석·조언·서술형 문장은 넣지 말고 사실만.
- 설명 문구나 머리말 없이, 추출 결과 불릿만 출력하세요.

[문서 내용]
${truncated}`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: '파일이 10MB를 초과했습니다.' }, { status: 413 });
    }
    if (!SUPPORTED_EXTENSIONS.includes(getExtension(file.name) as typeof SUPPORTED_EXTENSIONS[number])) {
      return NextResponse.json({ error: '지원하지 않는 형식입니다. (pdf / docx / txt / xlsx / csv)' }, { status: 415 });
    }

    // 텍스트 추출
    let text: string;
    try {
      text = await extractFileText(file);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '파일을 읽을 수 없습니다.';
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    if (!text.trim()) {
      return NextResponse.json({ error: '파일에서 텍스트를 추출할 수 없습니다.' }, { status: 422 });
    }

    // Claude로 핵심 데이터 추출
    const raw = await callClaude(buildUserPrompt(text), SYSTEM_PROMPT);
    const extractedText = raw.replace(/```/g, '').trim().slice(0, MAX_EXTRACTED_CHARS);

    if (!extractedText) {
      return NextResponse.json({ error: '핵심 데이터를 추출하지 못했습니다.' }, { status: 422 });
    }

    return NextResponse.json({ extractedText });
  } catch (e) {
    console.error('[추가자료 파싱] 오류:', e);
    return NextResponse.json({ error: '파일 분석 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
