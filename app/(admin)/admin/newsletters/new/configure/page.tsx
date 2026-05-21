'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNewsletterStore } from '@/store/newsletterStore';
import { useCompanyStore } from '@/store/companyStore';

type ContentFormat = '글' | '영상' | '인포그래픽' | '카드뉴스';
type InteractionType = '퀴즈' | '시뮬레이션' | '성찰질문' | '체크리스트';
type StepLevel = '초급' | '중급' | '고급';
type DeliverySchedule = '주 1회' | '격주' | '월 1회';
type SurveyType = '상시 조사' | '정기 조사';

interface Step {
  id: string;
  title: string;
  level: StepLevel;
  formats: ContentFormat[];
  interactions: InteractionType[];
  contentPoolLink: string;
  specificContent: string;
}

const CONTENT_FORMATS: ContentFormat[] = ['글', '영상', '인포그래픽', '카드뉴스'];
const INTERACTION_TYPES: InteractionType[] = ['퀴즈', '시뮬레이션', '성찰질문', '체크리스트'];
const LEVELS: StepLevel[] = ['초급', '중급', '고급'];
const DELIVERY_SCHEDULES: DeliverySchedule[] = ['주 1회', '격주', '월 1회'];
const SURVEY_TYPES: SurveyType[] = ['상시 조사', '정기 조사'];

const levelStyle: Record<StepLevel, string> = {
  '초급': 'bg-emerald-100 text-emerald-700',
  '중급': 'bg-blue-100 text-blue-700',
  '고급': 'bg-purple-100 text-purple-700',
};

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

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

