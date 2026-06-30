import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/api/claude';
import { safeParseJson } from '@/lib/repairJson';

// 미리보기 본문 구조 (generate 라우트의 GeneratedNewsletter와 동일 형태)
type Section = {
  contentTitle?: string;
  contentId?: string;
  subtitle?: string;
  intro?: string;
  summary?: string;
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

// 요약본(이메일 미리보기) 편집 전용 — 요약본에 보이는 필드만 수정하고 본문 상세는 보존
const EMAIL_SYSTEM_PROMPT = `당신은 B2B 리더십 코칭 뉴스레터의 '요약본(이메일 미리보기)' 편집자입니다.
기존 뉴스레터 본문(JSON)과 사용자의 수정 요청을 받아, 요약본에 노출되는 부분만 요청대로 고쳐 같은 JSON 구조로 반환합니다.

[요약본에 표시되는 부분 — 여기만 수정 대상]
- headline: 상단 큰 제목
- intro: 상단 도입 문장
- 각 섹션의 contentTitle: 섹션 제목
- 각 섹션의 summary: 그 섹션을 1~2문장으로 압축한 요약 (요약본 카드에 노출). 없으면 새로 만들고, 있으면 갱신하세요.

[원칙]
- 사용자의 수정 요청을 위 '요약본 표시 필드'에 반영하세요. 특히 각 섹션의 summary를 요청한 톤·길이에 맞게 새로(또는 갱신) 작성하세요. summary는 해당 섹션 body 내용을 근거로 요약하세요.
- body·quote·dataStat·caseStudy·keyTakeaway·actionPlan 등 본문 상세 필드는 원본 값을 그대로 두세요 (요약본 편집은 전체본문을 바꾸지 않습니다).
- 문체: 친근하지만 전문적인 존댓말(~해요 체). 이모지는 각 섹션 emoji 필드에만.
- 구조(키 이름·섹션 수·배열 길이)는 원본과 동일하게 유지하세요. 단, 각 섹션에 summary(string)는 추가/갱신해도 됩니다.
- contentId·thumbnail·thumbnailUrl·emoji 값은 원본 그대로 두세요.

[응답 형식]
다른 텍스트 없이, 원본과 동일한 키 구조의 JSON 객체만 출력하세요. 각 섹션에 summary(string)를 포함하세요.`;

export async function POST(req: NextRequest) {
  try {
    const { current, prompt, mode, referenceData } = (await req.json()) as {
      current: Newsletter;
      prompt: string;
      mode?: 'full' | 'email';
      referenceData?: string;
    };

    if (!current || !prompt?.trim()) {
      return NextResponse.json({ error: '수정할 본문과 프롬프트가 필요합니다.' }, { status: 400 });
    }

    // 요약본(email) 모드 = 요약 필드만 손대고 본문 상세는 보존
    const isEmail = mode === 'email';

    // 관리자가 '본문에 반영' 체크한 조직 진단 자료에서 추출된 데이터 (있을 때만)
    const referenceBlock = referenceData?.trim()
      ? `

[조직 진단 데이터 — 참고]
아래는 이 대상의 실제 진단 자료에서 추출한 데이터입니다. 수정 시 수치를 인용한다면 아래 값만 사용하고, 여기에 없는 수치는 지어내지 마세요(환각 금지). 값을 바꾸거나 보정하지 마세요.
${referenceData.trim()}`
      : '';

    // surveys는 서버에서 결정적으로 생성되는 큰 구조 → AI에 보내지 않고 그대로 보존
    const { surveys, ...editable } = current;

    const userPrompt = `현재 뉴스레터 본문(JSON):
${JSON.stringify(editable)}

수정 요청: ${prompt.trim()}
${referenceBlock}

위 수정 요청을 반영해 동일한 JSON 구조로만 응답하세요.`;

    const raw = await callClaude(userPrompt, isEmail ? EMAIL_SYSTEM_PROMPT : SYSTEM_PROMPT);
    const parsed = safeParseJson<Omit<Newsletter, 'surveys'>>(raw);

    // 섹션 병합. 본문(full) 모드: 비텍스트 메타만 보존. 요약본(email) 모드: 본문 상세는 원본 보존하고 제목·summary만 반영.
    const origSections = editable.sections ?? [];
    const mergedSections: Section[] = (parsed.sections ?? origSections).map((s, i) => {
      const orig = origSections[i] ?? {};
      if (isEmail) {
        return {
          ...orig,                                   // body 등 본문 상세는 원본 그대로
          contentTitle: s.contentTitle ?? orig.contentTitle,
          summary: s.summary ?? orig.summary,        // 요약본 카드에 노출되는 요약
        };
      }
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
      // 요약본 편집은 전체본문 결론(closing)을 바꾸지 않음
      closing: isEmail ? (editable.closing ?? parsed.closing) : (parsed.closing ?? editable.closing),
      sections: mergedSections,
      interactions: parsed.interactions ?? editable.interactions ?? [],
      surveys: surveys ?? [],
    });
  } catch (err) {
    console.error('[newsletter/refine]', err);
    return NextResponse.json({ error: '뉴스레터 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
