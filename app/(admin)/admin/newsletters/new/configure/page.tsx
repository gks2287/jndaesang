'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNewsletterStore } from '@/store/newsletterStore';
import { useCompanyStore } from '@/store/companyStore';
import CompanyLogo from '@/components/CompanyLogo';
import { DEFAULT_STORYLINE, type StorylineStep } from '@/lib/storyline';
import { LEADERSHIP_COLOR } from '@/lib/constants/leadershipColors';
import { type Round, type CustomGroup, type RoundAttachment, type GroupDescription, makeCustomGroup, groupCompositionKey } from '@/lib/content';
import { getContentList, type ContentPoolItem, type ContentCategory } from '@/lib/api/contentPool';
import { isSendGroupSent } from '@/lib/newsletterSend';
import { useNewNewsletterDraftStore, type TopicSuggestion as DraftTopicSuggestion } from '@/store/newNewsletterDraftStore';
import { useParticipantStore } from '@/store/participantStore';
import { useLeadershipInfoStore } from '@/store/leadershipInfoStore';
import {
  renderGeneratedFullBody,
  renderInteractionTemplates,
  renderSurveyTemplates,
  renderNewsletterEmailPreview,
  type GeneratedNewsletter,
  type SavedNewsletterContent,
  type SavedNewsletterRound,
  type SavedNewsletterGroup,
} from '@/components/newsletter/NewsletterRender';

type DeliveryInterval = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual';
type WizardStep = 1 | 2 | 3 | 4 | 5;
type TopicSuggestion = DraftTopicSuggestion;

const DELIVERY_INTERVAL_OPTIONS: Array<{ value: DeliveryInterval; label: string; days: number; desc: string }> = [
  { value: 'weekly',     label: '주간',   days: 7,   desc: '7일마다' },
  { value: 'biweekly',   label: '격주',   days: 14,  desc: '14일마다' },
  { value: 'monthly',    label: '월 1회', days: 30,  desc: '30일마다' },
  { value: 'bimonthly',  label: '월 2회', days: 15,  desc: '15일마다' },
  { value: 'quarterly',  label: '분기',   days: 90,  desc: '90일마다' },
  { value: 'semiannual', label: '반기',   days: 180, desc: '180일마다' },
];
const WIZARD_STEPS: Array<{ n: WizardStep; label: string }> = [
  { n: 1, label: '스토리라인' },
  { n: 2, label: '회차 설계' },
  { n: 3, label: '발송일 설정' },
  { n: 4, label: '그룹 설정' },
  { n: 5, label: '콘텐츠 구성' },
];

// zustand selector가 매 렌더마다 새 배열을 만들지 않도록 하는 안정적인 빈 배열 참조
const EMPTY_LEADERSHIP_INFO: import('@/store/leadershipInfoStore').LeadershipInfo[] = [];

// 추가 자료 업로드 제한
const ATTACH_MAX_PER_TARGET = 5;
const ATTACH_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ATTACH_ACCEPT = '.pdf,.docx,.txt,.xlsx,.csv';
const ATTACH_ALLOWED_EXT = ['pdf', 'docx', 'txt', 'xlsx', 'csv'];

const INTERACTION_LABELS: Record<string, string> = {
  quiz: '퀴즈',
  scenario: '선택형 시나리오',
  selfcheck: '셀프 진단/체크리스트',
  reflection: '회고 질문',
  dodont: 'Do & Don\'t 리스트',
};

// 스토리라인 단계 카드/배지 통일 색상 (J&Company 메인 파랑 단색)
const UNIFIED_STEP_COLOR = {
  badge: 'bg-[#2B9EE8]',
  cardBg: 'bg-white',
  border: 'border-gray-200',
  titleColor: 'text-gray-800',
  subtitleColor: 'text-gray-500',
} as const;

function makeRoundsFromDistribution(dist: { stepIndex: number; count: number }[]): Round[] {
  const sorted = [...dist].sort((a, b) => a.stepIndex - b.stepIndex);
  let id = 1;
  return sorted.flatMap(({ stepIndex, count }) =>
    Array.from({ length: count }, () => ({
      id: id++,
      stepIndex,
      topic: '',
      contents: [],
      interactions: [],
      surveys: [],
      newsletterType: '일반형' as const,
      generalTypes: [],
      customLeaderIds: [],
      generalLeaderIds: [],
      customGroups: [],
      contentBrief: '',
      attachments: [],
    }))
  );
}

function getDefaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split('T')[0];
}

function calcScheduleDates(startDate: string, interval: DeliveryInterval, count: number): Date[] {
  const days = DELIVERY_INTERVAL_OPTIONS.find(o => o.value === interval)?.days ?? 30;
  const start = new Date(startDate + 'T00:00:00');
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i * days);
    return d;
  });
}

function formatKoreanDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

