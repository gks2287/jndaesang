'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  PERIODIC_SURVEY_TITLE,
  PERIODIC_SURVEY_DESCRIPTION,
  INTERACTION_SURVEY_LABELS,
  buildPeriodicSurveyQuestions,
  type PeriodicSurveyQuestion,
} from '@/lib/periodicSurvey';

// ── 인라인 편집 가능한 텍스트 컴포넌트 ──
function EditableText({ value, field, onEdit, className, tag: Tag = 'span', multiline = false, style }: {
  value: string;
  field: string;
  onEdit?: (field: string, value: string) => void;
  className?: string;
  tag?: 'span' | 'p' | 'h1' | 'div';
  multiline?: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (!ref.current || !onEdit) return;
    const text = ref.current.innerText.trim();
    if (text !== value) onEdit(field, text);
  }, [field, value, onEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === 'Escape') {
      if (ref.current) ref.current.innerText = value;
      ref.current?.blur();
    }
  }, [multiline, value]);

  useEffect(() => {
    if (ref.current && !editing) {
      ref.current.innerText = value;
    }
  }, [value, editing]);

  if (!onEdit) {
    return <Tag className={className} style={style}>{value}</Tag>;
  }

  return (
    <Tag
      ref={ref as React.RefObject<HTMLElement & HTMLSpanElement & HTMLParagraphElement & HTMLHeadingElement & HTMLDivElement>}
      className={`${className ?? ''} cursor-text outline-none rounded transition-colors hover:bg-[#55A4DA]/5 focus:bg-[#55A4DA]/10 focus:ring-1 focus:ring-[#55A4DA]/30`}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => setEditing(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={style}
    />
  );
}

// 스크롤형 본문 3부작 단계 라벨 (서론·본론·결론) — 흐름이 한눈에 읽히도록 동사형 단계로 노출
const STORY_STAGES = ['짚어보기', '파고들기', '행동하기'] as const;

// ── 생성된 뉴스레터 데이터 타입 (configure 페이지와 공유) ──
export type GeneratedNewsletterSection = {
  contentTitle: string;
  contentId: string;
  subtitle?: string;      // 제목 아래 부제
  summary?: string;       // (구버전 호환) 핵심 요약
  intro?: string;         // 공감 도입 단락
  body?: string[];        // 본문 단락들
  quote?: string;         // 강조 인용구
  dataStat?: { value: string; description: string }; // 데이터 박스
  caseStudy?: string;     // 실제 사례 박스
  mainBody?: string;      // (구버전 호환)
  examples?: string;      // (구버전 호환)
  keyTakeaway?: string;   // 핵심 한 줄 (서론 섹션 등에서는 생략 가능)
  actionPlan?: string[];  // 실천 가능한 행동 2~3개
  thumbnail?: string;     // 콘텐츠 썸네일 (콘텐츠 풀 우선)
  thumbnailUrl?: string;  // 썸네일 폴백 URL (서버 생성)
  emoji: string;
  youtubeUrl?: string;
};

export type GeneratedInteraction = {
  type: 'quiz' | 'scenario' | 'selfcheck' | 'reflection' | 'dodont';
  title: string;
  content: Record<string, unknown>;
};

export type AlwaysSurveyQuestion = {
  type: 'rating';
  options: string[];
  followUp: string;
  followUpOptions: string[];
  openQuestion: string;
};

export type { PeriodicSurveyQuestion } from '@/lib/periodicSurvey';

export type GeneratedSurvey = {
  type: 'always' | 'periodic';
  title?: string;        // 정기 설문 제목
  description?: string;  // 정기 설문 안내문
  questions: (AlwaysSurveyQuestion | PeriodicSurveyQuestion)[];
};

export type GeneratedNewsletter = {
  subject: string;
  headline: string;
  intro: string;
  sections: GeneratedNewsletterSection[];
  interactions: GeneratedInteraction[];
  surveys: GeneratedSurvey[];
  closing: string;
};

export type InteractionTypeKey = 'quiz' | 'scenario' | 'selfcheck' | 'reflection' | 'dodont';
export type SurveyTypeKey = 'always' | 'periodic';

// ── 제작완료 후 영구 저장되는 회차별 생성 본문 ──
export interface SavedNewsletterRound {
  vol: number;
  dateLabel: string;
  leadershipLabel: string;
  generated: GeneratedNewsletter;
  interactions: InteractionTypeKey[];
  surveys: SurveyTypeKey[];
}

export interface SavedNewsletterContent {
  rounds: SavedNewsletterRound[];
}

// 헤드라인 줄바꿈: 쉼표 뒤에서 줄바꿈하되, 양쪽 절이 모두 5글자 초과일 때만 (whitespace-pre-line과 함께 사용)
export function formatHeadline(text: string): string {
  const parts = text.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return text;
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const prev = parts[i - 1].replace(/\s/g, '');
    const cur = parts[i].replace(/\s/g, '');
    const breakHere = prev.length > 5 && cur.length > 5;
    out += ',' + (breakHere ? '\n' : ' ') + parts[i];
  }
  return out;
}

// 공통 섹션 헤더 (콘텐츠/인터랙션/만족도) — 에디토리얼 스타일:
// 브랜드 사각 마커 + 트래킹 대문자 라벨 + 가로 헤어라인
export function renderSectionHeader(_emoji: string, title: string, eyebrow?: string) {
  return (
    <div className="mt-14 mb-7">
      {eyebrow && (
        <div className="flex items-center gap-2.5 mb-2.5">
          <span className="w-6 h-[2px] bg-[#55A4DA]" />
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#55A4DA] leading-none">{eyebrow}</p>
        </div>
      )}
      <h2 className="text-2xl font-bold text-[#1A1A1A] leading-tight">{title}</h2>
    </div>
  );
}

