'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

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
  keyTakeaway: string;
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

export type PeriodicSurveyQuestion =
  | { type: 'scale'; question: string; scale: number }
  | { type: 'multiple'; question: string; options: string[] }
  | { type: 'open'; question: string };

export type GeneratedSurvey = {
  type: 'always' | 'periodic';
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

// 공통 섹션 헤더 (콘텐츠/인터랙션/만족도) — 상단 구분선 + 좌측 파란 막대 + 이모지 + 제목
export function renderSectionHeader(emoji: string, title: string) {
  return (
    <div className="mt-12 mb-6 pt-8 border-t border-gray-100">
      <div className="flex items-center gap-2.5 border-l-4 border-[#2B9EE8] pl-3">
        <span className="text-xl">{emoji}</span>
        <h2 className="text-lg font-semibold text-[#2C2C2C]">{title}</h2>
      </div>
    </div>
  );
}

// 인터랙션 템플릿: 선택된 타입을 AI 생성과 무관하게 예시 UI로 즉시 렌더
export function renderInteractionTemplates(types: InteractionTypeKey[]) {
  if (types.length === 0) return null;
  return (
    <>
      {renderSectionHeader('🎯', '함께 생각해봐요')}
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
                <button className="text-sm font-bold text-[#2B9EE8] hover:underline">정답 확인하기 →</button>
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
                    <button key={i} className="w-full text-left px-4 py-3 bg-white rounded-xl border border-[#E1EFFB] text-base text-[#2C2C2C] hover:border-[#2B9EE8] transition-colors">{opt}</button>
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
                      <div className="w-4 h-4 rounded border-2 border-[#2B9EE8]/40 flex-shrink-0 mt-1 bg-white" />
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
                      <p className="text-xs font-bold text-[#2B9EE8] mb-1">Q{i + 1}</p>
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
export function renderSurveyTemplates(types: SurveyTypeKey[]) {
  if (types.length === 0) return null;
  const periodicQuestions = [
    { q: '이번 호 콘텐츠가 업무에 도움이 되었나요?', kind: 'scale' as const },
    { q: '콘텐츠 분량은 적절했나요?', kind: 'scale' as const },
    { q: '가장 유익했던 콘텐츠는 무엇인가요?', kind: 'multiple' as const, options: ['콘텐츠 1', '콘텐츠 2', '인터랙션'] },
    { q: '실천으로 옮길 만한 내용이 있었나요?', kind: 'scale' as const },
    { q: '앞으로 다루었으면 하는 주제가 있나요?', kind: 'open' as const },
    { q: '동료에게 추천하고 싶으신가요?', kind: 'scale' as const },
  ];
  return (
    <>
      {renderSectionHeader('💬', '의견 들려주세요')}
      <div className="space-y-5">
        {types.map(type => {
          if (type === 'always') {
            return (
              <div key={type} className="rounded-2xl p-6 space-y-4 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
                <p className="text-base font-semibold text-[#2C2C2C]">이번 호 어떠셨나요?</p>
                <div className="flex gap-2">
                  {['아쉬워요', '괜찮아요', '최고예요'].map((opt, i) => (
                    <button key={i} className="flex-1 flex flex-col items-center gap-1 py-3 bg-white rounded-xl border border-[#E1EFFB] hover:border-[#2B9EE8] transition-colors">
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
                        <div className="w-4 h-4 rounded border-2 border-[#2B9EE8]/40 flex-shrink-0 bg-white" />
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
          // periodic
          return (
            <div key={type} className="rounded-2xl p-6 space-y-5 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
              <p className="text-base font-semibold text-[#2C2C2C]">정기 만족도 조사</p>
              {periodicQuestions.map((item, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold text-[#2C2C2C] mb-2">Q{i + 1}. {item.q}</p>
                  {item.kind === 'scale' && (
                    <div>
                      <div className="flex gap-1.5">
                        {Array.from({ length: 5 }, (_, n) => (
                          <button key={n} className="flex-1 py-2 text-sm bg-white border border-[#E1EFFB] rounded-lg hover:border-[#2B9EE8] transition-colors">{n + 1}</button>
                        ))}
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-gray-400">매우 불만족</span>
                        <span className="text-xs text-gray-400">매우 만족</span>
                      </div>
                    </div>
                  )}
                  {item.kind === 'multiple' && (
                    <div className="flex flex-wrap gap-2">
                      {item.options.map((opt, j) => (
                        <button key={j} className="px-3.5 py-1.5 text-sm bg-white border border-[#E1EFFB] rounded-lg hover:border-[#2B9EE8] transition-colors">{opt}</button>
                      ))}
                    </div>
                  )}
                  {item.kind === 'open' && (
                    <div className="w-full h-16 bg-white rounded-xl border border-[#E1EFFB] px-3 py-2 text-sm text-gray-400 flex items-start">답변을 입력해 주세요...</div>
                  )}
                </div>
              ))}
              <button className="w-full py-3 bg-[#2B9EE8] hover:bg-[#1a8ad4] text-white text-sm font-semibold rounded-xl transition-colors">제출하기</button>
            </div>
          );
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
      <div className={`${base} flex items-center justify-center`} style={{ background: 'linear-gradient(135deg, #2B9EE8 0%, #1a6fb5 100%)' }}>
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

// 전체 본문 렌더 (실시간 미리보기·미리보기 모달·제작완료 미리보기 공통)
export function renderGeneratedFullBody(generated: GeneratedNewsletter, opts: FullBodyOpts) {
  const { vol, dateLabel, leadershipLabel, templateInteractions, templateSurveys, onInlineEdit } = opts;
  const useTemplateInteractions = templateInteractions !== undefined;
  const useTemplateSurveys = templateSurveys !== undefined;
  const e = onInlineEdit; // shorthand
  return (
    <div className="bg-white max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-sm border border-gray-100 break-keep break-words">
      {/* 상단 네비게이션 */}
      <div className="px-6 sm:px-8 py-4 flex items-center justify-between border-b border-gray-100">
        <img src="/logo-jc.png" alt="J&Company" className="h-9 object-contain" onError={ev => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#6B7280] hover:text-[#2B9EE8] cursor-pointer transition-colors">뉴스레터 알아보기</span>
        </div>
      </div>

      {/* 본문 */}
      <div className="px-6 sm:px-8 py-10">
        {/* 헤더 영역 */}
        <div className="text-center mb-2">
          {generated.subject && <EditableText tag="p" value={generated.subject} field="subject" onEdit={e} className="text-xs font-bold text-[#2B9EE8] tracking-wide uppercase mb-3" />}
          <p className="text-xs text-[#6B7280] tracking-wide mb-4">Vol.{vol} · {dateLabel}{leadershipLabel ? ` · ${leadershipLabel}` : ''}</p>
          <EditableText tag="h1" value={formatHeadline(generated.headline)} field="headline" onEdit={e} className="text-2xl sm:text-3xl font-bold text-[#2C2C2C] leading-snug whitespace-pre-line break-keep" />
          <EditableText tag="p" value={generated.intro} field="intro" onEdit={e} className="text-base text-[#6B7280] leading-[1.8] text-left mt-4" multiline />
        </div>

        {/* 콘텐츠 */}
        {renderSectionHeader('📖', '오늘의 이야기')}
        <div>
          {generated.sections.map((sec, idx) => {
            // 본문 단락: body 우선, 없으면 구버전 필드로 폴백
            const bodyParas = (sec.body && sec.body.length > 0)
              ? sec.body
              : [sec.mainBody, sec.examples].filter((p): p is string => !!p && p.trim().length > 0);
            const paras = bodyParas.length > 0 ? bodyParas : (sec.summary ? [sec.summary] : []);
            return (
              <div key={sec.contentId}>
                {/* 콘텐츠 구분선 */}
                {idx > 0 && (
                  <div className="my-14 flex items-center justify-center">
                    <span className="text-gray-300 text-sm tracking-[0.5em]">• • •</span>
                  </div>
                )}
                {/* 카테고리 라벨 + 제목 + 부제 */}
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2B9EE8] bg-[#EAF4FC] px-2.5 py-1 rounded-full mb-3">📌 리더십 인사이트</span>
                <div className="border-l-4 border-[#2B9EE8] pl-4 mb-2">
                  <EditableText tag="p" value={`${sec.emoji} ${sec.contentTitle}`} field={`section.${idx}.contentTitle`} onEdit={e} className="text-2xl font-bold text-[#2C2C2C] leading-snug" />
                  {sec.subtitle && <EditableText tag="p" value={sec.subtitle} field={`section.${idx}.subtitle`} onEdit={e} className="text-sm text-[#6B7280] mt-1" />}
                </div>
                {/* 큰 썸네일 (16:9) — 항상 표시 (등록→웹서칭/주제URL→그라데이션) */}
                <Thumbnail sources={[sec.thumbnail, sec.thumbnailUrl]} label={sec.contentTitle} aspectClass="aspect-video" wrapClass="my-5" />
                {/* 도입 */}
                {sec.intro && <EditableText tag="p" value={sec.intro} field={`section.${idx}.intro`} onEdit={e} className="text-base text-[#4B5563] leading-[1.8] mb-4" multiline />}
                {/* 본문1 */}
                {paras[0] && <EditableText tag="p" value={paras[0]} field={`section.${idx}.body.0`} onEdit={e} className="text-base text-[#4B5563] leading-[1.8] mb-4" multiline />}
                {/* 인용구 박스 */}
                {sec.quote && (
                  <blockquote className="my-6 border-l-4 border-[#2B9EE8] pl-5 py-1">
                    <EditableText tag="p" value={sec.quote} field={`section.${idx}.quote`} onEdit={e} className="text-xl italic font-medium text-[#2C2C2C] leading-relaxed whitespace-pre-line break-keep" />
                  </blockquote>
                )}
                {/* 본문2 */}
                {paras[1] && <EditableText tag="p" value={paras[1]} field={`section.${idx}.body.1`} onEdit={e} className="text-base text-[#4B5563] leading-[1.8] mb-4" multiline />}
                {/* 데이터 박스 */}
                {sec.dataStat && (sec.dataStat.value || sec.dataStat.description) && (
                  <div className="my-6 rounded-xl p-6" style={{ backgroundColor: '#F0F7FF' }}>
                    <EditableText tag="p" value={`📊 ${sec.dataStat.value}`} field={`section.${idx}.dataStat.value`} onEdit={e} className="text-3xl font-black text-[#2B9EE8] leading-tight whitespace-pre-line break-keep" />
                    <EditableText tag="p" value={sec.dataStat.description} field={`section.${idx}.dataStat.description`} onEdit={e} className="text-base text-[#4B5563] leading-[1.7] mt-2" multiline />
                  </div>
                )}
                {/* 본문3 */}
                {paras[2] && <EditableText tag="p" value={paras[2]} field={`section.${idx}.body.2`} onEdit={e} className="text-base text-[#4B5563] leading-[1.8] mb-4" multiline />}
                {/* 사례 박스 */}
                {sec.caseStudy && (
                  <div className="my-6 rounded-xl p-5 border-l-4 border-gray-300" style={{ backgroundColor: '#F9FAFB' }}>
                    <p className="text-xs font-bold text-gray-500 mb-1.5">💼 실제 사례</p>
                    <EditableText tag="p" value={sec.caseStudy} field={`section.${idx}.caseStudy`} onEdit={e} className="text-sm text-[#4B5563] leading-[1.8]" multiline />
                  </div>
                )}
                {/* 나머지 본문 단락 */}
                {paras.slice(3).map((p, i) => (
                  <EditableText key={i} tag="p" value={p} field={`section.${idx}.body.${i + 3}`} onEdit={e} className="text-base text-[#4B5563] leading-[1.8] mb-4" multiline />
                ))}
                {/* 핵심 포인트 */}
                <div className="mt-5 rounded-xl p-4 border-l-4 border border-emerald-100 border-l-emerald-400" style={{ backgroundColor: '#F0FDF4' }}>
                  <p className="text-xs font-bold text-emerald-700 mb-1.5">💡 핵심 포인트</p>
                  <EditableText tag="p" value={sec.keyTakeaway} field={`section.${idx}.keyTakeaway`} onEdit={e} className="text-base font-semibold text-[#2C2C2C] leading-[1.8]" />
                </div>
                {/* Action Plan — 체크박스 형태 */}
                {sec.actionPlan && sec.actionPlan.length > 0 && (
                  <div className="mt-4 rounded-xl p-6 border border-[#E1EFFB] border-l-4 border-l-[#2B9EE8]" style={{ backgroundColor: '#F0F7FF' }}>
                    <p className="text-lg font-semibold text-[#2C2C2C]">✅ Action Plan</p>
                    <p className="text-xs text-[#6B7280] mt-0.5 mb-3">이번 호 핵심을 실천으로 옮겨보세요</p>
                    <ul className="space-y-3">
                      {sec.actionPlan.map((act, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-md border-2 border-[#2B9EE8] bg-white mt-0.5" />
                          <EditableText tag="p" value={act} field={`section.${idx}.actionPlan.${i}`} onEdit={e} className="text-base text-[#2C2C2C] leading-[1.7]" />
                        </li>
                      ))}
                    </ul>
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

        {/* 인터랙션 — 템플릿 override 시 선택된 타입을 즉시 렌더 */}
        {useTemplateInteractions && renderInteractionTemplates(templateInteractions!)}
        {!useTemplateInteractions && generated.interactions.length > 0 && (
          <>
            {renderSectionHeader('🎯', '함께 생각해봐요')}
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
                      <button className="text-sm font-bold text-[#2B9EE8] hover:underline">정답 확인하기 →</button>
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
                          <button key={i} className="w-full text-left px-4 py-3 bg-white rounded-xl border border-[#E1EFFB] text-base text-[#2C2C2C] hover:border-[#2B9EE8] transition-colors">{opt.label}</button>
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
                            <div className="w-4 h-4 rounded border-2 border-[#2B9EE8]/40 flex-shrink-0 mt-1 bg-white" />
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
                            <p className="text-xs font-bold text-[#2B9EE8] mb-1">Q{i + 1}</p>
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
        {useTemplateSurveys && renderSurveyTemplates(templateSurveys!)}
        {!useTemplateSurveys && generated.surveys.length > 0 && (
          <>
            {renderSectionHeader('💬', '의견 들려주세요')}
            <div className="space-y-5">
              {generated.surveys.map((survey, idx) => {
                if (survey.type === 'always') {
                  const q = survey.questions[0] as { type: 'rating'; options: string[]; followUp: string; followUpOptions: string[]; openQuestion: string };
                  return (
                    <div key={idx} className="rounded-2xl p-6 space-y-4 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
                      <p className="text-base font-semibold text-[#2C2C2C]">이번 호 어떠셨나요?</p>
                      <div className="flex gap-2">
                        {(q.options ?? []).map((opt, i) => (
                          <button key={i} className="flex-1 flex flex-col items-center gap-1 py-3 bg-white rounded-xl border border-[#E1EFFB] hover:border-[#2B9EE8] transition-colors">
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
                              <div className="w-4 h-4 rounded border-2 border-[#2B9EE8]/40 flex-shrink-0 bg-white" />
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
                  const questions = survey.questions as PeriodicSurveyQuestion[];
                  return (
                    <div key={idx} className="rounded-2xl p-6 space-y-5 border border-[#E1EFFB]" style={{ backgroundColor: '#F0F7FF' }}>
                      <p className="text-base font-semibold text-[#2C2C2C]">정기 만족도 조사</p>
                      {questions.map((q, i) => (
                        <div key={i}>
                          <p className="text-sm font-semibold text-[#2C2C2C] mb-2">Q{i + 1}. {q.question}</p>
                          {q.type === 'scale' && (
                            <div>
                              <div className="flex gap-1.5">
                                {Array.from({ length: q.scale }, (_, n) => (
                                  <button key={n} className="flex-1 py-2 text-sm bg-white border border-[#E1EFFB] rounded-lg hover:border-[#2B9EE8] transition-colors">{n + 1}</button>
                                ))}
                              </div>
                              <div className="flex justify-between mt-1">
                                <span className="text-xs text-gray-400">매우 불만족</span>
                                <span className="text-xs text-gray-400">매우 만족</span>
                              </div>
                            </div>
                          )}
                          {q.type === 'multiple' && (
                            <div className="flex flex-wrap gap-2">
                              {q.options.map((opt, j) => (
                                <button key={j} className="px-3.5 py-1.5 text-sm bg-white border border-[#E1EFFB] rounded-lg hover:border-[#2B9EE8] transition-colors">{opt}</button>
                              ))}
                            </div>
                          )}
                          {q.type === 'open' && (
                            <div className="w-full h-16 bg-white rounded-xl border border-[#E1EFFB] px-3 py-2 text-sm text-gray-400 flex items-start">답변을 입력해 주세요...</div>
                          )}
                        </div>
                      ))}
                      <button className="w-full py-3 bg-[#2B9EE8] hover:bg-[#1a8ad4] text-white text-sm font-semibold rounded-xl transition-colors">제출하기</button>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </>
        )}

        {/* 클로징 — 다음 호 안내 + 마이페이지 큰 버튼 */}
        <div className="mt-12 pt-8 border-t border-gray-100">
          <EditableText tag="p" value={generated.closing} field="closing" onEdit={e} className="text-base text-[#6B7280] leading-[1.8] italic border-l-2 border-[#2B9EE8]/30 pl-4 mb-4" multiline />
          <div className="rounded-2xl px-6 py-7 text-center" style={{ backgroundColor: '#EAF4FC' }}>
            <p className="text-base font-bold text-[#2C2C2C]">다음 호에서 만나요 👋</p>
            <p className="text-sm text-[#6B7280] mt-1">J&Company 코칭팀 드림</p>
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <div className="px-6 sm:px-8 py-6 border-t border-gray-100 flex items-center justify-between">
        <p className="text-xs text-[#6B7280] font-semibold">J&Company 코칭팀</p>
        <div className="flex gap-4">
          <span className="text-xs text-[#6B7280] hover:text-[#2B9EE8] cursor-pointer transition-colors">문의하기</span>
        </div>
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
        <button onClick={onReadFull} className="w-full py-3 bg-[#2B9EE8] hover:bg-[#1a8ad4] text-white text-sm font-semibold rounded-xl transition-colors">
          전체 뉴스레터 읽기 →
        </button>
      )}
    </div>
  );
  return (
    <div className="bg-white max-w-md mx-auto rounded-2xl overflow-hidden shadow-sm border border-gray-100 break-keep break-words">
      {/* 상단 헤더 — 흰 배경에 로고 크게 + 발행 정보 (작게) */}
      <div className="px-6 pt-8 pb-2 text-center">
        <img src="/logo-jc.png" alt="J&Company" className="h-16 object-contain mx-auto" onError={e => { const t = e.target as HTMLImageElement; t.outerHTML = '<span class="text-xl font-black text-[#2B9EE8] tracking-wider">J&COMPANY</span>'; }} />
        <p className="text-[11px] text-[#9CA3AF] mt-2">Vol.{vol}{dateLabel ? ` · ${dateLabel}` : ''}</p>
      </div>
      {/* 대표 썸네일 — 요약본은 약간 낮게(h-40), 항상 표시 (오류 시 폴백) */}
      <div className="px-6 pt-4">
        <Thumbnail sources={heroSources} label={heroSection?.contentTitle} aspectClass="h-40" />
      </div>
      {/* 카테고리 라벨 + 헤드라인 + 인트로 + 상단 CTA */}
      <div className="px-6 pt-5 text-center">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2B9EE8] bg-[#EAF4FC] px-2.5 py-1 rounded-full mb-3">📌 리더십 인사이트</span>
        <h1 className="text-xl font-bold text-[#2C2C2C] leading-snug whitespace-pre-line break-keep">{formatHeadline(generated.headline)}</h1>
        <p className="text-sm text-[#6B7280] leading-[1.7] mt-3">{generated.intro}</p>
        <div className="mt-5">{ctaButtons}</div>
      </div>
      {/* 콘텐츠 미리보기 — 컴팩트 (카테고리 라벨 · 제목 · 짧은 요약 · 자세히) */}
      <div className="px-6 mt-8">
        <div className="mb-4 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-2 border-l-4 border-[#2B9EE8] pl-3">
            <span className="text-base">📰</span>
            <h2 className="text-base font-semibold text-[#2C2C2C]">이번 호에서 다룰 내용</h2>
          </div>
        </div>
        <div className="space-y-3">
          {generated.sections.map(sec => (
            <div key={sec.contentId} className="rounded-xl p-4 border border-gray-100" style={{ backgroundColor: '#F9FAFB' }}>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2B9EE8] bg-[#EAF4FC] px-2 py-0.5 rounded-full mb-2">📌 리더십 인사이트</span>
              <p className="text-sm font-bold text-[#2C2C2C] leading-snug">{sec.emoji} {sec.contentTitle}</p>
              <p className="text-sm text-[#6B7280] leading-[1.6] mt-1 line-clamp-2">{sec.summary ?? sec.intro ?? sec.body?.[0] ?? sec.mainBody ?? ''}</p>
              {onReadFull && (
                <button onClick={onReadFull} className="mt-2 text-xs text-[#2B9EE8] font-bold">자세히 보기 →</button>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* 푸터 — 로고 작게 + 작은 텍스트 링크만 */}
      <div className="px-6 py-5 mt-8 border-t border-gray-100 flex items-center justify-between">
        <img src="/logo-jc.png" alt="J&Company" className="h-5 object-contain opacity-70" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div className="flex gap-4">
          <span className="text-xs text-[#6B7280] hover:text-[#2B9EE8] cursor-pointer transition-colors">문의하기</span>
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
