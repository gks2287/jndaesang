import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/api/claude';
import { safeParseJson } from '@/lib/repairJson';
import {
  PERIODIC_SURVEY_TITLE,
  PERIODIC_SURVEY_DESCRIPTION,
  INTERACTION_SURVEY_LABELS,
  buildPeriodicSurveyQuestions,
} from '@/lib/periodicSurvey';

// ── 타입 ──────────────────────────────────────────────────────────────
type GeneratedSection = {
  contentTitle: string;
  contentId: string;
  subtitle?: string;      // 제목 아래 부제 한 줄
  summary?: string;       // (구버전 호환) 핵심 요약
  intro?: string;         // 공감 도입 단락
  body?: string[];        // 본문 단락들 (3~5개)
  quote?: string;         // 강조 인용구
  dataStat?: { value: string; description: string }; // 데이터 박스
  caseStudy?: string;     // 실제 사례 박스
  mainBody?: string;      // (구버전 호환)
  examples?: string;      // (구버전 호환)
  keyTakeaway: string;
  actionPlan?: string[];  // 실천 가능한 행동 2~3개
  thumbnail?: string;     // 콘텐츠 풀 썸네일 (클라이언트에서 매핑)
  thumbnailUrl?: string;  // 썸네일 폴백 URL (콘텐츠 주제 기반 자동 생성)
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
  title?: string;
  description?: string;
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

// ── 썸네일 폴백 URL 생성 ──────────────────────────────────────────────
// 콘텐츠 풀에 썸네일이 없는(웹서칭 등) 섹션을 위해 주제/카테고리 기반 이미지 URL 생성.
// 1차 소스가 실패해도 클라이언트 렌더에서 그라데이션으로 폴백 → 항상 무언가는 표시됨.
function pickThumbnailSeed(text: string): string {
  const has = (...ws: string[]) => ws.some(w => text.includes(w));
  if (has('소통', '피드백', '커뮤니케이션', '커뮤니', '경청', '대화', '1on1', '미팅', '회의')) return 'communication';
  if (has('팀', '조직', '협업', '팀워크', '동료', '문화')) return 'teamwork';
  if (has('코칭', '성장', '멘토', '육성', '코치', '발전')) return 'coaching';
  if (has('변화', '혁신', '전환', '개선', '도전')) return 'innovation';
  if (has('리더십', '자기인식', '리더', '인식', '성찰')) return 'leadership';
  return 'business';
}

// Picsum: seed 고정이라 항상 같은 이미지 반환(일관성), 무료·안정·빠름
function buildThumbnailUrl(seed: string): string {
  return `https://picsum.photos/seed/${seed}/800/450`;
}

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

// 정기 만족도 조사 — 확정 12문항. Q5/Q6 선택지는 해당 회차의 실제 콘텐츠·인터랙션으로 채운다.
function buildPeriodicSurvey(round: RoundPayload): GeneratedSurvey {
  const contentLabels = round.contents.map(c => c.title).filter(Boolean);
  const interactionLabels = round.interactions.map(k => INTERACTION_SURVEY_LABELS[k] ?? k);
  return {
    type: 'periodic',
    title: PERIODIC_SURVEY_TITLE,
    description: PERIODIC_SURVEY_DESCRIPTION,
    questions: buildPeriodicSurveyQuestions({ contentLabels, interactionLabels }),
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
    const { round, leadershipType, companyName, referenceData } = await req.json() as {
      round: RoundPayload;
      leadershipType: string;
      companyName: string;
      referenceData?: string;
    };

    // 관리자가 첨부하고 '본문에 반영' 체크한 조직 진단 자료에서 추출된 데이터 (있을 때만)
    const referenceBlock = referenceData?.trim()
      ? `

[조직 진단 데이터 — 반드시 본문에 반영]
아래는 이 대상의 실제 진단 자료에서 추출한 데이터입니다. 본문(특히 dataStat, intro, 본론)에 자연스럽게 인용하세요.
- 아래에 명시된 수치·비율·분포만 사용하세요. 여기에 없는 수치는 절대 지어내지 마세요(환각 금지).
- 값을 바꾸거나 반올림 보정하지 말고 추출된 그대로 쓰세요.
- 데이터가 주제와 무관하면 억지로 끼워넣지 말고, 관련된 값만 활용하세요.
${referenceData.trim()}`
      : '';

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
${referenceBlock}

[줄바꿈 규칙 — 가독성을 위해 반드시 적용]
- headline: 18자 이상이면 의미 단위(조사/접속사/쉼표 앞뒤)에서 줄바꿈(\\n). 한 줄 15~20자 내외
  예) "변화 앞에서 멈춰 선 리더에게 —\\n지금 이 자리가 출발점입니다"
- dataStat.value: 길면 핵심 숫자/비교값 앞에서 줄바꿈(\\n)
  예) "자기인식 높은 리더 vs 낮은 리더:\\n팀 성과 83% vs 47%"
- quote: 20자 이상이면 의미 단위에서 줄바꿈(\\n)
  예) "자신이 어디에 서 있는지 아는 리더만이,\\n팀을 어디로 데려갈지 알 수 있다"