function CheckboxCard({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
        checked
          ? 'border-[#55A4DA] bg-[#55A4DA]/5 text-[#55A4DA]'
          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <span
        className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          checked ? 'bg-[#55A4DA] border-[#55A4DA]' : 'border-gray-300'
        }`}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      {label}
    </button>
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

  const [steps, setSteps] = useState<Step[]>([makeStep(0)]);
  const [activeId, setActiveId] = useState<string>(steps[0].id);
  const [deliverySchedule, setDeliverySchedule] = useState<DeliverySchedule>('주 1회');
  const [surveyType, setSurveyType] = useState<SurveyType>('상시 조사');
  const [newsletterTitle, setNewsletterTitle] = useState('');
  const [newsletterMemo, setNewsletterMemo] = useState('');

  const activeStep = steps.find(s => s.id === activeId) ?? steps[0];

  function updateStep(id: string, patch: Partial<Step>) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  function addStep() {
    const s = makeStep(steps.length);
    setSteps(prev => [...prev, s]);
    setActiveId(s.id);
  }

  function removeStep(id: string) {
    if (steps.length === 1) return;
    const idx = steps.findIndex(s => s.id === id);
    const next = steps.filter(s => s.id !== id);
    setSteps(next);
    if (activeId === id) setActiveId(next[Math.max(0, idx - 1)].id);
  }

  function handleSave(status: '제작 중' | '제작완료') {
    const company = targetCompanies[0];
    const leadershipType =
      leadershipTypes.length > 0
        ? leadershipTypes[0]
        : deptsParam
        ? `부서별`
        : '미지정';

    const autoTitle =
      `${company?.name ?? '미지정'} ${leadershipType} 리더십 코칭`.trim();

    addNewsletter({
      title: newsletterTitle.trim() || autoTitle,
      companyId: company?.id ?? 0,
      companyName: company?.name ?? '미지정',
      leadershipType,
      status,
      stepCount: steps.length,
    });

    router.push(`/admin/newsletters?tab=${encodeURIComponent(status)}`);
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
          <button
            onClick={() => handleSave('제작완료')}
            className="text-sm font-semibold bg-[#55A4DA] hover:bg-[#3A8BC4] text-white px-5 py-1.5 rounded-lg transition-colors"
          >
            생성 완료
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
                  <span key={t} className="font-semibold px-2 py-0.5 bg-red-50 text-red-600 rounded-full">{t}</span>
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

      {/* ── 전역 설정 바 ── */}
      <div className="bg-[#F8FAFC] border-b border-gray-200 px-8 py-2.5 flex items-center gap-6 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-gray-500">발송 주기</span>
          <div className="flex gap-1">
            {DELIVERY_SCHEDULES.map(s => (
              <button
                key={s}
                onClick={() => setDeliverySchedule(s)}
                className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                  deliverySchedule === s
                    ? 'bg-[#55A4DA] text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-gray-500">만족도 조사</span>
          <div className="flex gap-1">
            {SURVEY_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setSurveyType(t)}
                className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                  surveyType === t
                    ? 'bg-[#55A4DA] text-white'
                    : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 메인 2-column ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* 왼쪽: 단계 목록 */}
        <div className="w-60 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-800">뉴스레터 단계</p>
            <span className="text-xs font-semibold text-[#55A4DA]">{steps.length}단계</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {steps.map((step, idx) => {
              const isActive = step.id === activeId;
              return (
                <div
                  key={step.id}
                  onClick={() => setActiveId(step.id)}
                  className={`group flex items-center gap-2.5 px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors ${
                    isActive ? 'bg-[#55A4DA]/5' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${
                    isActive ? 'bg-[#55A4DA] text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isActive ? 'text-[#2E7DB5]' : 'text-gray-700'}`}>
                      {step.title || `Step ${idx + 1}`}
                    </p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${levelStyle[step.level]}`}>
                      {step.level}
                    </span>
                  </div>
                  {steps.length > 1 && (
                    <button
                      onClick={e => { e.stopPropagation(); removeStep(step.id); }}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 p-0.5 rounded"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-gray-100">
            <button
              onClick={addStep}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-[#55A4DA] rounded-lg transition-colors border border-dashed border-[#55A4DA]/40 hover:border-[#55A4DA] hover:bg-[#55A4DA]/5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              단계 추가
            </button>
          </div>
        </div>

        {/* 오른쪽: 편집 영역 */}
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-6">
          <div className="max-w-2xl mx-auto space-y-4">

            {/* ── 뉴스레터 기타 (전체 설정) ── */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-800">뉴스레터 기타</h3>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">뉴스레터 제목</label>
                <input
                  type="text"
                  value={newsletterTitle}
                  onChange={e => setNewsletterTitle(e.target.value)}
                  placeholder={
                    `예: ${targetCompanies[0]?.name ?? '고객사'} ${leadershipTypes[0] ?? ''} 리더십 코칭`.trim()
                  }
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">관리자 메모</label>
                <textarea
                  value={newsletterMemo}
                  onChange={e => setNewsletterMemo(e.target.value)}
                  placeholder="이 뉴스레터에 대한 내부 메모를 입력하세요."
                  rows={2}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition resize-none"
                />
              </div>
            </section>

            {/* ── 구분선 ── */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <p className="text-xs text-gray-400 font-semibold flex items-center gap-1.5">
                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  steps.find(s => s.id === activeId)?.id === activeId
                    ? 'bg-[#55A4DA] text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {steps.findIndex(s => s.id === activeId) + 1}
                </span>
                단계 설정
              </p>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* ── 단계 기본 정보 ── */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-800">단계 기본 정보</h3>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">단계 제목</label>
                <input
                  type="text"
                  value={activeStep.title}
                  onChange={e => updateStep(activeStep.id, { title: e.target.value })}
                  placeholder={`예: Step ${steps.findIndex(s => s.id === activeStep.id) + 1} — 자기인식과 리더십 패턴`}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">수준</label>
                <div className="flex gap-2">
                  {LEVELS.map(level => (
                    <button
                      key={level}
                      onClick={() => updateStep(activeStep.id, { level })}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        activeStep.level === level
                          ? levelStyle[level]
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* ── 콘텐츠 형식 ── */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
              <h3 className="text-sm font-bold text-gray-800">콘텐츠 형식</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {CONTENT_FORMATS.map(fmt => (
                  <CheckboxCard
                    key={fmt}
                    label={fmt}
                    checked={activeStep.formats.includes(fmt)}
                    onClick={() => updateStep(activeStep.id, {
                      formats: toggle(activeStep.formats, fmt),
                    })}
                  />
                ))}
              </div>
            </section>

            {/* ── Interaction 요소 ── */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
              <h3 className="text-sm font-bold text-gray-800">Interaction 요소</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {INTERACTION_TYPES.map(type => (
                  <CheckboxCard
                    key={type}
                    label={type}
                    checked={activeStep.interactions.includes(type)}
                    onClick={() => updateStep(activeStep.id, {
                      interactions: toggle(activeStep.interactions, type),
                    })}
                  />
                ))}
              </div>
            </section>

            {/* ── 콘텐츠 설정 ── */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-800">콘텐츠 설정</h3>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">콘텐츠 풀 링크</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={activeStep.contentPoolLink}
                    onChange={e => updateStep(activeStep.id, { contentPoolLink: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                  />
                  {activeStep.contentPoolLink && (
                    <a
                      href={activeStep.contentPoolLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#55A4DA] border border-[#55A4DA]/30 rounded-xl hover:bg-[#55A4DA]/5 transition-colors whitespace-nowrap"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      열기
                    </a>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">특정 콘텐츠 선택</label>
                <textarea
                  value={activeStep.specificContent}
                  onChange={e => updateStep(activeStep.id, { specificContent: e.target.value })}
                  placeholder="이 단계에서 사용할 특정 콘텐츠를 선택하거나 메모를 입력하세요."
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition resize-none"
                />
              </div>
            </section>

          </div>
        </div>
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
