import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/api/claude';

// ── 타입 ──────────────────────────────────────────────────────────────
type GeneratedSection = {
  contentTitle: string;
  contentId: string;
  summary?: string;       // (구버전 호환) 핵심 요약
  intro?: string;         // 도입 단락
  mainBody?: string;      // 본문 핵심 내용
  examples?: string;      // 구체적 사례/데이터
  keyTakeaway: string;
  actionPlan?: string[];  // 실천 가능한 행동 2~3개
  emoji: string;
  youtubeUrl?: string;
};

type GeneratedInteraction = {
  type: 'quiz' | 'scenario' | 'selfcheck' | 'reflection' | 'dodont';
  title: string;
  content:
    | { question: string; options: string[]; answer: number }
    | { situation: string; options: { label: string; result: string }[] }
    | { items: string[] }
    | { questions: string[] }
    | { do: string[]; dont: string[] };
};

type GeneratedSurvey = {
  type: 'always' | 'periodic';
  questions: unknown[];
};

type GeneratedNewsletter = {
  subject: string;
  headline: string;
  intro: string;
  sections: GeneratedSection[];
  interactions: GeneratedInteraction[];
  surveys: GeneratedSurvey[];
  closing: string;
};

type ContentItem = {
  id: string;
  title: string;
  body?: string;
  tags?: string[];
};

type RoundPayload = {
  id: number;
  topic: string;
  stepLabel: string;
  contents: ContentItem[];
  interactions: string[];
  surveys: string[];
};

// ── 만족도 조사 고정 구조 ──────────────────────────────────────────────
function buildAlwaysSurvey(): GeneratedSurvey {
  return {
    type: 'always',
    questions: [{
      type: 'rating',
      options: ['별로예요', '좋아요', '최고예요'],
      followUp: '어떤 점이 좋았나요?',
      followUpOptions: ['내용이 유익했어요', '읽기 편했어요', '실무에 바로 쓸 수 있어요', '새로운 시각을 얻었어요'],
      openQuestion: '가장 좋았던 콘텐츠는 무엇이었나요?',
    }],
  };
}

function buildPeriodicSurvey(): GeneratedSurvey {
  return {
    type: 'periodic',
    questions: [
      { type: 'scale', question: '이 뉴스레터가 전반적으로 만족스러우셨나요?', scale: 5 },
      { type: 'scale', question: '콘텐츠가 업무에 도움이 되었나요?', scale: 5 },
      { type: 'multiple', question: '가장 유익했던 콘텐츠 유형은?', options: ['아티클', '인터뷰', '책 추천', '성공 사례', '카드뉴스', '웹툰'] },
      { type: 'multiple', question: '인터랙션 활동 중 가장 좋았던 것은?', options: ['퀴즈', '선택형 시나리오', '셀프 진단', '회고 질문', "Do&Don't"] },
      { type: 'scale', question: '뉴스레터 분량이 적절했나요?', scale: 5 },
      { type: 'open', question: '개선되었으면 하는 점이 있다면 자유롭게 적어주세요.' },
    ],
  };
}

// ── 인터랙션 스키마 프롬프트 생성 ─────────────────────────────────────
function buildInteractionPrompt(types: string[]): string {
  const parts: string[] = [];
  if (types.includes('quiz')) {
    parts.push(`{"type":"quiz","title":"이번 주 퀴즈","content":{"question":"주제 관련 퀴즈 질문 1개","options":["선택지1","선택지2","선택지3","선택지4"],"answer":0}}`);
  }
  if (types.includes('scenario')) {
    parts.push(`{"type":"scenario","title":"이런 상황이라면?","content":{"situation":"상황 설명 2~3문장","options":[{"label":"선택지 A","result":"이 선택의 결과/피드백"},{"label":"선택지 B","result":"이 선택의 결과/피드백"},{"label":"선택지 C","result":"이 선택의 결과/피드백"}]}}`);
  }
  if (types.includes('selfcheck')) {
    parts.push(`{"type":"selfcheck","title":"셀프 체크리스트","content":{"items":["항목1","항목2","항목3","항목4","항목5"]}}`);
  }
  if (types.includes('reflection')) {
    parts.push(`{"type":"reflection","title":"오늘의 성찰 질문","content":{"questions":["성찰 질문1","성찰 질문2","성찰 질문3"]}}`);
  }
  if (types.includes('dodont')) {
    parts.push(`{"type":"dodont","title":"Do & Don't","content":{"do":["실천항목1","실천항목2","실천항목3"],"dont":["금지항목1","금지항목2","금지항목3"]}}`);
  }
  return parts.join(',\n    ');
}