- 줄바꿈은 반드시 \\n 문자로 표시 (JSON 문자열 내 \\n)

[작성 지침]
- 문체: 친근하지만 전문적인 존댓말(~해요 체). 능동적인 문장으로 쓰고 수동태는 쓰지 마세요
- 독자: 40~50대 기업 중간관리자~임원. 현장에서 바로 적용할 수 있는 내용으로
- 구체적인 숫자·연구결과·실제 사례를 반드시 포함 (추상적 조언 금지)
- 이모지는 각 섹션 소제목(emoji 필드)에만 1개씩. subject·headline·intro·keyTakeaway 등 다른 곳에는 이모지를 쓰지 마세요 (closing의 ✅·👉 기호만 예외)
- 뉴스레터 유형이 맞춤형이면 해당 리더십 유형(${leadershipType})의 특성(예: 독재형의 일방적 지시, 방관형의 무관심 등)을 직접 반영한 내용으로 작성
- 전체를 읽으면 서론 → 본론 → 결론 흐름이 소제목 없이도 자연스럽게 느껴지도록. 전체 4~5분 읽기 분량

[전체 구조 — intro(서론) → sections 3개(본론) → closing(결론)]
- intro (서론): 독자가 공감할 현장 질문이나 상황으로 시작해 "맞아, 나도 이런 경험 있어"라는 반응을 유도하고, 오늘 다룰 주제를 자연스럽게 제시. 2~3문장으로 간결하게
- sections (본론): 정확히 3개 생성. 선택된 콘텐츠를 우선 반영하되, 콘텐츠가 3개보다 적으면 주제를 3가지 관점으로 나누고, 많으면 핵심 3가지로 압축. 세 섹션이 문제 인식 → 원인·근거 → 현장 적용 순으로 자연스럽게 이어지도록
- closing (결론): "✅ 오늘의 핵심: "로 시작해 본론의 핵심을 한 문장으로 정리하고, 줄을 바꿔(\\n) "👉 내일 바로 해보세요: " 뒤에 구체적 행동 1~2가지를 제시한 다음, 따뜻하고 기대감 있는 한 문장으로 마무리

