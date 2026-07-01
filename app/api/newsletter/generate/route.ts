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
  keyTakeaway?: string;   // 핵심 한 줄 (서론 섹션 등에서는 생략 가능)
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

// Picsum: seed 고정이라 항상 같은 이미지 반환(일관성), 무료·안정·빠름.
// index를 seed에 더해 같은 뉴스레터 안 섹션끼리 다른 이미지가 나오게 한다.
function buildThumbnailUrl(seed: string, index = 0): string {
  return `https://picsum.photos/seed/${seed}-${index}/800/450`;
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
    const { round, leadershipType, companyName, referenceData, leadershipInfo } = await req.json() as {
      round: RoundPayload;
      leadershipType: string;
      companyName: string;
      referenceData?: string;
      leadershipInfo?: { type: string; characteristics?: string; developmentPoints?: string }[];
    };

    // 이 기업 다면진단 기반 유형 정보 (특징=공감/문제인식, 개발포인트=실천 처방)
    const infoBlock = (leadershipInfo && leadershipInfo.length > 0)
      ? `\n\n[이 기업 다면진단 기반 리더십 유형 정보 — 본문에 반드시 반영]\n`
        + leadershipInfo
            .filter(i => (i.characteristics?.trim() || i.developmentPoints?.trim()))
            .map(i => `- ${i.type}\n  · 특징: ${i.characteristics ?? ''}${i.developmentPoints?.trim() ? `\n  · 개발 포인트: ${i.developmentPoints}` : ''}`)
            .join('\n')
        + `\n(특징은 intro·본문의 공감/문제 인식에, 개발 포인트는 keyTakeaway와 actionPlan의 실천 처방에 직접 반영하세요. 문서에 없는 내용은 지어내지 마세요.)`
      : '';

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
${infoBlock}

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
- 지루하지 않고 재밌게, 옆에서 말 거는 느낌으로. "솔직히 뜨끔하지 않나요?"처럼 독자를 콕 찌르는 문장을 적절히 섞으세요
- 독자: 40~50대 기업 중간관리자~임원. 현장에서 바로 적용할 수 있는 내용으로
- 구체적인 숫자·연구결과·실제 사례를 포함 (추상적 조언 금지). 단 수치·사실은 지어내지 말고, 주어진 콘텐츠·진단 데이터 등 근거 범위 안에서만 쓰세요
- 이모지는 각 섹션 소제목(emoji 필드)에만 1개씩. subject·headline·intro·keyTakeaway 등 다른 곳에는 이모지를 쓰지 마세요 (closing의 ✅·👉 기호만 예외)
- 뉴스레터 유형이 맞춤형이면 해당 리더십 유형(${leadershipType})의 특성(예: 독재형의 일방적 지시, 방관형의 무관심 등)을 직접 반영한 내용으로 작성
- 전체를 읽으면 서론 → 본론 → 결론 흐름이 소제목 없이도 자연스럽게 느껴지도록. 전체 4~5분 읽기 분량

[전체 구조 — intro(여는 글) → sections 3개(서론·본론·결론) → closing(맺는 글)]
- intro (여는 글): 독자가 공감할 현장 질문이나 상황으로 시작해 "맞아, 나도 이런 경험 있어"라는 반응을 유도하고, 오늘 다룰 주제를 자연스럽게 제시. 2~3문장으로 간결하게

- sections (3개): "같은 구성의 3번 반복"이 아니라, 하나의 이야기가 짚어보기 → 파고들기 → 행동하기로 이어지게 만드세요. 정확히 3개를 생성하되 세 섹션은 블록 구성·길이·톤이 서로 달라야 하고, 앞 섹션을 이어받아 전개합니다(병렬 나열 금지). 선택된 콘텐츠가 있으면 우선 반영하세요.
  · 섹션 1 = 서론 '짚어보기'(짧고 가볍게): 독자를 끌어들이는 훅(질문/장면)으로 시작 — "나는 제대로 된 리더로 일하고 있나?"처럼 독자 본인 얘기로 느끼게. 충격적인 통계 하나(dataStat)로 궁금증을 유발하고, 한 줄 임팩트(keyTakeaway 한 줄)로 다음으로 넘깁니다. 이 섹션의 dataStat.value는 화면에 거대한 타이포로 노출되니 반드시 짧은 수치·대비만(예: "83% vs 47%", "10명 중 8명") — 문장으로 길게 쓰지 말고, 부연 설명은 dataStat.description에 넣으세요. 짧은 도입은 intro 한 단락에만 쓰고 body는 비우세요(이 섹션은 거대 통계+한 줄이 주인공인 임팩트 레이아웃). quote·caseStudy·actionPlan도 빈 값. 가장 짧게. 역할: '왜 이게 지금 나에게 중요한가'를 던지고 본론으로 안내.
  · 섹션 2 = 본론 '파고들기'(가장 길고 풍부): 핵심 개념을 깊이 파고들며 quote·dataStat·caseStudy·keyTakeaway를 모두 활용해 가장 꽉 차게 씁니다. intro를 "앞서 ~을 봤다면, 이번엔 ~" 식으로 섹션 1을 직접 이어받아 시작하세요. actionPlan은 여기 두지 말고 결론으로 미룹니다. 역할: 주제를 본격적으로 파헤치는 핵심부.
  · 섹션 3 = 결론 '행동하기'(짧게 수렴 + 행동): intro를 "여기까지 봤다면, 이제 ~" 식 연결로 시작해 앞 내용을 짧게 수렴시키고 "그래서 이제 뭘 할 것인가"로 떠밉니다. 수렴 문장은 intro(+필요시 body 1단락 이내)로 짧게, 그 다음 actionPlan을 무게 실어 가장 구체적으로 배치(2~3개), keyTakeaway로 강하게 끝냅니다. dataStat·caseStudy·quote는 빈 값(통계·사례 나열 금지, 이 섹션은 체크리스트 카드가 주인공). 역할: 결단과 행동으로 마무리.
- 분량: 본론(2)이 가장 길고, 서론(1)은 가장 짧고 가볍게, 결론(3)은 그 중간 — 본론보다 짧게. 세 섹션이 길이·시각 밀도에서 확실히 달라야 합니다(같은 카드 반복 금지). 사실·수치는 지어내지 말 것.

- closing (맺는 글): "✅ 오늘의 핵심: "로 시작해 본론의 핵심을 한 문장으로 정리하고, 줄을 바꿔(\\n) "👉 내일 바로 해보세요: " 뒤에 구체적 행동 1~2가지를 제시한 다음, 따뜻하고 기대감 있는 한 문장으로 마무리

[각 섹션 작성 지침 — 블록은 위 도입/심화/결단 역할에 맞게 분배하되, 서론·결론도 빈약하지 않게 채우세요]
- 톤: 옆에서 말 거는 듯 재밌고 생생하게. "솔직히 뜨끔하지 않나요?"처럼 독자를 콕 찌르는 문장을 섞되, 한 호흡엔 하나의 메시지만 — 개념을 한 섹션에 욱여넣지 마세요.
- contentTitle (★섹션 헤드라인 — 목차와 Article 큰 제목에 그대로 노출됨): 그 섹션의 내용을 대표하는 고유 헤드라인을 쓰세요. 절대 규칙:
  · 세 섹션의 contentTitle은 서로 "의미가 다른" 헤드라인이어야 합니다. 같은 문구에 1/2/3 같은 숫자만 바꿔 붙이거나, 단어 몇 개만 바꿔 회피하는 것은 금지.
  · 뉴스레터 메인 주제(headline/subject)를 그대로 복사하지 마세요. 각 섹션은 자기 역할(서론=문제 제기, 본론=핵심 파헤치기, 결론=행동 촉구)을 대표하는 다른 헤드라인을 가집니다.
  · 다음은 '스타일 가이드'일 뿐 그대로 출력하지 말 것 — 이번 호 주제(${round.topic.trim() || '주제'})에 맞는 고유 헤드라인을 새로 만드세요:
    - 서론 예시 스타일: "리더의 70%가 자신의 역할을 설명하지 못한다"
    - 본론 예시 스타일: "'나는 좋은 리더'라는 착각이 팀을 멈추게 한다"
    - 결론 예시 스타일: "지금 이 질문에 답하는 것, 그게 리더십의 시작이에요"
  · 선택된 콘텐츠가 있으면 그 콘텐츠를 바탕으로 하되, 결국은 '그 섹션의 헤드라인'이 되게 다듬으세요.
- contentId: 매칭되는 콘텐츠 id (없으면 빈 문자열)
- emoji: 소제목 앞에 붙일 이모지 1개
- subtitle: contentTitle을 보조하는 다른 각도의 한 줄. 헤드라인과 의미가 겹치면 안 됩니다 — 헤드라인이 결론을 던지면 subtitle은 그 이유·반전·디테일 등 다른 각을 한 줄로. (헤드라인을 말만 바꿔 반복 금지)
- intro: 소제목 아래 2~3문장 설명. 이 섹션에서 무엇을 다루는지 자연스럽게
- body: 핵심 내용 불릿 (각 1~2문장). 섹션 2(파고들기)는 가장 풍부하게(불릿 다수). 섹션 1(짚어보기)은 body를 비우고 도입은 intro에만. 섹션 3(행동하기)은 body 1단락 이내로 짧게 수렴
- quote: 강조하고 싶은 핵심 메시지 한 문장 (따옴표 없이, 임팩트 있게) — 섹션 2에만 사용, 섹션 1·3은 빈 값
- dataStat: { value: 핵심 수치/통계 (예 "78% vs 32%"), description: 그 수치의 의미 1~2문장 } — 섹션 1(훅 통계 1개)·섹션 2(집중 배치)에만 사용, 섹션 3은 빈 값
- caseStudy: 실제 같은 사례 2~3문장 ("A 회사의 김 팀장은...") — 섹션 2에만 사용, 섹션 1·3은 빈 값
- keyTakeaway: 이 섹션의 핵심 한 줄 (이모지 없이). 섹션 1(한 줄 임팩트)·섹션 2·섹션 3에 사용. 비우면 화면에 Key Point 박스가 표시되지 않습니다
- actionPlan: 실천 가능한 구체적 행동 2~3개 (배열) — 섹션 3(결단)에 무게를 실어 배치, 섹션 1·2는 비워도 됨. 작성 원칙:
  · 추상적 조언이 아닌 구체적 행동, "~해보세요"/"~를 시도해보세요" 형태
  · 측정 가능하거나 명확한 행동, 리더십 유형(${leadershipType})·단계(${round.stepLabel})에 맞춤
  · 예시(독재형 맞춤형): "이번 주 회의에서 팀원 3명에게 의견을 먼저 물어보세요"
  · 예시(일반형): "오늘 1on1에서 '요즘 어떤 점이 가장 어렵나요?'라고 질문해보세요"${hasInteractions ? `

[인터랙션 생성 — 주제·리더십 유형, 그리고 위 본론(sections) 내용과 맥락이 자연스럽게 이어지는 구체적인 내용으로 작성]
"interactions" 배열에 아래 구조로 정확히 생성하세요:
${interactionSchema}` : ''}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 포함 금지:
(아래 예시는 한 섹션의 전체 필드 형태일 뿐입니다. sections는 3개를 만들되, 세 섹션의 contentTitle은 서로 의미가 다른 고유 헤드라인이어야 합니다. 역할별로 블록을 다르게 채우세요 — 서론(짚어보기)=dataStat 1개+keyTakeaway 한 줄, quote·caseStudy·actionPlan은 빈 값 / 본론(파고들기)=quote·dataStat·caseStudy·keyTakeaway 모두 채움 / 결론(행동하기)=keyTakeaway+actionPlan, dataStat·caseStudy는 빈 값.)
{
  "subject": "이메일 제목 (클릭하고 싶게, 숫자·질문·반전 활용, 이모지 없이)",
  "headline": "핵심 한 줄 헤드라인 (숫자·질문·반전 활용, 이모지 없이)",
  "intro": "공감 현장 질문/상황으로 여는 서론 2~3문장 (이모지 없이)",
  "sections": [
    {
      "contentTitle": "이 섹션 고유 헤드라인 (목차·제목에 노출, 세 섹션 서로 다르게, 메인 주제 복사 금지)",
      "contentId": "콘텐츠 id (없으면 빈 문자열)",
      "subtitle": "헤드라인을 보조하는 다른 각도의 한 줄 (헤드라인과 의미 중복 금지)",
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

    // 각 섹션에 썸네일 폴백 URL 부여 (주제·콘텐츠 제목·태그 기반 키워드 선택).
    // seed에 섹션 인덱스를 붙여 뉴스레터 안에서 섹션마다 서로 다른 이미지가 나오도록 한다(중복 방지 1차).
    const sections: GeneratedSection[] = (parsed.sections ?? []).map((s, i) => {
      const matched = round.contents.find(c => c.id === s.contentId);
      const keywordText = [s.contentTitle ?? '', round.topic ?? '', ...(matched?.tags ?? [])].join(' ');
      return { ...s, thumbnailUrl: buildThumbnailUrl(pickThumbnailSeed(keywordText), i) };
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
