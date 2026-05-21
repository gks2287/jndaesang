'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNewsletterStore } from '@/store/newsletterStore';
import { useCompanyStore } from '@/store/companyStore';
import { DEFAULT_STORYLINE, STEP_COLORS } from '@/lib/storyline';
import { LEADERSHIP_COLOR } from '@/lib/constants/leadershipColors';

type ContentFormat = '글' | '영상' | '인포그래픽' | '카드뉴스';
type InteractionType = '퀴즈' | '시뮬레이션' | '성찰질문' | '체크리스트';
type StepLevel = '초급' | '중급' | '고급';
type DeliverySchedule = '주 1회' | '격주' | '월 1회';
type SurveyType = '상시 조사' | '정기 조사' | '안보냄' | '둘다 보냄';
type WizardStep = 1 | 2 | 3 | 4 | 5;

interface Step {
  id: string;
  title: string;
  level: StepLevel;
  formats: ContentFormat[];
  interactions: InteractionType[];
  contentPoolLink: string;
  specificContent: string;
}

interface TopicSuggestion {
  title: string;
  description: string;
  reason: string;
}

const DELIVERY_SCHEDULES: DeliverySchedule[] = ['주 1회', '격주', '월 1회'];
const SURVEY_TYPES: SurveyType[] = ['상시 조사', '정기 조사', '안보냄', '둘다 보냄'];

const WIZARD_STEPS: Array<{ n: WizardStep; label: string }> = [
  { n: 1, label: '스토리라인' },
  { n: 2, label: '주제 선정' },
  { n: 3, label: '콘텐츠 구성' },
  { n: 4, label: '발송 주기' },
  { n: 5, label: '만족도 조사' },
];


function makeStep(n: number): Step {
  return {
    id: `step-${Date.now()}-${n}`,
    title: '',
    level: '초급',
    formats: [],
    interactions: [],
    contentPoolLink: '',
    specificContent: '',
  };
}

function PlaceholderStep({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#F8FAFC]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm font-bold text-gray-500 mb-1.5">{label}</p>
        <p className="text-xs text-gray-400">다음 작업에서 구현 예정입니다.</p>
      </div>
    </div>
  );
}

function ConfigureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addNewsletter = useNewsletterStore(s => s.addNewsletter);
  const companies = useCompanyStore(s => s.companies);

  const kind = searchParams.get('kind') ?? '일반형';
  const companyIdsParam = searchParams.get('companyIds') ?? '';
  const typesParam = searchParams.get('types') ?? '';
  const deptsParam = searchParams.get('depts') ?? '';
  const leadersCount = Number(searchParams.get('leaders') ?? 0);

  const companyIdList = companyIdsParam
    ? companyIdsParam.split(',').map(Number).filter(Boolean)
    : [];
  const targetCompanies = companies.filter(c => companyIdList.includes(c.id));
  const leadershipTypes = typesParam ? typesParam.split(',').filter(Boolean) : [];

  // 위저드 상태
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);

  // 2단계: 주제 선정
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<TopicSuggestion | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);

  // 2~3단계: 콘텐츠 구성 (추후 구현)
  const [steps] = useState<Step[]>([makeStep(0)]);

  // 4단계: 발송 주기
  const [deliverySchedule, setDeliverySchedule] = useState<DeliverySchedule>('주 1회');

  // 5단계: 만족도 조사 + 제목
  const [surveyType, setSurveyType] = useState<SurveyType>('상시 조사');
  const [newsletterTitle, setNewsletterTitle] = useState('');

  async function fetchTopics() {
    setIsLoadingTopics(true);
    setTopicError(null);
    setSuggestions([]);
    setSelectedTopic(null);
    try {
      const res = await fetch('/api/topics/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadershipTypes,
          companyName: targetCompanies[0]?.name ?? '',
          kind,
        }),
      });
      if (!res.ok) throw new Error('API 오류');
      const data = await res.json() as { topics: TopicSuggestion[] };
      setSuggestions(data.topics ?? []);
    } catch {
      setTopicError('주제 추천을 불러오지 못했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoadingTopics(false);
    }
  }

  function handleSave(status: '제작 중' | '제작완료') {
    const company = targetCompanies[0];
    const leadershipType =
      leadershipTypes.length > 0 ? leadershipTypes[0] : deptsParam ? '부서별' : '미지정';

    const topicTitle = isCustom ? customTopic.trim() : selectedTopic?.title ?? '';
    const autoTitle = `${company?.name ?? '미지정'} ${leadershipType} 리더십 코칭`.trim();

    addNewsletter({
      title: newsletterTitle.trim() || topicTitle || autoTitle,
      companyId: company?.id ?? 0,
      companyName: company?.name ?? '미지정',
      leadershipType,
      status,
      stepCount: steps.length,
    });

    router.push(`/admin/newsletters?tab=${encodeURIComponent(status)}`);
  }

  function canGoNext(): boolean {
    if (wizardStep === 2) {
      if (isCustom) return customTopic.trim().length > 0;
      return selectedTopic !== null;
    }
    return true;
  }

  function goNext() {
    if (wizardStep < 5 && canGoNext()) setWizardStep(prev => (prev + 1) as WizardStep);
  }

  function goPrev() {
    if (wizardStep > 1) setWizardStep(prev => (prev - 1) as WizardStep);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── 상단 토퍼 ── */}
      <div className="bg-white border-b border-gray-200 px-8 py-3.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-[15px] text-gray-400 font-semibold">
          <Link href="/admin/newsletters" className="hover:text-gray-600 transition-colors">
            뉴스레터 제작
          </Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link href="/admin/newsletters/new" className="hover:text-gray-600 transition-colors">
            새로 만들기
          </Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-800 font-bold">콘텐츠 구성</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/admin/newsletters')}
            className="text-sm font-medium text-gray-500 border border-gray-200 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => handleSave('제작 중')}
            className="text-sm font-medium text-gray-700 border border-gray-200 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            임시저장
          </button>
        </div>
      </div>

      {/* ── 컨텍스트 뱃지 바 ── */}
      <div className="bg-white border-b border-gray-200 px-8 py-2.5 flex items-center gap-4 flex-shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">대상 기업</span>
          <div className="flex gap-1">
            {targetCompanies.length > 0
              ? targetCompanies.map(c => (
                  <span key={c.id} className="font-semibold px-2 py-0.5 bg-[#55A4DA]/10 text-[#55A4DA] rounded-full">
                    {c.name}
                  </span>
                ))
              : <span className="text-gray-400">—</span>}
          </div>
        </div>
        {leadershipTypes.length > 0 && (
          <>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-gray-400">리더십 유형</span>
              <div className="flex gap-1">
                {leadershipTypes.map(t => (
                  <span key={t} className={`font-semibold px-2 py-0.5 rounded-full ${LEADERSHIP_COLOR[t] ?? 'bg-gray-100 text-gray-600'}`}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="w-px h-4 bg-gray-200" />
        <span className="text-gray-500">
          {kind} · 대상 리더 <span className="font-semibold text-gray-700">{leadersCount}명</span>
        </span>
      </div>

      {/* ── 스테퍼 ── */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-center flex-shrink-0">
        <div className="flex items-center">
          {WIZARD_STEPS.map((s, i) => {
            const isDone = s.n < wizardStep;
            const isActive = s.n === wizardStep;
            return (
              <div key={s.n} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? 'bg-[#55A4DA] text-white'
                      : isActive
                      ? 'bg-[#55A4DA] text-white ring-4 ring-[#55A4DA]/20'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isDone ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : s.n}
                  </div>
                  <span className={`text-[10px] font-semibold whitespace-nowrap ${
                    isActive ? 'text-[#55A4DA]' : isDone ? 'text-[#55A4DA]/70' : 'text-gray-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {i < WIZARD_STEPS.length - 1 && (
                  <div className={`w-16 h-px mx-3 mb-4 transition-colors ${
                    isDone ? 'bg-[#55A4DA]' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2단계: 주제 선정 ── */}
      {wizardStep === 2 && (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="max-w-xl mx-auto px-6 py-10 space-y-6">

            {/* 현재 설정 요약 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">현재 설정</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">기업</span>
                  <div className="flex gap-1">
                    {targetCompanies.length > 0
                      ? targetCompanies.map(c => (
                          <span key={c.id} className="text-xs font-semibold px-2.5 py-1 bg-[#55A4DA]/10 text-[#55A4DA] rounded-full">
                            {c.name}
                          </span>
                        ))
                      : <span className="text-xs text-gray-400">—</span>}
                  </div>
                </div>
                {leadershipTypes.length > 0 && (
                  <>
                    <div className="w-px h-4 bg-gray-200" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">리더십 유형</span>
                      <div className="flex flex-wrap gap-1">
                        {leadershipTypes.map(t => (
                          <span key={t} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${LEADERSHIP_COLOR[t] ?? 'bg-gray-100 text-gray-600'}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div className="w-px h-4 bg-gray-200" />
                <span className="text-xs text-gray-500">
                  {kind} · <span className="font-semibold text-gray-700">{leadersCount}명</span>
                </span>
              </div>
            </div>

            {/* AI 추천 섹션 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">AI 주제 추천</h3>
                  <p className="text-xs text-gray-400 mt-0.5">설정 기반으로 뉴스레터 주제 3개를 추천합니다.</p>
                </div>
                <button
                  onClick={fetchTopics}
                  disabled={isLoadingTopics}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isLoadingTopics
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-[#55A4DA] hover:bg-[#3A8BC4] text-white shadow-sm'
                  }`}
                >
                  {isLoadingTopics ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      생성 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {suggestions.length > 0 ? '다시 추천받기' : 'AI 주제 추천받기'}
                    </>
                  )}
                </button>
              </div>

              {/* 로딩 */}
              {isLoadingTopics && (
                <div className="flex items-center justify-center py-10 gap-3 text-gray-400">
                  <svg className="w-5 h-5 animate-spin text-[#55A4DA]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-sm">AI가 주제를 생성하고 있습니다...</span>
                </div>
              )}

              {/* 에러 */}
              {topicError && !isLoadingTopics && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-red-600 flex-1">{topicError}</p>
                  <button onClick={fetchTopics} className="text-xs font-semibold text-red-500 hover:text-red-700 whitespace-nowrap">
                    다시 시도
                  </button>
                </div>
              )}

              {/* 추천 카드 목록 */}
              {!isLoadingTopics && suggestions.length > 0 && (
                <div className="space-y-2.5">
                  {suggestions.map((topic, idx) => {
                    const isSelected = !isCustom && selectedTopic?.title === topic.title;
                    return (
                      <button
                        key={idx}
                        onClick={() => { setSelectedTopic(topic); setIsCustom(false); }}
                        className={`w-full text-left flex items-start gap-3.5 px-4 py-4 rounded-xl border-2 transition-all ${
                          isSelected
                            ? 'border-[#55A4DA] bg-[#55A4DA]/5'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                          isSelected ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold leading-snug ${isSelected ? 'text-[#2E7DB5]' : 'text-gray-800'}`}>
                            {topic.title}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{topic.description}</p>
                          {topic.reason && (
                            <div className="mt-2.5 flex items-start gap-1.5 bg-[#55A4DA]/5 rounded-lg px-3 py-2">
                              <svg className="w-3 h-3 text-[#55A4DA] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-[11px] text-[#2E7DB5] leading-relaxed">{topic.reason}</p>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 초기 안내 */}
              {!isLoadingTopics && suggestions.length === 0 && !topicError && (
                <div className="flex items-center justify-center py-8 text-center">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-[#55A4DA]/10 flex items-center justify-center mx-auto mb-2.5">
                      <svg className="w-5 h-5 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <p className="text-xs text-gray-500 font-medium">버튼을 눌러 AI 주제 추천을 받아보세요.</p>
                  </div>
                </div>
              )}
            </div>

            {/* 직접 입력 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
              <button
                onClick={() => { setIsCustom(v => !v); setSelectedTopic(null); }}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isCustom ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                  }`}>
                    {isCustom && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm font-semibold text-gray-700">직접 입력</span>
                </div>
                <span className="text-xs text-gray-400">AI 추천 대신 직접 주제를 입력합니다</span>
              </button>
              {isCustom && (
                <input
                  type="text"
                  value={customTopic}
                  onChange={e => setCustomTopic(e.target.value)}
                  placeholder="뉴스레터 주제를 직접 입력하세요"
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                />
              )}
            </div>

          </div>
        </div>
      )}

      {wizardStep === 1 && (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="max-w-5xl mx-auto px-6 py-10">

            {/* 헤더 */}
            <div className="mb-8">
              <h2 className="text-base font-bold text-gray-800 mb-1">뉴스레터 스토리라인</h2>
              <p className="text-xs text-gray-400">5단계 코칭 여정으로 리더의 변화를 이끕니다. 구조를 확인한 뒤 다음으로 진행하세요.</p>
            </div>

            {/* 가로 플로우 (데스크탑) / 세로 (모바일) */}
            <div className="flex flex-col lg:flex-row items-stretch gap-0 lg:gap-0 mb-8">
              {DEFAULT_STORYLINE.map((s, i) => {
                const color = STEP_COLORS[i];
                return (
                  <div key={s.step} className="flex flex-col lg:flex-row items-stretch flex-1 min-w-0">
                    {/* 카드 */}
                    <div className={`flex-1 rounded-2xl border-2 ${color.border} ${color.cardBg} p-5 flex flex-col gap-3`}>
                      {/* 뱃지 + 제목 */}
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full ${color.badge} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white text-xs font-bold">{s.step}</span>
                        </div>
                        <div>
                          <p className={`text-sm font-bold leading-tight ${color.titleColor}`}>{s.title}</p>
                          <p className={`text-[11px] font-semibold ${color.subtitleColor}`}>{s.subtitle}</p>
                        </div>
                      </div>
                      {/* 설명 */}
                      <p className="text-xs text-gray-600 leading-relaxed flex-1">{s.description}</p>
                    </div>

                    {/* 화살표 — 데스크탑: 가로, 모바일: 세로 */}
                    {i < DEFAULT_STORYLINE.length - 1 && (
                      <div className="flex items-center justify-center lg:px-2 py-2 lg:py-0 flex-shrink-0">
                        {/* 모바일: 아래 화살표 */}
                        <svg className="w-4 h-4 text-gray-300 lg:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        {/* 데스크탑: 오른쪽 화살표 */}
                        <svg className="w-4 h-4 text-gray-300 hidden lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 안내 + 이 구조로 진행 버튼 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-2 bg-[#55A4DA]/5 border border-[#55A4DA]/20 rounded-xl px-4 py-3 flex-1">
                <svg className="w-4 h-4 text-[#55A4DA] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-[#2E7DB5]">이 스토리라인은 모든 뉴스레터에 공통으로 적용됩니다. 다음 단계에서 각 회차별 콘텐츠를 구성합니다.</p>
              </div>
              <button
                onClick={goNext}
                className="flex items-center gap-2 px-6 py-3 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-sm font-bold rounded-xl transition-colors shadow-sm whitespace-nowrap flex-shrink-0"
              >
                이 구조로 진행
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

          </div>
        </div>
      )}
      {wizardStep === 3 && <PlaceholderStep label="콘텐츠 구성" />}

      {wizardStep === 4 && (
        <div className="flex-1 flex items-center justify-center bg-[#F8FAFC] overflow-y-auto py-12">
          <div className="w-full max-w-md px-6">
            <h2 className="text-base font-bold text-gray-800 mb-1.5">발송 주기 선택</h2>
            <p className="text-xs text-gray-400 mb-8">뉴스레터를 얼마나 자주 발송할지 선택하세요.</p>
            <div className="space-y-3">
              {DELIVERY_SCHEDULES.map(s => (
                <button
                  key={s}
                  onClick={() => setDeliverySchedule(s)}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                    deliverySchedule === s
                      ? 'border-[#55A4DA] bg-[#55A4DA]/5 text-[#55A4DA]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    deliverySchedule === s ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                  }`}>
                    {deliverySchedule === s && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {wizardStep === 5 && (
        <div className="flex-1 flex items-center justify-center bg-[#F8FAFC] overflow-y-auto py-12">
          <div className="w-full max-w-md px-6 space-y-8">
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1.5">뉴스레터 제목</h2>
              <p className="text-xs text-gray-400 mb-4">저장 시 사용할 뉴스레터 제목을 입력하세요.</p>
              <input
                type="text"
                value={newsletterTitle}
                onChange={e => setNewsletterTitle(e.target.value)}
                placeholder={
                  isCustom && customTopic
                    ? customTopic
                    : selectedTopic?.title
                    ?? `${targetCompanies[0]?.name ?? '고객사'} ${leadershipTypes[0] ?? ''} 리더십 코칭`.trim()
                }
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition bg-white"
              />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1.5">만족도 조사 설정</h2>
              <p className="text-xs text-gray-400 mb-4">만족도 조사를 어떻게 발송할지 선택하세요.</p>
              <div className="space-y-3">
                {SURVEY_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setSurveyType(t)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-sm font-semibold transition-all ${
                      surveyType === t
                        ? 'border-[#55A4DA] bg-[#55A4DA]/5 text-[#55A4DA]'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      surveyType === t ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                    }`}>
                      {surveyType === t && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => handleSave('제작완료')}
              className="w-full py-3.5 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
            >
              생성 완료
            </button>
          </div>
        </div>
      )}

      {/* ── 하단 네비게이션 ── */}
      <div className="bg-white border-t border-gray-200 px-8 py-3.5 flex items-center justify-between flex-shrink-0">
        <button
          onClick={goPrev}
          disabled={wizardStep === 1}
          className={`flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg border transition-colors ${
            wizardStep === 1
              ? 'border-gray-100 text-gray-300 cursor-not-allowed'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          이전
        </button>

        {wizardStep < 5 && (
          <button
            onClick={goNext}
            disabled={!canGoNext()}
            className={`flex items-center gap-1.5 text-sm font-semibold px-5 py-1.5 rounded-lg transition-colors ${
              canGoNext()
                ? 'bg-[#55A4DA] hover:bg-[#3A8BC4] text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            다음
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

    </div>
  );
}

export default function ConfigurePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        로딩 중...
      </div>
    }>
      <ConfigureContent />
    </Suspense>
  );
}