[각 섹션(본론) 작성 지침]
- contentTitle: 콘텐츠 제목 (선택 콘텐츠가 있으면 그 제목, 없으면 주제 기반)
- contentId: 매칭되는 콘텐츠 id (없으면 빈 문자열)
- emoji: 소제목 앞에 붙일 이모지 1개
- subtitle: 질문형 소제목 (예: "리더가 먼저 말하면 왜 안 될까?")
- intro: 소제목 아래 2~3문장 설명. 이 섹션에서 무엇을 다루는지 자연스럽게
- body: 핵심 내용을 짧은 불릿 2~3개 (각 1~2문장). 장황하지 않게 핵심만
- quote: 강조하고 싶은 핵심 메시지 한 문장 (따옴표 없이, 임팩트 있게)
- dataStat: { value: 핵심 수치/통계 (예 "78% vs 32%"), description: 그 수치의 의미 1~2문장 } — 구체적 수치 반드시 포함
- caseStudy: 실제 같은 사례 2~3문장 ("A 회사의 김 팀장은...") — 구체적 사례 반드시 포함
- keyTakeaway: 이 섹션의 핵심을 요약한 한 줄 (이모지 없이)
- actionPlan: 실천 가능한 구체적 행동 2~3개 (배열). 작성 원칙:
  · 추상적 조언이 아닌 구체적 행동, "~해보세요"/"~를 시도해보세요" 형태
  · 측정 가능하거나 명확한 행동, 리더십 유형(${leadershipType})·단계(${round.stepLabel})에 맞춤
  · 예시(독재형 맞춤형): "이번 주 회의에서 팀원 3명에게 의견을 먼저 물어보세요"
  · 예시(일반형): "오늘 1on1에서 '요즘 어떤 점이 가장 어렵나요?'라고 질문해보세요"${hasInteractions ? `

[인터랙션 생성 — 주제·리더십 유형, 그리고 위 본론(sections) 내용과 맥락이 자연스럽게 이어지는 구체적인 내용으로 작성]
"interactions" 배열에 아래 구조로 정확히 생성하세요:
${interactionSchema}` : ''}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 포함 금지:
{
  "subject": "이메일 제목 (클릭하고 싶게, 숫자·질문·반전 활용, 이모지 없이)",
  "headline": "핵심 한 줄 헤드라인 (숫자·질문·반전 활용, 이모지 없이)",
  "intro": "공감 현장 질문/상황으로 여는 서론 2~3문장 (이모지 없이)",
  "sections": [
    {
      "contentTitle": "콘텐츠 제목",
      "contentId": "콘텐츠 id (없으면 빈 문자열)",
      "subtitle": "질문형 소제목 (예: 리더가 먼저 말하면 왜 안 될까?)",
      "intro": "소제목 아래 2~3문장 설명",
      "body": ["핵심 불릿1 (1~2문장)", "핵심 불릿2 (1~2문장)", "핵심 불릿3 (선택)"],
      "quote": "강조 인용구 한 문장",
      "dataStat": { "value": "78% vs 32%", "description": "수치의 의미 1~2문장" },
      "caseStudy": "실제 사례 2~3문장",
      "keyTakeaway": "이 섹션의 핵심 한 줄 (이모지 없이)",
      "actionPlan": ["오늘 당장 할 수 있는 구체적 행동", "이번 주에 시도해볼 행동"],
      "emoji": "소제목 앞 이모지 1개"
    }
  ],
  "interactions": [${hasInteractions ? `\n    ${interactionSchema}\n  ` : ''}],
  "closing": "✅ 오늘의 핵심: [본론 핵심 한 문장]\\n👉 내일 바로 해보세요: [행동 1~2가지] — 따뜻하고 기대감 있는 마무리"
}`;

    const raw = await callClaude(prompt);

    const parsed = safeParseJson<Omit<GeneratedNewsletter, 'surveys'>>(raw);

    // 각 섹션에 썸네일 폴백 URL 부여 (주제·콘텐츠 제목·태그 기반 키워드 선택)
    const sections: GeneratedSection[] = (parsed.sections ?? []).map(s => {
      const matched = round.contents.find(c => c.id === s.contentId);
      const keywordText = [s.contentTitle ?? '', round.topic ?? '', ...(matched?.tags ?? [])].join(' ');
      return { ...s, thumbnailUrl: buildThumbnailUrl(pickThumbnailSeed(keywordText)) };
    });

    const surveys: GeneratedSurvey[] = round.surveys.map(s =>
      s === 'always' ? buildAlwaysSurvey() : buildPeriodicSurvey(round)
    );

    return NextResponse.json({ ...parsed, sections, surveys } satisfies GeneratedNewsletter);
  } catch (err) {
    console.error('[newsletter/generate]', err);
    return NextResponse.json({ error: '뉴스레터 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