// 발송일 <input type="date"> 값용 로컬 기준 YYYY-MM-DD 문자열.
// toISOString()은 UTC로 변환돼 KST에서 하루 밀릴 수 있으므로 로컬 필드로 직접 구성한다.
function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── 저장소 불러오기 모달 ─────────────────────────────────────────────
function StorageImportModal({ onImport, onClose }: {
  onImport: (generated: GeneratedNewsletter, headline: string) => void;
  onClose: () => void;
}) {
  const newsletters = useNewsletterStore(s => s.newsletters);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const storageNLs = useMemo(() =>
    newsletters
      .filter(n => n.status === '제작완료' && n.generatedContent?.rounds?.some(r => r.generated?.headline))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [newsletters],
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return storageNLs;
    return storageNLs.filter(n =>
      n.companyName?.includes(q) || n.leadershipType?.includes(q) || n.title?.includes(q)
    );
  }, [storageNLs, search]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-800">저장소에서 불러오기</h3>
            <p className="text-xs text-gray-400 mt-0.5">제작완료된 뉴스레터 회차를 그대로 가져옵니다</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="기업명·유형·제목 검색" value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-full" autoFocus />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {storageNLs.length === 0 ? '저장소에 제작완료된 뉴스레터가 없습니다.' : '검색 결과가 없습니다.'}
            </p>
          ) : filtered.map(nl => {
            const rounds = (nl.generatedContent?.rounds ?? []).filter(r => r.generated?.headline);
            const isOpen = expanded.has(nl.id);
            return (
              <div key={nl.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(nl.id) ? n.delete(nl.id) : n.add(nl.id); return n; })}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <CompanyLogo name={nl.companyName} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{nl.companyName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{nl.leadershipType}</span>
                      <span className="text-[10px] text-gray-400">{rounds.length}회차</span>
                    </div>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {rounds.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => { if (r.generated) { onImport(r.generated, r.generated.headline ?? ''); } }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#55A4DA]/5 transition-colors text-left group"
                      >
                        <span className="text-xs font-bold text-gray-400 w-10 flex-shrink-0">{r.vol}회차</span>
                        <span className="flex-1 text-sm text-gray-700 truncate">{r.generated?.headline}</span>
                        <span className="text-xs font-semibold text-[#55A4DA] opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity">불러오기</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ConfigureContent() {
  const router = useRouter();
  const addNewsletter = useNewsletterStore(s => s.addNewsletter);
  const updateNewsletter = useNewsletterStore(s => s.updateNewsletter);
  const companies = useCompanyStore(s => s.companies);

  const configDraft = useNewNewsletterDraftStore();
  // 수정 모드: 편집 대상 뉴스레터 id (이어서/신규는 null)
  const editingNewsletterId = configDraft.editingNewsletterId;
  const allParticipants = useParticipantStore(s => s.participants);

  // 발송완료로 잠긴 그룹 판정용 — 편집 대상 뉴스레터의 sentGroups (`${회차}|${유형}`)
  const allNewsletters = useNewsletterStore(s => s.newsletters);
  const editingSentGroups = useMemo(
    () => (editingNewsletterId != null ? (allNewsletters.find(n => n.id === editingNewsletterId)?.sentGroups ?? []) : []),
    [allNewsletters, editingNewsletterId],
  );

  const targetCompanies = companies.filter(c => configDraft.companyIds.includes(c.id));
  const leadershipTypes: string[] = [];

  const selectedParticipants = allParticipants.filter(p => configDraft.companyIds?.includes(p.companyId) ?? false);

  // 이 기업 다면진단 기반 리더십 유형 정보 (뉴스레터 주제·본문 맞춤용)
  const leadershipInfoYear = new Date().getFullYear();
  const leadershipCompanyId = targetCompanies[0]?.id;
  const loadLeadershipInfo = useLeadershipInfoStore(s => s.loadForCompany);
  // 맵에서 원시 값만 선택(안정 참조). 없으면 모듈 상수 빈 배열 → 무한 렌더 방지
  const companyLeadershipInfo = useLeadershipInfoStore(
    s => (leadershipCompanyId != null ? s.current[`${leadershipCompanyId}-${leadershipInfoYear}`] : undefined),
  ) ?? EMPTY_LEADERSHIP_INFO;
  useEffect(() => {
    if (leadershipCompanyId != null) void loadLeadershipInfo(leadershipCompanyId, leadershipInfoYear);
  }, [leadershipCompanyId, leadershipInfoYear, loadLeadershipInfo]);
  // 주어진 유형들과 매칭되는 리더십 정보만 (문서에 없는 유형은 자동 제외)
  const matchLeadershipInfo = (types: string[]) =>
    companyLeadershipInfo.filter(i => types.includes(i.type));

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [companySearch, setCompanySearch] = useState('');

  function handleCancel() {
    localStorage.removeItem('newsletter_draft_saved');
    configDraft.resetDraft();
    router.push('/admin/newsletters');
  }

  // ── 위저드 단계 ──
  const [wizardStep, setWizardStep] = useState<WizardStep>(
    Math.min(configDraft.wizardStep, 5) as WizardStep
  );

  // ── 1단계: 스토리라인 편집 ──
  const [customStoryline, setCustomStoryline] = useState<StorylineStep[]>(configDraft.customStoryline);
  const [isEditingStoryline, setIsEditingStoryline] = useState(false);
  const [draftStoryline, setDraftStoryline] = useState<StorylineStep[]>(DEFAULT_STORYLINE);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [aiRefineError, setAiRefineError] = useState<string | null>(null);

  // ── 2단계: 회차 설계 ──
  const [totalRounds, setTotalRounds] = useState<number>(
    configDraft.totalRounds > 0 ? configDraft.totalRounds : configDraft.customStoryline.length
  );
  const [roundDistribution, setRoundDistribution] = useState<{ stepIndex: number; count: number }[]>(
    configDraft.roundDistribution.length > 0
      ? configDraft.roundDistribution
      : configDraft.customStoryline.map((_, i) => ({ stepIndex: i, count: 1 }))
  );

  // ── 4단계: 리더십 유형 배분 ──
  // 수정 진입 시 지정 회차(seededActiveRoundIdx)의 그룹 설정 탭으로 바로 열리도록 초기화
  const [distributionRoundIdx, setDistributionRoundIdx] = useState(configDraft.seededActiveRoundIdx ?? 0);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  // Step 4: '이전 회차와 동일하게' 배분 복사 메뉴 열림 상태
  const [copyDistMenuOpen, setCopyDistMenuOpen] = useState(false);
  // Step 5 추가 자료: 드래그오버 중인 타깃 id (시각 피드백)
  const [attachDragTarget, setAttachDragTarget] = useState<string | null>(null);

  // 그룹 설명(유형 구성 키 → 설명). 회차 무관 공유 — 드래프트에 동기화.
  const [groupDescriptions, setGroupDescriptions] = useState<Record<string, GroupDescription>>(configDraft.groupDescriptions ?? {});
  // 그룹 카드 설명 패널 펼침 상태 (그룹 id 기준)
  const [expandedGroupDesc, setExpandedGroupDesc] = useState<Set<string>>(new Set());
  // AI 그룹 설명 일괄 생성 로딩
  const [generatingGroupDesc, setGeneratingGroupDesc] = useState(false);

  // ── 5단계: 콘텐츠 구성 (회차별 통합) ──
  const [rounds, setRounds] = useState<Round[]>(configDraft.rounds);
  const [activeRoundIdx, setActiveRoundIdx] = useState(configDraft.seededActiveRoundIdx ?? 0);
  // 좌측 실시간 미리보기 대상 탭 ('general' 또는 그룹 id) — 이어서/수정 진입 시 클릭한 그룹으로 시작
  const [previewTargetId, setPreviewTargetId] = useState<string>(configDraft.seededPreviewTargetId ?? 'general');
  // 좌측 실시간 미리보기 표시 모드 (전체 본문 / 요약본)
  const [livePreviewMode, setLivePreviewMode] = useState<'full' | 'email'>('full');
  // '구성 완료' 버튼으로 공개된 미리보기 대상 (`${roundIdx}:${targetId}`) — 클릭 전까지 미리보기 숨김
  const [revealedPreviews, setRevealedPreviews] = useState<Set<string>>(new Set());
  // 하단 고정 프롬프트 바: 입력값 + 수정 진행 중 여부
  const [promptInput, setPromptInput] = useState('');
  const [refining, setRefining] = useState(false);
  // AI 자동 채움 중복 실행 가드 (`${roundIdx}:${targetId}`)
  const autoFilledRef = useRef<Set<string>>(new Set());
  // 세션 단위 클라이언트 캐시 (기업 선택 시 초기화) — API 비용 절감
  const topicsCacheRef = useRef<Map<string, TopicSuggestion[]>>(new Map());
  const contentsCacheRef = useRef<Map<string, ContentPoolItem[]>>(new Map());
  // 좌측 실시간 미리보기 본문 (generate API 결과, `${roundIdx}:${targetId}` 키)
  const [livePreviewContent, setLivePreviewContent] = useState<Record<string, GeneratedNewsletter>>({});
  const [livePreviewGenerating, setLivePreviewGenerating] = useState<Set<string>>(new Set());
  // 백그라운드 준비 중인 대상 (주제 추천 + 콘텐츠 서칭 단계, `${roundIdx}:${targetId}`)
  const [preparingTargets, setPreparingTargets] = useState<Set<string>>(new Set());
  const livePreviewTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // 대상별 마지막 생성 시그니처 (key → sig). 현재 구성과 다르면 재생성 (A→B→A 되돌림도 정상 반영)
  const livePreviewSigRef = useRef<Record<string, string>>({});
  // 콘텐츠 자동 추천 debounce 타이머·시그니처 (key → `${roundIdx}:${targetId}`) — 주제·세부방향 변경 감시
  const contentSuggestTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const contentSuggestSigRef = useRef<Record<string, string>>({});
  // Step 4 → 5 진입 시 전 회차 자동 구성 로딩 오버레이

  // 주제 선정
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>(configDraft.suggestions);
  // 주제 추천 대상: 'general' 또는 그룹 id
  const [suggestionsTarget, setSuggestionsTarget] = useState<string>('general');
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);

  // 아코디언 접힘 상태 (key가 들어있으면 접힘 / 없으면 펼침) — 그룹/일반형 공용
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // 유형 칩 펼침 (Step 4) — 키 absent = 접힘(기본)
  const [expandedTypeChips, setExpandedTypeChips] = useState<Set<string>>(new Set());

  // 콘텐츠 풀
  const [contentPoolOpen, setContentPoolOpen] = useState(false);
  const [contentPoolForCustom, setContentPoolForCustom] = useState(false);
  const [contentPoolGroupId, setContentPoolGroupId] = useState<string | null>(null);
  const [contentPoolItems, setContentPoolItems] = useState<ContentPoolItem[]>([]);
  const [contentPoolLoading, setContentPoolLoading] = useState(false);
  const [contentPoolQuery, setContentPoolQuery] = useState('');
  const [contentPoolCategoryFilter, setContentPoolCategoryFilter] = useState<ContentCategory | ''>('');
  const [contentPreviewItem, setContentPreviewItem] = useState<ContentPoolItem | null>(null);
  const [contentSuggestLoading, setContentSuggestLoading] = useState<boolean[]>([]);

  // ── 3단계: 발송일 설정 ──
  const [deliveryInterval, setDeliveryInterval] = useState<DeliveryInterval | null>((configDraft.seededDeliveryInterval as DeliveryInterval | null) ?? null);
  const [startDate, setStartDate] = useState<string>(configDraft.seededStartDate ?? getDefaultStartDate());
  // 회차별 발송일 수동 변경분 (회차 index → 'YYYY-MM-DD'). 휴일 등으로 특정 회차만 옮길 때 사용.
  const [scheduleDateOverrides, setScheduleDateOverrides] = useState<Record<number, string>>({});

  // ── 저장/임시저장 토스트 ──
  const [showDraftToast, setShowDraftToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('임시저장 완료');

  // ── PPT 다운로드 ──
  const [isPptDownloading, setIsPptDownloading] = useState(false);

  // ── 저장소 불러오기 ──
  const [storageImportOpen, setStorageImportOpen] = useState(false);
  const [storageImportTargetId, setStorageImportTargetId] = useState<string>('general');

  function handleImportFromStorage(targetId: string, generated: GeneratedNewsletter, headline: string) {
    const key = `${activeRoundIdx}:${targetId}`;
    if (targetId === 'general') {
      setRoundTopic(activeRoundIdx, headline);
    } else {
      setGroupTopic(activeRoundIdx, targetId, headline);
    }
    setLivePreviewContent(prev => ({ ...prev, [key]: generated }));
    setGeneratedContent(prev => {
      const n = { ...prev, [activeRoundIdx]: generated };
      generatedContentRef.current = n;
      return n;
    });
    setRevealedPreviews(prev => new Set([...prev, key]));
    setStorageImportOpen(false);
  }

  // ── 미리보기 모달 ──
  const [previewOpen, setPreviewOpen] = useState(false);
  // 생성 확정 중복 저장 방지
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const [previewTab, setPreviewTab] = useState(0);
  // 미리보기 모달: 수신 리더 확인 오버레이 열림 여부
  const [showRecipients, setShowRecipients] = useState(false);
  // 실시간 미리보기 생성에 실패한 대상 키(`${roundIdx}:${targetId}`) — 무음 실패 대신 안내 표시용
  const [livePreviewErrors, setLivePreviewErrors] = useState<Set<string>>(new Set());
  // 미리보기 모달: 회차 내 그룹 탭 ('general' 또는 그룹 id)
  const [previewGroupId, setPreviewGroupId] = useState<string>('general');
  const [previewOpenGroups, setPreviewOpenGroups] = useState<Set<number>>(new Set([0]));
  const [generatedContent, setGeneratedContent] = useState<Record<number, GeneratedNewsletter>>({});
  // 최신 생성 결과 미러 (사전 생성 루프에서 stale closure 없이 참조)
  const generatedContentRef = useRef<Record<number, GeneratedNewsletter>>({});
  // 진행 중 회차 미러 (중복 호출 방지 — 클로저 stale 없이 즉시 참조)
  const [previewContentTab, setPreviewContentTab] = useState<Record<number, 'email' | 'full'>>({});
  // 본문 편집 모드 (미리보기 모달)
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<GeneratedNewsletter | null>(null);
  // 사용자가 본문을 직접 편집한 회차 (general) — "편집됨" 표시용 (콘텐츠 변경 시 해제)
  const editedRoundsRef = useRef<Set<number>>(new Set());

  // ── draft store 동기화 ──
  useEffect(() => {
    configDraft.setDraft({
      wizardStep, customStoryline, suggestions, rounds,
      totalRounds, roundDistribution, groupDescriptions,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, customStoryline, suggestions, rounds, totalRounds, roundDistribution, groupDescriptions]);

  // 새 뉴스레터 제작 시작(기업 선택/변경) 또는 나가기(초기화) 시 세션 캐시 초기화
  useEffect(() => {
    topicsCacheRef.current.clear();
    contentsCacheRef.current.clear();
  }, [configDraft.companyIds]);

  // 유형 배분(Step 4): 저장된 리더십 유형 정보가 로드되면, 카탈로그 유형 중
  // 아직 어느 그룹에도 없는 유형을 그룹으로 추가 (비동기 로드/진행 중 draft 보정)
  useEffect(() => {
    if (wizardStep !== 4) return;
    if (companyLeadershipInfo.length === 0) return;
    const catalogTypes = companyLeadershipInfo.map(i => i.type);
    setRounds(prev => {
      let changed = false;
      const next = prev.map(r => {
        const existing = new Set(r.customGroups.flatMap(g => g.types));
        const missing = catalogTypes.filter(t => !existing.has(t));
        if (missing.length === 0) return r;
        changed = true;
        const added = missing.map((t, i) => {
          const leaderIds = selectedParticipants.filter(p => p.leadershipType === t).map(p => p.id);
          return makeCustomGroup(`g-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`, [t], leaderIds);
        });
        return { ...r, customGroups: [...r.customGroups, ...added] };
      });
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, companyLeadershipInfo]);

  // Step 5 진입/회차 전환/탭 전환 시 — '현재 활성 탭'만 주제·콘텐츠 AI 자동 채움
  // (첫 탭만 바로 추천되고, 다른 그룹은 실제로 그 탭으로 넘어갔을 때 추천)
  useEffect(() => {
    if (wizardStep !== 5) return;
    const r = rounds[activeRoundIdx];
    if (!r) return;
    const activeGroups = r.customGroups.filter(g => g.types.length > 0);
    const tabIds = [...(r.generalLeaderIds.length > 0 ? ['general'] : []), ...activeGroups.map(g => g.id)];
    const current = tabIds.includes(previewTargetId) ? previewTargetId : (tabIds[0] ?? 'general');
    void autoFillTarget(activeRoundIdx, current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, activeRoundIdx, previewTargetId]);

  // 회차 전환 시 아코디언 초기화 (모두 펼침) + 미리보기 대상 일반형으로 리셋
  // 단, 최초 마운트에서는 seed된 그룹 탭(seededPreviewTargetId)을 유지한다.
  const skipFirstPreviewResetRef = useRef(true);
  useEffect(() => {
    setCollapsedSections(new Set());
    setSuggestionsTarget('general');
    if (skipFirstPreviewResetRef.current) {
      skipFirstPreviewResetRef.current = false;
    } else {
      setPreviewTargetId('general');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoundIdx]);

  // 생성 결과 미러 동기화
  useEffect(() => { generatedContentRef.current = generatedContent; }, [generatedContent]);

  // 이어서/수정 진입: 완료 회차 본문을 미리보기 표시 상태로 하이드레이션(최초 1회).
  // 완료 회차는 현재 구성과 동일 서명으로 표시해 불필요한 재생성(API 호출)을 막는다.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const seeded = configDraft.seededGeneratedContent;
    if (!seeded?.rounds?.length) return;
    const gen: Record<number, GeneratedNewsletter> = {};
    const live: Record<string, GeneratedNewsletter> = {};
    // 완료 회차는 미리보기를 즉시 공개 — 회차 전환 후 돌아와도 초기 화면이 아닌 완성 미리보기가 보이도록
    const revealed: string[] = [];
    seeded.rounds.forEach(sr => {
      const idx = (sr.vol ?? 0) - 1;
      if (idx < 0 || !sr.generated) return;
      const generated = sr.generated;
      gen[idx] = generated;
      const r = configDraft.rounds[idx];
      if (!r) {
        live[`${idx}:general`] = generated;
        revealed.push(`${idx}:general`);
        return;
      }
      // 완료 회차의 표시 대상(일반형 + 유형이 있는 그룹) 전부에 저장 본문을 복원·공개한다.
      // 일반형 리더가 없는 회차는 그룹 탭만 보이므로 general만 복원하면 빈 화면이 뜬다.
      const targets = [
        { id: 'general', topic: r.topic, ids: r.contents.map(c => c.id), interactions: r.interactions, surveys: r.surveys },
        ...r.customGroups.filter(g => g.types.length > 0).map(g => ({
          id: g.id, topic: g.topic, ids: g.contents.map(c => c.id), interactions: g.interactions, surveys: g.surveys,
        })),
      ];
      targets.forEach(t => {
        const key = `${idx}:${t.id}`;
        live[key] = generated;
        revealed.push(key);
        // 저장 본문과 동일 서명으로 표시해 불필요한 재생성(API 호출)을 막는다.
        livePreviewSigRef.current[key] = JSON.stringify({
          roundIdx: idx, targetId: t.id, topic: t.topic, ids: t.ids, interactions: t.interactions, surveys: t.surveys,
        });
      });
    });
    if (Object.keys(gen).length === 0) return;
    generatedContentRef.current = { ...generatedContentRef.current, ...gen };
    setGeneratedContent(prev => ({ ...gen, ...prev }));
    setLivePreviewContent(prev => ({ ...live, ...prev }));
    setRevealedPreviews(prev => new Set([...prev, ...revealed]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 미리보기 모달 열림: Step 5 실시간 미리보기 결과 재활용 + 미생성 회차 백그라운드 순차 생성(1회차 우선)
  useEffect(() => {
    if (!previewOpen) return;
    void runPreviewPregen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen]);

  // 미리보기 모달이 닫히면 수신 리더 오버레이도 함께 닫음
  useEffect(() => { if (!previewOpen) setShowRecipients(false); }, [previewOpen]);

  // Step 5: 본문을 주제/콘텐츠 기준으로 백그라운드 자동 생성 (debounce 1초)
  // - 저장·회차 본문에 쓰이는 general은 항상 준비하되, 그룹 본문은 '현재 활성 탭'만 생성한다.
  //   → 방문하지 않은 다른 그룹이 미리 생성돼 미리보기에 함께 뜨는 것을 방지.
  // - 인터랙션/만족도가 바뀌면 본문(실제 내용 기반 인터랙션)을 다시 생성해야 하므로 시그니처에 포함
  // - 주제/콘텐츠가 바뀌면 편집 보호와 무관하게 항상 재생성 · 현재 구성과 sig 다르면 재생성
  useEffect(() => {
    if (wizardStep !== 5) return;
    const r = rounds[activeRoundIdx];
    if (!r) return;
    const activeGroups = r.customGroups.filter(g => g.types.length > 0);
    const tabIds = [...(r.generalLeaderIds.length > 0 ? ['general'] : []), ...activeGroups.map(g => g.id)];
    const current = tabIds.includes(previewTargetId) ? previewTargetId : (tabIds[0] ?? 'general');
    const activeGroup = activeGroups.find(g => g.id === current);
    const targetList = [
      { targetId: 'general', topic: r.topic, ids: r.contents.map(c => c.id), interactions: r.interactions, surveys: r.surveys },
      ...(activeGroup ? [{ targetId: activeGroup.id, topic: activeGroup.topic, ids: activeGroup.contents.map(c => c.id), interactions: activeGroup.interactions, surveys: activeGroup.surveys }] : []),
    ];
    const timers = livePreviewTimers.current;
    targetList.forEach(({ targetId, topic, ids, interactions, surveys }) => {
      if (!topic.trim() && ids.length === 0) return; // 주제/콘텐츠 없으면 생성하지 않음
      const sig = JSON.stringify({ roundIdx: activeRoundIdx, targetId, topic, ids, interactions, surveys });
      const key = `${activeRoundIdx}:${targetId}`;
      if (livePreviewSigRef.current[key] === sig) return; // 현재 구성과 동일 — 이미 최신 (탭 전환 등)
      // 주제/콘텐츠 변경 → 편집 본문은 폐기하고 새로 생성 (general은 모달 캐시·편집 표시도 무효화)
      if (targetId === 'general') {
        editedRoundsRef.current.delete(activeRoundIdx);
        delete generatedContentRef.current[activeRoundIdx];
        setGeneratedContent(prev => { const n = { ...prev }; delete n[activeRoundIdx]; return n; });
      }
      if (timers[key]) clearTimeout(timers[key]);
      timers[key] = setTimeout(async () => {
        livePreviewSigRef.current[key] = sig;
        await generateLivePreview(activeRoundIdx, targetId);
      }, 1000);
    });
    return () => {
      targetList.forEach(({ targetId }) => {
        const key = `${activeRoundIdx}:${targetId}`;
        if (timers[key]) clearTimeout(timers[key]);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, activeRoundIdx, rounds, previewTargetId]);

  // Step 5: 콘텐츠 세부 방향(contentBrief)이 바뀌면 콘텐츠 자동 재추천 (debounce 900ms)
  // - 주제만 정해지면 바로 서칭하던 기존 흐름 대신, 주제+세부방향 시그니처를 함께 감시해
  //   세부방향을 입력할 틈 없이 즉시 실행되던 문제를 없앤다 (autoFillTarget은 더 이상 콘텐츠를 직접 호출하지 않음).
  // - 이미 콘텐츠가 담겨 있으면(수동이든 이전 자동 추천이든) 자동 재실행하지 않는다 — 덮어쓰기 방지.
  //   다시 담고 싶으면 '콘텐츠 다시 가져오기'를 직접 누른다.
  // - general은 항상 대상, 그룹은 본문 생성 debounce와 동일하게 '현재 활성 탭'만.
  useEffect(() => {
    if (wizardStep !== 5) return;
    const r = rounds[activeRoundIdx];
    if (!r) return;
    const activeGroups = r.customGroups.filter(g => g.types.length > 0);
    const tabIds = [...(r.generalLeaderIds.length > 0 ? ['general'] : []), ...activeGroups.map(g => g.id)];
    const current = tabIds.includes(previewTargetId) ? previewTargetId : (tabIds[0] ?? 'general');
    const activeGroup = activeGroups.find(g => g.id === current);
    const targetList = [
      { targetId: 'general', topic: r.topic, contents: r.contents, contentBrief: r.contentBrief ?? '' },
      ...(activeGroup ? [{ targetId: activeGroup.id, topic: activeGroup.topic, contents: activeGroup.contents, contentBrief: activeGroup.contentBrief ?? '' }] : []),
    ];
    const timers = contentSuggestTimers.current;
    targetList.forEach(({ targetId, topic, contents, contentBrief }) => {
      if (!topic.trim()) return; // 주제 없으면 추천하지 않음
      if (contents.length > 0) return; // 이미 콘텐츠가 있으면 자동 재실행하지 않음(덮어쓰기 방지)
      const sig = JSON.stringify({ roundIdx: activeRoundIdx, targetId, topic, contentBrief });
      const key = `${activeRoundIdx}:${targetId}`;
      if (contentSuggestSigRef.current[key] === sig) return; // 이미 이 시그니처로 시도함
      if (timers[key]) clearTimeout(timers[key]);
      timers[key] = setTimeout(() => {
        contentSuggestSigRef.current[key] = sig;
        if (targetId === 'general') void suggestContentsForRound(activeRoundIdx, topic);
        else void suggestGroupContents(activeRoundIdx, targetId, topic);
      }, 900);
    });
    return () => {
      targetList.forEach(({ targetId }) => {
        const key = `${activeRoundIdx}:${targetId}`;
        if (timers[key]) clearTimeout(timers[key]);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, activeRoundIdx, rounds, previewTargetId]);

  // 아코디언 펼침 여부 (collapsedSections에 없으면 펼침)
  function isSectionOpen(key: string): boolean {
    return !collapsedSections.has(key);
  }

  function toggleSectionKey(key: string) {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function togglePreviewGroup(stepIdx: number) {
    setPreviewOpenGroups(prev => {
      const next = new Set(prev);
      next.has(stepIdx) ? next.delete(stepIdx) : next.add(stepIdx);
      return next;
    });
  }


  // 모달 진입 시: 콘텐츠 구성 단계에서 만든 본문을 재활용만 함 (새로 생성하지 않음 — [수정5])
  // 미생성 회차는 탭 클릭 시 selectPreviewTab에서 지연 생성
  function runPreviewPregen() {
    const seed: Record<number, GeneratedNewsletter> = {};
    rounds.forEach((_, idx) => {
      const reused = livePreviewContent[`${idx}:general`];
      if (reused && !generatedContentRef.current[idx]) seed[idx] = reused;
    });
    if (Object.keys(seed).length > 0) {
      generatedContentRef.current = { ...generatedContentRef.current, ...seed };
      setGeneratedContent(prev => ({ ...seed, ...prev }));
    }
  }

  // 미리보기 모달: 회차 탭 클릭 — 저장된 데이터만 재활용 (API 호출 X)
  function selectPreviewTab(idx: number) {
    setPreviewTab(idx);
    setPreviewGroupId('general');
    setEditMode(false);
    setEditDraft(null);
    if (generatedContentRef.current[idx]) return; // 이미 보유
    const reused = livePreviewContent[`${idx}:general`]; // 콘텐츠 구성에서 만든 결과 재활용
    if (reused) {
      generatedContentRef.current = { ...generatedContentRef.current, [idx]: reused };
      setGeneratedContent(prev => ({ ...prev, [idx]: reused }));
    }
    // 없으면 생성하지 않음 — 모달은 저장된 데이터만 표시
  }

  // ── 본문 편집 (미리보기 모달) ──
  function startEdit() {
    const gen = generatedContent[previewTab];
    if (!gen) return;
    setEditDraft(JSON.parse(JSON.stringify(gen)) as GeneratedNewsletter); // 작업용 깊은 복사
    setEditMode(true);
  }
  function cancelEdit() {
    setEditMode(false);
    setEditDraft(null);
  }
  function saveEdit() {
    if (!editDraft) return;
    const idx = previewTab;
    generatedContentRef.current = { ...generatedContentRef.current, [idx]: editDraft };
    setGeneratedContent(prev => ({ ...prev, [idx]: editDraft }));
    // 좌측 실시간 미리보기(일반형)에도 반영
    setLivePreviewContent(prev => ({ ...prev, [`${idx}:general`]: editDraft }));
    editedRoundsRef.current.add(idx); // "편집됨" 표시 (콘텐츠 변경 시 자동 해제·재생성)
    setEditMode(false);
    setEditDraft(null);
  }
  function updateEditField(field: 'subject' | 'headline' | 'intro' | 'closing', value: string) {
    setEditDraft(prev => prev ? { ...prev, [field]: value } : prev);
  }
  function updateEditSection(secIdx: number, field: 'contentTitle' | 'subtitle' | 'intro' | 'mainBody' | 'examples' | 'summary' | 'keyTakeaway' | 'quote' | 'caseStudy', value: string) {
    setEditDraft(prev => {
      if (!prev) return prev;
      const sections = prev.sections.map((s, i) => i === secIdx ? { ...s, [field]: value } : s);
      return { ...prev, sections };
    });
  }
  // 본문 단락(body)은 빈 줄로 구분된 textarea로 편집
  function updateEditBody(secIdx: number, value: string) {
    setEditDraft(prev => {
      if (!prev) return prev;
      const list = value.split('\n\n').map(s => s.trim()).filter(Boolean);
      const sections = prev.sections.map((s, i) => i === secIdx ? { ...s, body: list } : s);
      return { ...prev, sections };
    });
  }
  // 데이터 박스(dataStat) 편집
  function updateEditDataStat(secIdx: number, field: 'value' | 'description', value: string) {
    setEditDraft(prev => {
      if (!prev) return prev;
      const sections = prev.sections.map((s, i) => i === secIdx ? { ...s, dataStat: { value: s.dataStat?.value ?? '', description: s.dataStat?.description ?? '', [field]: value } } : s);
      return { ...prev, sections };
    });
  }
  // Action Plan은 줄바꿈으로 구분된 textarea로 편집
  function updateEditActionPlan(secIdx: number, value: string) {
    setEditDraft(prev => {
      if (!prev) return prev;
      const list = value.split('\n').map(s => s.trim()).filter(Boolean);
      const sections = prev.sections.map((s, i) => i === secIdx ? { ...s, actionPlan: list } : s);
      return { ...prev, sections };
    });
  }

  // ── 실시간 미리보기 인라인 편집 핸들러 ──
  function handleInlineEdit(field: string, value: string) {
    const r = rounds[activeRoundIdx];
    if (!r) return;
    const activeGroups = r.customGroups.filter(g => g.types.length > 0);
    const tabs = [...(r.generalLeaderIds.length > 0 ? [{ id: 'general', label: '일반형' }] : []), ...activeGroups.map((g) => ({ id: g.id, label: g.types.join('·') || '새 그룹' }))];
    const currentTarget = tabs.some(t => t.id === previewTargetId) ? previewTargetId : (tabs[0]?.id ?? 'general');
    const key = `${activeRoundIdx}:${currentTarget}`;
    setLivePreviewContent(prev => {
      const gen = prev[key];
      if (!gen) return prev;
      const updated = JSON.parse(JSON.stringify(gen)) as typeof gen;
      // 최상위 필드
      if (field === 'subject' || field === 'headline' || field === 'intro' || field === 'closing') {
        (updated as Record<string, unknown>)[field] = value;
      }
      // 섹션 필드: section.{idx}.{field} 또는 section.{idx}.body.{paraIdx} 등
      const secMatch = field.match(/^section\.(\d+)\.(.+)$/);
      if (secMatch) {
        const secIdx = parseInt(secMatch[1]);
        const secField = secMatch[2];
        const sec = updated.sections[secIdx];
        if (sec) {
          if (secField === 'contentTitle') {
            // 이모지가 앞에 붙어 있으므로 기존 이모지 보존
            const emojiMatch = value.match(/^(\S+)\s+(.*)$/);
            if (emojiMatch) {
              sec.emoji = emojiMatch[1];
              sec.contentTitle = emojiMatch[2];
            } else {
              sec.contentTitle = value;
            }
          } else if (secField.startsWith('body.')) {
            const paraIdx = parseInt(secField.split('.')[1]);
            if (!sec.body) sec.body = [];
            sec.body[paraIdx] = value;
          } else if (secField === 'dataStat.value') {
            if (!sec.dataStat) sec.dataStat = { value: '', description: '' };
            // 📊 접두사 제거
            sec.dataStat.value = value.replace(/^📊\s*/, '');
          } else if (secField === 'dataStat.description') {
            if (!sec.dataStat) sec.dataStat = { value: '', description: '' };
            sec.dataStat.description = value;
          } else if (secField.startsWith('actionPlan.')) {
            const apIdx = parseInt(secField.split('.')[1]);
            if (!sec.actionPlan) sec.actionPlan = [];
            sec.actionPlan[apIdx] = value;
          } else {
            (sec as Record<string, unknown>)[secField] = value;
          }
        }
      }
      return { ...prev, [key]: updated };
    });
  }

  // 생성 결과 섹션에 콘텐츠 썸네일 매핑 (contentId 매칭)
  // thumbnail = 1순위(직접 등록), thumbnailUrl = 2순위(웹서칭 이미지) → 3순위(주제 Unsplash)
  function attachSectionThumbnails(data: GeneratedNewsletter, contents: ContentPoolItem[]): GeneratedNewsletter {
    return {
      ...data,
      sections: data.sections.map(s => {
        const item = contents.find(c => c.id === s.contentId);
        const registered = (item?.thumbnail && item.thumbnail.trim()) ? item.thumbnail : '';
        return {
          ...s,
          thumbnail: registered || s.thumbnail,                // 1순위: 직접 등록 썸네일
          thumbnailUrl: item?.thumbnailUrl || s.thumbnailUrl,  // 2순위: 웹서칭 이미지 → 3순위: 주제 Unsplash
        };
      }),
    };
  }

  // ── Step 5 좌측 실시간 미리보기: 그룹/일반형 단위로 generate API 호출 ──
  async function generateLivePreview(roundIdx: number, targetId: string) {
    const r = rounds[roundIdx];
    if (!r) return;
    const isCustom = targetId !== 'general';
    const group = isCustom ? r.customGroups.find(g => g.id === targetId) : undefined;
    if (isCustom && !group) return;
    const topic = isCustom ? (group?.topic ?? '') : r.topic;
    const contents = isCustom ? (group?.contents ?? []) : r.contents;
    const interactions = isCustom ? (group?.interactions ?? []) : r.interactions;
    const surveys = isCustom ? (group?.surveys ?? []) : r.surveys;
    const contentBrief = isCustom ? (group?.contentBrief ?? '') : (r.contentBrief ?? '');
    if (!topic.trim() && contents.length === 0) return;
    // '본문에 반영' 체크 + 파싱 성공한 추가 자료만 컨텍스트로 주입 (미체크·실패 자료는 제외)
    const referenceData = buildReferenceData(roundIdx, targetId);
    const key = `${roundIdx}:${targetId}`;
    setLivePreviewGenerating(prev => new Set([...prev, key]));
    setLivePreviewErrors(prev => { if (!prev.has(key)) return prev; const s = new Set(prev); s.delete(key); return s; });
    try {
      const res = await fetch('/api/newsletter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round: {
            id: r.id,
            topic,
            stepLabel: customStoryline[r.stepIndex]?.title ?? '',
            contents,
            interactions,
            surveys,
            contentBrief,
          },
          leadershipType: isCustom && group && group.types.length > 0 ? group.types.join(', ') : '일반형',
          companyName: targetCompanies.map(c => c.name).join(', ') || '대상 기업',
          referenceData,
          leadershipInfo: matchLeadershipInfo(isCustom && group && group.types.length > 0 ? group.types : []),
          // 원문 기반으로 도출된 그룹 설명이 본문 방향의 근거 (원문 직접 주입 대신)
          groupDescription: isCustom && group && group.types.length > 0
            ? groupDescriptions[groupCompositionKey(group.types)]
            : undefined,
        }),
      });
      if (!res.ok) throw new Error('생성 실패');
      const data = attachSectionThumbnails(await res.json() as GeneratedNewsletter, contents);
      setLivePreviewContent(prev => ({ ...prev, [key]: data }));
    } catch (e) {
      console.error('미리보기 생성 오류:', e);
      setLivePreviewErrors(prev => new Set(prev).add(key));
    } finally {
      setLivePreviewGenerating(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  }

  // 우측 '구성 완료' 버튼: 해당 대상의 미리보기를 공개하고, 아직 본문이 없으면 즉시 생성 트리거
  function revealPreview(roundIdx: number, targetId: string) {
    const key = `${roundIdx}:${targetId}`;
    setRevealedPreviews(prev => new Set(prev).add(key));
    if (!livePreviewContent[key] && !livePreviewGenerating.has(key)) {
      void generateLivePreview(roundIdx, targetId);
    }
  }

  // 하단 프롬프트 바: 현재 미리보기 대상의 본문을 프롬프트로 수정 (refine API)
  async function refinePreview(targetId: string) {
    if (isTargetLocked(activeRoundIdx, targetId)) { showToast('발송 완료된 그룹은 수정할 수 없습니다.'); return; }
    const key = `${activeRoundIdx}:${targetId}`;
    const current = livePreviewContent[key];
    const text = promptInput.trim();
    if (!current || !text || refining) return;
    // 수정 시에도 '반영' 체크된 추가 자료를 컨텍스트로 함께 전달
    const referenceData = buildReferenceData(activeRoundIdx, targetId);
    setRefining(true);
    try {
      const res = await fetch('/api/newsletter/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 현재 보고 있는 모드 전달 — 요약본(email)이면 요약 필드를, 전체본문(full)이면 본문을 수정
        body: JSON.stringify({ current, prompt: text, mode: livePreviewMode, referenceData }),
      });
      if (!res.ok) throw new Error('수정 실패');
      const data = await res.json() as GeneratedNewsletter;
      setLivePreviewContent(prev => ({ ...prev, [key]: data }));
      // 일반형이면 미리보기 모달 캐시·편집 표시에도 반영
      if (targetId === 'general') {
        generatedContentRef.current = { ...generatedContentRef.current, [activeRoundIdx]: data };
        setGeneratedContent(prev => ({ ...prev, [activeRoundIdx]: data }));
        editedRoundsRef.current.add(activeRoundIdx);
      }
      setPromptInput('');
    } catch (e) {
      console.error('프롬프트 수정 오류:', e);
    } finally {
      setRefining(false);
    }
  }

  // ── 1단계: 스토리라인 편집 함수 ──
  function openEditModal() {
    setDraftStoryline(customStoryline.map(s => ({ ...s })));
    setAiPrompt('');
    setAiRefineError(null);
    setIsEditingStoryline(true);
  }

  function saveStoryline() {
    setCustomStoryline(draftStoryline.map((s, i) => ({ ...s, step: i + 1 })));
    setIsEditingStoryline(false);
  }

  function updateDraftStep(idx: number, field: keyof Omit<StorylineStep, 'step'>, value: string) {
    setDraftStoryline(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  function addDraftStep() {
    setDraftStoryline(prev => [
      ...prev,
      { step: prev.length + 1, title: '새 단계', subtitle: '', description: '' },
    ]);
  }

  function removeDraftStep(idx: number) {
    if (draftStoryline.length <= 2) return;
    setDraftStoryline(prev =>
      prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 }))
    );
  }

  async function refineWithAI() {
    if (!aiPrompt.trim()) return;
    setIsAiRefining(true);
    setAiRefineError(null);
    try {
      const res = await fetch('/api/storyline/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStoryline: draftStoryline, prompt: aiPrompt }),
      });
      if (!res.ok) throw new Error('API 오류');
      const data = await res.json() as { storyline: StorylineStep[] };
      setDraftStoryline(data.storyline);
      setAiPrompt('');
    } catch {
      setAiRefineError('AI 수정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsAiRefining(false);
    }
  }

  // ── 2단계: 회차 설계 함수 ──
  const distSum = roundDistribution.reduce((s, d) => s + d.count, 0);

  function adjustCount(stepIdx: number, delta: number) {
    setRoundDistribution(prev =>
      prev.map(d => d.stepIndex === stepIdx ? { ...d, count: Math.max(0, d.count + delta) } : d)
    );
  }

  function handleTotalRoundsChange(val: number) {
    const min = customStoryline.length;
    const next = Math.max(min, val);
    setTotalRounds(next);
  }

  // 주제 추천 캐시 키 (서버 키와 동일 의미 — 회차+단계+유형+기업명+kind+그룹설명)
  function topicsCacheKey(leadershipTypes: string[], companyName: string, kind: string, stepTitle: string, roundIndex: number, groupDescription?: GroupDescription): string {
    const gd = groupDescription ? `${groupDescription.summary ?? ''}|${groupDescription.characteristics ?? ''}`.slice(0, 120) : '';
    return JSON.stringify({ roundIndex, stepTitle: stepTitle ?? '', types: [...leadershipTypes].sort(), companyName: companyName ?? '', kind, gd });
  }

  // 그룹 유형 조합의 그룹 설명 조회 (없으면 undefined — 서버는 유형 요약 기반 fallback)
  function groupDescriptionFor(types: string[] | undefined): GroupDescription | undefined {
    if (!types || types.length === 0) return undefined;
    return groupDescriptions[groupCompositionKey(types)];
  }

  // ── 3단계: 주제 선정 함수 ──
  async function fetchTopicsForRound(roundIdx: number, targetId: string = 'general') {
    setIsLoadingTopics(true);
    setTopicError(null);
    setSuggestions([]);
    setSuggestionsTarget(targetId);
    const isCustom = targetId !== 'general';
    try {
      const currentRound = rounds[roundIdx];
      const group = isCustom ? currentRound?.customGroups.find(g => g.id === targetId) : undefined;
      const leadershipTypes = (isCustom && group && group.types.length > 0) ? group.types : ['일반형'];
      const companyName = targetCompanies[0]?.name ?? '';
      const kind = isCustom ? '맞춤형' : '일반형';
      const stepTitle = currentRound ? (customStoryline[currentRound.stepIndex]?.title ?? '') : '';
      const groupDescription = isCustom ? groupDescriptionFor(group?.types) : undefined;
      const cacheKey = topicsCacheKey(leadershipTypes, companyName, kind, stepTitle, roundIdx + 1, groupDescription);
      const cachedTopics = topicsCacheRef.current.get(cacheKey);
      if (cachedTopics) { console.log('[client topics/suggest] 캐시 HIT'); setSuggestions(cachedTopics); return; }
      const res = await fetch('/api/topics/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadershipTypes, companyName, kind, stepTitle, roundIndex: roundIdx + 1, leadershipInfo: matchLeadershipInfo((leadershipTypes ?? []).filter(t => t !== '일반형')), groupDescription }),
      });
      if (!res.ok) throw new Error('API 오류');
      const data = await res.json() as { topics: TopicSuggestion[] };
      topicsCacheRef.current.set(cacheKey, data.topics ?? []);
      setSuggestions(data.topics ?? []);
    } catch {
      setTopicError('주제 추천을 불러오지 못했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoadingTopics(false);
    }
  }

  // 회차 진입 시 주제 자동 추천 → 첫 추천 자동 선택 (공유 suggestions UI 미사용)
  // 콘텐츠 자동 서칭은 여기서 바로 호출하지 않음 — 세부 방향(contentBrief)을 입력할 틈을
  // 주기 위해 별도 debounce effect(콘텐츠 세부 방향 감시)가 주제 설정 이후 담당한다.
  async function autoFillTarget(roundIdx: number, targetId: string) {
    const key = `${roundIdx}:${targetId}`;
    if (autoFilledRef.current.has(key)) return;
    const isCustom = targetId !== 'general';
    const r = rounds[roundIdx];
    if (!r) return;
    const group = isCustom ? r.customGroups.find(g => g.id === targetId) : undefined;
    if (isCustom && !group) return;
    const existingTopic = isCustom ? (group?.topic ?? '') : r.topic;
    autoFilledRef.current.add(key);
    if (existingTopic.trim()) return; // 이미 주제 있으면 가드만 등록하고 스킵
    // 주제 추천 호출 (실패 시 1회 자동 재시도) — 유형/단계/회차/기업명 모두 반영. 클라이언트 캐시 우선
    const requestTopics = async (): Promise<TopicSuggestion[] | null> => {
      const leadershipTypes = (isCustom && group && group.types.length > 0) ? group.types : ['일반형'];
      const companyName = targetCompanies[0]?.name ?? '';
      const kind = isCustom ? '맞춤형' : '일반형';
      const stepTitle = customStoryline[r.stepIndex]?.title ?? '';
      const groupDescription = isCustom ? groupDescriptionFor(group?.types) : undefined;
      const cacheKey = topicsCacheKey(leadershipTypes, companyName, kind, stepTitle, roundIdx + 1, groupDescription);
      const cachedTopics = topicsCacheRef.current.get(cacheKey);
      if (cachedTopics && cachedTopics.length) { console.log('[client topics/suggest] 캐시 HIT'); return cachedTopics; }
      const body = JSON.stringify({ leadershipTypes, companyName, kind, stepTitle, roundIndex: roundIdx + 1, leadershipInfo: matchLeadershipInfo((leadershipTypes ?? []).filter(t => t !== '일반형')), groupDescription });
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch('/api/topics/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
          if (res.ok) {
            const data = await res.json() as { topics: TopicSuggestion[] };
            if (data.topics?.length) { topicsCacheRef.current.set(cacheKey, data.topics); return data.topics; }
          }
        } catch { /* 재시도 */ }
      }
      return null;
    };
    setPreparingTargets(prev => new Set([...prev, key])); // 준비 중 표시 시작
    try {
      const topics = await requestTopics();
      const first = topics?.[0]?.title;
      if (!first) { autoFilledRef.current.delete(key); return; }
      if (isCustom) setGroupTopic(roundIdx, targetId, first);
      else setRoundTopic(roundIdx, first);
    } finally {
      setPreparingTargets(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  }

  function setRoundContentBrief(roundIdx: number, contentBrief: string) {
    if (isTargetLocked(roundIdx, 'general')) { showToast('발송 완료된 그룹은 수정할 수 없습니다.'); return; }
    setRounds(prev => prev.map((r, i) => i === roundIdx ? { ...r, contentBrief } : r));
  }

  function setRoundTopic(roundIdx: number, topic: string) {
    if (isTargetLocked(roundIdx, 'general')) { showToast('발송 완료된 그룹은 수정할 수 없습니다.'); return; }
    setRounds(prev => prev.map((r, i) => i === roundIdx ? { ...r, topic } : r));
  }

  function toggleInteraction(roundIdx: number, val: 'quiz' | 'scenario' | 'selfcheck' | 'reflection' | 'dodont') {
    if (isTargetLocked(roundIdx, 'general')) { showToast('발송 완료된 그룹은 수정할 수 없습니다.'); return; }
    setRounds(prev =>
      prev.map((r, i) => {
        if (i !== roundIdx) return r;
        const has = r.interactions.includes(val);
        return {
          ...r,
          interactions: has ? r.interactions.filter(v => v !== val) : [...r.interactions, val],
        };
      })
    );
  }

  function toggleSurvey(roundIdx: number, val: 'always' | 'periodic') {
    if (isTargetLocked(roundIdx, 'general')) { showToast('발송 완료된 그룹은 수정할 수 없습니다.'); return; }
    setRounds(prev =>
      prev.map((r, i) => {
        if (i !== roundIdx) return r;
        const has = r.surveys.includes(val);
        return {
          ...r,
          surveys: has ? r.surveys.filter(v => v !== val) : [...r.surveys, val],
        };
      })
    );
  }

  // ── 3단계: 콘텐츠 풀 함수 ──
  const loadContentPool = useCallback(async (q: string, cat: ContentCategory | '') => {
    setContentPoolLoading(true);
    try {
      const filter = cat ? { q: q || undefined, category: cat } : { q: q || undefined };
      const items = await getContentList(filter);
      setContentPoolItems(items);
    } finally {
      setContentPoolLoading(false);
    }
  }, []);

  function openContentPool(isCustom = false, groupId: string | null = null) {
    setContentPoolForCustom(isCustom);
    setContentPoolGroupId(groupId);
    setContentPoolQuery('');
    setContentPoolCategoryFilter('');
    void loadContentPool('', '');
    setContentPoolOpen(true);
  }

  // ── 발송완료 그룹 수정 잠금 ──
  // 타깃('general' 또는 그룹 id)이 커버하는 리더십 유형 목록
  function targetTypeNames(roundIdx: number, targetId: string): string[] {
    const r = rounds[roundIdx];
    if (!r) return [];
    if (targetId === 'general') return r.generalTypes ?? [];
    return r.customGroups.find(g => g.id === targetId)?.types ?? [];
  }
  // 편집 대상 회차·타깃이 이미 발송 완료되어 수정 불가인지
  function isTargetLocked(roundIdx: number, targetId: string): boolean {
    if (editingNewsletterId == null) return false;
    return isSendGroupSent(editingSentGroups, roundIdx + 1, targetTypeNames(roundIdx, targetId));
  }

  // 그룹 단위 업데이트 헬퍼 (발송완료 그룹은 변경 차단)
  function updateGroup(roundIdx: number, groupId: string, patch: (g: CustomGroup) => CustomGroup) {
    if (isTargetLocked(roundIdx, groupId)) { showToast('발송 완료된 그룹은 수정할 수 없습니다.'); return; }
    setRounds(prev => prev.map((r, i) =>
      i !== roundIdx ? r : { ...r, customGroups: r.customGroups.map(g => g.id === groupId ? patch(g) : g) }
    ));
  }

  function addContentToRound(item: ContentPoolItem) {
    if (isTargetLocked(activeRoundIdx, 'general')) { showToast('발송 완료된 그룹은 수정할 수 없습니다.'); return; }
    setRounds(prev =>
      prev.map((r, i) =>
        i !== activeRoundIdx ? r : {
          ...r,
          contents: r.contents.some(c => c.id === item.id) ? r.contents : [...r.contents, item],
        }
      )
    );
  }

  function removeContentFromRound(roundIdx: number, itemId: string) {
    if (isTargetLocked(roundIdx, 'general')) { showToast('발송 완료된 그룹은 수정할 수 없습니다.'); return; }
    setRounds(prev =>
      prev.map((r, i) =>
        i !== roundIdx ? r : { ...r, contents: r.contents.filter(c => c.id !== itemId) }
      )
    );
  }

  function setGroupTopic(roundIdx: number, groupId: string, topic: string) {
    updateGroup(roundIdx, groupId, g => ({ ...g, topic }));
  }

  function setGroupContentBrief(roundIdx: number, groupId: string, contentBrief: string) {
    updateGroup(roundIdx, groupId, g => ({ ...g, contentBrief }));
  }

  function addCustomContentToGroup(item: ContentPoolItem, groupId: string) {
    updateGroup(activeRoundIdx, groupId, g => ({
      ...g,
      contents: g.contents.some(c => c.id === item.id) ? g.contents : [...g.contents, item],
    }));
  }

  function removeCustomContentFromGroup(roundIdx: number, groupId: string, itemId: string) {
    updateGroup(roundIdx, groupId, g => ({ ...g, contents: g.contents.filter(c => c.id !== itemId) }));
  }

  function toggleGroupInteraction(roundIdx: number, groupId: string, val: 'quiz' | 'scenario' | 'selfcheck' | 'reflection' | 'dodont') {
    updateGroup(roundIdx, groupId, g => ({
      ...g,
      interactions: g.interactions.includes(val) ? g.interactions.filter(v => v !== val) : [...g.interactions, val],
    }));
  }

  function toggleGroupSurvey(roundIdx: number, groupId: string, val: 'always' | 'periodic') {
    updateGroup(roundIdx, groupId, g => ({
      ...g,
      surveys: g.surveys.includes(val) ? g.surveys.filter(v => v !== val) : [...g.surveys, val],
    }));
  }

  async function suggestContentsForRound(roundIdx: number, topic: string) {
    if (isTargetLocked(roundIdx, 'general')) { showToast('발송 완료된 그룹은 수정할 수 없습니다.'); return; }
    if (!topic.trim()) return;
    setContentSuggestLoading(prev => { const n = [...prev]; n[roundIdx] = true; return n; });
    try {
      const leadershipType = '일반형';
      const contentBrief = rounds[roundIdx]?.contentBrief?.trim() ?? '';
      const cacheKey = `${topic.trim()}|${leadershipType}|${contentBrief}`;
      let suggested = contentsCacheRef.current.get(cacheKey);
      if (suggested) {
        console.log('[client contents/suggest] 캐시 HIT');
      } else {
        const res = await fetch('/api/contents/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic,
            leadershipType,
            contentBrief,
            storyStage: customStoryline[rounds[roundIdx]?.stepIndex ?? 0]?.title ?? '',
            existingIds: rounds[roundIdx]?.contents.map(c => c.id) ?? [],
          }),
        });
        if (!res.ok) return;
        const data = await res.json() as { contents: ContentPoolItem[] };
        if (!data.contents?.length) return;
        suggested = data.contents;
        contentsCacheRef.current.set(cacheKey, suggested);
      }
      const picked = suggested;
      setRounds(prev =>
        prev.map((r, i) =>
          i !== roundIdx ? r : {
            ...r,
            contents: [...r.contents, ...picked.filter(s => !r.contents.some(c => c.id === s.id))],
          }
        )
      );
    } catch {
      // silently fail
    } finally {
      setContentSuggestLoading(prev => { const n = [...prev]; n[roundIdx] = false; return n; });
    }
  }

  async function suggestGroupContents(roundIdx: number, groupId: string, topic: string) {
    if (isTargetLocked(roundIdx, groupId)) { showToast('발송 완료된 그룹은 수정할 수 없습니다.'); return; }
    if (!topic.trim()) return;
    setContentSuggestLoading(prev => { const n = [...prev]; n[roundIdx] = true; return n; });
    try {
      const r = rounds[roundIdx];
      const group = r?.customGroups.find(g => g.id === groupId);
      const leadershipType = group && group.types.length ? group.types.join(', ') : '맞춤형';
      const contentBrief = group?.contentBrief?.trim() ?? '';
      const cacheKey = `${topic.trim()}|${leadershipType}|${contentBrief}`;
      let suggested = contentsCacheRef.current.get(cacheKey);
      if (suggested) {
        console.log('[client contents/suggest] 캐시 HIT');
      } else {
        const res = await fetch('/api/contents/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic,
            leadershipType,
            contentBrief,
            storyStage: customStoryline[r?.stepIndex ?? 0]?.title ?? '',
            existingIds: group?.contents.map(c => c.id) ?? [],
          }),
        });
        if (!res.ok) return;
        const data = await res.json() as { contents: ContentPoolItem[] };
        if (!data.contents?.length) return;
        suggested = data.contents;
        contentsCacheRef.current.set(cacheKey, suggested);
      }
      const picked = suggested;
      updateGroup(roundIdx, groupId, g => ({
        ...g,
        contents: [...g.contents, ...picked.filter(s => !g.contents.some(c => c.id === s.id))],
      }));
    } catch {
      // silently fail
    } finally {
      setContentSuggestLoading(prev => { const n = [...prev]; n[roundIdx] = false; return n; });
    }
  }

  // ── 네비게이션 ──
  function canGoNext(): boolean {
    if (wizardStep === 1) return configDraft.companyIds.length > 0;
    if (wizardStep === 2) return distSum === totalRounds && totalRounds >= customStoryline.length;
    if (wizardStep === 3) return !!startDate && !!deliveryInterval; // 발송 주기: 주기·시작일 선택 필수
    if (wizardStep === 4) return true;
    return true;
  }

  function goNext() {
    if (wizardStep >= 5 || !canGoNext()) return;
    if (wizardStep === 2) {
      const newBase = makeRoundsFromDistribution(roundDistribution);
      const newTotal = newBase.length;
      setRounds(prev => {
        const merged = prev.length === 0
          ? newBase
          : prev.length >= newTotal
            ? prev.slice(0, newTotal)
            : [...prev, ...newBase.slice(prev.length)];
        // 기본 그룹 초기화 (customGroups가 비어있는 회차에 부정 리더 전체를 그룹 1로)
        return merged.map(r => r.customGroups.length > 0 ? r : { ...r, customGroups: buildDefaultGroups() });
      });
      setActiveRoundIdx(0);
      setSuggestions([]);
      setDistributionRoundIdx(0);
    }
    if (wizardStep === 4) {
      // customGroups 기반으로 각 round의 leaderIds / newsletterType 자동 세팅
      const nextRounds = rounds.map(r => {
        // 그룹별 leaderIds 재계산 + 빈 그룹 제거
        const groups = r.customGroups
          .map(g => ({ ...g, leaderIds: selectedParticipants.filter(p => g.types.includes(p.leadershipType)).map(p => p.id) }))
          .filter(g => g.types.length > 0);
        const customLeaderIds = Array.from(new Set(groups.flatMap(g => g.leaderIds)));
        const generalLeaderIds = selectedParticipants.filter(p => !customLeaderIds.includes(p.id)).map(p => p.id);
        const customTypesAll = groups.flatMap(g => g.types);
        // 그룹에 없는(카탈로그 미매칭) 참여자 유형만 일반형으로 — 긍정/부정 구분 없이 실제 유형 기준
        const generalTypes = Array.from(new Set(selectedParticipants.map(p => p.leadershipType)))
          .filter(t => t && !customTypesAll.includes(t));
        return {
          ...r,
          customGroups: groups,
          customLeaderIds,
          generalLeaderIds,
          generalTypes,
          newsletterType: groups.length > 0 ? '맞춤형' as const : '일반형' as const,
        };
      });
      setRounds(nextRounds);
      setActiveRoundIdx(0);
      setSuggestions([]);
      // 현재 활성 회차(0)만 자동 구성 — Step 5 진입 effect가 활성 회차의 그룹/일반형을 채움
      setWizardStep(5);
      return;
    }
    setWizardStep(prev => (prev + 1) as WizardStep);
  }

  // 기본 그룹: 저장된 리더십 유형 정보(카탈로그)의 모든 유형 + 실제 직책자 유형을 유형별 그룹으로
  function buildDefaultGroups(): CustomGroup[] {
    const catalogTypes = companyLeadershipInfo.map(i => i.type);
    const participantTypes = [...new Set(selectedParticipants.map(p => p.leadershipType))];
    const allTypes = [...new Set<string>([...catalogTypes, ...participantTypes])];
    if (allTypes.length === 0) return [];
    // 저장한 유형별로 그룹 자동 생성 (해당 유형 직책자가 있으면 매핑)
    return allTypes.map((t, i) => {
      const leaderIds = selectedParticipants.filter(p => p.leadershipType === t).map(p => p.id);
      return makeCustomGroup(`g-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`, [t], leaderIds);
    });
  }

  function goPrev() {
    if (wizardStep > 1) { setWizardStep(prev => (prev - 1) as WizardStep); return; }
    // Step 1: 기업 선택 화면으로 복귀 + 기존 작업 내용(스토리라인/rounds 등) 초기화
    configDraft.resetDraft();
  }

  // 제작완료 시 회차별 생성 본문(전체본문 + 요약본) 저장 데이터 구성
  // 주기·시작일로 계산한 기본 발송일에, 회차별 수동 변경분(scheduleDateOverrides)을 덮어쓴 최종 발송일 배열.
  function getEffectiveScheduleDates(): Date[] {
    if (!startDate || !deliveryInterval) return [];
    const base = calcScheduleDates(startDate, deliveryInterval, rounds.length);
    return base.map((d, i) => {
      const ov = scheduleDateOverrides[i];
      if (ov) {
        const od = new Date(ov + 'T00:00:00');
        if (!Number.isNaN(od.getTime())) return od;
      }
      return d;
    });
  }

  // 최종 발송일(회차별 변경분 반영) 기준 총 발송 기간 라벨.
  function effectiveDurationLabel(): string {
    const dates = getEffectiveScheduleDates();
    if (dates.length <= 1) return '—';
    const first = dates[0];
    const last = dates[dates.length - 1];
    const startStr = first.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
    const endStr = last.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
    const totalDays = Math.round((last.getTime() - first.getTime()) / 86400000);
    const totalMonths = Math.max(1, Math.round(totalDays / 30));
    return `${startStr} ~ ${endStr} (약 ${totalMonths}개월)`;
  }

  function buildSavedContent(): SavedNewsletterContent | undefined {
    if (!startDate || !deliveryInterval) return undefined;
    const schedDates = getEffectiveScheduleDates();
    const leadershipLabel = leadershipTypes.join(', ');
    const savedRounds: SavedNewsletterRound[] = [];
    rounds.forEach((r, idx) => {
      // 실제로 구성된 타깃만 대상 — 카탈로그 백필로 존재하지만 손대지 않은 빈 그룹은 제외.
      const hasGeneralTarget = r.generalLeaderIds.length > 0 && (r.topic.trim().length > 0 || r.contents.length > 0);
      const configuredGroups = r.customGroups.filter(g => g.types.length > 0 && (g.topic.trim().length > 0 || g.contents.length > 0));
      const targets = [
        ...(hasGeneralTarget ? [{ groupId: 'general', types: [] as string[], label: '일반', interactions: r.interactions, surveys: r.surveys }] : []),
        ...configuredGroups.map(g => ({ groupId: g.id, types: g.types, label: g.types.join('·'), interactions: g.interactions, surveys: g.surveys })),
      ];

      const groups: SavedNewsletterGroup[] = targets.flatMap(t => {
        const gen = t.groupId === 'general'
          ? (generatedContent[idx] ?? livePreviewContent[`${idx}:general`])
          : livePreviewContent[`${idx}:${t.groupId}`];
        if (!gen) return [];
        return [{ groupId: t.groupId, types: t.types, label: t.label, generated: gen, interactions: t.interactions, surveys: t.surveys }];
      });
      if (groups.length === 0) return;

      const primary = groups[0];
      savedRounds.push({
        vol: idx + 1,
        dateLabel: schedDates[idx] ? formatKoreanDate(schedDates[idx]) : '',
        leadershipLabel,
        generated: primary.generated,
        interactions: primary.interactions,
        surveys: primary.surveys,
        groups,
      });
    });
    return savedRounds.length > 0 ? { rounds: savedRounds } : undefined;
  }

  // 이어서/수정 복원용 위저드 스냅샷
  function buildAuthoring() {
    // 이어만들기 복원용 마지막 위치: 그룹 설정(4단계)이면 그 단계 회차 탭, 그 외엔 콘텐츠 구성 회차
    const lastActiveRoundIdx = wizardStep === 4 ? distributionRoundIdx : activeRoundIdx;
    return {
      storyline: customStoryline, totalRounds, roundDistribution, rounds,
      startDate, deliveryInterval: deliveryInterval ?? undefined,
      lastWizardStep: wizardStep, lastActiveRoundIdx,
    };
  }

  async function handleSave(status: '제작 중' | '제작완료', savedContent?: SavedNewsletterContent) {
    const company = targetCompanies[0];
    const leadershipType = leadershipTypes.length > 0
      ? leadershipTypes[0]
      : '미지정';
    const autoTitle = `${company?.name ?? '대상 기업'} 리더십 코칭`.trim();
    // 긍정/부정 구분 없이 실제 참여자 유형 전체를 대상으로 저장
    const allLeaderTypes = [...new Set(selectedParticipants.map(p => p.leadershipType))].filter(Boolean);
    const payload = {
      title: autoTitle,
      companyId: company?.id ?? 0,
      companyName: company?.name ?? '미지정',
      leadershipType,
      status,
      stepCount: customStoryline.length,
      positiveLeaders: { types: [], count: 0 },
      negativeLeaders: { types: allLeaderTypes, count: selectedParticipants.length },
      totalRounds: customStoryline.length,
      completedRounds: status === '제작완료' ? customStoryline.length : 0,
      type: 'general' as const,
      leaderType: 'negative' as const,
      totalLeaders: selectedParticipants.length,
      // 수정 모드에서 본문을 새로 만들지 않았으면 기존 본문 보존
      generatedContent: savedContent ?? (editingNewsletterId != null ? (configDraft.seededGeneratedContent ?? undefined) : undefined),
      authoring: buildAuthoring(),
    };
    // 수정 모드면 기존 레코드 덮어쓰기, 아니면 새 캠페인 생성
    if (editingNewsletterId != null) {
      await updateNewsletter(editingNewsletterId, payload);
    } else {
      await addNewsletter(payload);
    }
    configDraft.resetDraft();
    router.push(`/admin/newsletters?tab=${encodeURIComponent(status)}`);
  }

  function handleSaveInPlace() {
    localStorage.setItem('newsletter_draft_saved', JSON.stringify({ savedByUser: true }));
    setToastMessage('저장되었습니다');
    setShowDraftToast(true);
    setTimeout(() => setShowDraftToast(false), 1500);
  }

  async function handleDraftSave() {
    // savedByUser 플래그 저장 → 복구 팝업 억제용
    localStorage.setItem('newsletter_draft_saved', JSON.stringify({ savedByUser: true }));
    // 뉴스레터 목록에 추가
    const company = targetCompanies[0];
    const leadershipType = leadershipTypes.length > 0
      ? leadershipTypes[0]
      : '미지정';
    // 긍정/부정 구분 없이 실제 참여자 유형 전체를 대상으로 저장
    const allLeaderTypes = [...new Set(selectedParticipants.map(p => p.leadershipType))].filter(Boolean);
    const draftPayload = {
      title: `${company?.name ?? '대상 기업'} 리더십 코칭`.trim(),
      companyId: company?.id ?? 0,
      companyName: company?.name ?? '미지정',
      leadershipType,
      status: '제작 중' as const,
      stepCount: customStoryline.length,
      positiveLeaders: { types: [], count: 0 },
      negativeLeaders: { types: allLeaderTypes, count: selectedParticipants.length },
      totalRounds: customStoryline.length,
      completedRounds: 0,
      type: 'general' as const,
      leaderType: 'negative' as const,
      totalLeaders: selectedParticipants.length,
      authoring: buildAuthoring(),
    };
    if (editingNewsletterId != null) {
      await updateNewsletter(editingNewsletterId, draftPayload);
    } else {
      await addNewsletter(draftPayload);
    }
    // sessionStorage(Zustand) 클리어 → 이후 새로 만들기 시 팝업 안 뜸
    configDraft.resetDraft();
    setToastMessage('임시저장 완료');
    setShowDraftToast(true);
    setTimeout(() => {
      setShowDraftToast(false);
      router.push('/admin/newsletters?tab=' + encodeURIComponent('제작 중'));
    }, 1500);
  }

  function handleComplete() {
    if (!deliveryInterval || !startDate) return;
    setPreviewTab(0);
    setPreviewOpenGroups(new Set([0]));
    setEditMode(false);
    setEditDraft(null);
    setPreviewOpen(true);
  }

  async function handleConfirmCreate() {
    if (!deliveryInterval || !startDate) return;
    if (confirmingRef.current) return; // 중복 저장 방지
    confirmingRef.current = true;
    setIsConfirming(true);
    const schedDates = getEffectiveScheduleDates();
    console.log('[뉴스레터 생성 완료]', {
      meta: { targetCompanies, leadershipTypes },
      storyline: customStoryline,
      totalRounds,
      roundDistribution,
      rounds,
      delivery: {
        interval: deliveryInterval,
        startDate,
        schedule: rounds.map((r, idx) => ({
          round: idx + 1,
          date: schedDates[idx]?.toISOString().split('T')[0] ?? '',
          stepTitle: customStoryline[r.stepIndex]?.title ?? '',
        })),
      },
    });
    try {
      await handleSave('제작완료', buildSavedContent());
    } catch {
      confirmingRef.current = false;
      setIsConfirming(false);
    }
  }

  function switchRound(idx: number) {
    setActiveRoundIdx(idx);
    setSuggestions([]);
    setTopicError(null);
  }

  // ── Step 4: 선택한 이전 회차의 유형 배분(맞춤형 그룹 구성)을 현재 회차에 동일하게 적용 ──
  // 그룹의 유형 묶음만 복사하고 인원(leaderIds)은 현재 대상자 기준으로 재계산. 콘텐츠는 복사하지 않음.
  function applyDistributionFrom(sourceIdx: number) {
    setRounds(prev => {
      const src = prev[sourceIdx];
      if (!src) return prev;
      return prev.map((round, i) => {
        if (i !== distributionRoundIdx) return round;
        const newGroups = src.customGroups.map(g =>
          makeCustomGroup(
            `g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            [...g.types],
            selectedParticipants.filter(p => g.types.includes(p.leadershipType)).map(p => p.id),
          ),
        );
        return { ...round, customGroups: newGroups };
      });
    });
    setCopyDistMenuOpen(false);
  }

  // ── Step 4: 현재 회차의 유형 배분을 다른 모든 회차에 동일하게 적용 ──
  function applyDistributionToAll() {
    setRounds(prev => {
      const src = prev[distributionRoundIdx];
      if (!src) return prev;
      return prev.map((round, i) => {
        if (i === distributionRoundIdx) return round;
        const newGroups = src.customGroups.map(g =>
          makeCustomGroup(
            `g-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
            [...g.types],
            selectedParticipants.filter(p => g.types.includes(p.leadershipType)).map(p => p.id),
          ),
        );
        return { ...round, customGroups: newGroups };
      });
    });
  }

  // ── Step 4: AI 그룹 설명 일괄 생성 ──
  // 전 회차의 모든 그룹(유형 있는) 구성을 유형 구성 키로 중복 제거하고, 기업 학습 유형 정보를 종합해 도출.
  async function generateAllGroupDescriptions() {
    const seen = new Map<string, string[]>(); // key → types
    rounds.forEach(r => r.customGroups.forEach(g => {
      if (g.types.length === 0) return;
      const key = groupCompositionKey(g.types);
      if (!seen.has(key)) seen.set(key, g.types);
    }));
    if (seen.size === 0) return;
    const groups = Array.from(seen.entries()).map(([key, types]) => ({
      key,
      types,
      typeInfos: matchLeadershipInfo(types),
    }));
    setGeneratingGroupDesc(true);
    try {
      const res = await fetch('/api/admin/leadership-info/group-describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: targetCompanies.map(c => c.name).join(', ') || '대상 기업', groups, companyId: leadershipCompanyId ?? undefined, infoYear: leadershipInfoYear }),
      });
      if (!res.ok) throw new Error('생성 실패');
      const data = (await res.json()) as { descriptions: Record<string, GroupDescription> };
      setGroupDescriptions(prev => ({ ...prev, ...data.descriptions }));
      // 생성된 그룹 설명 패널을 펼쳐 결과를 바로 보여줌
      setExpandedGroupDesc(() => {
        const next = new Set<string>();
        rounds.forEach(r => r.customGroups.forEach(g => {
          if (g.types.length > 0 && data.descriptions[groupCompositionKey(g.types)]) next.add(g.id);
        }));
        return next;
      });
    } catch (e) {
      console.error('그룹 설명 생성 오류:', e);
      alert('그룹 설명 생성 중 오류가 발생했습니다.');
    } finally {
      setGeneratingGroupDesc(false);
    }
  }

  // 그룹 설명 편집 — 유형 구성 키 기준으로 갱신(같은 구성의 다른 회차 그룹에도 반영)
  function updateGroupDescription(types: string[], field: keyof GroupDescription, value: string) {
    const key = groupCompositionKey(types);
    if (!key) return;
    setGroupDescriptions(prev => ({
      ...prev,
      [key]: {
        summary: prev[key]?.summary ?? '',
        characteristics: prev[key]?.characteristics ?? '',
        developmentPoints: prev[key]?.developmentPoints ?? '',
        [field]: value,
      },
    }));
  }

  function toggleGroupDescPanel(groupId: string) {
    setExpandedGroupDesc(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  }

  // ── Step 5: 타깃(일반형/그룹)별 추가 자료(파일) 업로드/파싱/삭제 ──
  // targetId === 'general' → Round.attachments, 그 외 → 해당 CustomGroup.attachments
  function patchTargetAttachments(
    roundIdx: number,
    targetId: string,
    updater: (list: RoundAttachment[]) => RoundAttachment[],
  ) {
    if (isTargetLocked(roundIdx, targetId)) { showToast('발송 완료된 그룹은 수정할 수 없습니다.'); return; }
    setRounds(prev => prev.map((r, i) => {
      if (i !== roundIdx) return r;
      if (targetId === 'general') return { ...r, attachments: updater(r.attachments ?? []) };
      return {
        ...r,
        customGroups: r.customGroups.map(g => g.id === targetId ? { ...g, attachments: updater(g.attachments ?? []) } : g),
      };
    }));
  }

  function getTargetAttachments(roundIdx: number, targetId: string): RoundAttachment[] {
    const r = rounds[roundIdx];
    if (!r) return [];
    if (targetId === 'general') return r.attachments ?? [];
    return r.customGroups.find(g => g.id === targetId)?.attachments ?? [];
  }

  function showToast(msg: string) {
    setToastMessage(msg);
    setShowDraftToast(true);
    setTimeout(() => setShowDraftToast(false), 2500);
  }

  async function uploadAttachments(roundIdx: number, targetId: string, files: FileList | File[]) {
    if (isTargetLocked(roundIdx, targetId)) { showToast('발송 완료된 그룹은 수정할 수 없습니다.'); return; }
    const list = Array.from(files);
    const current = getTargetAttachments(roundIdx, targetId);
    let slots = ATTACH_MAX_PER_TARGET - current.length;
    for (const file of list) {
      if (slots <= 0) { showToast(`자료는 타깃당 최대 ${ATTACH_MAX_PER_TARGET}개까지 첨부할 수 있어요`); break; }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ATTACH_ALLOWED_EXT.includes(ext)) { showToast(`${file.name}: 지원하지 않는 형식 (pdf/docx/txt/xlsx/csv)`); continue; }
      if (file.size > ATTACH_MAX_BYTES) { showToast(`${file.name}: 10MB를 초과했어요`); continue; }
      slots -= 1;
      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      patchTargetAttachments(roundIdx, targetId, prev => [
        ...prev,
        { id, name: file.name, mimeType: file.type, size: file.size, note: '', useForGeneration: false, parseStatus: 'parsing', uploadedAt: new Date().toISOString() },
      ]);
      // 업로드 즉시 파싱 — 추출 텍스트만 보관 (파일 바이트는 저장하지 않음)
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/newsletter/parse-attachment', { method: 'POST', body: fd });
        const data = await res.json() as { extractedText?: string; error?: string };
        if (!res.ok || !data.extractedText) throw new Error(data.error || '파싱 실패');
        patchTargetAttachments(roundIdx, targetId, prev => prev.map(a => a.id === id ? { ...a, parseStatus: 'done', extractedText: data.extractedText } : a));
      } catch (e) {
        const msg = e instanceof Error ? e.message : '파일을 분석할 수 없습니다.';
        patchTargetAttachments(roundIdx, targetId, prev => prev.map(a => a.id === id ? { ...a, parseStatus: 'error', parseError: msg } : a));
      }
    }
  }

  function removeAttachment(roundIdx: number, targetId: string, id: string) {
    patchTargetAttachments(roundIdx, targetId, prev => prev.filter(a => a.id !== id));
  }

  function setAttachmentNote(roundIdx: number, targetId: string, id: string, note: string) {
    patchTargetAttachments(roundIdx, targetId, prev => prev.map(a => a.id === id ? { ...a, note } : a));
  }

  function toggleAttachmentUse(roundIdx: number, targetId: string, id: string) {
    patchTargetAttachments(roundIdx, targetId, prev => prev.map(a => a.id === id ? { ...a, useForGeneration: !a.useForGeneration } : a));
  }

  // '본문에 반영' 체크 + 파싱 성공한 자료의 추출 텍스트만 모아 generate/refine 입력으로 사용
  function buildReferenceData(roundIdx: number, targetId: string): string {
    return getTargetAttachments(roundIdx, targetId)
      .filter(a => a.useForGeneration && a.parseStatus === 'done' && a.extractedText?.trim())
      .map(a => `[자료: ${a.name}${a.note ? ` — ${a.note}` : ''}]\n${a.extractedText!.trim()}`)
      .join('\n\n');
  }

  // ── Step 5: 주제/콘텐츠/인터랙션/만족도 4섹션 렌더 (일반형·맞춤형 그룹 공용) ──
  function renderContentSections(opts: {
    keyPrefix: string;
    targetId: string;
    topic: string;
    contents: ContentPoolItem[];
    interactions: ('quiz' | 'scenario' | 'selfcheck' | 'reflection' | 'dodont')[];
    surveys: ('always' | 'periodic')[];
    placeholder: string;
    setTopic: (t: string) => void;
    contentBrief: string;
    setContentBrief: (v: string) => void;
    suggestContents: (t: string) => void;
    removeContent: (itemId: string) => void;
    toggleInteractionFn: (v: 'quiz' | 'scenario' | 'selfcheck' | 'reflection' | 'dodont') => void;
    toggleSurveyFn: (v: 'always' | 'periodic') => void;
    openPool: () => void;
    attachments: RoundAttachment[];
    uploadAttachmentsFn: (files: FileList | File[]) => void;
    removeAttachmentFn: (id: string) => void;
    toggleAttachmentUseFn: (id: string) => void;
    setAttachmentNoteFn: (id: string, note: string) => void;
    locked?: boolean;
  }) {
    const { keyPrefix, targetId, topic, contents, interactions, surveys, placeholder, contentBrief, attachments, locked } = opts;
    const kTopic = `${keyPrefix}:2`, kContent = `${keyPrefix}:3`, kAttach = `${keyPrefix}:3b`, kInter = `${keyPrefix}:4`, kSurvey = `${keyPrefix}:5`;
    const attachDropId = `${keyPrefix}:attach`;
    const usedAttachCount = attachments.filter(a => a.useForGeneration && a.parseStatus === 'done').length;
    const fmtSize = (n: number) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
    const isTarget = suggestionsTarget === targetId;
    const targetKey = `${activeRoundIdx}:${targetId}`;
    // 주제 추천 로딩: 수동 재추천(isLoadingTopics+isTarget) 또는 초기 자동 준비 중 주제 미설정 단계
    const topicLoading = (isLoadingTopics && isTarget) || (preparingTargets.has(targetKey) && !topic.trim());
    return (
      <>
        {/* 저장소에서 불러오기 */}
        {!locked && (
          <button
            type="button"
            onClick={() => { setStorageImportTargetId(opts.targetId); setStorageImportOpen(true); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-dashed border-[#55A4DA]/50 hover:border-[#55A4DA] bg-[#55A4DA]/5 hover:bg-[#55A4DA]/10 transition-all group"
          >
            <svg className="w-4 h-4 text-[#55A4DA] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-bold text-[#2E7DB5]">저장소에서 불러오기</p>
              <p className="text-[11px] text-gray-400 mt-0.5">제작완료된 다른 뉴스레터를 그대로 가져옵니다</p>
            </div>
            <svg className="w-3.5 h-3.5 text-[#55A4DA]/50 group-hover:text-[#55A4DA] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {locked && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <p className="text-sm font-semibold text-emerald-700">이 그룹은 이미 발송되어 수정할 수 없습니다.</p>
          </div>
        )}
        <div className={`space-y-4 ${locked ? 'pointer-events-none select-none opacity-60' : ''}`} aria-disabled={locked}>
        {/* 주제 선정 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => toggleSectionKey(kTopic)} className="w-full px-5 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
            <p className="text-base font-medium text-gray-800 flex-1 text-left">주제 선정</p>
            {topic.trim() ? (<svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>) : (<span className="text-[11px] text-gray-400 flex-shrink-0">필수</span>)}
            <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${isSectionOpen(kTopic) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className={`grid transition-all duration-200 ${isSectionOpen(kTopic) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="border-t border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">이 회차 · 단계에 맞는 주제를 AI가 추천합니다.</p>
                  <button onClick={() => fetchTopicsForRound(activeRoundIdx, targetId)} disabled={isLoadingTopics} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 ml-3 ${isLoadingTopics ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#55A4DA] hover:bg-[#3A8BC4] text-white shadow-sm'}`}>
                    {isLoadingTopics ? (<><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>생성 중...</>) : (<><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>AI 재추천</>)}
                  </button>
                </div>
                {topicLoading ? (
                  <div className="flex items-center gap-2 px-3 py-3 rounded-xl border border-dashed border-[#55A4DA]/40 bg-[#55A4DA]/5">
                    <svg className="w-3.5 h-3.5 animate-spin text-[#55A4DA] flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                    <p className="text-xs text-[#55A4DA] font-medium">AI가 주제를 추천하고 있어요...</p>
                  </div>
                ) : (
                  <>
                    {topicError && isTarget && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                        <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-xs text-red-600 flex-1">{topicError}</p>
                        <button onClick={() => fetchTopicsForRound(activeRoundIdx, targetId)} className="text-xs font-semibold text-red-500 hover:text-red-700 whitespace-nowrap">재시도</button>
                      </div>
                    )}
                    {suggestions.length > 0 && isTarget ? (
                      <div className="space-y-2">
                        {suggestions.map((sg, idx) => {
                          const isSelected = topic === sg.title;
                          return (
                            <button key={idx} onClick={() => { opts.setTopic(sg.title); if (!contents.length) opts.suggestContents(sg.title); }} className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border-2 transition-all ${isSelected ? 'border-[#55A4DA] bg-[#55A4DA]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${isSelected ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'}`}>{isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}</div>
                              <div className="flex-1 min-w-0"><p className={`text-sm font-semibold leading-snug ${isSelected ? 'text-[#2E7DB5]' : 'text-gray-800'}`}>{sg.title}</p><p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{sg.description}</p></div>
                            </button>
                          );
                        })}
                      </div>
                    ) : topic.trim() ? (
                      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border-2 border-[#55A4DA] bg-[#55A4DA]/5">
                        <div className="w-4 h-4 rounded-full border-2 border-[#55A4DA] bg-[#55A4DA] flex items-center justify-center flex-shrink-0 mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-white" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-[#55A4DA] mb-0.5">AI 추천 주제</p>
                          <p className="text-sm font-semibold text-[#2E7DB5] leading-snug">{topic}</p>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
                <div>
                  <p className="text-[11px] text-gray-400 mb-1.5">직접 입력 또는 추천 주제 수정</p>
                  <input type="text" value={topic} disabled={topicLoading} onChange={e => opts.setTopic(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && topic.trim()) opts.suggestContents(topic.trim()); }} placeholder={placeholder} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed" />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* 콘텐츠 세부 방향 (선택) */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-base font-medium text-gray-800">콘텐츠 세부 방향</p>
            <span className="text-[11px] text-gray-400 flex-shrink-0">선택</span>
          </div>
          <p className="text-xs text-gray-500">이번 뉴스레터에 꼭 반영하고 싶은 관점·사례·키워드가 있다면 적어주세요. AI 콘텐츠 수집·본문 생성에 우선 반영됩니다.</p>
          <textarea
            value={contentBrief}
            onChange={e => opts.setContentBrief(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition resize-y"
          />
        </div>
        {/* 콘텐츠 선택 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div onClick={() => toggleSectionKey(kContent)} className="px-5 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors cursor-pointer">
            <p className="text-base font-medium text-gray-800 flex-1">콘텐츠 선택</p>
            {contents.length > 0 ? (<span className="text-[11px] font-semibold text-[#55A4DA] flex-shrink-0">{contents.length}개 선택됨</span>) : (<span className="text-[11px] text-gray-400 flex-shrink-0">선택사항</span>)}
            <button onClick={e => { e.stopPropagation(); if (topic.trim()) opts.suggestContents(topic.trim()); }} disabled={!topic.trim() || contentSuggestLoading[activeRoundIdx]} className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ml-2 flex-shrink-0 border ${!topic.trim() || contentSuggestLoading[activeRoundIdx] ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-[#55A4DA] text-[#55A4DA] hover:bg-[#55A4DA]/5'}`} title={topic.trim() ? '현재 주제로 콘텐츠 다시 가져오기' : '주제를 먼저 선택하세요'}><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>콘텐츠 다시 가져오기</button>
            <button onClick={e => { e.stopPropagation(); opts.openPool(); }} className="flex items-center gap-1 px-2.5 py-1 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-xs font-bold rounded-lg transition-colors ml-1.5 flex-shrink-0"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>콘텐츠 풀</button>
            <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${isSectionOpen(kContent) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
          <div className={`grid transition-all duration-200 ${isSectionOpen(kContent) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="border-t border-gray-100 p-4">
                {contents.length === 0 && !contentSuggestLoading[activeRoundIdx] ? (
                  <button onClick={() => opts.openPool()} className="w-full py-5 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-colors flex flex-col items-center gap-1.5"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>콘텐츠 풀에서 선택하세요</button>
                ) : (
                  <div className="space-y-2">
                    {contents.map(item => (
                      <div key={item.id} className="border border-gray-100 rounded-xl px-3 pt-2.5 pb-2 group bg-gray-50">
                        <div className="flex items-center gap-3">
                          {item.thumbnail && <img src={item.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 bg-gray-200" />}
                          <div className="flex-1 min-w-0"><div className="flex items-center gap-1 mb-0.5"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.type === 'original' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{item.type === 'original' ? 'J& 오리지널' : '큐레이션'}</span><span className="text-[10px] text-gray-400">{item.category} · {item.duration}분</span></div><p className="text-xs font-semibold text-gray-700 truncate">{item.title}</p></div>
                          <button onClick={() => opts.removeContent(item.id)} className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        {item.body && <button onClick={() => setContentPreviewItem(item)} className="mt-1.5 text-[11px] text-[#55A4DA] hover:text-[#2E7DB5] font-medium transition-colors">내용 보기 →</button>}
                      </div>
                    ))}
                    {contentSuggestLoading[activeRoundIdx] && (<div className="flex items-center gap-2 px-3 py-3 rounded-xl border border-dashed border-[#55A4DA]/40 bg-[#55A4DA]/5"><svg className="w-3.5 h-3.5 animate-spin text-[#55A4DA] flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg><p className="text-xs text-[#55A4DA] font-medium">AI가 콘텐츠를 선택하는 중...</p></div>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* 추가 자료 업로드 — 조직 진단 결과 등을 첨부하고 '본문에 반영' 체크한 자료만 생성에 사용 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div onClick={() => toggleSectionKey(kAttach)} className="px-5 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors cursor-pointer">
            <p className="text-base font-medium text-gray-800 flex-1">추가 자료 업로드</p>
            {usedAttachCount > 0
              ? (<span className="text-[11px] font-semibold text-[#55A4DA] flex-shrink-0">{usedAttachCount}개 반영</span>)
              : attachments.length > 0
                ? (<span className="text-[11px] text-gray-400 flex-shrink-0">{attachments.length}개 · 미반영</span>)
                : (<span className="text-[11px] text-gray-400 flex-shrink-0">선택사항</span>)}
            <label
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-xs font-bold rounded-lg transition-colors ml-1.5 flex-shrink-0 cursor-pointer"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              파일 추가
              <input type="file" multiple accept={ATTACH_ACCEPT} className="hidden" onChange={e => { if (e.target.files?.length) opts.uploadAttachmentsFn(e.target.files); e.target.value = ''; }} />
            </label>
            <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${isSectionOpen(kAttach) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
          <div className={`grid transition-all duration-200 ${isSectionOpen(kAttach) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="border-t border-gray-100 p-4 space-y-3">
                <p className="text-[11px] text-gray-400">조직 진단 결과(엑셀·PDF 등)를 첨부하면 분포·수치를 추출해, <span className="font-semibold text-gray-500">‘본문에 반영’ 체크한 자료만</span> 생성·수정에 사용합니다. (pdf · docx · txt · xlsx · csv · 최대 10MB · 타깃당 {ATTACH_MAX_PER_TARGET}개)</p>
                {/* 드롭존 */}
                <label
                  className={`flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl py-5 px-4 cursor-pointer transition-colors ${
                    attachDragTarget === attachDropId ? 'border-[#55A4DA] bg-[#55A4DA]/10' : 'border-gray-200 hover:border-[#55A4DA]/50 hover:bg-[#55A4DA]/5'
                  }`}
                  onDragOver={e => { e.preventDefault(); setAttachDragTarget(attachDropId); }}
                  onDragLeave={() => setAttachDragTarget(null)}
                  onDrop={e => { e.preventDefault(); setAttachDragTarget(null); if (e.dataTransfer.files.length) opts.uploadAttachmentsFn(e.dataTransfer.files); }}
                >
                  <input type="file" multiple accept={ATTACH_ACCEPT} className="hidden" onChange={e => { if (e.target.files?.length) opts.uploadAttachmentsFn(e.target.files); e.target.value = ''; }} />
                  <svg className="w-5 h-5 text-[#55A4DA] mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3-3m0 0l3 3m-3-3v9" /></svg>
                  <span className="text-xs text-gray-400">파일을 끌어다 놓거나 클릭해 업로드</span>
                </label>
                {/* 업로드 목록 */}
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    {attachments.map(a => {
                      const isError = a.parseStatus === 'error';
                      const isParsing = a.parseStatus === 'parsing';
                      const canUse = a.parseStatus === 'done';
                      return (
                        <div key={a.id} className={`border rounded-xl px-3 py-2.5 ${isError ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-gray-50'}`}>
                          <div className="flex items-center gap-2.5">
                            {/* 반영 체크박스 — 파싱 성공한 자료만 활성 */}
                            <button
                              onClick={() => canUse && opts.toggleAttachmentUseFn(a.id)}
                              disabled={!canUse}
                              title={canUse ? '본문에 반영' : (isParsing ? '분석 중' : '분석 실패 — 반영 불가')}
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                a.useForGeneration && canUse ? 'border-[#55A4DA] bg-[#55A4DA]' : canUse ? 'border-gray-300 hover:border-[#55A4DA]' : 'border-gray-200 cursor-not-allowed'
                              }`}
                            >
                              {a.useForGeneration && canUse && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" /></svg>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold text-gray-700 truncate">{a.name}</p>
                                <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtSize(a.size)}</span>
                              </div>
                              {/* 상태 표시 */}
                              {isParsing && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-[#55A4DA] mt-0.5">
                                  <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                                  데이터 분석 중...
                                </span>
                              )}
                              {isError && <span className="block text-[10px] text-red-500 mt-0.5">분석 실패 — 본문에 반영되지 않아요{a.parseError ? ` (${a.parseError})` : ''}</span>}
                              {canUse && <span className="block text-[10px] text-emerald-600 mt-0.5">분석 완료 · {a.useForGeneration ? '본문에 반영됨' : '체크하면 반영'}</span>}
                            </div>
                            <button onClick={() => opts.removeAttachmentFn(a.id)} className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors" title="삭제"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                          </div>
                          <input
                            type="text"
                            value={a.note}
                            onChange={e => opts.setAttachmentNoteFn(a.id, e.target.value)}
                            placeholder="메모 (예: 2024 리더십 진단 분포)"
                            className="w-full mt-1.5 text-[11px] text-gray-600 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-[#55A4DA] focus:outline-none py-0.5 placeholder-gray-300"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* 인터랙션 요소 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => toggleSectionKey(kInter)} className="w-full px-5 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
            <p className="text-base font-medium text-gray-800 flex-1 text-left">인터랙션 요소</p>
            {interactions.length > 0 ? (<span className="text-[11px] font-semibold text-[#55A4DA] flex-shrink-0">{interactions.map(v => INTERACTION_LABELS[v] ?? v).join(' · ')}</span>) : (<span className="text-[11px] text-gray-400 flex-shrink-0">선택사항</span>)}
            <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${isSectionOpen(kInter) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className={`grid transition-all duration-200 ${isSectionOpen(kInter) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="border-t border-gray-100 p-5 space-y-2">
                <p className="text-xs text-gray-400 mb-3">학습 참여도를 높이는 인터랙션 요소를 선택하세요. 복수 선택 가능합니다.</p>
                {([{ val: 'quiz' as const, label: '퀴즈', desc: '학습 내용 확인 퀴즈' }, { val: 'scenario' as const, label: '선택형 시나리오', desc: '상황을 주고 A/B/C 중 선택하면 유형별 피드백을 주는 인터랙션' }, { val: 'selfcheck' as const, label: '셀프 진단/체크리스트', desc: '정답 없이 스스로를 점검하는 체크리스트 (예: 나는 팀원 의견을 충분히 듣는가?)' }, { val: 'reflection' as const, label: '회고 질문', desc: '성찰을 유도하는 열린 질문 (예: 이번 주 바꾸고 싶은 내 행동은?)' }, { val: 'dodont' as const, label: "Do & Don't 리스트", desc: '해야 할 것과 하지 말아야 할 것을 명확하게 정리한 실천 가이드' }]).map(({ val, label, desc }) => {
                  const checked = interactions.includes(val);
                  return (<button key={val} onClick={() => opts.toggleInteractionFn(val)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${checked ? 'border-[#55A4DA] bg-[#55A4DA]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}><div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'}`}>{checked && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div><div><p className={`text-sm font-semibold ${checked ? 'text-[#2E7DB5]' : 'text-gray-700'}`}>{label}</p><p className="text-[11px] text-gray-400">{desc}</p></div></button>);
                })}
              </div>
            </div>
          </div>
        </div>
        {/* 만족도 조사 */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => toggleSectionKey(kSurvey)} className="w-full px-5 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors">
            <p className="text-base font-medium text-gray-800 flex-1 text-left">만족도 조사</p>
            {surveys.length > 0 ? (<span className="text-[11px] font-semibold text-[#55A4DA] flex-shrink-0">{surveys.map(v => v === 'always' ? '상시' : '정기').join(' · ')}</span>) : (<span className="text-[11px] text-gray-400 flex-shrink-0">선택사항</span>)}
            <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1 transition-transform duration-200 ${isSectionOpen(kSurvey) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className={`grid transition-all duration-200 ${isSectionOpen(kSurvey) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="border-t border-gray-100 p-5 space-y-2">
                <p className="text-xs text-gray-400 mb-3">이 회차에 포함할 만족도 조사를 선택하세요. 중복 선택 가능합니다.</p>
                {([{ val: 'always' as const, label: '상시 만족도 조사', desc: '매 회차 발송 후 수집' }, { val: 'periodic' as const, label: '정기 만족도 조사', desc: '주기적으로 심층 수집' }]).map(({ val, label, desc }) => {
                  const checked = surveys.includes(val);
                  return (<button key={val} onClick={() => opts.toggleSurveyFn(val)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${checked ? 'border-[#55A4DA] bg-[#55A4DA]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}><div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'}`}>{checked && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div><div><p className={`text-sm font-semibold ${checked ? 'text-[#2E7DB5]' : 'text-gray-700'}`}>{label}</p><p className="text-[11px] text-gray-400">{desc}</p></div></button>);
                })}
              </div>
            </div>
          </div>
        </div>
        </div>
      </>
    );
  }

  // ── Step 5: 좌측 실시간 미리보기 (우측 편집 내용을 그대로 반영) ──
  function renderLivePreview(targetId: string) {
    const r = rounds[activeRoundIdx];
    if (!r) return null;
    const isCustom = targetId !== 'general';
    const activeGroups = r.customGroups.filter(g => g.types.length > 0);
    const group = isCustom ? activeGroups.find(g => g.id === targetId) : undefined;
    const topic = isCustom ? (group?.topic ?? '') : r.topic;
    const contents = isCustom ? (group?.contents ?? []) : r.contents;
    const interactions = isCustom ? (group?.interactions ?? []) : r.interactions;
    const surveys = isCustom ? (group?.surveys ?? []) : r.surveys;
    const firstThumbnail = contents[0]?.thumbnail ?? '';
    const hasConfig = topic.trim().length > 0 || contents.length > 0 || interactions.length > 0 || surveys.length > 0;
    const leadershipLabel = isCustom ? (group?.types.join(', ') ?? '') : '일반형';
    const key = `${activeRoundIdx}:${targetId}`;
    const generated = livePreviewContent[key];
    // 백그라운드 준비 중(주제 추천·콘텐츠 서칭) 또는 본문 생성 중 여부
    const preparing = preparingTargets.has(key) || livePreviewGenerating.has(key);
    // '구성 완료' 버튼을 누르기 전에는 미리보기를 표시하지 않음 (우측 구성 패널 하단 버튼으로 공개)
    const revealed = revealedPreviews.has(key);
    if (!revealed) {
      return (
        <div className="h-full min-h-[480px] rounded-2xl shadow-md border border-[#D6EAF8] bg-white flex flex-col items-center justify-center py-20 px-6 gap-3 text-center">
          <svg className="w-9 h-9 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <p className="text-sm font-semibold text-gray-700">구성을 완료하면 미리보기가 표시됩니다</p>
          <p className="text-xs text-gray-400 leading-relaxed">오른쪽에서 주제·콘텐츠를 구성한 뒤<br />하단의 &lsquo;구성 완료 · 미리보기 보기&rsquo; 버튼을 눌러주세요</p>
        </div>
      );
    }

    if (!hasConfig) {
      // 준비 중이면 로딩 안내, 아니면 빈 상태
      if (preparing) {
        return (
          <div className="h-full min-h-[480px] rounded-2xl shadow-md border border-[#D6EAF8] bg-white flex flex-col items-center justify-center py-20 px-6 gap-3 text-center">
            <svg className="w-8 h-8 text-[#2B9EE8] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
            <p className="text-sm font-semibold text-gray-700">AI가 콘텐츠를 준비하고 있어요...</p>
            <p className="text-xs text-gray-400">주제 추천 → 콘텐츠 선택 → 본문 생성 (약 1분 소요)</p>
          </div>
        );
      }
      return (
        <div className="h-full min-h-[480px] rounded-2xl shadow-md border border-[#D6EAF8] bg-white flex flex-col items-center justify-center py-20 px-6 gap-2 text-center">
          <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <p className="text-xs text-gray-400">콘텐츠를 추가하면 여기에 표시됩니다</p>
        </div>
      );
    }

    // AI 본문이 아직 없을 때: 본문 영역은 로딩, 인터랙션/만족도 템플릿은 즉시 표시
    if (!generated) {
      return (
        <div className="bg-white max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-sm border border-gray-100 break-keep break-words">
          {/* 상단 네비게이션 */}
          <div className="px-6 sm:px-8 py-4 flex items-center justify-between border-b border-gray-100">
            <img src="/logo-jc.png" alt="J&Company" className="h-9 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <p className="text-xs text-[#6B7280]">Vol.{activeRoundIdx + 1}{leadershipLabel ? ` · ${leadershipLabel}` : ''}</p>
          </div>
          <div className="px-6 sm:px-8 py-10">
            <div className="rounded-2xl py-16 px-5 border border-[#E1EFFB] flex flex-col items-center justify-center gap-3 text-center" style={{ backgroundColor: '#F0F7FF' }}>
              <svg className="w-7 h-7 text-[#2B9EE8] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
              <p className="text-sm font-semibold text-gray-700">AI가 콘텐츠를 준비하고 있어요...</p>
              <p className="text-xs text-gray-400">본문을 생성하고 있어요 (약 1분 소요)</p>
            </div>
            {renderInteractionTemplates(interactions)}
            {renderSurveyTemplates(surveys, { contentLabels: contents.map(c => c.title), interactionLabels: interactions.map(k => INTERACTION_LABELS[k] ?? k) })}
          </div>
        </div>
      );
    }

    if (livePreviewMode === 'email') {
      return renderNewsletterEmailPreview(generated, { vol: activeRoundIdx + 1, dateLabel: '발송일 미정', firstThumbnail, onReadFull: () => setLivePreviewMode('full') });
    }
    return renderGeneratedFullBody(generated, { vol: activeRoundIdx + 1, dateLabel: '발송일 미정', leadershipLabel, firstThumbnail, templateInteractions: interactions, templateSurveys: surveys, templateSurveyContentLabels: contents.map(c => c.title), templateSurveyInteractionLabels: interactions.map(k => INTERACTION_LABELS[k] ?? k), onInlineEdit: handleInlineEdit });
  }

  // ── 본문 편집 패널 (미리보기 모달) ──
  function renderEditPanel() {
    if (!editDraft) return null;
    const labelCls = 'text-xs font-bold text-gray-500 mb-1.5 block';
    const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-[#55A4DA] focus:outline-none focus:ring-1 focus:ring-[#55A4DA]/30 transition-colors';
    const areaCls = inputCls + ' resize-y leading-relaxed';
    return (
      <div className="bg-white rounded-2xl border border-gray-200 max-w-2xl mx-auto p-6 space-y-5">
        <div className="flex items-center gap-2 pb-1">
          <svg className="w-4 h-4 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          <p className="text-sm font-bold text-gray-800">본문 편집</p>
        </div>
        <div>
          <label className={labelCls}>이번 호 제목 (subject)</label>
          <input className={inputCls} value={editDraft.subject} onChange={e => updateEditField('subject', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>헤드라인 (headline)</label>
          <textarea className={areaCls} rows={2} value={editDraft.headline} onChange={e => updateEditField('headline', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>인트로 (intro)</label>
          <textarea className={areaCls} rows={3} value={editDraft.intro} onChange={e => updateEditField('intro', e.target.value)} />
        </div>
        <div className="space-y-4 pt-1">
          <p className="text-xs font-bold text-gray-500">콘텐츠 섹션</p>
          {editDraft.sections.map((sec, i) => (
            <div key={sec.contentId ?? i} className="rounded-xl border border-gray-100 p-4 space-y-3" style={{ backgroundColor: '#F8FAFC' }}>
              <div>
                <label className={labelCls}>{i + 1}. 제목</label>
                <input className={inputCls} value={sec.contentTitle} onChange={e => updateEditSection(i, 'contentTitle', e.target.value)} />
              </div>
              {sec.summary !== undefined && sec.body === undefined && sec.intro === undefined ? (
                <div>
                  <label className={labelCls}>요약</label>
                  <textarea className={areaCls} rows={2} value={sec.summary} onChange={e => updateEditSection(i, 'summary', e.target.value)} />
                </div>
              ) : (
                <>
                  <div>
                    <label className={labelCls}>부제</label>
                    <input className={inputCls} value={sec.subtitle ?? ''} onChange={e => updateEditSection(i, 'subtitle', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>도입</label>
                    <textarea className={areaCls} rows={2} value={sec.intro ?? ''} onChange={e => updateEditSection(i, 'intro', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>본문 (단락은 빈 줄로 구분)</label>
                    <textarea className={areaCls} rows={5} value={(sec.body && sec.body.length ? sec.body.join('\n\n') : (sec.mainBody ?? ''))} onChange={e => updateEditBody(i, e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>💬 인용구</label>
                    <input className={inputCls} value={sec.quote ?? ''} onChange={e => updateEditSection(i, 'quote', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={labelCls}>📊 수치</label>
                      <input className={inputCls} value={sec.dataStat?.value ?? ''} onChange={e => updateEditDataStat(i, 'value', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>데이터 설명</label>
                      <input className={inputCls} value={sec.dataStat?.description ?? ''} onChange={e => updateEditDataStat(i, 'description', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>💼 실제 사례</label>
                    <textarea className={areaCls} rows={2} value={sec.caseStudy ?? ''} onChange={e => updateEditSection(i, 'caseStudy', e.target.value)} />
                  </div>
                </>
              )}
              <div>
                <label className={labelCls}>💡 핵심 포인트</label>
                <textarea className={areaCls} rows={2} value={sec.keyTakeaway ?? ''} onChange={e => updateEditSection(i, 'keyTakeaway', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>✅ Action Plan (한 줄에 하나씩)</label>
                <textarea className={areaCls} rows={3} value={(sec.actionPlan ?? []).join('\n')} onChange={e => updateEditActionPlan(i, e.target.value)} placeholder={'오늘 당장 할 수 있는 행동\n이번 주에 시도해볼 행동\n지속적으로 적용할 행동'} />
              </div>
            </div>
          ))}
        </div>
        <div>
          <label className={labelCls}>마무리 (closing)</label>
          <textarea className={areaCls} rows={3} value={editDraft.closing} onChange={e => updateEditField('closing', e.target.value)} />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button onClick={cancelEdit} className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">취소</button>
          <button onClick={saveEdit} className="px-5 py-2 text-sm font-bold bg-[#55A4DA] hover:bg-[#3A8BC4] text-white rounded-lg transition-colors">저장</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── 상단 토퍼 ── */}
      <div className="bg-white border-b border-gray-200 px-8 py-3.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-[15px] text-gray-400 font-semibold">
          <Link href="/admin/newsletters" className="hover:text-gray-700 hover:underline transition-colors">
            뉴스레터 제작
          </Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link href="/admin/newsletters/new" className="hover:text-gray-700 hover:underline transition-colors">
            대상 설정
          </Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-800 font-bold">콘텐츠 구성</span>
        </div>
        {configDraft.companyIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="text-sm font-medium text-gray-400 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              나가기
            </button>
            <button
              onClick={handleSaveInPlace}
              className="text-sm font-medium border border-[#55A4DA] text-[#55A4DA] px-4 py-1.5 rounded-lg hover:bg-[#55A4DA]/5 transition-colors"
            >
              저장
            </button>
            <button
              onClick={handleDraftSave}
              className="text-sm font-medium bg-[#55A4DA] hover:bg-[#3A8BC4] text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              임시저장
            </button>
          </div>
        )}
      </div>

      {/* ── 기업 선택: 미선택 시 전체 화면 ── */}
      {configDraft.companyIds.length === 0 && (() => {
        const filtered = companies.filter(c => !companySearch.trim() || c.name.includes(companySearch.trim()));
        return (
          <div className="flex-1 overflow-y-auto bg-[#F8FAFC] flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-3xl">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">뉴스레터 대상 기업 선택</h2>
                <p className="text-sm text-gray-400">뉴스레터를 발송할 기업을 선택해주세요.</p>
              </div>
              <div className="relative mb-6">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="기업명 검색"
                  value={companySearch}
                  onChange={e => setCompanySearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                  autoFocus
                />
              </div>
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-10">검색 결과가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {filtered.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        configDraft.setDraft({ companyIds: [c.id] });
                        setCompanySearch('');
                      }}
                      className="flex flex-col items-center gap-3 p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-[#55A4DA] hover:shadow-md transition-all group text-center"
                    >
                      <CompanyLogo name={c.name} logoUrl={c.logoUrl} size={56} />
                      <div>
                        <p className="text-sm font-semibold text-gray-800 group-hover:text-[#2E7DB5] transition-colors">{c.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{c.industry}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── 기업 정보 바 (선택 후) ── */}
      {configDraft.companyIds.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-8 py-2 flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-400">대상 기업</span>
          <span className="text-sm font-semibold text-gray-800">{targetCompanies[0]?.name ?? '—'}</span>
          <div className="w-px h-4 bg-gray-200" />
          <span className="text-xs text-gray-500">
            대상 리더 <span className="font-semibold text-gray-700">{selectedParticipants.length}명</span>
          </span>
        </div>
      )}

      {/* ── 스테퍼 ── */}
      {configDraft.companyIds.length > 0 && <div className="bg-white border-b border-gray-200 px-8 py-2.5 flex items-center justify-center flex-shrink-0">
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
                  <div className={`w-16 h-px mx-3 mb-4 transition-colors ${isDone ? 'bg-[#55A4DA]' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>}

      {/* ════════════════════════════════
          1단계: 스토리라인
      ════════════════════════════════ */}
      {wizardStep === 1 && configDraft.companyIds.length > 0 && (
        <div className="flex-1 overflow-hidden bg-[#F8FAFC] flex flex-col">
          <div className="w-full px-8 py-6 flex flex-col flex-1 justify-center">
            <div className="mb-4 flex-shrink-0">
              <h2 className="text-base font-bold text-gray-800 mb-1">뉴스레터 스토리라인</h2>
              <p className="text-xs text-gray-400">5단계 코칭 여정으로 리더의 변화를 이끕니다. 구조를 확인한 뒤 다음으로 진행하세요.</p>
            </div>
              <div className="flex flex-col lg:flex-row items-stretch gap-0">
                {customStoryline.map((s, i) => {
                  const color = UNIFIED_STEP_COLOR;
                  return (
                    <div key={s.step} className="flex flex-col lg:flex-row items-stretch flex-1 min-w-0">
                      <div className={`flex-1 rounded-2xl border ${color.border} ${color.cardBg} p-5 flex flex-col gap-3 hover:border-blue-300 hover:shadow-sm transition-all`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full ${color.badge} flex items-center justify-center flex-shrink-0`}>
                            <span className="text-white text-xs font-bold">{s.step}</span>
                          </div>
                          <div>
                            <p className={`text-sm font-bold leading-tight ${color.titleColor}`}>{s.title}</p>
                            <p className={`text-[11px] font-semibold ${color.subtitleColor}`}>{s.subtitle}</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed flex-1">{s.description}</p>
                      </div>
                      {i < customStoryline.length - 1 && (
                        <div className="flex items-center justify-center lg:px-2 py-2 lg:py-0 flex-shrink-0">
                          <svg className="w-4 h-4 text-gray-300 lg:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          <svg className="w-4 h-4 text-gray-300 hidden lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="pt-4 flex justify-end">
                <button
                  onClick={openEditModal}
                  className="flex items-center gap-1.5 px-4 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  편집
                </button>
              </div>

          </div>
        </div>
      )}

      {/* ════════════════════════════════
          2단계: 회차 설계
      ════════════════════════════════ */}
      {wizardStep === 2 && (
        <div className="flex-1 overflow-hidden bg-[#F8FAFC]">
          <div className="w-full px-8 py-6 flex flex-col gap-4 h-full">

            {/* 헤더 */}
            <div className="flex-shrink-0">
              <h2 className="text-base font-bold text-gray-800 mb-1">회차 설계</h2>
              <p className="text-xs text-gray-400">총 발송 회차를 설정하고, 각 단계별 회차 수를 배분하세요. 단계당 최소 1회차가 필요합니다.</p>
            </div>

            {/* 좌우 패널 */}
            <div className="flex gap-4 flex-1 min-h-0">

              {/* 좌측: 총 회차 + 단계별 배분 */}
              <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">

                {/* 총 발송 회차 */}
                <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">총 발송 회차</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <button
                        onClick={() => handleTotalRoundsChange(totalRounds - 1)}
                        disabled={totalRounds <= customStoryline.length}
                        className="w-9 h-9 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#55A4DA] hover:text-[#55A4DA] disabled:opacity-30 disabled:cursor-not-allowed transition-all font-bold text-lg"
                      >
                        −
                      </button>
                      <div className="text-center">
                        <span className="text-4xl font-black text-gray-800">{totalRounds}</span>
                        <p className="text-xs text-gray-400 mt-0.5">회차</p>
                      </div>
                      <button
                        onClick={() => handleTotalRoundsChange(totalRounds + 1)}
                        className="w-9 h-9 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-all font-bold text-lg"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400">최소 {customStoryline.length}회차</p>
                  </div>
                </div>

                {/* 단계별 배분 */}
                <div className="flex-1 px-6 py-5 flex flex-col min-h-0">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex-shrink-0">단계별 회차 배분</p>
                  <div className="flex-1 space-y-2.5 overflow-y-auto">
                    {customStoryline.map((s, i) => {
                      const color = UNIFIED_STEP_COLOR;
                      const dist = roundDistribution.find(d => d.stepIndex === i);
                      const count = dist?.count ?? 1;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full ${color.badge} flex items-center justify-center flex-shrink-0`}>
                            <span className="text-white text-[10px] font-bold">{s.step}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${color.titleColor}`}>{s.title}</p>
                            {s.subtitle && <p className="text-[10px] text-gray-400 truncate">{s.subtitle}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => adjustCount(i, -1)}
                              disabled={count <= 1}
                              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#55A4DA] hover:text-[#55A4DA] disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-bold"
                            >
                              −
                            </button>
                            <span className="w-7 text-center text-sm font-bold text-gray-700">{count}</span>
                            <button
                              onClick={() => adjustCount(i, 1)}
                              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-all text-sm font-bold"
                            >
                              +
                            </button>
                            <span className="text-xs text-gray-400 w-6">회차</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                    <span className="text-xs text-gray-500">합계</span>
                    <div className={`flex items-center gap-1.5 text-sm font-bold ${
                      distSum === totalRounds ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {distSum === totalRounds ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {distSum} / {totalRounds}회차
                      {distSum !== totalRounds && (
                        <span className="text-[11px] font-normal ml-1">
                          ({distSum > totalRounds ? `${distSum - totalRounds}회 초과` : `${totalRounds - distSum}회 부족`})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* 우측: 회차 미리보기 */}
              <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">회차 미리보기</p>
                  {distSum === totalRounds && (
                    <span className="text-[11px] text-gray-400">총 {totalRounds}회차</span>
                  )}
                </div>
                {distSum === totalRounds ? (
                  <div className="flex-1 overflow-y-auto">
                    <div className="divide-y divide-gray-50">
                      {makeRoundsFromDistribution(roundDistribution).map((r, idx) => {
                        const s = customStoryline[r.stepIndex];
                        const color = UNIFIED_STEP_COLOR;
                        return (
                          <div key={idx} className="flex items-center gap-3 px-5 py-2.5">
                            <span className="text-xs text-gray-400 w-12 flex-shrink-0">{idx + 1}회차</span>
                            <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${color.badge} text-white flex-shrink-0`}>
                              {s?.step}단계
                            </div>
                            <span className="text-xs text-gray-600 truncate">{s?.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-xs text-gray-300">배분을 완료하면 미리보기가 표시됩니다.</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          4단계: 리더십 유형 배분
      ════════════════════════════════ */}
      {wizardStep === 4 && (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="w-full px-8 py-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1">리더십 그룹 설정</h2>
              <p className="text-xs text-gray-400">회차별로 그룹 단위 대상 리더를 설정합니다. 유형을 드래그해 그룹 간 이동할 수 있습니다.</p>
            </div>

            {/* 회차 탭 + 전 회차 동일하게 (같은 줄) */}
            {rounds.length > 0 && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                {rounds.map((r, idx) => {
                  const s = customStoryline[r.stepIndex];
                  const isActive = idx === distributionRoundIdx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setDistributionRoundIdx(idx)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                        isActive ? 'border-[#55A4DA] bg-[#55A4DA]/5 text-[#2E7DB5]' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {idx + 1}회차
                      {s && <span className="ml-1.5 font-normal text-gray-400">{s.title}</span>}
                    </button>
                  );
                })}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {rounds.some(r => r.customGroups.some(g => g.types.length > 0)) && (
                    <button
                      onClick={() => { void generateAllGroupDescriptions(); }}
                      disabled={generatingGroupDesc}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                        generatingGroupDesc
                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'border-[#55A4DA] text-[#55A4DA] hover:bg-[#55A4DA]/5'
                      }`}
                    >
                      {generatingGroupDesc ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                      {generatingGroupDesc ? 'AI 설명 생성 중…' : 'AI로 그룹 설명 생성'}
                    </button>
                  )}
                  {rounds.length > 1 && (
                    <button
                      onClick={() => { if (confirm('현재 회차의 그룹 설정을 다른 모든 회차에 동일하게 적용할까요?')) applyDistributionToAll(); }}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[#55A4DA] bg-[#55A4DA] text-white hover:bg-[#3A8BC4] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      전 회차 동일하게
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 이전 회차와 동일하게 — 2회차부터 노출 (1회차는 복사할 이전 회차가 없음) */}
            {rounds.length > 1 && distributionRoundIdx > 0 && (
              <div className="relative inline-block">
                <button
                  onClick={() => setCopyDistMenuOpen(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[#55A4DA] text-[#55A4DA] hover:bg-[#55A4DA]/5 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 4h8a2 2 0 012 2v6a2 2 0 01-2 2h-8a2 2 0 01-2-2v-6a2 2 0 012-2z" />
                  </svg>
                  이전 회차와 동일하게 적용
                  <svg className={`w-3 h-3 transition-transform ${copyDistMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {copyDistMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCopyDistMenuOpen(false)} />
                    <div className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                      <div className="px-3.5 py-2.5 border-b border-gray-100 text-[11px] font-bold text-gray-400">
                        복사할 회차를 선택하세요
                      </div>
                      <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
                        {rounds.slice(0, distributionRoundIdx).map((r, idx) => {
                          const s = customStoryline[r.stepIndex];
                          const groupCount = r.customGroups.filter(g => g.types.length > 0).length;
                          return (
                            <button
                              key={idx}
                              onClick={() => applyDistributionFrom(idx)}
                              className="w-full text-left px-3.5 py-2.5 hover:bg-[#55A4DA]/5 transition-colors"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-gray-700">{idx + 1}회차</span>
                                {s && <span className="text-[11px] text-gray-400 truncate">{s.title}</span>}
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5">맞춤형 {groupCount}그룹</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 배분 카드 */}
            {rounds[distributionRoundIdx] !== undefined && (() => {
              const r = rounds[distributionRoundIdx];
              // 긍정/부정 구분 없이 실제 참여자 유형 전체를 대상으로 함
              const allTypes = Array.from(new Set(selectedParticipants.map(p => p.leadershipType))).filter(Boolean);
              const groups = r.customGroups;
              const typesInGroups = new Set(groups.flatMap(g => g.types));
              const negInGeneral = allTypes.filter(t => !typesInGroups.has(t));

              const countOf = (type: string) => selectedParticipants.filter(p => p.leadershipType === type).length;
              const generalCount = negInGeneral.reduce((s, t) => s + countOf(t), 0);

              // 유형을 특정 그룹(또는 일반형)으로 이동
              function moveType(type: string, targetGroupId: string | 'general') {
                setRounds(prev => prev.map((round, i) => {
                  if (i !== distributionRoundIdx) return round;
                  const stripped = round.customGroups.map(g => ({ ...g, types: g.types.filter(t => t !== type) }));
                  const next = targetGroupId === 'general'
                    ? stripped
                    : stripped.map(g => g.id === targetGroupId ? { ...g, types: g.types.includes(type) ? g.types : [...g.types, type] } : g);
                  // 유형이 모두 빠진(빈) 그룹은 박스 자동 제거
                  const withCounts = next
                    .filter(g => g.types.length > 0)
                    .map(g => ({ ...g, leaderIds: selectedParticipants.filter(p => g.types.includes(p.leadershipType)).map(p => p.id) }));
                  return { ...round, customGroups: withCounts };
                }));
              }

              function addGroup() {
                setRounds(prev => prev.map((round, i) => i !== distributionRoundIdx ? round : {
                  ...round,
                  customGroups: [...round.customGroups, makeCustomGroup(`g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)],
                }));
              }

              function removeGroup(groupId: string) {
                setRounds(prev => prev.map((round, i) => i !== distributionRoundIdx ? round : {
                  ...round,
                  customGroups: round.customGroups.filter(g => g.id !== groupId),
                }));
              }

              const TypeChip = ({ type, sourceId }: { type: string; sourceId: string }) => {
                const members = selectedParticipants.filter(p => p.leadershipType === type);
                const key = `${sourceId}:${type}`;
                const expanded = expandedTypeChips.has(key);
                return (
                  <div
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('leadershipType', type); e.dataTransfer.setData('sourceId', sourceId); }}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing hover:border-[#55A4DA]/50 hover:shadow-sm transition-all select-none shadow-sm"
                  >
                    <button
                      onClick={() => setExpandedTypeChips(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <svg className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      <span className="text-xs font-bold text-gray-900 flex-1">{type}</span>
                      <span className="text-[10px] font-semibold text-gray-500">{members.length}명</span>
                      <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </button>
                    {expanded && (
                      <div className="px-3.5 pb-2.5 pt-0.5 space-y-1 border-t border-gray-100">
                        {members.map(p => (
                          <div key={p.id} className="flex items-center gap-2 py-1">
                            <span className="text-xs font-medium text-gray-700 flex-1">{p.name} {p.position}</span>
                            <span className="text-[10px] text-gray-400">{p.leadershipType}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  {/* 유형 배분 그룹 (가로 배치) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
                      {groups.map((g, gi) => {
                        const groupCount = g.types.reduce((s, t) => s + countOf(t), 0);
                        return (
                          <div
                            key={g.id}
                            onDragOver={e => { e.preventDefault(); setDragOverTarget(g.id); }}
                            onDragLeave={() => setDragOverTarget(null)}
                            onDrop={e => {
                              e.preventDefault();
                              const type = e.dataTransfer.getData('leadershipType');
                              if (type) moveType(type, g.id);
                              setDragOverTarget(null);
                            }}
                            className={`rounded-xl border transition-all ${dragOverTarget === g.id ? 'border-[#55A4DA] bg-[#55A4DA]/5' : 'border-gray-200 bg-gray-50/40'}`}
                          >
                            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                              <p className="text-xs font-bold text-[#2E7DB5] flex-1">{g.types.length > 0 ? g.types.join(' · ') : '새 그룹'}</p>
                              <span className="text-[10px] font-semibold text-gray-500 bg-white px-2 py-0.5 rounded-full">{groupCount}명</span>
                              <button onClick={() => removeGroup(g.id)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0" title="그룹 삭제">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                            <div className="p-3 space-y-2 min-h-[72px]">
                              {g.types.length > 0 ? (
                                g.types.map(type => <TypeChip key={type} type={type} sourceId={g.id} />)
                              ) : (
                                <div className="flex items-center justify-center h-14 text-xs text-gray-300">
                                  유형을 이 그룹으로 드래그하세요
                                </div>
                              )}
                            </div>
                            {/* 그룹 설명 접이식 패널 (유형이 있는 그룹만) */}
                            {g.types.length > 0 && (() => {
                              const descKey = groupCompositionKey(g.types);
                              const desc = groupDescriptions[descKey];
                              const open = expandedGroupDesc.has(g.id);
                              return (
                                <div className="border-t border-gray-100">
                                  <button
                                    onClick={() => toggleGroupDescPanel(g.id)}
                                    className="w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-gray-50/60 transition-colors"
                                  >
                                    <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-xs font-semibold text-gray-600">그룹 설명</span>
                                    {desc?.summary?.trim() && !open && (
                                      <span className="text-[11px] text-gray-400 truncate flex-1">{desc.summary}</span>
                                    )}
                                    {!desc && (
                                      <span className="text-[10px] text-gray-300 flex-1">미생성</span>
                                    )}
                                  </button>
                                  {open && (
                                    <div className="px-4 pb-3 space-y-2.5">
                                      {!desc ? (
                                        <p className="text-[11px] text-gray-400">상단 <span className="font-semibold text-[#55A4DA]">AI로 그룹 설명 생성</span>을 눌러 설명을 만들어 주세요. 생성 후 내용을 수정할 수 있습니다.</p>
                                      ) : (
                                        ([
                                          { field: 'summary' as const, label: '요약', rows: 2 },
                                          { field: 'characteristics' as const, label: '특성', rows: 3 },
                                          { field: 'developmentPoints' as const, label: '개발 포인트', rows: 3 },
                                        ]).map(({ field, label, rows }) => (
                                          <div key={field}>
                                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">{label}</label>
                                            <AutoGrowTextarea
                                              value={desc[field] ?? ''}
                                              onChange={e => updateGroupDescription(g.types, field, e.target.value)}
                                              minRows={rows}
                                              placeholder={`${label}을(를) 입력하세요`}
                                              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition resize-none bg-white"
                                            />
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                      <button onClick={addGroup} className="min-h-[120px] py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs font-semibold text-gray-400 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-colors flex items-center justify-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        그룹 추가
                      </button>
                  </div>
                </div>
              );
            })()}

            {rounds.length === 0 && (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                2단계에서 회차를 먼저 설계해주세요.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          5단계: 콘텐츠 구성 (회차별 통합)
      ════════════════════════════════ */}
      {wizardStep === 5 && (
        <div className="flex-1 overflow-hidden bg-[#F8FAFC] flex flex-col">
          {rounds.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              2단계에서 회차를 먼저 설계해주세요.
            </div>
          ) : (
          <>
            {/* 상단: 회차 탭 + 그룹/일반형 탭 통합 */}
            <div className="bg-white border-b border-gray-200 px-6 py-2 flex-shrink-0 flex items-center gap-4 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                {rounds.map((r, idx) => {
                  const s = customStoryline[r.stepIndex];
                  const isActive = idx === activeRoundIdx;
                  const activeGroups = r.customGroups.filter(g => g.types.length > 0);
                  const isDone = activeGroups.length > 0
                    ? activeGroups.every(g => g.topic.trim().length > 0) && r.topic.trim().length > 0
                    : r.topic.trim().length > 0;
                  return (
                    <button
                      key={idx}
                      onClick={() => switchRound(idx)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all flex items-center gap-1.5 ${
                        isActive ? 'border-[#55A4DA] bg-[#55A4DA]/5 text-[#2E7DB5]' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {isDone && (
                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      )}
                      {idx + 1}회차
                      {s && <span className="font-normal text-gray-400">{s.title}</span>}
                    </button>
                  );
                })}
              </div>

              <div className="h-5 w-px bg-gray-200 flex-shrink-0" />

              {/* 그룹/일반형 탭 (인라인) */}
              {(() => {
                const r = rounds[activeRoundIdx];
                if (!r) return null;
                const activeGroups = r.customGroups.filter(g => g.types.length > 0);
                const tabs = [...(r.generalLeaderIds.length > 0 ? [{ id: 'general', label: '일반형' }] : []), ...activeGroups.map((g) => ({ id: g.id, label: g.types.join('·') || '새 그룹' }))];
                const currentTarget = tabs.some(t => t.id === previewTargetId) ? previewTargetId : (tabs[0]?.id ?? 'general');
                return (
                  <div className="flex gap-1.5 flex-wrap">
                    {tabs.map(t => (
                      <button key={t.id} onClick={() => setPreviewTargetId(t.id)} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1 ${currentTarget === t.id ? 'bg-[#55A4DA] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`} title={isTargetLocked(activeRoundIdx, t.id) ? '발송 완료 · 수정 불가' : undefined}>
                        {isTargetLocked(activeRoundIdx, t.id) && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        )}
                        {t.label}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* 본문: 좌우 2분할 */}
            <div className="flex-1 flex overflow-hidden">
              {/* 좌측: 미리보기 (스크롤) + 하단 고정 프롬프트 바 */}
              <div className="w-3/5 flex-shrink-0 border-r border-gray-200 flex flex-col overflow-hidden">
                {(() => {
                  const r = rounds[activeRoundIdx];
                  if (!r) return null;
                  const activeGroups = r.customGroups.filter(g => g.types.length > 0);
                  const tabs = [...(r.generalLeaderIds.length > 0 ? [{ id: 'general', label: '일반형' }] : []), ...activeGroups.map((g) => ({ id: g.id, label: g.types.join('·') || '새 그룹' }))];
                  const current = tabs.some(t => t.id === previewTargetId) ? previewTargetId : (tabs[0]?.id ?? 'general');
                  // 현재 미리보기 대상 설명 (우측 헤더와 동일 표현)
                  const targetDesc = (() => {
                    if (current === 'general') {
                      const gParts = selectedParticipants.filter(p => r.generalLeaderIds.includes(p.id));
                      const detailArr: string[] = [];
                      (r.generalTypes ?? []).forEach(t => {
                        const n = gParts.filter(p => p.leadershipType === t).length;
                        if (n > 0) detailArr.push(`${t} ${n}명`);
                      });
                      return { title: '일반형', detail: detailArr.join(' + '), count: r.generalLeaderIds.length };
                    }
                    const gi = activeGroups.findIndex(g => g.id === current);
                    const g = activeGroups[gi];
                    return { title: g ? g.types.join(' · ') : '맞춤형', detail: '', count: g?.leaderIds.length ?? 0 };
                  })();
                  const previewKey = `${activeRoundIdx}:${current}`;
                  const targetLocked = isTargetLocked(activeRoundIdx, current);
                  const canRefine = !targetLocked && revealedPreviews.has(previewKey) && !!livePreviewContent[previewKey];
                  return (
                    <>
                      {/* 스크롤 영역 (헤더 + 본문 미리보기) */}
                      <div className="flex-1 overflow-y-auto px-6 py-4">
                        <div className="pb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-bold text-gray-800">미리보기</p>
                            <p className="text-[11px] mt-0.5">
                              <span className="font-semibold text-[#2E7DB5]">{targetDesc.title}</span>
                              <span className="text-gray-400">{targetDesc.detail ? ` · ${targetDesc.detail}` : ''} ({targetDesc.count}명)</span>
                            </p>
                          </div>
                          {/* 전체본문 / 요약본 전환 토글 */}
                          <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg flex-shrink-0">
                            {([['full', '전체본문'], ['email', '요약본']] as const).map(([mode, label]) => (
                              <button
                                key={mode}
                                onClick={() => setLivePreviewMode(mode)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${livePreviewMode === mode ? 'bg-white text-[#2E7DB5] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="w-full">
                          {renderLivePreview(current)}
                        </div>
                      </div>
                      {/* 하단 고정 프롬프트 바 — 스크롤해도 위치 고정 (배경/보더 없이 입력창·전송만) */}
                      <div className="flex-shrink-0 px-6 py-3">
                        <form
                          onSubmit={e => { e.preventDefault(); void refinePreview(current); }}
                          className="flex items-center gap-2"
                        >
                          <div className="relative flex-1">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                            <input
                              type="text"
                              value={promptInput}
                              onChange={e => setPromptInput(e.target.value)}
                              disabled={!canRefine || refining}
                              placeholder={targetLocked ? '발송 완료된 그룹은 수정할 수 없습니다' : canRefine ? (livePreviewMode === 'email' ? '요약본을 프롬프트로 수정하세요 (예: 요약을 한 줄로, 더 임팩트 있게)' : '본문을 프롬프트로 수정하세요 (예: 더 짧고 간결하게, 전문적인 톤으로)') : '미리보기를 먼저 표시하면 프롬프트로 수정할 수 있어요'}
                              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition-colors disabled:bg-gray-50 disabled:text-gray-400 disabled:placeholder-gray-400"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={!canRefine || refining || !promptInput.trim()}
                            aria-label="프롬프트로 수정"
                            className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#55A4DA] text-white flex items-center justify-center hover:bg-[#3A8BC4] disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
                          >
                            {refining ? (
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                            )}
                          </button>
                        </form>
                        {refining && <p className="text-[11px] text-gray-400 mt-1.5 pl-1">AI가 요청을 반영해 본문을 수정하고 있어요...</p>}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* 우측: 콘텐츠 편집 (선택한 탭만) */}
              <div className="w-2/5 flex-shrink-0 overflow-y-auto px-6 py-4">
                {(() => {
              const r = rounds[activeRoundIdx];
              if (!r) return null;
              const s = customStoryline[r.stepIndex];
              const activeGroups = r.customGroups.filter(g => g.types.length > 0);
              const tabs = [...(r.generalLeaderIds.length > 0 ? [{ id: 'general', label: '일반형' }] : []), ...activeGroups.map((g) => ({ id: g.id, label: g.types.join('·') || '새 그룹' }))];
              const currentTarget = tabs.some(t => t.id === previewTargetId) ? previewTargetId : (tabs[0]?.id ?? 'general');
              return (
                <div className="space-y-4">

                  {/* 회차 헤더 (박스 밖) */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xl font-bold text-gray-900">{activeRoundIdx + 1}회차 콘텐츠 구성</p>
                        <p className="text-sm text-gray-500 mt-0.5">{s?.title} · {s?.subtitle}</p>
                        <p className="text-xs text-gray-400 mt-1">그룹 설정은 이전 단계에서 변경하세요.</p>
                      </div>
                    </div>
                  </div>

                  {/* 맞춤형 그룹 섹션 (선택한 탭만) */}
                  {activeGroups.map((g, gi) => {
                    if (g.id !== currentTarget) return null;
                    return (
                      <div key={g.id} className="bg-[#F0F7FF] rounded-xl p-6 space-y-4">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-lg font-semibold text-gray-900">{g.types.join(' · ')}</p>
                            <span className="text-sm text-gray-500 flex-shrink-0">{g.leaderIds.length}명</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {g.types.map(t => (
                              <span key={t} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white border border-[#55A4DA]/30 text-[#2E7DB5]">{t}</span>
                            ))}
                          </div>
                        </div>
                        {renderContentSections({
                          keyPrefix: `g:${g.id}`,
                          targetId: g.id,
                          topic: g.topic,
                          contents: g.contents,
                          interactions: g.interactions,
                          surveys: g.surveys,
                          placeholder: '맞춤형 뉴스레터 주제를 입력하세요 (Enter로 AI 콘텐츠 추천)',
                          setTopic: t => setGroupTopic(activeRoundIdx, g.id, t),
                          contentBrief: g.contentBrief ?? '',
                          setContentBrief: v => setGroupContentBrief(activeRoundIdx, g.id, v),
                          suggestContents: t => suggestGroupContents(activeRoundIdx, g.id, t),
                          removeContent: id => removeCustomContentFromGroup(activeRoundIdx, g.id, id),
                          toggleInteractionFn: v => toggleGroupInteraction(activeRoundIdx, g.id, v),
                          toggleSurveyFn: v => toggleGroupSurvey(activeRoundIdx, g.id, v),
                          openPool: () => openContentPool(true, g.id),
                          attachments: g.attachments ?? [],
                          uploadAttachmentsFn: files => void uploadAttachments(activeRoundIdx, g.id, files),
                          removeAttachmentFn: id => removeAttachment(activeRoundIdx, g.id, id),
                          toggleAttachmentUseFn: id => toggleAttachmentUse(activeRoundIdx, g.id, id),
                          setAttachmentNoteFn: (id, note) => setAttachmentNote(activeRoundIdx, g.id, id, note),
                          locked: isTargetLocked(activeRoundIdx, g.id),
                        })}
                      </div>
                    );
                  })}

                  {/* 일반형 섹션 (일반형 탭일 때만) */}
                  {currentTarget === 'general' && (() => {
                    const generalParticipants = selectedParticipants.filter(p => r.generalLeaderIds.includes(p.id));
                    const parts = (r.generalTypes ?? []).map(t => {
                      const n = generalParticipants.filter(p => p.leadershipType === t).length;
                      return n > 0 ? `${t} ${n}명` : null;
                    }).filter(Boolean) as string[];
                    return (
                  <div className="bg-[#F0F7FF] rounded-xl p-6 space-y-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-lg font-semibold text-gray-900">일반형</p>
                        <span className="text-sm text-gray-500 flex-shrink-0">{r.generalLeaderIds.length}명</span>
                      </div>
                      {parts.length > 0 && <p className="text-sm text-gray-500 mt-0.5">{parts.join(' + ')}</p>}
                    </div>
                    {renderContentSections({
                      keyPrefix: 'general',
                      targetId: 'general',
                      topic: r.topic,
                      contents: r.contents,
                      interactions: r.interactions,
                      surveys: r.surveys,
                      placeholder: '일반형 뉴스레터 주제를 입력하세요 (Enter로 AI 콘텐츠 추천)',
                      setTopic: t => setRoundTopic(activeRoundIdx, t),
                      contentBrief: r.contentBrief ?? '',
                      setContentBrief: v => setRoundContentBrief(activeRoundIdx, v),
                      suggestContents: t => suggestContentsForRound(activeRoundIdx, t),
                      removeContent: id => removeContentFromRound(activeRoundIdx, id),
                      toggleInteractionFn: v => toggleInteraction(activeRoundIdx, v),
                      toggleSurveyFn: v => toggleSurvey(activeRoundIdx, v),
                      openPool: () => openContentPool(false, null),
                      attachments: r.attachments ?? [],
                      uploadAttachmentsFn: files => void uploadAttachments(activeRoundIdx, 'general', files),
                      removeAttachmentFn: id => removeAttachment(activeRoundIdx, 'general', id),
                      toggleAttachmentUseFn: id => toggleAttachmentUse(activeRoundIdx, 'general', id),
                      setAttachmentNoteFn: (id, note) => setAttachmentNote(activeRoundIdx, 'general', id, note),
                      locked: isTargetLocked(activeRoundIdx, 'general'),
                    })}
                  </div>
                    );
                  })()}

                  {/* 구성 완료 → 좌측 실시간 미리보기 공개 */}
                  {(() => {
                    const isCustom = currentTarget !== 'general';
                    const grp = isCustom ? activeGroups.find(g => g.id === currentTarget) : undefined;
                    const tTopic = isCustom ? (grp?.topic ?? '') : r.topic;
                    const tContents = isCustom ? (grp?.contents ?? []) : r.contents;
                    const canReveal = tTopic.trim().length > 0 || tContents.length > 0;
                    const isRevealed = revealedPreviews.has(`${activeRoundIdx}:${currentTarget}`);
                    return (
                      <div className="pt-2 pb-1">
                        {isRevealed ? (
                          <div className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-50 text-emerald-600 text-sm font-semibold">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            미리보기 표시 중 · 수정하면 자동 반영됩니다
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={!canReveal}
                              onClick={() => revealPreview(activeRoundIdx, currentTarget)}
                              className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${canReveal ? 'bg-[#55A4DA] text-white hover:bg-[#3A8BC4]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                            >
                              구성 완료 · 미리보기 보기
                            </button>
                            {!canReveal && (
                              <p className="text-xs text-gray-400 text-center mt-2">주제를 입력하거나 콘텐츠를 1개 이상 추가하면 미리보기를 볼 수 있어요</p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}

                </div>
              );
            })()}
              </div>
            </div>
          </>
          )}
        </div>
      )}

      {/* ════════════════════════════════
          3단계: 발송일 설정
      ════════════════════════════════ */}
      {wizardStep === 3 && (
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="w-full px-8 py-6 space-y-5">

            {/* 헤더 */}
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1">발송일 설정</h2>
              <p className="text-xs text-gray-400">주기와 시작일을 선택하면 전체 발송 일정이 자동으로 계산됩니다.</p>
            </div>

            {/* ① 발송 주기 카드 선택 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">발송 주기</p>
              <div className="grid grid-cols-3 gap-3">
                {DELIVERY_INTERVAL_OPTIONS.map(opt => {
                  const isSelected = deliveryInterval === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { setDeliveryInterval(opt.value); setScheduleDateOverrides({}); }}
                      className={`relative flex flex-col items-center gap-1.5 px-4 py-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-[#55A4DA] bg-[#55A4DA]/5'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#55A4DA] flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      <p className={`text-base font-bold ${isSelected ? 'text-[#55A4DA]' : 'text-gray-800'}`}>{opt.label}</p>
                      <p className={`text-xs ${isSelected ? 'text-[#55A4DA]/70' : 'text-gray-400'}`}>{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ② 시작일 선택 */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">첫 번째 회차 발송일</p>
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setScheduleDateOverrides({}); }}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
              />
            </div>

            {/* ③ 발송 일정 미리보기 — 회차별 발송일 직접 변경 가능(휴일 등) */}
            {deliveryInterval && startDate && rounds.length > 0 && (() => {
              const schedDates = getEffectiveScheduleDates();
              return (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">발송 일정 미리보기</p>
                    <span className="text-[11px] text-gray-400">발송일을 눌러 회차별로 변경할 수 있어요 · 총 {rounds.length}회차</span>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-6 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider w-20">회차</th>
                        <th className="text-left px-6 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">발송일</th>
                        <th className="text-left px-6 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">스토리라인 단계</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rounds.map((r, idx) => {
                        const s = customStoryline[r.stepIndex];
                        const color = UNIFIED_STEP_COLOR;
                        const date = schedDates[idx];
                        const isOverridden = scheduleDateOverrides[idx] !== undefined;
                        const dow = date ? date.getDay() : -1;
                        const isWeekend = dow === 0 || dow === 6;
                        const prevDate = idx > 0 ? schedDates[idx - 1] : null;
                        const outOfOrder = !!(prevDate && date && date.getTime() <= prevDate.getTime());
                        return (
                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-2.5 text-xs font-semibold text-gray-500 align-top">{idx + 1}회차</td>
                            <td className="px-6 py-2.5">
                              {date ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <input
                                    type="date"
                                    value={toISODate(date)}
                                    onChange={e => {
                                      const v = e.target.value;
                                      if (!v) return;
                                      setScheduleDateOverrides(prev => ({ ...prev, [idx]: v }));
                                    }}
                                    className={`px-2.5 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#55A4DA]/30 transition ${isWeekend ? 'border-amber-300 text-amber-700 bg-amber-50/60' : 'border-gray-200 text-gray-800'}`}
                                  />
                                  <span className={`text-[11px] font-medium ${isWeekend ? 'text-amber-600' : 'text-gray-400'}`}>
                                    {date.toLocaleDateString('ko-KR', { weekday: 'short' })}{isWeekend ? ' · 주말' : ''}
                                  </span>
                                  {outOfOrder && (
                                    <span className="text-[11px] text-red-500">이전 회차보다 빠름</span>
                                  )}
                                  {isOverridden && (
                                    <button
                                      type="button"
                                      onClick={() => setScheduleDateOverrides(prev => {
                                        const next = { ...prev };
                                        delete next[idx];
                                        return next;
                                      })}
                                      className="text-[11px] text-[#55A4DA] hover:underline"
                                    >
                                      기본값
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-2.5 align-top">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${color.badge} text-white`}>
                                {s?.title}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50">
                    <p className="text-xs text-gray-500">
                      총 발송 기간: <span className="font-semibold text-gray-700">{effectiveDurationLabel()}</span>
                    </p>
                  </div>
                </div>
              );
            })()}


          </div>
        </div>
      )}

      {/* ════════════════════════════════
          스토리라인 편집 모달
      ════════════════════════════════ */}
      {isEditingStoryline && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-800">스토리라인 편집</h2>
                <p className="text-xs text-gray-400 mt-0.5">단계 추가·삭제·순서 변경 및 내용 수정이 가능합니다.</p>
              </div>
              <button onClick={() => setIsEditingStoryline(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-2.5">
                {draftStoryline.map((s, idx) => {
                  const color = UNIFIED_STEP_COLOR;
                  return (
                    <div key={idx} className={`rounded-xl border-2 ${color.border} ${color.cardBg} p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-7 h-7 rounded-full ${color.badge} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white text-xs font-bold">{idx + 1}</span>
                        </div>
                        <button
                          onClick={() => removeDraftStep(idx)}
                          disabled={draftStoryline.length <= 2}
                          className="text-gray-300 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      <div className="space-y-2">
                        <input
                          value={s.title}
                          onChange={e => updateDraftStep(idx, 'title', e.target.value)}
                          placeholder="단계명 (예: 수용)"
                          className={`w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold bg-white focus:outline-none focus:border-current focus:ring-1 focus:ring-current/20 transition ${color.titleColor}`}
                        />
                        <input
                          value={s.subtitle}
                          onChange={e => updateDraftStep(idx, 'subtitle', e.target.value)}
                          placeholder="부제 (예: 성찰과 인정)"
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-600 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition"
                        />
                        <textarea
                          value={s.description}
                          onChange={e => updateDraftStep(idx, 'description', e.target.value)}
                          placeholder="단계 설명을 입력하세요"
                          rows={2}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-600 resize-none focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={addDraftStep}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-colors font-medium"
              >
                + 단계 추가
              </button>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2 flex-shrink-0">
              <button
                onClick={() => setIsEditingStoryline(false)}
                className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveStoryline}
                className="px-5 py-2 text-sm font-bold bg-[#55A4DA] hover:bg-[#3A8BC4] text-white rounded-lg transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          콘텐츠 풀 모달
      ════════════════════════════════ */}
      {contentPoolOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-800">콘텐츠 풀</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {activeRoundIdx + 1}회차 · {rounds[activeRoundIdx]?.topic || '—'}
                </p>
              </div>
              <button onClick={() => setContentPoolOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0 space-y-2.5">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={contentPoolQuery}
                  onChange={e => {
                    setContentPoolQuery(e.target.value);
                    void loadContentPool(e.target.value, contentPoolCategoryFilter);
                  }}
                  placeholder="제목, 작성자, 태그 검색..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto">
                {(['', '아티클', '인터뷰', '책 추천', '성공 사례', '카드뉴스', '웹툰', '영상'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setContentPoolCategoryFilter(cat);
                      void loadContentPool(contentPoolQuery, cat);
                    }}
                    className={`flex-shrink-0 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      contentPoolCategoryFilter === cat
                        ? 'bg-[#55A4DA] text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {cat === '' ? '전체' : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {contentPoolLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                  <svg className="w-4 h-4 animate-spin text-[#55A4DA]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-sm">불러오는 중...</span>
                </div>
              ) : contentPoolItems.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                  검색 결과가 없습니다.
                </div>
              ) : (
                contentPoolItems.map(item => {
                  const currentRound = rounds[activeRoundIdx];
                  const poolGroup = contentPoolForCustom && contentPoolGroupId
                    ? currentRound?.customGroups.find(g => g.id === contentPoolGroupId)
                    : undefined;
                  const alreadyAdded = poolGroup
                    ? poolGroup.contents.some(c => c.id === item.id)
                    : (currentRound?.contents.some(c => c.id === item.id) ?? false);
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border transition-all ${
                        alreadyAdded
                          ? 'border-gray-100 bg-gray-50 opacity-50'
                          : 'border-gray-200 hover:border-[#55A4DA] hover:bg-[#55A4DA]/5'
                      }`}
                    >
                      <div
                        onClick={() => !alreadyAdded && (poolGroup ? addCustomContentToGroup(item, poolGroup.id) : addContentToRound(item))}
                        className={`flex items-start gap-3 px-4 pt-3 pb-2 ${alreadyAdded ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {item.thumbnail && (
                          <img src={item.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              item.type === 'original' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                            }`}>{item.type === 'original' ? 'J& 오리지널' : '큐레이션'}</span>
                            <span className="text-[10px] text-gray-400">{item.category}</span>
                          </div>
                          <p className="text-xs font-semibold text-gray-800 truncate">{item.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-400">{item.author} · {item.duration}분</span>
                            {item.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
                            ))}
                          </div>
                        </div>
                        {alreadyAdded ? (
                          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                      </div>
                      {item.body && (
                        <div className="px-4 pb-2.5">
                          <button
                            onClick={() => setContentPreviewItem(item)}
                            className="text-[11px] text-[#55A4DA] hover:text-[#2E7DB5] font-medium transition-colors"
                          >
                            내용 보기 →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end flex-shrink-0">
              <button
                onClick={() => setContentPoolOpen(false)}
                className="px-5 py-2 text-sm font-bold bg-[#55A4DA] hover:bg-[#3A8BC4] text-white rounded-lg transition-colors"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          콘텐츠 내용 보기 모달
      ════════════════════════════════ */}
      {contentPreviewItem && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    contentPreviewItem.type === 'original' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                  }`}>{contentPreviewItem.type === 'original' ? 'J& 오리지널' : '큐레이션'}</span>
                  <span className="text-[10px] text-gray-400">{contentPreviewItem.category} · {contentPreviewItem.duration}분</span>
                </div>
                <h3 className="text-sm font-bold text-gray-800 leading-snug">{contentPreviewItem.title}</h3>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] text-gray-400">{contentPreviewItem.author}</span>
                  {contentPreviewItem.tags.slice(0, 4).map(tag => (
                    <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{tag}</span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setContentPreviewItem(null)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{contentPreviewItem.body}</p>
            </div>
            <div className="px-6 py-3 border-t border-gray-100 flex justify-end flex-shrink-0">
              <button
                onClick={() => setContentPreviewItem(null)}
                className="px-5 py-2 text-sm font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          미리보기 모달
      ════════════════════════════════ */}
      {previewOpen && (() => {
        const schedDates = deliveryInterval && startDate
          ? calcScheduleDates(startDate, deliveryInterval, rounds.length)
          : [];
        const stepGroups = customStoryline
          .map((step, stepIdx) => ({
            step,
            stepIdx,
            rounds: rounds
              .map((r, globalIdx) => ({ ...r, globalIdx }))
              .filter(r => r.stepIndex === stepIdx),
          }))
          .filter(g => g.rounds.length > 0);
        const activeRound = rounds[previewTab];
        const activeStep = activeRound ? customStoryline[activeRound.stepIndex] : null;
        const activeColor = activeRound ? UNIFIED_STEP_COLOR : null;
        const intervalLabel = DELIVERY_INTERVAL_OPTIONS.find(o => o.value === deliveryInterval)?.label ?? '—';

        return (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col">

              {/* 헤더 */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold text-gray-800">뉴스레터 미리보기</h2>
                  <p className="text-xs text-gray-400 mt-0.5">생성 전 전체 구성을 확인하세요.</p>
                </div>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  닫기
                </button>
              </div>

              {/* 스크롤 본문 */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                {/* A: 상단 요약 */}
                <div className="bg-gray-50 rounded-xl p-5">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
                      <p className="text-[11px] text-gray-400 mb-1">대상 기업</p>
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {targetCompanies.length > 0 ? targetCompanies.map(c => c.name).join(', ') : '—'}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
                      <p className="text-[11px] text-gray-400 mb-1">총 회차</p>
                      <p className="text-sm font-bold text-gray-800">{rounds.length}회차</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
                      <p className="text-[11px] text-gray-400 mb-1">발송 주기</p>
                      <p className="text-sm font-bold text-gray-800">{intervalLabel}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-5 flex-wrap">
                      {leadershipTypes.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-gray-400">리더십 유형</span>
                          <div className="flex gap-1">
                            {leadershipTypes.map(t => (
                              <span key={t} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEADERSHIP_COLOR[t] ?? 'bg-gray-100 text-gray-600'}`}>{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-gray-400">시작일</span>
                        <span className="text-xs font-semibold text-gray-700">
                          {startDate ? formatKoreanDate(new Date(startDate + 'T00:00:00')) : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-gray-400">총 발송 기간</span>
                        <span className="text-xs font-semibold text-gray-700">
                          {deliveryInterval && startDate ? effectiveDurationLabel() : '—'}
                        </span>
                      </div>
                    </div>
                    {selectedParticipants.length > 0 && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                        <span className="text-[11px] text-gray-400 flex-shrink-0">수신 리더</span>
                        <span className="text-xs font-semibold text-gray-700">{selectedParticipants.length}명</span>
                        <button
                          type="button"
                          onClick={() => setShowRecipients(true)}
                          className="ml-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E7DB5] bg-[#EAF4FC] hover:bg-[#d9ecfa] px-2.5 py-1 rounded-full transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          확인하기
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* B: 스토리라인 단계별 회차 묶음 */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">스토리라인 단계별 구성</h3>
                  <div className="space-y-2.5">
                    {stepGroups.map(({ step, stepIdx, rounds: groupRounds }) => {
                      const color = UNIFIED_STEP_COLOR;
                      const isOpen = previewOpenGroups.has(stepIdx);
                      const rangeText = groupRounds.length === 1
                        ? `${groupRounds[0].globalIdx + 1}회차`
                        : `${groupRounds[0].globalIdx + 1}~${groupRounds[groupRounds.length - 1].globalIdx + 1}회차`;
                      return (
                        <div key={stepIdx} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                          <button
                            onClick={() => togglePreviewGroup(stepIdx)}
                            className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                          >
                            <div className={`w-7 h-7 rounded-full ${color.badge} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-white text-xs font-bold">{step.step}</span>
                            </div>
                            <div className="flex-1 text-left">
                              <p className={`text-sm font-bold ${color.titleColor}`}>{step.title}</p>
                              <p className="text-[11px] text-gray-400">{step.subtitle}</p>
                            </div>
                            <span className="text-[11px] text-gray-400 flex-shrink-0">{rangeText} · {groupRounds.length}개</span>
                            <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <div className={`grid transition-all duration-200 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                            <div className="overflow-hidden">
                              <div className="border-t border-gray-100 divide-y divide-gray-50">
                                {groupRounds.map(r => {
                                  const date = schedDates[r.globalIdx];
                                  return (
                                    <div key={r.id} className="px-5 py-3">
                                      <div className="flex items-center gap-3 flex-wrap mb-2">
                                        <span className="text-xs font-bold text-gray-700">{r.globalIdx + 1}회차</span>
                                        <span className="text-[11px] text-gray-400">콘텐츠 {r.contents.length}개</span>
                                        {r.interactions.length > 0 && (
                                          <span className="text-[11px] text-[#55A4DA]">
                                            {r.interactions.map(v => INTERACTION_LABELS[v] ?? v).join(' · ')}
                                          </span>
                                        )}
                                        {r.surveys.length > 0 && (
                                          <span className="text-[11px] text-purple-500">
                                            {r.surveys.map(v => v === 'always' ? '상시조사' : '정기조사').join(' · ')}
                                          </span>
                                        )}
                                        {date && (
                                          <span className="text-[11px] text-gray-400">📅 {formatKoreanDate(date)}</span>
                                        )}
                                      </div>
                                      {/* 그룹별 주제 — 그룹마다 주제가 다를 수 있으므로 그룹 단위로 표시 */}
                                      {(() => {
                                        const activeGroups = r.customGroups.filter(g => g.types.length > 0);
                                        if (activeGroups.length === 0 && r.generalLeaderIds.length === 0) {
                                          return (
                                            <div className="flex items-baseline gap-2">
                                              <span className={`text-xs flex-1 min-w-0 ${r.topic.trim() ? 'text-gray-600' : 'text-gray-300 italic'}`}>{r.topic.trim() || '주제 미선정'}</span>
                                              <span className="text-[11px] text-gray-400 flex-shrink-0">전체 {selectedParticipants.length}명</span>
                                            </div>
                                          );
                                        }
                                        return (
                                          <div className="space-y-1">
                                            {activeGroups.map(g => (
                                              <div key={g.id} className="flex items-baseline gap-2">
                                                <span className="text-[11px] font-semibold text-[#2E7DB5] flex-shrink-0">{g.types.join(' · ')}</span>
                                                <span className={`text-xs flex-1 min-w-0 truncate ${g.topic?.trim() ? 'text-gray-600' : 'text-gray-300 italic'}`}>{g.topic?.trim() || '주제 미선정'}</span>
                                                <span className="text-[11px] text-gray-400 flex-shrink-0">{g.leaderIds.length}명</span>
                                              </div>
                                            ))}
                                            {r.generalLeaderIds.length > 0 && (
                                              <div className="flex items-baseline gap-2">
                                                <span className="text-[11px] font-semibold text-gray-500 flex-shrink-0">일반</span>
                                                <span className={`text-xs flex-1 min-w-0 truncate ${r.topic.trim() ? 'text-gray-600' : 'text-gray-300 italic'}`}>{r.topic.trim() || '주제 미선정'}</span>
                                                <span className="text-[11px] text-gray-400 flex-shrink-0">{r.generalLeaderIds.length}명</span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* C: 뉴스레터 프리뷰 */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">뉴스레터 PREVIEW</h3>
                  {/* 회차 탭 */}
                  <div className="flex gap-1.5 overflow-x-auto pb-2 flex-nowrap mb-4">
                    {rounds.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectPreviewTab(idx)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          previewTab === idx
                            ? 'bg-[#55A4DA] text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {idx + 1}회차
                      </button>
                    ))}
                  </div>
                  {/* AI 생성 영역 */}
                  {activeRound && (() => {
                    // 회차 내 발송 그룹 탭 — customGroups에는 카탈로그 백필로 자동 추가된 미구성 그룹도
                    // 섞여 있을 수 있으므로, types.length만으로 걸러선 안 되고 실제로 주제/콘텐츠가
                    // 구성되어 생성 대상인 그룹만 노출한다 (일반 탭도 동일 기준 적용).
                    const generatedGroups = activeRound.customGroups.filter(
                      g => g.types.length > 0 && (g.topic.trim().length > 0 || g.contents.length > 0)
                    );
                    const generalGen = generatedContent[previewTab] ?? livePreviewContent[`${previewTab}:general`];
                    const hasGeneralTarget = activeRound.generalLeaderIds.length > 0
                      && (activeRound.topic.trim().length > 0 || activeRound.contents.length > 0);
                    const groupTabs = [
                      ...(hasGeneralTarget ? [{ id: 'general', label: '일반' }] : []),
                      ...generatedGroups.map(g => ({ id: g.id, label: g.types.join('·') })),
                    ];
                    const curGroup = groupTabs.some(t => t.id === previewGroupId) ? previewGroupId : (groupTabs[0]?.id ?? 'general');
                    const displayGenerated = curGroup === 'general' ? generalGen : livePreviewContent[`${previewTab}:${curGroup}`];
                    const contentTab = previewContentTab[previewTab] ?? 'full';
                    const firstThumbnail = activeRound.contents[0]?.thumbnail ?? '';
                    const schedDate = schedDates[previewTab];

                    const groupTabsUI = groupTabs.length > 0 ? (
                      <div className="flex gap-1.5 overflow-x-auto pb-2 flex-nowrap mb-3">
                        {groupTabs.map(t => (
                          <button key={t.id} onClick={() => { setPreviewGroupId(t.id); setEditMode(false); }}
                            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${curGroup === t.id ? 'bg-[#2E7DB5] text-white' : 'bg-[#EAF4FC] text-[#2E7DB5] hover:bg-[#d9ecfa]'}`}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    ) : null;

                    // 저장된 데이터만 표시 — 없으면 안내 (API 호출/스피너 없음)
                    if (!displayGenerated) {
                      const genKey = `${previewTab}:${curGroup}`;
                      const failed = livePreviewErrors.has(genKey);
                      const busy = livePreviewGenerating.has(genKey);
                      return (
                        <>
                          {groupTabsUI}
                          <div className="flex flex-col items-center justify-center py-20 px-6 gap-3 text-center">
                            {failed ? (
                              <>
                                <svg className="w-9 h-9 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <div>
                                  <p className="text-sm font-semibold text-gray-600">본문 생성에 실패했어요</p>
                                  <p className="text-xs text-gray-400 mt-1">AI 생성 중 오류가 발생했어요. AI 크레딧 잔액을 확인해 주세요.</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => { void generateLivePreview(previewTab, curGroup); }}
                                  disabled={busy}
                                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#55A4DA] hover:bg-[#3A8BC4] px-3.5 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                                >
                                  {busy ? '생성 중…' : '다시 생성'}
                                </button>
                              </>
                            ) : (
                              <>
                                <svg className="w-9 h-9 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <div>
                                  <p className="text-sm font-semibold text-gray-600">{curGroup === 'general' ? '아직 생성된 본문이 없어요' : '이 그룹의 본문이 아직 생성되지 않았어요'}</p>
                                  <p className="text-xs text-gray-400 mt-1">콘텐츠 구성 단계에서 {curGroup === 'general' ? '이 회차를' : '이 그룹을'} 먼저 생성해주세요</p>
                                </div>
                              </>
                            )}
                          </div>
                        </>
                      );
                    }

                    const generated = displayGenerated;
                    const canEdit = curGroup === 'general';
                    const isEdited = editedRoundsRef.current.has(previewTab);
                    return (
                      <div className="space-y-3">
                        {groupTabsUI}
                        {/* 서브탭 + 편집/다시생성 */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex gap-1">
                            {(['full', 'email'] as const).map(tab => (
                              <button
                                key={tab}
                                onClick={() => setPreviewContentTab(prev => ({ ...prev, [previewTab]: tab }))}
                                disabled={editMode}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 ${
                                  contentTab === tab
                                    ? 'bg-[#55A4DA] text-white'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                              >
                                {tab === 'full' ? '전체 본문' : '요약본'}
                              </button>
                            ))}
                            {isEdited && !editMode && (
                              <span className="self-center ml-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">편집됨</span>
                            )}
                          </div>
                          {!editMode && (
                            <div className="flex items-center gap-2">
                              {canEdit && (
                                <button
                                  onClick={startEdit}
                                  className="flex items-center gap-1 text-xs font-semibold text-[#55A4DA] hover:text-[#3A8BC4] transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  본문 편집
                                </button>
                              )}
                              {generated && (
                                <button
                                  onClick={async () => {
                                    if (isPptDownloading) return;
                                    setIsPptDownloading(true);
                                    try {
                                      const { downloadNewsletterPPT } = await import('@/lib/generatePPT');
                                      await downloadNewsletterPPT(generated, {
                                        vol: previewTab + 1,
                                        companyName: targetCompanies[0]?.name ?? 'J&Company',
                                        dateLabel: schedDate ? formatKoreanDate(schedDate) : undefined,
                                        interactions: activeRound?.interactions,
                                        surveys: activeRound?.surveys,
                                      });
                                    } finally {
                                      setIsPptDownloading(false);
                                    }
                                  }}
                                  disabled={isPptDownloading}
                                  className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  {isPptDownloading ? (
                                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  )}
                                  PPT 다운로드
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 편집 모드: 편집 패널 / 보기 모드: 미리보기 */}
                        {editMode ? renderEditPanel() : (
                          <>
                            {contentTab === 'email' && renderNewsletterEmailPreview(generated, {
                              vol: previewTab + 1,
                              dateLabel: schedDate ? formatKoreanDate(schedDate) : '',
                              firstThumbnail,
                              onReadFull: () => setPreviewContentTab(prev => ({ ...prev, [previewTab]: 'full' })),
                            })}
                            {contentTab === 'full' && renderGeneratedFullBody(generated, {
                              vol: previewTab + 1,
                              dateLabel: schedDate ? formatKoreanDate(schedDate) : '—',
                              leadershipLabel: leadershipTypes.join(', '),
                              firstThumbnail,
                              templateInteractions: activeRound.interactions,
                              templateSurveys: activeRound.surveys,
                              templateSurveyContentLabels: activeRound.contents.map(c => c.title),
                              templateSurveyInteractionLabels: activeRound.interactions.map(k => INTERACTION_LABELS[k] ?? k),
                            })}
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>

              </div>

              {/* 푸터 */}
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  수정하러 돌아가기
                </button>
                <button
                  onClick={handleConfirmCreate}
                  disabled={isConfirming}
                  className="flex items-center gap-2 px-6 py-2 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-sm font-bold rounded-lg transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isConfirming ? '생성 중…' : '생성 확정'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

            </div>

            {/* 수신 리더 확인 오버레이 (유형 그룹별) */}
            {showRecipients && (
              <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowRecipients(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                    <div>
                      <h3 className="text-base font-bold text-gray-800">수신 리더</h3>
                      <p className="text-xs text-gray-400 mt-0.5">유형 그룹별 · 총 {selectedParticipants.length}명</p>
                    </div>
                    <button onClick={() => setShowRecipients(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    {(() => {
                      const groups = new Map<string, typeof selectedParticipants>();
                      selectedParticipants.forEach(p => {
                        const k = p.leadershipType || '미분류';
                        if (!groups.has(k)) groups.set(k, []);
                        groups.get(k)!.push(p);
                      });
                      return [...groups.entries()].map(([type, members]) => (
                        <div key={type}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${LEADERSHIP_COLOR[type] ?? 'bg-gray-100 text-gray-600'}`}>{type}</span>
                            <span className="text-[11px] text-gray-400">{members.length}명</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {members.map(p => (
                              <span key={p.id} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100 text-gray-700">
                                {p.name} <span className="text-gray-400">{p.position}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}


      {/* ── 임시저장 토스트 ── */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-gray-800">저장하지 않고 나가시겠습니까?</h3>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">작업 내용이 사라집니다.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-4 py-2 text-sm font-semibold bg-[#55A4DA] hover:bg-[#3A8BC4] text-white rounded-lg transition-colors"
              >
                계속 작업
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}

      {storageImportOpen && (
        <StorageImportModal
          onImport={(generated, headline) => handleImportFromStorage(storageImportTargetId, generated, headline)}
          onClose={() => setStorageImportOpen(false)}
        />
      )}

      {showDraftToast && (
        <div className="fixed top-4 right-4 z-[100] bg-gray-800 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* ── 하단 네비게이션 ── */}
      {configDraft.companyIds.length > 0 && <div className="bg-white border-t border-gray-200 px-8 py-3.5 flex items-center justify-between flex-shrink-0">
        <button
          onClick={goPrev}
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {wizardStep === 1 ? '기업 선택' : '이전'}
        </button>

        {wizardStep < 5 && (
          <div className="relative group">
            {wizardStep === 1 && configDraft.companyIds.length === 0 && (
              <div className="absolute bottom-full mb-2 right-0 whitespace-nowrap bg-gray-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                기업을 먼저 선택해주세요
              </div>
            )}
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
          </div>
        )}
        {wizardStep === 5 && (
          <button
            onClick={handleComplete}
            disabled={!deliveryInterval || !startDate}
            className={`flex items-center gap-1.5 text-sm font-semibold px-5 py-1.5 rounded-lg transition-colors ${
              deliveryInterval && startDate
                ? 'bg-[#55A4DA] hover:bg-[#3A8BC4] text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            생성
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>}

    </div>
  );
}

// 내용 길이에 맞춰 높이가 자동으로 늘어나는 textarea (AI 생성 텍스트가 잘리지 않도록)
function AutoGrowTextarea({ value, onChange, placeholder, className, minRows = 2 }: {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      rows={minRows}
      placeholder={placeholder}
      className={className}
      style={{ overflow: 'hidden' }}
    />
  );
}

// persist(sessionStorage) 스토어가 hydrate되기 전에 ConfigureContent가 마운트되면
// useState 초기값이 seed된 값(wizardStep=5, rounds, 스토리라인 등) 대신 기본값을 읽어
// '스토리라인(1단계)' 초기 화면이 뜨는 문제가 발생한다. hydration 완료 후에만 마운트한다.
function useDraftHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const store = useNewNewsletterDraftStore.persist;
    if (store.hasHydrated()) setHydrated(true);
    const unsub = store.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}

function ConfigureGate() {
  const hydrated = useDraftHydrated();
  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        불러오는 중...
      </div>
    );
  }
  return <ConfigureContent />;
}

export default function ConfigurePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        로딩 중...
      </div>
    }>
      <ConfigureGate />
    </Suspense>
  );
}
