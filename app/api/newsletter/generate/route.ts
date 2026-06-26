import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/api/claude';
import { safeParseJson } from '@/lib/repairJson';

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
- 독자: 40~50대 기업 중간관리자~임원. 이들이 현장에서 바로 적용할 수 있는 내용으로
- 구체적인 숫자·연구결과·실제 사례를 반드시 포함 (추상적 조언 금지)
- 이모지는 body(본문 단락) 안에서는 1~2개만 절제해서 사용 (과도한 사용 금지). subtitle/quote/keyTakeaway/closing 등 구조 필드의 이모지는 그대로 유지
- '서론'·'본론'·'결론' 같은 소제목을 글에 절대 쓰지 마세요. 소제목 없이 자연스럽게 흐르는 글로 작성
- 뉴스레터 유형이 맞춤형이면 해당 리더십 유형(${leadershipType})의 특성(예: 독재형의 일방적 지시, 방관형의 무관심 등)을 직접 반영한 내용으로 작성
- sections는 콘텐츠 수만큼 생성 (콘텐츠 없으면 1개, 주제 기반 작성)
- 각 섹션을 충분히 길고 풍부하게 작성 (섹션당 2500~3500자, 단락 7~9개). 기존보다 1.5~2배 분량으로 깊이 있게. 단조롭지 않게 흐름 다양화
- 서론 → 본론 → 결론의 흐름이 소제목 없이도 자연스럽게 드러나도록:
  · 서론(intro + body 앞부분): 독자가 공감할 현장 상황이나 질문으로 시작해 "맞아, 나도 이런 경험 있어"라는 반응을 유도하고, 이번 호 핵심 주제를 자연스럽게 제시
  · 본론(body 중심): 핵심 인사이트 2~3가지를 자연스럽게 연결하고, 각 인사이트에 구체적 사례·데이터·연구결과를 붙여 다음 인사이트로 매끄럽게 이어지게
  · 결론(keyTakeaway + actionPlan + closing): 본론의 핵심을 한 문장으로 정리하고, 독자가 내일 당장 실천할 행동 1가지를 제시한 뒤 다음 호에 대한 기대감으로 마무리
- 흐름: 도입(intro) → 본문 → 인용구(quote) → 본문 → 데이터(dataStat) → 본문 → 사례(caseStudy) → 본문(적용) → 핵심 포인트(keyTakeaway) → Action Plan(actionPlan)
- subtitle: 제목 아래 부제 한 줄
- intro: 독자가 공감할 현장 상황이나 질문으로 여는 도입 2~3문장
- body: 본문 단락 배열 (7~9개, 각 3~5문장). 콘텐츠 본문을 풍부하게 풀어쓰고, 인사이트가 다음 단락으로 자연스럽게 이어지도록
- quote: 강조하고 싶은 핵심 메시지 한 문장 (따옴표 없이, 임팩트 있게)
- dataStat: { value: 핵심 수치/통계 (예 "78% vs 32%"), description: 그 수치의 의미 1~2문장 }
- caseStudy: 실제 같은 사례 2~3문장 ("A 회사의 김 팀장은...")
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
      "subtitle": "제목 아래 부제 한 줄",
      "intro": "독자가 공감할 현장 상황/질문으로 여는 도입 2~3문장",
      "body": ["본문 단락1 — 서론: 공감 상황 + 핵심 주제 제시", "본문 단락2 — 본론: 첫 인사이트 + 구체 사례", "본문 단락3 — 본론: 둘째 인사이트 + 데이터/연구", "본문 단락4 — 본론: 셋째 인사이트 + 현장 적용", "본문 단락5", "본문 단락6", "본문 단락7 (각 단락 3~5문장, 자연스럽게 이어지도록)"],
      "quote": "강조 인용구 한 문장",
      "dataStat": { "value": "78% vs 32%", "description": "수치의 의미 1~2문장" },
      "caseStudy": "실제 사례 2~3문장",
      "keyTakeaway": "한 줄 핵심 교훈 (이모지 포함)",
      "actionPlan": ["오늘 당장 할 수 있는 구체적 행동", "이번 주에 시도해볼 행동", "한 달 동안 지속할 행동"],
      "emoji": "섹션 대표 이모지 1개"
    }
  ],
  "interactions": [${hasInteractions ? `\n    ${interactionSchema}\n  ` : ''}],
  "closing": "마무리 문구 (따뜻하게, 1~2문장, 이모지 포함)"
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
      s === 'always' ? buildAlwaysSurvey() : buildPeriodicSurvey()
    );

    return NextResponse.json({ ...parsed, sections, surveys } satisfies GeneratedNewsletter);
  } catch (err) {
    console.error('[newsletter/generate]', err);
    return NextResponse.json({ error: '뉴스레터 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
