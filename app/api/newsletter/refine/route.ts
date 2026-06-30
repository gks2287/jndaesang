import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/api/claude';
import { safeParseJson } from '@/lib/repairJson';

// 미리보기 본문 구조 (generate 라우트의 GeneratedNewsletter와 동일 형태)
type Section = {
  contentTitle?: string;
  contentId?: string;
  subtitle?: string;
  intro?: string;
  body?: string[];
  quote?: string;
  dataStat?: { value: string; description: string };
  caseStudy?: string;
  keyTakeaway?: string;
  actionPlan?: string[];
  emoji?: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  youtubeUrl?: string;
};

type Newsletter = {
  subject: string;
  headline: string;
  intro: string;
  sections: Section[];
  interactions: unknown[];
  surveys: unknown[];
  closing: string;
};

const SYSTEM_PROMPT = `당신은 B2B 리더십 코칭 뉴스레터 편집자입니다.
기존 뉴스레터 본문(JSON)과 사용자의 수정 요청을 받아, 요청을 반영한 새 본문을 같은 JSON 구조로 반환합니다.

[원칙]
- 사용자의 수정 요청에 해당하는 부분만 자연스럽게 수정하고, 나머지는 원본을 그대로 유지하세요
- 문체: 친근하지만 전문적인 존댓말(~해요 체). 능동적인 문장
- 이모지는 각 섹션 소제목(emoji 필드)에만 1개씩. subject·headline·intro·keyTakeaway 등에는 쓰지 마세요
- 구조(키 이름·배열 길이·섹션 수)는 원본과 동일하게 유지하세요
- 각 섹션의 contentId·thumbnail·thumbnailUrl·emoji 값은 원본 그대로 두세요 (임의로 바꾸지 마세요)
- 줄바꿈이 필요하면 JSON 문자열 내 \\n 으로 표시

[응답 형식]
다른 텍스트 없이, 원본과 동일한 키 구조의 JSON 객체만 출력하세요.`;

export async function POST(req: NextRequest) {
  try {
    const { current, prompt } = (await req.json()) as { current: Newsletter; prompt: string };

    if (!current || !prompt?.trim()) {
      return NextResponse.json({ error: '수정할 본문과 프롬프트가 필요합니다.' }, { status: 400 });
    }

    // surveys는 서버에서 결정적으로 생성되는 큰 구조 → AI에 보내지 않고 그대로 보존
    const { surveys, ...editable } = current;

    const userPrompt = `현재 뉴스레터 본문(JSON):
${JSON.stringify(editable)}

수정 요청: ${prompt.trim()}

위 수정 요청을 반영해 동일한 JSON 구조로만 응답하세요.`;

    const raw = await callClaude(userPrompt, SYSTEM_PROMPT);
    const parsed = safeParseJson<Omit<Newsletter, 'surveys'>>(raw);

    // 섹션의 비텍스트 메타(contentId·썸네일·emoji)는 원본을 우선 보존 (AI 환각 방지)
    const origSections = editable.sections ?? [];
    const mergedSections: Section[] = (parsed.sections ?? origSections).map((s, i) => {
      const orig = origSections[i] ?? {};
      return {
        ...s,
        contentId: s.contentId ?? orig.contentId,
        emoji: s.emoji ?? orig.emoji,
        thumbnail: orig.thumbnail,
        thumbnailUrl: orig.thumbnailUrl,
      };
    });

    return NextResponse.json({
      ...parsed,
      sections: mergedSections,
      interactions: parsed.interactions ?? editable.interactions ?? [],
      surveys: surveys ?? [],
    });
  } catch (err) {
    console.error('[newsletter/refine]', err);
    return NextResponse.json({ error: '뉴스레터 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