// 인터랙션 템플릿: 선택된 타입을 AI 생성과 무관하게 예시 UI로 즉시 렌더
export function renderInteractionTemplates(types: InteractionTypeKey[]) {
  if (types.length === 0) return null;
  return (
    <>
      {renderSectionHeader('🎯', '함께 생각해봐요', 'Interaction')}
      <div className="space-y-5">
        {types.map(type => {
          if (type === 'quiz') {
            return (
              <div key={type} className="rounded-2xl p-6 space-y-3 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
                <div className="flex items-center gap-2"><span className="text-lg">🧠</span><p className="text-base font-semibold text-[#2C2C2C]">학습 내용 확인 퀴즈</p></div>
                <p className="text-base text-[#6B7280] leading-[1.8]">이번 회차의 핵심 내용을 가장 잘 설명한 것은 무엇일까요?</p>
                <div className="space-y-2">
                  {['선택지 A', '선택지 B', '선택지 C'].map((opt, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-4 py-3 bg-white rounded-xl border border-[#E1EFFB] text-base text-[#2C2C2C]">
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />{opt}
                    </div>
                  ))}
                </div>
                <button className="text-sm font-bold text-[#55A4DA] hover:underline">정답 확인하기 →</button>
              </div>
            );
          }
          if (type === 'scenario') {
            return (
              <div key={type} className="rounded-2xl p-6 space-y-3 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
                <div className="flex items-center gap-2"><span className="text-lg">🎭</span><p className="text-base font-semibold text-[#2C2C2C]">상황 시나리오</p></div>
                <p className="text-base text-[#6B7280] leading-[1.8]">다음과 같은 상황이 주어졌을 때, 당신이라면 어떻게 하시겠어요?</p>
                <div className="space-y-2">
                  {['A. 첫 번째 선택', 'B. 두 번째 선택', 'C. 세 번째 선택'].map((opt, i) => (
                    <button key={i} className="w-full text-left px-4 py-3 bg-white rounded-xl border border-[#E1EFFB] text-base text-[#2C2C2C] hover:border-[#55A4DA] transition-colors">{opt}</button>
                  ))}
                </div>
              </div>
            );
          }
          if (type === 'selfcheck') {
            return (
              <div key={type} className="rounded-2xl p-6 space-y-3 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
                <div className="flex items-center gap-2"><span className="text-lg">✅</span><p className="text-base font-semibold text-[#2C2C2C]">셀프 진단 체크리스트</p></div>
                <div className="space-y-2.5">
                  {['나는 팀원의 의견을 충분히 듣는가?', '피드백을 구체적으로 전달하는가?', '약속한 사항을 끝까지 지키는가?'].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded border-2 border-[#55A4DA]/40 flex-shrink-0 mt-1 bg-white" />
                      <p className="text-base text-[#2C2C2C]">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (type === 'reflection') {
            return (
              <div key={type} className="rounded-2xl p-6 space-y-3 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
                <div className="flex items-center gap-2"><span className="text-lg">💭</span><p className="text-base font-semibold text-[#2C2C2C]">회고 질문</p></div>
                <div className="space-y-2.5">
                  {['이번 주 가장 잘한 리더십 행동은 무엇인가요?', '다음 주 바꾸고 싶은 행동 하나를 적어보세요.'].map((q, i) => (
                    <div key={i} className="bg-white rounded-xl px-4 py-3.5 border border-[#E1EFFB]">
                      <p className="text-xs font-bold text-[#55A4DA] mb-1">Q{i + 1}</p>
                      <p className="text-base text-[#2C2C2C]">{q}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          // dodont
          return (
            <div key={type} className="rounded-2xl p-6 space-y-3 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
              <div className="flex items-center gap-2"><span className="text-lg">📋</span><p className="text-base font-semibold text-[#2C2C2C]">Do &amp; Don&apos;t</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-4 border border-[#E1EFFB]">
                  <p className="text-sm font-bold text-emerald-600 mb-2">Do</p>
                  <ul className="space-y-2">
                    {['경청하고 질문하기', '구체적으로 칭찬하기'].map((item, i) => (
                      <li key={i} className="text-sm text-[#2C2C2C] flex items-start gap-1.5"><span className="text-emerald-500 flex-shrink-0 mt-0.5">•</span>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white rounded-xl p-4 border border-[#E1EFFB]">
                  <p className="text-sm font-bold text-red-500 mb-2">Don&apos;t</p>
                  <ul className="space-y-2">
                    {['말 끊고 단정하기', '감정적으로 반응하기'].map((item, i) => (
                      <li key={i} className="text-sm text-[#2C2C2C] flex items-start gap-1.5"><span className="text-red-400 flex-shrink-0 mt-0.5">•</span>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// 만족도 템플릿: 선택된 타입을 AI 생성과 무관하게 예시 UI로 즉시 렌더
// 복수 선택(multiple) 미리보기 — minSelect~maxSelect 제한 적용. 초과 선택 차단 + 안내 문구 표시.
function MultiSelectPreview({ options, minSelect, maxSelect }: { options: string[]; minSelect: number; maxSelect: number }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [overflow, setOverflow] = useState(false);
  const toggle = (j: number) => {
    setSelected(prev => {
      if (prev.includes(j)) { setOverflow(false); return prev.filter(x => x !== j); }
      if (prev.length >= maxSelect) { setOverflow(true); return prev; }
      setOverflow(false);
      return [...prev, j];
    });
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt, j) => {
          const on = selected.includes(j);
          return (
            <button
              key={j}
              type="button"
              onClick={() => toggle(j)}
              aria-pressed={on}
              className={`px-3.5 py-1.5 text-sm rounded-lg border transition-colors ${on ? 'bg-[#55A4DA] text-white border-[#55A4DA]' : 'bg-white text-[#2C2C2C] border-[#E1EFFB] hover:border-[#55A4DA]'}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      <p className={`text-xs mt-1.5 ${overflow ? 'text-red-500' : 'text-gray-400'}`}>
        {overflow ? `최대 ${maxSelect}개까지만 선택할 수 있어요.` : `최소 ${minSelect}개, 최대 ${maxSelect}개까지 선택할 수 있어요.`}
      </p>
    </div>
  );
}

// 정기 만족도 조사 카드 — 즉시 미리보기/AI 생성 결과 양쪽에서 공용으로 사용.
// 제목·안내문 + 영역별 그룹 + 유형 텍스트 뱃지 + 필수(*) 표시.
function renderPeriodicSurveyCard(questions: PeriodicSurveyQuestion[], key?: string) {
  let lastArea = '';
  return (
    <div key={key} className="rounded-2xl p-6 space-y-4 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
      <div>
        <p className="text-base font-semibold text-[#2C2C2C]">{PERIODIC_SURVEY_TITLE}</p>
        <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">{PERIODIC_SURVEY_DESCRIPTION}</p>
      </div>
      {questions.map((q, i) => {
        const showArea = q.area !== lastArea;
        lastArea = q.area;
        return (
          <div key={i} className={showArea ? 'pt-2' : ''}>
            {showArea && <p className="text-xs font-bold text-[#55A4DA] mb-2">{q.area}</p>}
            <div className="flex items-start gap-1.5 mb-2">
              {/* 문항 유형(단일/복수) 라벨은 화면에 노출하지 않음 (데이터 구조상 q.type은 유지) */}
              <p className="text-sm font-semibold text-[#2C2C2C]">
                Q{i + 1}. {q.question}
                {q.required
                  ? <span className="text-red-500 ml-0.5">*</span>
                  : <span className="text-gray-400 text-xs font-normal ml-1">(선택)</span>}
              </p>
            </div>
            {q.type === 'single' && (
              <div className="space-y-2">
                {q.options.map((opt, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-[#55A4DA]/40 flex-shrink-0 bg-white" />
                    <p className="text-sm text-[#2C2C2C]">{opt}</p>
                  </div>
                ))}
              </div>
            )}
            {q.type === 'multiple' && (
              <MultiSelectPreview options={q.options} minSelect={q.minSelect} maxSelect={q.maxSelect} />
            )}
            {q.type === 'short' && (
              <div className="w-full h-10 bg-white rounded-xl border border-[#E1EFFB] px-3 py-2 text-sm text-gray-400 flex items-center">답변을 입력해 주세요...</div>
            )}
            {q.type === 'long' && (
              <div className="w-full h-16 bg-white rounded-xl border border-[#E1EFFB] px-3 py-2 text-sm text-gray-400 flex items-start">답변을 입력해 주세요...</div>
            )}
          </div>
        );
      })}
      <button className="w-full py-3 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-sm font-semibold rounded-xl transition-colors">제출하기</button>
    </div>
  );
}

export function renderSurveyTemplates(
  types: SurveyTypeKey[],
  opts?: { contentLabels?: string[]; interactionLabels?: string[] },
) {
  if (types.length === 0) return null;
  return (
    <>
      {renderSectionHeader('💬', '의견 들려주세요', 'Feedback')}
      <div className="space-y-5">
        {types.map(type => {
          if (type === 'always') {
            return (
              <div key={type} className="rounded-2xl p-6 space-y-4 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
                <p className="text-base font-semibold text-[#2C2C2C]">이번 호 어떠셨나요?</p>
                <div className="flex gap-2">
                  {['아쉬워요', '괜찮아요', '최고예요'].map((opt, i) => (
                    <button key={i} className="flex-1 flex flex-col items-center gap-1 py-3 bg-white rounded-xl border border-[#E1EFFB] hover:border-[#55A4DA] transition-colors">
                      <span className="text-2xl">{['😐', '😊', '🤩'][i]}</span>
                      <span className="text-xs text-[#6B7280]">{opt}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#2C2C2C] mb-2">도움이 된 콘텐츠가 있었나요?</p>
                  <div className="space-y-2">
                    {['본문 콘텐츠', '인터랙션', '특별히 없음'].map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border-2 border-[#55A4DA]/40 flex-shrink-0 bg-white" />
                        <p className="text-sm text-[#2C2C2C]">{opt}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#2C2C2C] mb-1.5">한 줄 의견을 남겨주세요</p>
                  <div className="w-full h-16 bg-white rounded-xl border border-[#E1EFFB] px-3 py-2 text-sm text-gray-400 flex items-start">답변을 입력해 주세요...</div>
                </div>
              </div>
            );
          }
          // periodic — 확정 12문항(동적 선택지 포함)
          return renderPeriodicSurveyCard(buildPeriodicSurveyQuestions(opts), type);
        })}
      </div>
    </>
  );
}

export type InlineEditCallback = (field: string, value: string) => void;

export interface FullBodyOpts {
  vol: number;
  dateLabel: string;
  leadershipLabel: string;
  firstThumbnail?: string;
  templateInteractions?: InteractionTypeKey[];
  templateSurveys?: SurveyTypeKey[];
  /** 정기 설문 Q5(콘텐츠) 동적 선택지 — 회차의 실제 콘텐츠 제목 */
  templateSurveyContentLabels?: string[];
  /** 정기 설문 Q6(인터랙션) 동적 선택지 — 회차의 실제 활동 요소 라벨 */
  templateSurveyInteractionLabels?: string[];
  /** 인라인 편집 콜백 — 전달 시 텍스트를 직접 클릭하여 수정 가능 */
  onInlineEdit?: InlineEditCallback;
}

// 썸네일 — 오류 없이 항상 표시. 후보 URL을 순서대로 시도(onError 시 다음 후보) →
// 모두 실패하면 파란 그라데이션 배경 + 주제 텍스트로 대체 (절대 빈 박스 없음).
const THUMB_FALLBACK_URL = 'https://picsum.photos/seed/business/800/450';
function Thumbnail({ sources, label, aspectClass, wrapClass }: {
  sources: (string | undefined)[];  // 우선순위 순 후보 URL (빈 값 자동 제외)
  label?: string;
  aspectClass: string;   // 'aspect-video' (전체 본문) 또는 'h-40' (요약본)
  wrapClass?: string;
}) {
  const candidates = [
    ...sources.filter((u): u is string => !!u && u.trim().length > 0),
    THUMB_FALLBACK_URL,
  ];
  const [idx, setIdx] = useState(0);
  const base = `${aspectClass} w-full rounded-2xl overflow-hidden border border-gray-100 ${wrapClass ?? ''}`;
  // 모든 후보 실패 → 그라데이션 + 주제 텍스트
  if (idx >= candidates.length) {
    return (
      <div className={`${base} flex items-center justify-center`} style={{ background: 'linear-gradient(135deg, #55A4DA 0%, #2D6E9E 100%)' }}>
        <span className="text-white font-bold text-sm tracking-wide px-4 text-center break-keep line-clamp-2">{label || '리더십 인사이트'}</span>
      </div>
    );
  }
  return (
    <div className={base}>
      <img
        src={candidates[idx]}
        alt=""
        className="w-full h-full object-cover"
        onError={() => setIdx(i => i + 1)}
      />
    </div>
  );
}

// 오버레이 히어로 — Thumbnail과 동일한 후보 폴백(등록→웹서칭/주제URL→그라데이션) 위에
// 다크 그라데이션을 깔고 그 위로 eyebrow·헤드라인을 얹는다. 이미지가 없어도 키컬러 그라데이션으로 안전.
function HeroOverlay({ sources, label, children }: {
  sources: (string | undefined)[];
  label?: string;
  children: React.ReactNode;
}) {
  const candidates = [
    ...sources.filter((u): u is string => !!u && u.trim().length > 0),
    THUMB_FALLBACK_URL,
  ];
  const [idx, setIdx] = useState(0);
  const failedAll = idx >= candidates.length;
  return (
    <div className="relative w-full aspect-[16/10] overflow-hidden bg-[#1F3349]">
      {failedAll ? (
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #55A4DA 0%, #2D6E9E 100%)' }} aria-label={label} />
      ) : (
        <img src={candidates[idx]} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setIdx(i => i + 1)} />
      )}
      {/* 가독성을 위한 다크 그라데이션 */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(15,32,49,0.88) 0%, rgba(15,32,49,0.45) 42%, rgba(15,32,49,0.08) 100%)' }} />
      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">{children}</div>
    </div>
  );
}

// 전체 본문 렌더 (실시간 미리보기·미리보기 모달·제작완료 미리보기 공통)
export function renderGeneratedFullBody(generated: GeneratedNewsletter, opts: FullBodyOpts) {
  const { vol, dateLabel, leadershipLabel, templateInteractions, templateSurveys, templateSurveyContentLabels, templateSurveyInteractionLabels, onInlineEdit } = opts;
  const useTemplateInteractions = templateInteractions !== undefined;
  const useTemplateSurveys = templateSurveys !== undefined;
  const e = onInlineEdit; // shorthand

  // ── 목차·본문 섹션 중복 방지 ──
  // 레이아웃은 '서론·본론·결론' 3부작 전제. 데이터 이상(같은 헤드라인 섹션 중복)이 들어와도
  // 목차/본문에 두 번 나오지 않도록 헤드라인 기준으로 한 번씩만 남긴다.
  const seenTitles = new Set<string>();
  const sections = generated.sections.filter(s => {
    const key = (s.contentTitle ?? '').trim();
    if (key && seenTitles.has(key)) return false;
    if (key) seenTitles.add(key);
    return true;
  });

  // ── 이미지 중복 방지 ──
  // 뉴스레터 안에서 렌더되는 모든 사진(커버 + 본문 섹션 썸네일)이 서로 달라야 한다.
  // 커버가 섹션0의 이미지를 먼저 차지하고, 이후 섹션은 이미 쓰인 이미지면 비운다(중복보다 없는 게 낫다).
  const firstImage = (s?: GeneratedNewsletterSection) =>
    [s?.thumbnail, s?.thumbnailUrl].find((u): u is string => !!u && u.trim().length > 0) ?? '';
  const usedImages = new Set<string>();
  const coverImage = firstImage(sections[0]);
  if (coverImage) usedImages.add(coverImage);
  const sectionImage = sections.map((s, i) => {
    if (i === 0) return '';                                  // 섹션0 사진은 커버에서 노출 → 본문 인라인 중복 방지
    const img = firstImage(s);
    if (img && !usedImages.has(img)) { usedImages.add(img); return img; }
    return '';                                               // 중복이거나 후보 없음 → 이 섹션은 사진을 비움
  });

  return (
    <div className="bg-white max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-sm border border-gray-100 break-keep break-words">
      {/* ① 매스헤드 — 유틸바 + 대형 타이틀 + 원형 VOL 배지 + 블랙 더블 룰 */}
      <div className="px-6 sm:px-8 pt-6 pb-5">
        {/* 상단 유틸 바: 로고 + 온라인으로 보기 */}
        <div className="flex items-center justify-between">
          <img src="/logo-jc.png" alt="J&Company" className="h-7 object-contain" onError={ev => { const t = ev.target as HTMLImageElement; t.outerHTML = '<span class="text-base font-black tracking-tight text-[#55A4DA]">J&amp;COMPANY</span>'; }} />
          <span className="text-xs text-[#9CA3AF]">온라인으로 보기</span>
        </div>
        <div className="mt-4 h-px bg-gray-100" />
        {/* 타이틀 행: 발행물명 + 발행 정보 + VOL 배지 */}
        <div className="mt-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[#1A1A1A] leading-none break-keep">리더십 레터</h1>
            <p className="mt-3 text-sm text-[#9CA3AF]">{`// ${dateLabel}${leadershipLabel ? ` · ${leadershipLabel}` : ''}`}</p>
          </div>
          <div className="flex-shrink-0 w-16 h-16 rounded-full bg-[#55A4DA] text-white flex flex-col items-center justify-center leading-none shadow-sm">
            <span className="text-[9px] font-semibold tracking-[0.15em] opacity-80">VOL</span>
            <span className="text-xl font-black mt-1">{vol}</span>
          </div>
        </div>
      </div>
      <div className="px-6 sm:px-8">
        <div className="h-[3px] bg-[#1A1A1A]" />
        <div className="h-px bg-[#1A1A1A] mt-[3px]" />
      </div>

      {/* ② 오버레이 히어로 — 첫 섹션 썸네일 위에 eyebrow + 헤드라인 */}
      <HeroOverlay sources={[coverImage]} label={sections[0]?.contentTitle}>
        {generated.subject && (
          <EditableText tag="p" value={generated.subject} field="subject" onEdit={e} className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/80 mb-2" />
        )}
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full mb-3">📌 리더십 인사이트</span>
        <EditableText tag="h1" value={formatHeadline(generated.headline)} field="headline" onEdit={e} className="text-2xl sm:text-3xl font-black text-white leading-snug whitespace-pre-line break-keep drop-shadow-sm" />
      </HeroOverlay>

      {/* 본문 */}
      <div className="px-6 sm:px-8 py-10">
        {/* ③ 인트로 (리드) */}
        <div className="mb-2">
          <div className="w-10 h-[3px] bg-[#55A4DA] mb-4" />
          <EditableText tag="p" value={generated.intro} field="intro" onEdit={e} className="text-[17px] text-[#374151] leading-[1.85]" multiline />
        </div>

        {/* ④ 이번 호 목차 — 단계(짚어보기/파고들기/행동하기)별 한 줄 요약 (앵커 스크롤) */}
        {sections.length > 1 && (
          <div className="mt-8 rounded-2xl border border-[#E1EFFB] overflow-hidden">
            <div className="px-5 py-2.5 bg-[#EAF4FC]">
              <p className="text-[11px] font-bold tracking-[0.15em] text-[#2E7DB5]">이번 호 목차</p>
            </div>
            <ul className="divide-y divide-[#EEF2F7]">
              {sections.map((sec, idx) => (
                <li key={`toc-${idx}`}>
                  <a href={`#nl-sec-${idx}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F6FAFE] transition-colors group">
                    <span className="flex-shrink-0 w-[4.75rem] flex items-baseline gap-1.5">
                      <span className="text-[10px] font-black text-[#9CA3AF] tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
                      {STORY_STAGES[idx] && <span className="text-[12px] font-bold text-[#55A4DA] whitespace-nowrap">{STORY_STAGES[idx]}</span>}
                    </span>
                    <span className="text-sm text-[#374151] leading-snug flex-1 min-w-0 group-hover:text-[#55A4DA] transition-colors">{(sec.contentTitle ?? '').replace(/\n/g, ' ')}</span>
                    <span className="text-[#9CA3AF] group-hover:text-[#55A4DA] transition-colors flex-shrink-0">→</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ⑤ 콘텐츠 */}
        {renderSectionHeader('📖', '오늘의 이야기', "Today's Story")}
        <div>
          {sections.map((sec, idx) => {
            // 본문 단락: body 우선, 없으면 구버전 필드로 폴백
            const bodyParas = (sec.body && sec.body.length > 0)
              ? sec.body
              : [sec.mainBody, sec.examples].filter((p): p is string => !!p && p.trim().length > 0);
            const paras = bodyParas.length > 0 ? bodyParas : (sec.summary ? [sec.summary] : []);
            // 역할 결정: 첫 섹션=서론(임팩트형), 마지막=결론(실천 카드형), 그 외=본론(기사형)
            const role: 'intro' | 'body' | 'action' =
              idx === 0 ? 'intro' : (idx === sections.length - 1 ? 'action' : 'body');

            // 단계 마커(진행 바 + 라벨) — 세 템플릿 공통 throughline (요청대로 유지)
            const eyebrow = (
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex items-center gap-1">
                  {sections.map((_, i) => (
                    <span key={i} className={`h-[3px] rounded-full transition-all ${i === idx ? 'w-6 bg-[#55A4DA]' : 'w-2.5 bg-[#CFE3F3]'}`} />
                  ))}
                </div>
                <p className="text-[11px] font-bold text-[#55A4DA] leading-none">
                  <span className="tabular-nums tracking-[0.1em]">{String(idx + 1).padStart(2, '0')}/{String(sections.length).padStart(2, '0')}</span>
                  {STORY_STAGES[idx] && <span className="ml-1.5">· {STORY_STAGES[idx]}</span>}
                </p>
              </div>
            );

            const divider = idx > 0 && (
              <div className="my-14 flex items-center gap-4">
                <span className="h-px flex-1 bg-gray-100" />
                <span className="text-gray-300 text-xs tracking-[0.5em]">• • •</span>
                <span className="h-px flex-1 bg-gray-100" />
              </div>
            );

            // ───────── 서론: '임팩트형' — 거대 숫자/한 문장이 압도, 박스·인용·사례 없음 ─────────
            if (role === 'intro') {
              return (
                <div key={sec.contentId} id={`nl-sec-${idx}`} className="scroll-mt-4">
                  {divider}
                  {eyebrow}
                  <EditableText tag="p" value={sec.contentTitle} field={`section.${idx}.contentTitle`} onEdit={e} className="text-3xl sm:text-[2.5rem] font-black text-[#1A1A1A] leading-[1.15] break-keep" />
                  {sec.subtitle && <EditableText tag="p" value={sec.subtitle} field={`section.${idx}.subtitle`} onEdit={e} className="text-base text-[#9CA3AF] mt-3 leading-relaxed" />}
                  {sec.intro && <EditableText tag="p" value={sec.intro} field={`section.${idx}.intro`} onEdit={e} className="text-[17px] text-[#374151] leading-[1.85] mt-6" multiline />}
                  {/* 공감·문제 인식용 짧은 문단들 (짧게 끊어 읽기 리듬 유지) */}
                  {paras.map((p, i) => (
                    <EditableText key={i} tag="p" value={p} field={`section.${idx}.body.${i}`} onEdit={e} className="text-base text-[#4B5563] leading-[1.85] mt-4" multiline />
                  ))}
                  {/* 핵심 숫자 강조 + 한 줄 임팩트를 하나의 중앙 블록으로 묶어 여백 균형 (휑한 빈 공간 방지) */}
                  {((sec.dataStat && (sec.dataStat.value || sec.dataStat.description)) || (sec.keyTakeaway && sec.keyTakeaway.trim())) && (
                    <div className="mt-7 rounded-2xl bg-[#F3F8FC] px-6 py-7 text-center">
                      {sec.dataStat?.value && <EditableText tag="p" value={sec.dataStat.value} field={`section.${idx}.dataStat.value`} onEdit={e} className="text-3xl sm:text-4xl font-black text-[#55A4DA] leading-tight whitespace-pre-line break-keep" />}
                      {sec.dataStat?.description && <EditableText tag="p" value={sec.dataStat.description} field={`section.${idx}.dataStat.description`} onEdit={e} className="text-sm text-[#6B7280] leading-[1.7] max-w-md mx-auto mt-2.5" multiline />}
                      {sec.keyTakeaway && sec.keyTakeaway.trim() && (
                        <>
                          {sec.dataStat?.value && <div className="mx-auto w-10 h-px bg-[#CFE3F3] my-5" />}
                          <EditableText tag="p" value={sec.keyTakeaway} field={`section.${idx}.keyTakeaway`} onEdit={e} className="text-xl font-black text-[#1A1A1A] leading-snug break-keep" />
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // ───────── 결론: '실천 카드형' — 큰 체크리스트 카드가 주인공, 통계·사례·인용 없음 ─────────
            if (role === 'action') {
              return (
                <div key={sec.contentId} id={`nl-sec-${idx}`} className="scroll-mt-4">
                  {divider}
                  {eyebrow}
                  <EditableText tag="p" value={sec.contentTitle} field={`section.${idx}.contentTitle`} onEdit={e} className="text-2xl sm:text-3xl font-black text-[#1A1A1A] leading-tight break-keep" />
                  {/* 짧은 수렴 문장 */}
                  {sec.intro && <EditableText tag="p" value={sec.intro} field={`section.${idx}.intro`} onEdit={e} className="text-base text-[#4B5563] leading-[1.8] mt-3" multiline />}
                  {paras[0] && <EditableText tag="p" value={paras[0]} field={`section.${idx}.body.0`} onEdit={e} className="text-base text-[#4B5563] leading-[1.8] mt-2" multiline />}
                  {/* 큰 액션 카드 — 번호 매긴 체크 항목 */}
                  {sec.actionPlan && sec.actionPlan.length > 0 && (
                    <div className="mt-7 rounded-3xl border-2 border-[#55A4DA] px-6 py-7" style={{ backgroundColor: '#EAF4FC' }}>
                      <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#55A4DA] mb-1.5">Action Plan</p>
                      <p className="text-lg font-black text-[#1A1A1A] mb-5">내일, 이것부터 해보세요</p>
                      <ul className="space-y-3.5">
                        {sec.actionPlan.map((act, i) => (
                          <li key={i} className="flex items-start gap-3.5 rounded-2xl bg-white px-4 py-3.5 border border-[#CFE3F3]">
                            <span className="flex-shrink-0 w-6 h-6 rounded-md border-2 border-[#55A4DA] bg-white mt-0.5 flex items-center justify-center text-[11px] font-black text-[#55A4DA] tabular-nums">{i + 1}</span>
                            <EditableText tag="p" value={act} field={`section.${idx}.actionPlan.${i}`} onEdit={e} className="text-base text-[#374151] leading-[1.7] font-medium" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* 강하게 끝내는 한 줄 */}
                  {sec.keyTakeaway && sec.keyTakeaway.trim() && (
                    <EditableText tag="p" value={sec.keyTakeaway} field={`section.${idx}.keyTakeaway`} onEdit={e} className="text-xl font-black text-[#1A1A1A] leading-snug break-keep text-center mt-8" />
                  )}
                </div>
              );
            }

            // ───────── 본론: '심층 기사형' — 글·인용·통계 카드·사례가 길게 흐름 ─────────
            return (
              <div key={sec.contentId} id={`nl-sec-${idx}`} className="scroll-mt-4">
                {divider}
                {eyebrow}
                <EditableText tag="p" value={sec.contentTitle} field={`section.${idx}.contentTitle`} onEdit={e} className="text-2xl sm:text-3xl font-black text-[#1A1A1A] leading-tight break-keep" />
                {sec.subtitle && <EditableText tag="p" value={sec.subtitle} field={`section.${idx}.subtitle`} onEdit={e} className="text-base text-[#9CA3AF] mt-2 leading-relaxed" />}
                {/* 중복 방지된 이미지가 있을 때만 표시 (없으면 사진 없이 진행) */}
                {sectionImage[idx] && <Thumbnail sources={[sectionImage[idx]]} label={sec.contentTitle} aspectClass="aspect-video" wrapClass="my-5" />}
                {sec.intro && <EditableText tag="p" value={sec.intro} field={`section.${idx}.intro`} onEdit={e} className="text-base text-[#4B5563] leading-[1.8] mb-4" multiline />}
                {paras[0] && <EditableText tag="p" value={paras[0]} field={`section.${idx}.body.0`} onEdit={e} className="text-base text-[#4B5563] leading-[1.8] mb-4" multiline />}
                {sec.quote && (
                  <blockquote className="my-7 border-l-[3px] border-[#55A4DA] pl-5">
                    <span className="block text-3xl font-black text-[#55A4DA]/30 leading-none mb-1">&ldquo;</span>
                    <EditableText tag="p" value={sec.quote} field={`section.${idx}.quote`} onEdit={e} className="text-xl italic font-medium text-[#1F2937] leading-relaxed whitespace-pre-line break-keep" />
                  </blockquote>
                )}
                {paras[1] && <EditableText tag="p" value={paras[1]} field={`section.${idx}.body.1`} onEdit={e} className="text-base text-[#4B5563] leading-[1.8] mb-4" multiline />}
                {sec.dataStat && (sec.dataStat.value || sec.dataStat.description) && (
                  <div className="my-7 rounded-2xl overflow-hidden">
                    <div className="px-6 pt-5 pb-5 bg-[#55A4DA]">
                      <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/75 mb-1.5">By the Numbers</p>
                      <EditableText tag="p" value={sec.dataStat.value} field={`section.${idx}.dataStat.value`} onEdit={e} className="text-4xl font-black text-white leading-none whitespace-pre-line break-keep" />
                    </div>
                    <div className="px-6 py-5 bg-[#EAF4FC]">
                      <EditableText tag="p" value={sec.dataStat.description} field={`section.${idx}.dataStat.description`} onEdit={e} className="text-base text-[#4B5563] leading-[1.7]" multiline />
                    </div>
                  </div>
                )}
                {paras[2] && <EditableText tag="p" value={paras[2]} field={`section.${idx}.body.2`} onEdit={e} className="text-base text-[#4B5563] leading-[1.8] mb-4" multiline />}
                {sec.caseStudy && (
                  <div className="my-6 rounded-2xl px-6 py-5" style={{ backgroundColor: '#F7F8FA' }}>
                    <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mb-2.5">Case Study</p>
                    <EditableText tag="p" value={sec.caseStudy} field={`section.${idx}.caseStudy`} onEdit={e} className="text-base text-[#4B5563] leading-[1.8]" multiline />
                  </div>
                )}
                {paras.slice(3).map((p, i) => (
                  <EditableText key={i} tag="p" value={p} field={`section.${idx}.body.${i + 3}`} onEdit={e} className="text-base text-[#4B5563] leading-[1.8] mb-4" multiline />
                ))}
                {sec.keyTakeaway && sec.keyTakeaway.trim() && (
                  <div className="mt-6 rounded-r-2xl px-6 py-5 border-l-[4px] border-[#55A4DA]" style={{ backgroundColor: '#F3F8FC' }}>
                    <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#55A4DA] mb-2">Key Point</p>
                    <EditableText tag="p" value={sec.keyTakeaway} field={`section.${idx}.keyTakeaway`} onEdit={e} className="text-base font-bold text-[#1A1A1A] leading-[1.7]" />
                  </div>
                )}
                {sec.youtubeUrl && (
                  <div className="mt-4 aspect-video rounded-xl overflow-hidden bg-black">
                    <iframe src={sec.youtubeUrl} className="w-full h-full" allowFullScreen title={sec.contentTitle} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 인터랙션 — 실제 생성 내용이 있으면 그것을 우선 렌더, 없을 때만 예시 템플릿으로 폴백 */}
        {useTemplateInteractions && generated.interactions.length === 0 && renderInteractionTemplates(templateInteractions!)}
        {generated.interactions.length > 0 && (
          <>
            {renderSectionHeader('🎯', '함께 생각해봐요', 'Interaction')}
            <div className="space-y-5">
              {generated.interactions.map((ia, idx) => {
                if (ia.type === 'quiz') {
                  const c = ia.content as { question: string; options: string[]; answer: number };
                  return (
                    <div key={idx} className="rounded-2xl p-6 space-y-3 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
                      <div className="flex items-center gap-2"><span className="text-lg">🧠</span><p className="text-base font-semibold text-[#2C2C2C]">{ia.title}</p></div>
                      <p className="text-base text-[#6B7280] leading-[1.8]">{c.question}</p>
                      <div className="space-y-2">
                        {(c.options ?? []).map((opt, i) => (
                          <div key={i} className="flex items-center gap-2.5 px-4 py-3 bg-white rounded-xl border border-[#E1EFFB] text-base text-[#2C2C2C]">
                            <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />{opt}
                          </div>
                        ))}
                      </div>
                      <button className="text-sm font-bold text-[#55A4DA] hover:underline">정답 확인하기 →</button>
                    </div>
                  );
                }
                if (ia.type === 'scenario') {
                  const c = ia.content as { situation: string; options: { label: string; result: string }[] };
                  return (
                    <div key={idx} className="rounded-2xl p-6 space-y-3 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
                      <div className="flex items-center gap-2"><span className="text-lg">🎭</span><p className="text-base font-semibold text-[#2C2C2C]">{ia.title}</p></div>
                      <p className="text-base text-[#6B7280] leading-[1.8]">{c.situation}</p>
                      <div className="space-y-2">
                        {(c.options ?? []).map((opt, i) => (
                          <button key={i} className="w-full text-left px-4 py-3 bg-white rounded-xl border border-[#E1EFFB] text-base text-[#2C2C2C] hover:border-[#55A4DA] transition-colors">{opt.label}</button>
                        ))}
                      </div>
                    </div>
                  );
                }
                if (ia.type === 'selfcheck') {
                  const c = ia.content as { items: string[] };
                  return (
                    <div key={idx} className="rounded-2xl p-6 space-y-3 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
                      <div className="flex items-center gap-2"><span className="text-lg">✅</span><p className="text-base font-semibold text-[#2C2C2C]">{ia.title}</p></div>
                      <div className="space-y-2.5">
                        {(c.items ?? []).map((item, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <div className="w-4 h-4 rounded border-2 border-[#55A4DA]/40 flex-shrink-0 mt-1 bg-white" />
                            <p className="text-base text-[#2C2C2C]">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                if (ia.type === 'reflection') {
                  const c = ia.content as { questions: string[] };
                  return (
                    <div key={idx} className="rounded-2xl p-6 space-y-3 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
                      <div className="flex items-center gap-2"><span className="text-lg">💭</span><p className="text-base font-semibold text-[#2C2C2C]">{ia.title}</p></div>
                      <div className="space-y-2.5">
                        {(c.questions ?? []).map((q, i) => (
                          <div key={i} className="bg-white rounded-xl px-4 py-3.5 border border-[#E1EFFB]">
                            <p className="text-xs font-bold text-[#55A4DA] mb-1">Q{i + 1}</p>
                            <p className="text-base text-[#2C2C2C]">{q}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                if (ia.type === 'dodont') {
                  const c = ia.content as { do: string[]; dont: string[] };
                  return (
                    <div key={idx} className="rounded-2xl p-6 space-y-3 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
                      <div className="flex items-center gap-2"><span className="text-lg">📋</span><p className="text-base font-semibold text-[#2C2C2C]">{ia.title}</p></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl p-4 border border-[#E1EFFB]">
                          <p className="text-sm font-bold text-emerald-600 mb-2">Do</p>
                          <ul className="space-y-2">
                            {(c.do ?? []).map((item, i) => (
                              <li key={i} className="text-sm text-[#2C2C2C] flex items-start gap-1.5"><span className="text-emerald-500 flex-shrink-0 mt-0.5">•</span>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-[#E1EFFB]">
                          <p className="text-sm font-bold text-red-500 mb-2">Don&apos;t</p>
                          <ul className="space-y-2">
                            {(c.dont ?? []).map((item, i) => (
                              <li key={i} className="text-sm text-[#2C2C2C] flex items-start gap-1.5"><span className="text-red-400 flex-shrink-0 mt-0.5">•</span>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </>
        )}

        {/* 만족도 — 템플릿 override 시 선택된 타입을 즉시 렌더 */}
        {useTemplateSurveys && renderSurveyTemplates(templateSurveys!, { contentLabels: templateSurveyContentLabels, interactionLabels: templateSurveyInteractionLabels })}
        {!useTemplateSurveys && generated.surveys.length > 0 && (
          <>
            {renderSectionHeader('💬', '의견 들려주세요', 'Feedback')}
            <div className="space-y-5">
              {generated.surveys.map((survey, idx) => {
                if (survey.type === 'always') {
                  const q = survey.questions[0] as { type: 'rating'; options: string[]; followUp: string; followUpOptions: string[]; openQuestion: string };
                  return (
                    <div key={idx} className="rounded-2xl p-6 space-y-4 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
                      <p className="text-base font-semibold text-[#2C2C2C]">이번 호 어떠셨나요?</p>
                      <div className="flex gap-2">
                        {(q.options ?? []).map((opt, i) => (
                          <button key={i} className="flex-1 flex flex-col items-center gap-1 py-3 bg-white rounded-xl border border-[#E1EFFB] hover:border-[#55A4DA] transition-colors">
                            <span className="text-2xl">{['😐', '😊', '🤩'][i]}</span>
                            <span className="text-xs text-[#6B7280]">{opt}</span>
                          </button>
                        ))}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#2C2C2C] mb-2">{q.followUp}</p>
                        <div className="space-y-2">
                          {(q.followUpOptions ?? []).map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded border-2 border-[#55A4DA]/40 flex-shrink-0 bg-white" />
                              <p className="text-sm text-[#2C2C2C]">{opt}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#2C2C2C] mb-1.5">{q.openQuestion}</p>
                        <div className="w-full h-16 bg-white rounded-xl border border-[#E1EFFB] px-3 py-2 text-sm text-gray-400 flex items-start">답변을 입력해 주세요...</div>
                      </div>
                    </div>
                  );
                }
                if (survey.type === 'periodic') {
                  return renderPeriodicSurveyCard(survey.questions as PeriodicSurveyQuestion[], String(idx));
                }
                return null;
              })}
            </div>
          </>
        )}

        {/* ⑧ 클로징 — 브랜드 색면 사인오프 */}
        <div className="mt-14 pt-8 border-t border-gray-100">
          <EditableText tag="p" value={generated.closing} field="closing" onEdit={e} className="text-base text-[#6B7280] leading-[1.8] italic border-l-2 border-[#55A4DA]/30 pl-4 mb-5" multiline />
          <div className="rounded-2xl px-6 py-8 text-center text-white" style={{ background: 'linear-gradient(135deg, #55A4DA 0%, #3A8BC4 100%)' }}>
            <p className="text-lg font-bold">다음 호에서 만나요 👋</p>
            <p className="text-sm text-white/85 mt-1.5">J&Company 코칭팀 드림</p>
          </div>
        </div>
      </div>

      {/* ⑨ 푸터 — 에디토리얼 (브랜드 룰 + 로고 + 링크 + 카피라이트) */}
      <div className="px-6 sm:px-8 pt-6 pb-7 border-t border-gray-100">
        <div className="h-[3px] w-10 bg-[#55A4DA] mb-4" />
        <div className="flex items-center justify-between">
          <img src="/logo-jc.png" alt="J&Company" className="h-5 object-contain opacity-70" onError={ev => { const t = ev.target as HTMLImageElement; t.outerHTML = '<span class="text-xs font-black tracking-tight text-[#55A4DA] opacity-70">J&amp;COMPANY</span>'; }} />
          <div className="flex gap-4">
            <span className="text-xs text-[#6B7280] hover:text-[#55A4DA] cursor-pointer transition-colors">문의하기</span>
          </div>
        </div>
        <p className="text-[11px] text-[#9CA3AF] mt-3">© J&amp;Company 리더십 코칭 · VOL.{vol}</p>
      </div>
    </div>
  );
}

export interface EmailPreviewOpts {
  vol: number;
  dateLabel: string;
  onReadFull?: () => void;
  firstThumbnail?: string; // 첫 콘텐츠 썸네일 (없으면 키컬러 그라데이션)
}

// 요약본(이메일) 미리보기 — 전체 본문과 같은 톤, 더 컴팩트하게
export function renderNewsletterEmailPreview(generated: GeneratedNewsletter, opts: EmailPreviewOpts) {
  const { vol, dateLabel, onReadFull, firstThumbnail } = opts;
  // 요약본 대표 썸네일 후보(우선순위 순): 첫 섹션 등록 → 웹서칭/주제URL → 전달받은 firstThumbnail
  const heroSection = generated.sections[0];
  const heroSources = [heroSection?.thumbnail, heroSection?.thumbnailUrl, firstThumbnail];
  const ctaButtons = (
    <div className="space-y-2.5">
      {onReadFull && (
        <button onClick={onReadFull} className="w-full py-3 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-sm font-semibold rounded-xl transition-colors">
          전체 뉴스레터 읽기 →
        </button>
      )}
    </div>
  );
  return (
    <div className="bg-white max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-sm border border-gray-100 break-keep break-words">
      {/* 상단 헤더 — 흰 배경에 로고 크게 + 발행 정보 (작게) */}
      <div className="px-6 pt-8 pb-2 text-center">
        <img src="/logo-jc.png" alt="J&Company" className="h-16 object-contain mx-auto" onError={e => { const t = e.target as HTMLImageElement; t.outerHTML = '<span class="text-xl font-black text-[#55A4DA] tracking-wider">J&COMPANY</span>'; }} />
        <p className="text-[11px] text-[#9CA3AF] mt-2">Vol.{vol}{dateLabel ? ` · ${dateLabel}` : ''}</p>
      </div>
      {/* 대표 썸네일 — 요약본은 약간 낮게(h-40), 항상 표시 (오류 시 폴백) */}
      <div className="px-6 pt-4">
        <Thumbnail sources={heroSources} label={heroSection?.contentTitle} aspectClass="h-40" />
      </div>
      {/* 카테고리 라벨 + 헤드라인 + 인트로 + 상단 CTA */}
      <div className="px-6 pt-5 text-center">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#55A4DA] bg-[#EAF4FC] px-2.5 py-1 rounded-full mb-3">📌 리더십 인사이트</span>
        <h1 className="text-xl font-bold text-[#2C2C2C] leading-snug whitespace-pre-line break-keep">{formatHeadline(generated.headline)}</h1>
        <p className="text-sm text-[#6B7280] leading-[1.7] mt-3">{generated.intro}</p>
        <div className="mt-5">{ctaButtons}</div>
      </div>
      {/* 콘텐츠 미리보기 — 컴팩트 (카테고리 라벨 · 제목 · 짧은 요약 · 자세히) */}
      <div className="px-6 mt-8">
        <div className="mb-4 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-2 border-l-4 border-[#55A4DA] pl-3">
            <span className="text-base">📰</span>
            <h2 className="text-base font-semibold text-[#2C2C2C]">이번 호에서 다룰 내용</h2>
          </div>
        </div>
        <div className="space-y-3">
          {generated.sections.map(sec => (
            <div key={sec.contentId} className="rounded-xl p-4 border border-gray-100" style={{ backgroundColor: '#F9FAFB' }}>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#55A4DA] bg-[#EAF4FC] px-2 py-0.5 rounded-full mb-2">📌 리더십 인사이트</span>
              <p className="text-sm font-bold text-[#2C2C2C] leading-snug">{sec.emoji} {sec.contentTitle}</p>
              <p className="text-sm text-[#6B7280] leading-[1.6] mt-1 line-clamp-2">{sec.summary ?? sec.intro ?? sec.body?.[0] ?? sec.mainBody ?? ''}</p>
              {onReadFull && (
                <button onClick={onReadFull} className="mt-2 text-xs text-[#55A4DA] font-bold">자세히 보기 →</button>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* 푸터 — 로고 작게 + 작은 텍스트 링크만 */}
      <div className="px-6 py-5 mt-8 border-t border-gray-100 flex items-center justify-between">
        <img src="/logo-jc.png" alt="J&Company" className="h-5 object-contain opacity-70" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div className="flex gap-4">
          <span className="text-xs text-[#6B7280] hover:text-[#55A4DA] cursor-pointer transition-colors">문의하기</span>
        </div>
      </div>
    </div>
  );
}

// ── 제작완료 뉴스레터 미리보기 모달 (열람 전용) ──
export function SavedNewsletterPreviewModal({
  open,
  onClose,
  title,
  content,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  content: SavedNewsletterContent | null;
}) {
  const [roundIdx, setRoundIdx] = useState(0);
  const [tab, setTab] = useState<'full' | 'email'>('full');

  if (!open || !content || content.rounds.length === 0) return null;
  const safeIdx = Math.min(roundIdx, content.rounds.length - 1);
  const round = content.rounds[safeIdx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-gray-50 w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-gray-900">{title}</p>
            <p className="text-xs text-gray-400 mt-0.5">제작완료 뉴스레터 미리보기 (열람 전용)</p>
          </div>
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            닫기
          </button>
        </div>

        {/* 회차 탭 + 전체/이메일 탭 */}
        <div className="px-6 pt-4 bg-white border-b border-gray-100 flex-shrink-0">
          <div className="flex gap-1.5 overflow-x-auto pb-3 flex-nowrap">
            {content.rounds.map((r, idx) => (
              <button
                key={idx}
                onClick={() => setRoundIdx(idx)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${safeIdx === idx ? 'bg-[#55A4DA] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {r.vol}회차
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 pb-3">
            {(['full', 'email'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${tab === t ? 'bg-[#55A4DA] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {t === 'full' ? '전체 본문' : '요약본'}
              </button>
            ))}
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'full'
            ? renderGeneratedFullBody(round.generated, {
                vol: round.vol,
                dateLabel: round.dateLabel,
                leadershipLabel: round.leadershipLabel,
                templateInteractions: round.interactions,
                templateSurveys: round.surveys,
                templateSurveyContentLabels: round.generated.sections.map(s => s.contentTitle).filter(Boolean),
                templateSurveyInteractionLabels: round.interactions.map(k => INTERACTION_SURVEY_LABELS[k] ?? k),
              })
            : renderNewsletterEmailPreview(round.generated, {
                vol: round.vol,
                dateLabel: round.dateLabel,
                onReadFull: () => setTab('full'),
              })}
        </div>
      </div>
    </div>
  );
}
