// 정기 만족도 조사 — J&Company 확정 12문항.
// 위저드 즉시 미리보기(renderSurveyTemplates)와 AI 생성 경로(buildPeriodicSurvey)에서
// 동일하게 사용하도록 문항 정의를 한 곳으로 단일화한다. (기존엔 두 곳에 중복돼 있었음)

export const PERIODIC_SURVEY_TITLE = '리더십 뉴스레터 만족도 조사';
export const PERIODIC_SURVEY_DESCRIPTION =
  '뉴스레터를 읽어주셔서 감사합니다. 더 나은 콘텐츠 제공을 위해 아래 설문에 응해주세요. (소요 시간: 약 3분)';

// 인터랙션 키 → 설문 선택지 라벨 (Q6 동적 생성용)
export const INTERACTION_SURVEY_LABELS: Record<string, string> = {
  quiz: '퀴즈',
  scenario: '선택형 시나리오',
  selfcheck: '셀프 진단/체크리스트',
  reflection: '회고 질문',
  dodont: "Do & Don't 리스트",
};

// 문항 유형 4종:
// - single   : 객관식(단일) — 보기 중 하나 선택
// - multiple : 객관식(복수) — minSelect~maxSelect개 선택
// - short    : 단답식 — 짧은 텍스트 입력
// - long     : 서술형 — 자유 서술
export type PeriodicSurveyQuestion =
  | { type: 'single'; area: string; required: boolean; question: string; options: string[] }
  | { type: 'multiple'; area: string; required: boolean; question: string; options: string[]; minSelect: number; maxSelect: number }
  | { type: 'short'; area: string; required: boolean; question: string }
  | { type: 'long'; area: string; required: boolean; question: string };

// 유형 → 한글 텍스트 뱃지 (디자인 정책상 이모지 대신 텍스트 사용)
export const SURVEY_TYPE_BADGE: Record<PeriodicSurveyQuestion['type'], string> = {
  single: '단일',
  multiple: '복수',
  short: '단답',
  long: '서술',
};

// Q5(콘텐츠)·Q6(인터랙션) 동적 선택지를 못 끌어왔을 때의 fallback (관리자 수동 편집 전 임시 노출용)
const Q5_FALLBACK = ['본문 주제 1', '본문 주제 2', '인터랙션 활동'];
const Q6_FALLBACK = ['퀴즈', '선택형 시나리오', '셀프 진단/체크리스트', '회고 질문', "Do & Don't 리스트"];

// 확정 12문항 생성. Q5/Q6는 해당 회차의 실제 콘텐츠/인터랙션으로 선택지를 채우고,
// 비어 있으면 fallback을 노출한다.
export function buildPeriodicSurveyQuestions(opts?: {
  contentLabels?: string[];
  interactionLabels?: string[];
}): PeriodicSurveyQuestion[] {
  const q5options = (opts?.contentLabels ?? []).filter(Boolean);
  const q6options = (opts?.interactionLabels ?? []).filter(Boolean);
  return [
    { type: 'single', area: '전반적 만족도', required: true, question: '이번 뉴스레터에 전반적으로 얼마나 만족하셨나요?', options: ['매우 만족', '만족', '보통', '불만족', '매우 불만족'] },
    { type: 'single', area: '전반적 만족도', required: true, question: '뉴스레터 콘텐츠의 수준(깊이와 난이도)은 어느 정도였나요?', options: ['너무 어려웠다', '약간 어려웠다', '적절했다', '약간 쉬웠다', '너무 쉬웠다'] },
    { type: 'single', area: '전반적 만족도', required: true, question: '이번 시즌 뉴스레터의 발송 횟수(빈도)는 적절했나요?', options: ['너무 많았다', '약간 많았다', '적절했다', '약간 적었다', '더 자주 받고 싶다'] },
    { type: 'single', area: '콘텐츠 유용성', required: true, question: '이번 뉴스레터의 내용이 업무/리더십 역량 향상에 얼마나 도움이 됐나요?', options: ['매우 도움됨', '도움됨', '보통', '도움 안 됨', '전혀 도움 안 됨'] },
    { type: 'multiple', area: '콘텐츠 유용성', required: true, question: '이번 뉴스레터에서 가장 도움이 되거나 인상 깊었던 내용이나 글을 알려주세요. (1~3개)', options: q5options.length > 0 ? q5options : Q5_FALLBACK, minSelect: 1, maxSelect: 3 },
    { type: 'multiple', area: '인터랙션 요소', required: true, question: '뉴스레터 내 활동 요소(Interaction Part) 중 어떤 유형이 가장 좋았나요? (1~3개)', options: q6options.length > 0 ? q6options : Q6_FALLBACK, minSelect: 1, maxSelect: 3 },
    { type: 'single', area: '가독성/디자인', required: true, question: '뉴스레터의 레이아웃과 디자인이 읽기 편하고 시각적으로 만족스러웠나요?', options: ['매우 만족', '만족', '보통', '불만족', '매우 불만족'] },
    { type: 'single', area: '가독성/디자인', required: true, question: '뉴스레터의 분량과 구성(목차 흐름, 섹션 구분 등)은 적절했나요?', options: ['매우 적절', '적절', '보통', '부적절', '매우 부적절'] },
    { type: 'single', area: '트렌드 적합성', required: true, question: '다루어진 주제와 정보가 현재 HR/리더십 트렌드를 잘 반영하고 있었나요?', options: ['매우 그렇다', '그렇다', '보통', '아니다', '전혀 아니다'] },
    { type: 'short', area: '트렌드 적합성', required: false, question: '다음 시즌에 다루어 주었으면 하는 주제나 트렌드가 있다면 알려주세요.' },
    { type: 'single', area: '추천 의향', required: true, question: '이 뉴스레터를 동료나 지인에게 추천할 의향이 있으신가요?', options: ['매우 그렇다', '그렇다', '보통', '아니다', '전혀 아니다'] },
    { type: 'long', area: '개선 의견', required: false, question: '뉴스레터를 더 좋게 만들기 위해 개선했으면 하는 점이 있다면 자유롭게 적어주세요.' },
  ];
}
