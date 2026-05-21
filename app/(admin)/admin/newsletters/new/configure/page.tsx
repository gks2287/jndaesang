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

const DELIVERY_SCHEDULES: DeliverySchedule[] = ['주 1회', '격주', '월 1회'];
const SURVEY_TYPES: SurveyType[] = ['상시 조사', '정기 조사', '안보냄', '둘다 보냄'];

const WIZARD_STEPS: Array<{ n: WizardStep; label: string }> = [
  { n: 1, label: '주제 선정' },
  { n: 2, label: '스토리라인' },
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

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  // steps 상태는 2~3단계 구현 시 setSteps, activeId 추가 예정
  const [steps] = useState<Step[]>([makeStep(0)]);
  const [deliverySchedule, setDeliverySchedule] = useState<DeliverySchedule>('주 1회');
  const [surveyType, setSurveyType] = useState<SurveyType>('상시 조사');
  const [newsletterTitle, setNewsletterTitle] = useState('');

  function handleSave(status: '제작 중' | '제작완료') {
    const company = targetCompanies[0];
    const leadershipType =
      leadershipTypes.length > 0
        ? leadershipTypes[0]
        : deptsParam
        ? '부서별'
        : '미지정';

    const autoTitle = `${company?.name ?? '미지정'} ${leadershipType} 리더십 코칭`.trim();

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

  function goNext() {
    if (wizardStep < 5) setWizardStep(prev => (prev + 1) as WizardStep);
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
                  <span key={t} className="font-semibold px-2 py-0.5 bg-red-50 text-red-600 rounded-full">
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

      {/* ── 메인 콘텐츠 ── */}
      {wizardStep === 1 && <PlaceholderStep label="주제 선정" />}
      {wizardStep === 2 && <PlaceholderStep label="스토리라인 확인" />}
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

            {/* 뉴스레터 제목 */}
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1.5">뉴스레터 제목</h2>
              <p className="text-xs text-gray-400 mb-4">저장 시 사용할 뉴스레터 제목을 입력하세요.</p>
              <input
                type="text"
                value={newsletterTitle}
                onChange={e => setNewsletterTitle(e.target.value)}
                placeholder={`예: ${targetCompanies[0]?.name ?? '고객사'} ${leadershipTypes[0] ?? ''} 리더십 코칭`.trim()}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition bg-white"
              />
            </div>

            {/* 만족도 조사 */}
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

            {/* 생성 완료 버튼 */}
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
            className="flex items-center gap-1.5 text-sm font-semibold px-5 py-1.5 rounded-lg bg-[#55A4DA] hover:bg-[#3A8BC4] text-white transition-colors"
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