// ── POST 핸들러 ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { round, leadershipType, companyName } = await req.json() as {
      round: RoundPayload;
      leadershipType: string;
      companyName: string;
    };

    const contentSummary = round.contents.length > 0
      ? round.contents.map((c, i) =>
          `[${i + 1}] ID:${c.id} 제목:"${c.title}"\n본문: ${(c.body ?? '').slice(0, 800)}`
        ).join('\n\n')
      : '(콘텐츠 미선정)';

    const hasInteractions = round.interactions.length > 0;
    const interactionSchema = hasInteractions ? buildInteractionPrompt(round.interactions) : '';

    const prompt = `당신은 뉴닉 스타일의 B2B 리더십 코칭 뉴스레터 작가입니다.
아래 정보를 바탕으로 뉴스레터 본문을 작성해주세요.

[대상 정보]
- 기업명: ${companyName}
- 리더십 유형: ${leadershipType}
- 스토리라인 단계: ${round.stepLabel}
- 이번 호 주제: ${round.topic.trim() || '(미선정)'}

[이번 호 콘텐츠]
${contentSummary}

[작성 지침]
- 뉴닉 스타일: 친근하고 재밌되 정제된 말투
- 리더(독자)에게 직접 말 거는 2인칭 톤 ("여러분", "당신")
- 이모지 적절히 활용 (과하지 않게)
- sections는 콘텐츠 수만큼 생성 (콘텐츠 없으면 1개, 주제 기반 작성)
- 각 섹션은 흐름: 도입(intro) → 본문(mainBody) → 구체적 사례/데이터(examples) → 핵심 포인트(keyTakeaway) → Action Plan(actionPlan)
- intro: 흥미를 끄는 도입 1~2문장
- mainBody: 콘텐츠 본문 기반 핵심 내용 2~4문장
- examples: 구체적 사례·수치·데이터 1~2문장
- keyTakeaway: 한 줄 핵심 교훈 (이모지 포함)
- actionPlan: 실천 가능한 구체적 행동 2~3개 (배열). 작성 원칙:
  · 추상적 조언이 아닌 구체적 행동, "~해보세요"/"~를 시도해보세요" 형태
  · 측정 가능하거나 명확한 행동, 리더십 유형(${leadershipType})·단계(${round.stepLabel})에 맞춤
  · 가능하면 [오늘 당장 / 이번 주 / 지속 적용] 단계로 구성
  · 예시(독재형 맞춤형): "이번 주 회의에서 팀원 3명에게 의견을 먼저 물어보세요"
  · 예시(일반형): "오늘 1on1에서 '요즘 어떤 점이 가장 어렵나요?'라고 질문해보세요"${hasInteractions ? `

[인터랙션 생성 — 주제·리더십 유형과 연관된 구체적인 내용으로 작성]
"interactions" 배열에 아래 구조로 정확히 생성하세요:
${interactionSchema}` : ''}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 포함 금지:
{
  "subject": "이메일 제목 (흥미롭게, 이모지 포함)",
  "headline": "핵심 한 줄 헤드라인",
  "intro": "도입부 2~3문장 (흥미 유발, 이모지 활용)",
  "sections": [
    {
      "contentTitle": "콘텐츠 제목",
      "contentId": "콘텐츠 id",
      "intro": "흥미를 끄는 도입 1~2문장",
      "mainBody": "핵심 내용 2~4문장",
      "examples": "구체적 사례/데이터 1~2문장",
      "keyTakeaway": "한 줄 핵심 교훈 (이모지 포함)",
      "actionPlan": ["오늘 당장 할 수 있는 구체적 행동", "이번 주에 시도해볼 행동", "지속적으로 적용할 행동"],
      "emoji": "섹션 대표 이모지 1개"
    }
  ],
  "interactions": [${hasInteractions ? `\n    ${interactionSchema}\n  ` : ''}],
  "closing": "마무리 문구 (따뜻하게, 1~2문장, 이모지 포함)"
}`;

    const raw = await callClaude(prompt);

    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('JSON 파싱 실패');

    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Omit<GeneratedNewsletter, 'surveys'>;

    const surveys: GeneratedSurvey[] = round.surveys.map(s =>
      s === 'always' ? buildAlwaysSurvey() : buildPeriodicSurvey()
    );

    return NextResponse.json({ ...parsed, surveys } satisfies GeneratedNewsletter);
  } catch (err) {
    console.error('[newsletter/generate]', err);
    return NextResponse.json({ error: '뉴스레터 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
