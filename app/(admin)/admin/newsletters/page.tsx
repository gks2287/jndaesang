'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNewNewsletterDraftStore, type WizardStep } from '@/store/newNewsletterDraftStore';
import { DEFAULT_STORYLINE } from '@/lib/storyline';
import type { Round } from '@/lib/content';
import { sentKey, isSendGroupSent } from '@/lib/newsletterSend';
import { type DeliveryInterval, DELIVERY_INTERVAL_OPTIONS, calcScheduleDates, formatKoreanDate } from '@/lib/schedule';
import { useCompanyStore } from '@/store/companyStore';
import { useNewsletterStore, type Newsletter } from '@/store/newsletterStore';
import CompanyLogo from '@/components/CompanyLogo';
import { useParticipantStore, participantToken, type Participant } from '@/store/participantStore';
import { SavedNewsletterPreviewModal, type SavedNewsletterContent, type SavedNewsletterRound, type GeneratedNewsletter } from '@/components/newsletter/NewsletterRender';
import { getContentList, type ContentPoolItem } from '@/lib/api/contentPool';

// ── 타입 ─────────────────────────────────────────────────────────────
type RoundStatus = 'inProgress' | 'completed';
type Polarity = 'positive' | 'negative';
type TabType = '최근' | '제작 중' | '제작완료';

interface RoundData {
  id: string;
  round: number;
  stage: string;
  topic: string | null;
  status: RoundStatus;
  progressPct: number;
}

interface TypeData {
  typeName: string;
  count: number;
  rounds: RoundData[];
  newsletterId?: number;
}

interface PolarityGroup {
  polarity: Polarity;
  totalCount: number;
  types: TypeData[];
  newsletterIds: number[];
}

interface CompanyData {
  companyId: number;
  companyName: string;
  totalLeaders: number;
  groups: PolarityGroup[];
  updatedAt: string;
}

interface PreviewTarget {
  companyName: string;
  polarity: Polarity;
  typeName: string;
  count: number;
  round: RoundData;
}

interface TypeRoundSelection {
  typeName: string;
  roundNums: number[];
}

interface SendConfirmTarget {
  selections: { company: CompanyData; typeRounds: TypeRoundSelection[] }[];
}

// ── 목업 데이터 ──────────────────────────────────────────────────────
const STAGES = ['수용', '분석', '실행', '적용', '공유', '성찰'];

function mk(cid: number, pol: string, type: string, round: number, topic: string | null, status: RoundStatus, pct: number): RoundData {
  return { id: `c${cid}-${pol}-${type}-${round}`, round, stage: STAGES[round - 1], topic, status, progressPct: pct };
}

const MOCK_COMPANIES: CompanyData[] = [
  {
    companyId: 1, companyName: 'LG화학', totalLeaders: 13, updatedAt: '2026-05-16',
    groups: [
      {
        polarity: 'positive', newsletterIds: [], totalCount: 8,
        types: [
          { typeName: '코칭형', count: 5, rounds: [
            mk(1,'positive','코칭형',1,'나의 리더십을 돌아보며','completed',100),
            mk(1,'positive','코칭형',2,'강점을 발견하는 시간','completed',100),
            mk(1,'positive','코칭형',3,'코칭 대화 시작하기','inProgress',60),
            mk(1,'positive','코칭형',4,null,'inProgress',0),
            mk(1,'positive','코칭형',5,null,'inProgress',0),
            mk(1,'positive','코칭형',6,null,'inProgress',0),
          ]},
          { typeName: '민주형', count: 3, rounds: [
            mk(1,'positive','민주형',1,'팀원과의 신뢰 쌓기','completed',100),
            mk(1,'positive','민주형',2,'민주적 의사결정 이해','inProgress',40),
            mk(1,'positive','민주형',3,null,'inProgress',0),
            mk(1,'positive','민주형',4,null,'inProgress',0),
            mk(1,'positive','민주형',5,null,'inProgress',0),
            mk(1,'positive','민주형',6,null,'inProgress',0),
          ]},
        ],
      },
      {
        polarity: 'negative', newsletterIds: [], totalCount: 5,
        types: [
          { typeName: '독재형', count: 3, rounds: [
            mk(1,'negative','독재형',1,'나의 리더십을 돌아보며','completed',100),
            mk(1,'negative','독재형',2,'독재적 패턴 인식하기','completed',100),
            mk(1,'negative','독재형',3,'경청과 소통 연습','inProgress',30),
            mk(1,'negative','독재형',4,null,'inProgress',0),
            mk(1,'negative','독재형',5,null,'inProgress',0),
            mk(1,'negative','독재형',6,null,'inProgress',0),
          ]},
          { typeName: '방관형', count: 2, rounds: [
            mk(1,'negative','방관형',1,'책임감의 의미 되새기기','inProgress',50),
            mk(1,'negative','방관형',2,null,'inProgress',0),
            mk(1,'negative','방관형',3,null,'inProgress',0),
            mk(1,'negative','방관형',4,null,'inProgress',0),
            mk(1,'negative','방관형',5,null,'inProgress',0),
            mk(1,'negative','방관형',6,null,'inProgress',0),
          ]},
        ],
      },
    ],
  },
  {
    companyId: 2, companyName: '현대모비스', totalLeaders: 9, updatedAt: '2026-05-14',
    groups: [
      {
        polarity: 'positive', newsletterIds: [], totalCount: 4,
        types: [
          { typeName: '코칭형', count: 4, rounds: [
            mk(2,'positive','코칭형',1,'성장을 이끄는 질문법','completed',100),
            mk(2,'positive','코칭형',2,'코칭형 리더의 핵심 역량','inProgress',70),
            mk(2,'positive','코칭형',3,null,'inProgress',0),
            mk(2,'positive','코칭형',4,null,'inProgress',0),
            mk(2,'positive','코칭형',5,null,'inProgress',0),
            mk(2,'positive','코칭형',6,null,'inProgress',0),
          ]},
        ],
      },
      {
        polarity: 'negative', newsletterIds: [], totalCount: 5,
        types: [
          { typeName: '불통형', count: 3, rounds: [
            mk(2,'negative','불통형',1,'소통의 벽을 허물다','completed',100),
            mk(2,'negative','불통형',2,'경청하는 리더 되기','completed',100),
            mk(2,'negative','불통형',3,'열린 대화 문화 만들기','inProgress',45),
            mk(2,'negative','불통형',4,null,'inProgress',0),
            mk(2,'negative','불통형',5,null,'inProgress',0),
            mk(2,'negative','불통형',6,null,'inProgress',0),
          ]},
          { typeName: '성과압박형', count: 2, rounds: [
            mk(2,'negative','성과압박형',1,'압박 없이 성과 내기','inProgress',80),
            mk(2,'negative','성과압박형',2,null,'inProgress',0),
            mk(2,'negative','성과압박형',3,null,'inProgress',0),
            mk(2,'negative','성과압박형',4,null,'inProgress',0),
            mk(2,'negative','성과압박형',5,null,'inProgress',0),
            mk(2,'negative','성과압박형',6,null,'inProgress',0),
          ]},
        ],
      },
    ],
  },
  {
    companyId: 3, companyName: 'SK하이닉스', totalLeaders: 6, updatedAt: '2026-03-25',
    groups: [
      {
        polarity: 'negative', newsletterIds: [], totalCount: 6,
        types: [
          { typeName: '방관형', count: 6, rounds: [
            mk(3,'negative','방관형',1,'리더의 존재 이유','completed',100),
            mk(3,'negative','방관형',2,'방관의 원인 찾기','completed',100),
            mk(3,'negative','방관형',3,'작은 개입으로 변화 시작','completed',100),
            mk(3,'negative','방관형',4,'현장 변화 실천기','completed',100),
            mk(3,'negative','방관형',5,'팀원과 함께한 여정','completed',100),
            mk(3,'negative','방관형',6,'지속 가능한 리더십 정착','completed',100),
          ]},
        ],
      },
    ],
  },
  {
    companyId: 4, companyName: 'KT&G', totalLeaders: 8, updatedAt: '2026-05-12',
    groups: [
      {
        polarity: 'positive', newsletterIds: [], totalCount: 8,
        types: [
          { typeName: '민주형', count: 5, rounds: [
            mk(4,'positive','민주형',1,'함께 만드는 비전','completed',100),
            mk(4,'positive','민주형',2,'팀 참여를 높이는 방법','inProgress',55),
            mk(4,'positive','민주형',3,null,'inProgress',0),
            mk(4,'positive','민주형',4,null,'inProgress',0),
            mk(4,'positive','민주형',5,null,'inProgress',0),
            mk(4,'positive','민주형',6,null,'inProgress',0),
          ]},
          { typeName: '코칭형', count: 3, rounds: [
            mk(4,'positive','코칭형',1,'질문으로 이끄는 리더십','inProgress',90),
            mk(4,'positive','코칭형',2,null,'inProgress',0),
            mk(4,'positive','코칭형',3,null,'inProgress',0),
            mk(4,'positive','코칭형',4,null,'inProgress',0),
            mk(4,'positive','코칭형',5,null,'inProgress',0),
            mk(4,'positive','코칭형',6,null,'inProgress',0),
          ]},
        ],
      },
    ],
  },
  {
    companyId: 5, companyName: '포스코', totalLeaders: 7, updatedAt: '2025-09-20',
    groups: [
      {
        polarity: 'negative', newsletterIds: [], totalCount: 7,
        types: [
          { typeName: '독재형', count: 4, rounds: [
            mk(5,'negative','독재형',1,'권위와 신뢰 사이에서','completed',100),
            mk(5,'negative','독재형',2,'지시에서 협의로','completed',100),
            mk(5,'negative','독재형',3,'팀원의 목소리 듣기','completed',100),
            mk(5,'negative','독재형',4,'자율성을 허용하는 연습','completed',100),
            mk(5,'negative','독재형',5,'변화된 리더십 나누기','completed',100),
            mk(5,'negative','독재형',6,'지속 가능한 성장 계획','completed',100),
          ]},
          { typeName: '감정기복형', count: 3, rounds: [
            mk(5,'negative','감정기복형',1,'감정 인식의 첫 걸음','completed',100),
            mk(5,'negative','감정기복형',2,'감정 조절 패턴 이해','completed',100),
            mk(5,'negative','감정기복형',3,'안정적 리더십 실천','completed',100),
            mk(5,'negative','감정기복형',4,'팀 심리 안전감 구축','completed',100),
            mk(5,'negative','감정기복형',5,'일관성 있는 소통하기','completed',100),
            mk(5,'negative','감정기복형',6,'평온한 리더로 마무리','completed',100),
          ]},
        ],
      },
    ],
  },
];

const leadershipColor: Record<string, string> = {
  '독재형': 'bg-red-100 text-red-700', '방관형': 'bg-orange-100 text-orange-700',
  '성과압박형': 'bg-purple-100 text-purple-700', '불통형': 'bg-pink-100 text-pink-700',
  '불명확형': 'bg-indigo-100 text-indigo-700', '감정기복형': 'bg-amber-100 text-amber-700',
  '코칭형': 'bg-blue-100 text-blue-700', '민주형': 'bg-sky-100 text-sky-700',
  '비전형': 'bg-teal-100 text-teal-700', '지원형': 'bg-green-100 text-green-700',
  '혁신형': 'bg-violet-100 text-violet-700',
};

// 탭 제거 — 상태 필터링 없이 전체 회차를 표시한다.
// (제작완료/제작 중 여부는 각 회차·카드의 isDone 분기로 버튼·동작이 그대로 결정됨)
function filterRounds(rounds: RoundData[], _tab: TabType): RoundData[] {
  return rounds;
}

// authoring.rounds가 없거나(레거시 캠페인) 개수가 totalRounds와 안 맞는 경우를 대비한 폴백.
// 콘텐츠 구성 화면은 rounds.length === 0이면 진입을 막으므로, 스토리라인 단계에 고르게 배분한 빈 회차를 만들어
// "이어서 만들기"가 항상 진입 가능하도록 한다.
function makeFallbackRounds(totalRounds: number, stepCount: number): Round[] {
  const steps = Math.max(1, stepCount);
  const base = Math.floor(totalRounds / steps);
  const extra = totalRounds % steps;
  let id = 1;
  return Array.from({ length: steps }, (_, stepIndex) => (stepIndex < extra ? base + 1 : base))
    .flatMap((count, stepIndex) =>
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
        attachments: [],
      }))
    );
}

// 저장 본문 sections에서 원래 사용한 콘텐츠 목록을 복원.
// 콘텐츠 풀에 실물 아이템(id 일치)이 있으면 그대로 사용하고, 없으면 저장된 섹션 정보로 항목을 재구성한다.
function contentsFromGenerated(gen: GeneratedNewsletter, pool: ContentPoolItem[]): ContentPoolItem[] {
  return (gen.sections ?? [])
    .filter(s => (s.contentId ?? '').length > 0 || (s.contentTitle ?? '').length > 0)
    .map((s, i) => {
      const real = pool.find(p => p.id === s.contentId);
      if (real) return real;
      return {
        id: s.contentId || `restored-${i}`,
        type: 'curation' as const,
        title: s.contentTitle,
        category: '아티클' as const,
        duration: 0,
        author: '',
        tags: [],
        thumbnail: s.thumbnail ?? '',
        thumbnailUrl: s.thumbnailUrl,
        body: s.body && s.body.length > 0 ? s.body.join('\n\n') : (s.mainBody ?? s.summary ?? ''),
        summary: s.summary,
        createdAt: '',
      };
    });
}

// 수정/이어서 진입 시: 회차 구성(주제·콘텐츠·인터랙션·만족도)이 비어 있으면 저장된 생성 본문에서 복원.
// 비어 있는 항목만 채우므로, 진입 직후 AI가 주제·콘텐츠를 새로 자동 선택하는 것을 막고 원래 구성을 보여준다.
function restoreRoundFromSaved(r: Round, savedRound: SavedNewsletterRound | undefined, pool: ContentPoolItem[]): Round {
  if (!savedRound?.generated?.headline) return r;
  const savedGroups = savedRound.groups?.length
    ? savedRound.groups
    : [{ groupId: 'general', types: [] as string[], label: savedRound.leadershipLabel, generated: savedRound.generated, interactions: savedRound.interactions, surveys: savedRound.surveys }];
  const general = savedGroups.find(g => g.groupId === 'general');
  const next: Round = { ...r };
  if (general) {
    if (!next.topic.trim()) next.topic = general.generated.headline ?? '';
    if (next.contents.length === 0) next.contents = contentsFromGenerated(general.generated, pool);
    if (next.interactions.length === 0) next.interactions = general.interactions ?? [];
    if (next.surveys.length === 0) next.surveys = general.surveys ?? [];
  }
  next.customGroups = r.customGroups.map(g => {
    const sg = savedGroups.find(sv => sv.groupId === g.id)
      ?? savedGroups.find(sv => sv.groupId !== 'general' && sv.types.length > 0 && sv.types.join('·') === g.types.join('·'));
    if (!sg) return g;
    return {
      ...g,
      topic: g.topic.trim() ? g.topic : (sg.generated.headline ?? ''),
      contents: g.contents.length > 0 ? g.contents : contentsFromGenerated(sg.generated, pool),
      interactions: g.interactions.length > 0 ? g.interactions : (sg.interactions ?? []),
      surveys: g.surveys.length > 0 ? g.surveys : (sg.surveys ?? []),
    };
  });
  return next;
}

function DeleteConfirmModal({ title, description, onConfirm, onClose }: {
  title: string; description: React.ReactNode; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 60) return `${Math.max(1, diffMin)}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

// "2026년 7월 1일" → Date. 형식이 다르면 null.
function parseKoreanDateLabel(label: string): Date | null {
  const m = label.match(/(\d+)년\s*(\d+)월\s*(\d+)일/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// 이 기업의 뉴스레터들 중 해당 회차(1-based)의 발송일을 찾는다.
// 같은 회차를 여러 유형(뉴스레터)이 나눠 받아도 발송일은 보통 회차 단위로 동일하므로,
// 처음 발견되는 유효한 값 하나만 사용해 회차당 한 번만 표시한다.
// 우선순위: ① 제작완료 시 저장된 본문의 dateLabel → ② authoring의 회차별 수동 변경(scheduleDateOverrides)
// → ③ authoring의 startDate·deliveryInterval로 균등 계산
// → ④ (레거시 — authoring.startDate가 없는 구버전 캠페인) 1회차 실제 저장 발송일 + deliveryInterval로 순연 계산
// → ⑤ 계산 불가(null, 화면에서 '발송일 미정'으로 표시)
function findRoundDateLabel(companyNewsletters: Newsletter[], roundNum: number): string | null {
  // ① 제작완료된 회차는 저장된 본문에 실제 발송일이 확정되어 있음
  for (const nl of companyNewsletters) {
    const label = nl.generatedContent?.rounds?.[roundNum - 1]?.dateLabel;
    if (label && label.trim()) return label.trim();
  }
  // ②·③ 제작 중 회차는 authoring(시작일·주기·수동 변경분)으로 계산
  for (const nl of companyNewsletters) {
    const a = nl.authoring;
    if (!a?.startDate || !a?.deliveryInterval) continue;
    const totalRounds = a.totalRounds && a.totalRounds > 0 ? a.totalRounds : (a.rounds?.length ?? 0);
    if (totalRounds <= 0 || roundNum > totalRounds) continue;
    const override = a.scheduleDateOverrides?.[roundNum - 1];
    if (override) {
      const od = new Date(override + 'T00:00:00');
      if (!Number.isNaN(od.getTime())) return formatKoreanDate(od);
    }
    const computed = calcScheduleDates(a.startDate, a.deliveryInterval as DeliveryInterval, totalRounds)[roundNum - 1];
    if (computed) return formatKoreanDate(computed);
  }
  // ④ 레거시 폴백 — authoring.startDate가 없어도 deliveryInterval과 1회차 실제 발송일만 있으면 순연 계산
  for (const nl of companyNewsletters) {
    const interval = nl.authoring?.deliveryInterval as DeliveryInterval | undefined;
    if (!interval) continue;
    const round1Label = nl.generatedContent?.rounds?.[0]?.dateLabel;
    const round1Date = round1Label ? parseKoreanDateLabel(round1Label) : null;
    if (!round1Date) continue;
    const days = DELIVERY_INTERVAL_OPTIONS.find(o => o.value === interval)?.days ?? 30;
    const target = new Date(round1Date);
    target.setDate(target.getDate() + (roundNum - 1) * days);
    return formatKoreanDate(target);
  }
  return null;
}

// "2026년 7월 22일" → "7/22" 축약. 형식이 다르면 원본을 그대로 반환.
function toShortDateLabel(dateLabel: string): string {
  const m = dateLabel.match(/(\d+)년\s*(\d+)월\s*(\d+)일/);
  return m ? `${Number(m[2])}/${Number(m[3])}` : dateLabel;
}

// ── 복구 팝업 ─────────────────────────────────────────────────────────
function RecoveryModal({ companyNames, stepLabel, onNew, onContinue, onClose }: {
  companyNames: string[]; stepLabel: string;
  onNew: () => void; onContinue: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-gray-300 hover:text-gray-500 transition-colors"
          title="닫기"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-800">작업 중인 내용이 있습니다</h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              <span className="font-semibold text-gray-700">
                {companyNames.length > 0 ? companyNames.join(', ') : '작업 중인 기업'}
              </span>의 뉴스레터를{' '}
              <span className="font-semibold text-gray-700">{stepLabel}</span> 중이었습니다.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onNew}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            새로 만들기
          </button>
          <button
            onClick={onContinue}
            className="flex-1 px-4 py-2 text-sm font-bold bg-[#55A4DA] hover:bg-[#3A8BC4] text-white rounded-lg transition-colors"
          >
            이어서 하기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 미리보기 모달 ────────────────────────────────────────────────────
function PreviewModal({ target, onClose }: { target: PreviewTarget; onClose: () => void }) {
  const isDone = target.round.status === 'completed';
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-800">뉴스레터 미리보기</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <CompanyLogo name={target.companyName} size={40} />
            <div>
              <p className="text-sm font-bold text-gray-800">{target.companyName}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${target.polarity === 'positive' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                  {target.polarity === 'positive' ? '긍정적' : '부정적'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${leadershipColor[target.typeName] ?? 'bg-gray-100 text-gray-500'}`}>
                  {target.typeName}
                </span>
                <span className="text-xs text-gray-400">{target.count}명</span>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">{target.round.round}회차</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 font-medium">{target.round.stage}</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-yellow-50 text-yellow-600'}`}>
                {isDone ? '제작완료' : '제작 중'}
              </span>
            </div>
            <p className={`text-sm font-medium ${target.round.topic ? 'text-gray-700' : 'text-gray-400 italic'}`}>
              {target.round.topic ?? '주제 미선정'}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div className={`h-2 rounded-full ${isDone ? 'bg-emerald-400' : 'bg-[#55A4DA]'}`} style={{ width: `${target.round.progressPct}%` }} />
              </div>
              <span className="text-xs font-semibold text-gray-500">{target.round.progressPct}%</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 발송 확인 모달 ──────────────────────────────────────────────────
function SendConfirmModal({ target, onConfirm, onClose, isSending }: {
  target: SendConfirmTarget; onConfirm: () => void; onClose: () => void; isSending: boolean;
}) {
  const totalCount = target.selections.reduce((s, sel) =>
    s + sel.typeRounds.reduce((s2, tr) => s2 + tr.roundNums.length, 0), 0);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#55A4DA]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-800">뉴스레터 발송</h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              선택한 <span className="font-semibold text-gray-700">{totalCount}개</span> 뉴스레터를 발송하시겠습니까?
            </p>
            <ul className="mt-2.5 space-y-2">
              {target.selections.map(({ company, typeRounds }) => (
                <li key={company.companyId} className="text-[11px]">
                  <span className="font-semibold text-gray-700">{company.companyName}</span>
                  <ul className="mt-1 ml-3 space-y-0.5">
                    {typeRounds.map(tr => (
                      <li key={tr.typeName} className="flex items-baseline gap-1.5">
                        <span className="text-gray-500">{tr.typeName}</span>
                        <span className="text-gray-400">— {tr.roundNums.join('·')}회차</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-gray-400 mt-2.5">(각 리더십 유형별 해당 직책자에게 맞춤 발송됩니다)</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={isSending}
            className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
            취소
          </button>
          <button onClick={onConfirm} disabled={isSending}
            className="px-4 py-2 text-sm font-bold bg-[#55A4DA] hover:bg-[#3A8BC4] text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5">
            {isSending ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                발송 중...
              </>
            ) : '발송'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 발송완료 판정은 '@/lib/newsletterSend'의 sentKey · isSendGroupSent 사용

// ── 회차 선택 발송 모달 (유형 매칭 직책자에게 실제 이메일 발송) ──────────
function SendRoundModal({ company, newsletters, participants, onClose }: {
  company: CompanyData;
  newsletters: Newsletter[];
  participants: Participant[];
  onClose: () => void;
}) {
  const markGroupsSent = useNewsletterStore(s => s.markGroupsSent);
  const companyNLs = useMemo(
    () => newsletters.filter(n =>
      n.companyId === company.companyId && n.status === '제작완료' &&
      n.generatedContent && n.generatedContent.rounds.length > 0),
    [newsletters, company.companyId],
  );
  // 회차별 발송 그룹 목록 — authoring의 customGroups 기준(유형 묶음별). 없으면 전체 대상 1그룹.
  type SendGroup = { key: string; label: string; topic: string; recipients: Participant[] };
  const sendGroupsForRound = (nl: Newsletter, roundIdx: number): SendGroup[] => {
    const cgs = nl.authoring?.rounds?.[roundIdx]?.customGroups?.filter(g => g.types.length > 0);
    if (cgs && cgs.length > 0) {
      return cgs.map(cg => ({
        key: cg.types.join(','),
        label: cg.types.join(' / '),
        topic: cg.topic?.trim() ?? '',
        recipients: participants.filter(p => p.companyId === company.companyId && cg.types.includes(p.leadershipType)),
      }));
    }
    // authoring 없음 → 유형별 전체(그 회사 참여자를 유형 단위로 묶어 각각 발송 가능하게)
    const types = [...new Set(participants.filter(p => p.companyId === company.companyId).map(p => p.leadershipType).filter(Boolean))];
    if (types.length > 0) {
      return types.map(t => ({
        key: t,
        label: t,
        topic: '',
        recipients: participants.filter(p => p.companyId === company.companyId && p.leadershipType === t),
      }));
    }
    return [{ key: 'all', label: '전체 대상', topic: '', recipients: participants.filter(p => p.companyId === company.companyId) }];
  };

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const toggle = (k: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  };
  const toggleExpand = (k: string) => {
    setExpanded(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  };

  async function handleSend() {
    if (selected.size === 0 || sending) return;
    setSending(true);
    let sent = 0; const errs: string[] = [];
    const sentKeysByNl = new Map<number, string[]>(); // 성공한 (회차·유형) 키
    try {
      for (const nl of companyNLs) {
        const rounds = nl.generatedContent!.rounds;
        for (let i = 0; i < rounds.length; i++) {
          const round = rounds[i];
          for (const g of sendGroupsForRound(nl, i)) {
            const k = `${nl.id}-${i + 1}-${g.key}`;
            if (!selected.has(k)) continue;
            const recipients = g.recipients.map(p => ({ email: p.email, name: p.name, token: participantToken(p) }));
            if (recipients.length === 0) continue;
            try {
              const res = await fetch('/api/newsletter/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipients, round: { vol: round.vol, dateLabel: round.dateLabel, generated: round.generated }, companyName: company.companyName }),
              });
              if (res.ok) {
                const d = await res.json(); sent += d.sent ?? recipients.length;
                // 발송 성공 → 이 그룹 수신인의 리더십 유형을 회차 단위로 발송완료 기록
                const arr = sentKeysByNl.get(nl.id) ?? [];
                for (const t of new Set(g.recipients.map(p => p.leadershipType))) arr.push(sentKey(i + 1, t));
                sentKeysByNl.set(nl.id, arr);
              }
              else { const e = await res.json().catch(() => ({})); errs.push(`${i + 1}회차 ${g.label}: ${e.error ?? '발송 실패'}`); }
            } catch { errs.push(`${i + 1}회차 ${g.label}: 네트워크 오류`); }
          }
        }
      }
      // 발송완료 상태 영속화
      await Promise.all([...sentKeysByNl].map(([nlId, keys]) => markGroupsSent(nlId, keys)));
      setResult({ ok: errs.length === 0, msg: errs.length ? `${sent}건 발송 · 일부 실패\n${errs.join('\n')}` : `${sent}건의 이메일을 발송했습니다.` });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-800">{company.companyName} 뉴스레터 발송</h3>
            <p className="text-xs text-gray-400 mt-0.5">회차·리더십 유형 그룹별로 선택해 해당 직책자에게 발송합니다</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {companyNLs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">발송 가능한 제작완료 뉴스레터가 없습니다.</p>
          )}
          {companyNLs.map(nl => (
            <div key={nl.id} className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50/70">
                <span className="text-xs font-bold text-gray-700">{nl.title}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {nl.generatedContent!.rounds.map((r, i) => {
                  const groups = sendGroupsForRound(nl, i);
                  return (
                    <div key={`${nl.id}-r${i + 1}`} className="px-4 py-3">
                      <div className="mb-2">
                        <span className="text-xs font-bold text-gray-600">Vol.{r.vol} · {i + 1}회차</span>
                      </div>
                      <div className="space-y-1.5 pl-1">
                        {groups.map(g => {
                          const k = `${nl.id}-${i + 1}-${g.key}`;
                          const disabled = g.recipients.length === 0;
                          const isOpen = expanded.has(k);
                          const groupTypes = [...new Set(g.recipients.map(p => p.leadershipType))];
                          const isSent = isSendGroupSent(nl.sentGroups, i + 1, groupTypes);
                          return (
                            <div key={k} className={`rounded-lg border ${disabled ? 'opacity-50 border-gray-100' : 'border-gray-200'}`}>
                              <div className={`flex items-center gap-2.5 px-3 py-2 ${isOpen ? 'border-b border-gray-100' : ''}`}>
                                <label className={`flex items-center gap-2.5 flex-1 min-w-0 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                  <input type="checkbox" disabled={disabled} checked={selected.has(k)} onChange={() => toggle(k)} className="w-4 h-4 rounded border-gray-300 text-[#55A4DA] focus:ring-[#55A4DA]/30" />
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#EAF4FC] text-[#2E7DB5] flex-shrink-0">{g.label}</span>
                                  <span className={`text-xs flex-1 min-w-0 truncate ${g.topic ? 'text-gray-600' : 'text-gray-300 italic'}`}>{g.topic || '주제 미선정'}</span>
                                </label>
                                {isSent && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 flex-shrink-0">발송완료</span>
                                )}
                                <span className={`text-[11px] flex-shrink-0 ${disabled ? 'text-red-400' : 'text-gray-400'}`}>수신 {g.recipients.length}명</span>
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(k)}
                                  disabled={disabled}
                                  className="flex items-center gap-0.5 text-[11px] font-medium text-[#2E7DB5] hover:text-[#1E5A85] disabled:text-gray-300 flex-shrink-0"
                                >
                                  명단
                                  <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                              </div>
                              {isOpen && (
                                <div className="px-3 py-2 bg-gray-50/50">
                                  {g.recipients.length === 0 ? (
                                    <p className="text-[11px] text-gray-400 py-1">매칭된 수신인이 없습니다.</p>
                                  ) : (
                                    <ul className="divide-y divide-gray-100">
                                      {g.recipients.map(p => (
                                        <li key={p.id} className="flex items-center gap-2 py-1.5 text-[11px]">
                                          <span className="font-semibold text-gray-700 flex-shrink-0">{p.name}</span>
                                          <span className="text-gray-400 flex-shrink-0">{[p.department, p.position].filter(Boolean).join(' · ')}</span>
                                          <span className="text-gray-400 flex-1 min-w-0 truncate">{p.email}</span>
                                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EAF4FC] text-[#2E7DB5] flex-shrink-0">{p.leadershipType}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 flex-shrink-0">
          {result && (
            <p className={`text-sm whitespace-pre-line flex-1 min-w-0 ${result.ok ? 'text-emerald-600' : 'text-amber-600'}`}>{result.msg}</p>
          )}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-lg transition-colors">닫기</button>
            <button
              onClick={handleSend}
              disabled={selected.size === 0 || sending}
              className="px-5 py-2 text-sm font-semibold text-white bg-[#55A4DA] hover:bg-[#3A8BC4] rounded-lg transition-colors disabled:bg-gray-200 disabled:text-gray-400"
            >
              {sending ? '발송 중...' : `발송 (${selected.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 4단계: 회차 행 ───────────────────────────────────────────────────
function RoundRow({ round, companyName, polarity, typeName, count, isCompleteTab, isSelected, onSelect, onPreview }: {
  round: RoundData; companyName: string; polarity: Polarity; typeName: string; count: number;
  isCompleteTab: boolean; isSelected: boolean;
  onSelect: (selectionId: string, checked: boolean) => void;
  onPreview: (t: PreviewTarget) => void;
}) {
  const isDone = round.status === 'completed';
  return (
    <div className={`flex items-center gap-3 ${isCompleteTab ? 'pl-16' : 'pl-24'} pr-5 py-2.5 border-b border-gray-100 last:border-b-0 bg-white hover:bg-gray-50/50 transition-colors`}>
      {isCompleteTab && (
        <input
          type="checkbox"
          className="w-3.5 h-3.5 accent-[#55A4DA] cursor-pointer flex-shrink-0"
          checked={isSelected}
          onChange={e => onSelect(`${typeName}-${round.round}`, e.target.checked)}
        />
      )}
      <span className="text-xs font-semibold text-gray-400 w-10 flex-shrink-0">{round.round}회차</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium flex-shrink-0 w-9 text-center">{round.stage}</span>
      <span className={`flex-1 text-sm min-w-0 truncate ${round.topic ? 'text-gray-700' : 'text-gray-300 italic'}`}>
        {round.topic ?? '주제 미선정'}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-20 bg-gray-100 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full ${isDone ? 'bg-emerald-400' : 'bg-[#55A4DA]'}`} style={{ width: `${round.progressPct}%` }} />
        </div>
        <span className="text-[11px] text-gray-400 w-8 text-right">{round.progressPct}%</span>
      </div>
      <div className="flex-shrink-0 w-[72px] text-right">
        {isDone ? (
          <button onClick={() => onPreview({ companyName, polarity, typeName, count, round })}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors whitespace-nowrap">
            미리보기
          </button>
        ) : (
          <Link href="/admin/newsletters/new/configure"
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#55A4DA]/10 text-[#55A4DA] hover:bg-[#55A4DA]/20 transition-colors whitespace-nowrap">
            이어하기
          </Link>
        )}
      </div>
    </div>
  );
}

// ── 3단계: 리더십 유형 행 ────────────────────────────────────────────
function TypeRow({ typeData, visibleRounds, companyId, companyName, polarity, openKeys, onToggle, isCompleteTab, selectedIds, onSelectRound, onPreview, selectedNewsletterIds, onToggleNewsletters }: {
  typeData: TypeData; visibleRounds: RoundData[]; companyId: number; companyName: string; polarity: Polarity;
  openKeys: Set<string>; onToggle: (k: string) => void; isCompleteTab: boolean;
  selectedIds: Set<string>; onSelectRound: (selectionId: string, checked: boolean) => void;
  onPreview: (t: PreviewTarget) => void;
  selectedNewsletterIds: Set<number>; onToggleNewsletters: (ids: number[]) => void;
}) {
  const key = `c${companyId}-${polarity}-${typeData.typeName}`;
  const isOpen = openKeys.has(key);
  const nlId = typeData.newsletterId;
  return (
    <div>
      <button onClick={() => onToggle(key)}
        className="w-full flex items-center gap-3 pl-16 pr-5 py-2.5 bg-white border-b border-gray-100 hover:bg-gray-50/60 transition-colors text-left">
        {nlId !== undefined && (
          <input
            type="checkbox"
            checked={selectedNewsletterIds.has(nlId)}
            onClick={e => e.stopPropagation()}
            onChange={e => { e.stopPropagation(); onToggleNewsletters([nlId]); }}
            className="w-3.5 h-3.5 rounded border-gray-300 accent-[#55A4DA] cursor-pointer flex-shrink-0"
          />
        )}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${leadershipColor[typeData.typeName] ?? 'bg-gray-100 text-gray-500'}`}>
          {typeData.typeName}
        </span>
        <span className="text-sm text-gray-600 font-medium flex-1">{typeData.count}명</span>
        <span className="text-xs text-gray-400">{visibleRounds.length}회차</span>
        <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && visibleRounds.map(round => (
        <RoundRow key={round.id} round={round} companyName={companyName} polarity={polarity}
          typeName={typeData.typeName} count={typeData.count} isCompleteTab={isCompleteTab}
          isSelected={selectedIds.has(`${typeData.typeName}-${round.round}`)} onSelect={onSelectRound}
          onPreview={onPreview} />
      ))}
    </div>
  );
}

// ── 2단계: 긍정/부정 행 ──────────────────────────────────────────────
function PolarityRow({ group, companyId, companyName, openKeys, onToggle, isCompleteTab, selectedIds, onSelectRound, onPreview, activeTab, selectedNewsletterIds, onToggleNewsletters, newsletters }: {
  group: PolarityGroup; companyId: number; companyName: string;
  openKeys: Set<string>; onToggle: (k: string) => void; isCompleteTab: boolean;
  selectedIds: Set<string>; onSelectRound: (selectionId: string, checked: boolean) => void;
  onPreview: (t: PreviewTarget) => void; activeTab: TabType;
  selectedNewsletterIds: Set<number>; onToggleNewsletters: (ids: number[]) => void;
  newsletters: Newsletter[];
}) {
  const key = `c${companyId}-${group.polarity}`;
  const isOpen = openKeys.has(key);
  const isPositive = group.polarity === 'positive';

  const visibleTypes = useMemo(() =>
    group.types
      .map(t => ({ ...t, visibleRounds: filterRounds(t.rounds, activeTab) }))
      .filter(t => t.visibleRounds.length > 0),
    [group.types, activeTab]
  );

  if (visibleTypes.length === 0) return null;

  const totalVisible = visibleTypes.reduce((s, t) => s + t.visibleRounds.length, 0);

  return (
    <div>
      <button onClick={() => onToggle(key)}
        className={`w-full flex items-center gap-3 pl-8 pr-5 py-2.5 border-b border-gray-100 transition-colors text-left ${isPositive ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'bg-gray-50 hover:bg-gray-100/70'}`}>
        {group.newsletterIds.length > 0 && (
          <input
            type="checkbox"
            checked={group.newsletterIds.every(id => selectedNewsletterIds.has(id))}
            onClick={e => e.stopPropagation()}
            onChange={e => { e.stopPropagation(); onToggleNewsletters(group.newsletterIds); }}
            className="w-3.5 h-3.5 rounded border-gray-300 accent-[#55A4DA] cursor-pointer flex-shrink-0"
          />
        )}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isPositive ? 'bg-blue-400' : 'bg-[#55A4DA]'}`} />
        <span className={`text-sm font-semibold flex-1 ${isPositive ? 'text-blue-700' : 'text-gray-700'}`}>
          {isPositive ? '긍정적 리더' : '대상 리더'}
        </span>
        <span className="text-xs text-gray-500">{group.totalCount}명</span>
        <span className="text-xs text-gray-400 ml-1">{totalVisible}회차</span>
        <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (isPositive ? (() => {
        // 긍정 리더: 세부 유형(코칭형/민주형 등) 없이 회차 번호 기준 통합 표시
        const seen = new Set<number>();
        const mergedRounds: RoundData[] = [];
        visibleTypes.forEach(t => t.visibleRounds.forEach(r => {
          if (!seen.has(r.round)) { seen.add(r.round); mergedRounds.push(r); }
        }));
        mergedRounds.sort((a, b) => a.round - b.round);
        const positiveNL = newsletters.find(n => n.companyId === companyId && n.leaderType === 'positive');
        return mergedRounds.map(round => (
          <RoundRow key={round.id} round={round} companyName={companyName} polarity={group.polarity}
            typeName="긍정 리더" count={group.totalCount} isCompleteTab={isCompleteTab}
            isSelected={selectedIds.has(`긍정 리더-${round.round}`)} onSelect={onSelectRound}
            onPreview={onPreview} />
        ));
      })() : visibleTypes.map(t => (
          <TypeRow key={t.typeName} typeData={t} visibleRounds={t.visibleRounds}
            companyId={companyId} companyName={companyName} polarity={group.polarity}
            openKeys={openKeys} onToggle={onToggle} isCompleteTab={isCompleteTab}
            selectedIds={selectedIds} onSelectRound={onSelectRound}
            onPreview={onPreview}
            selectedNewsletterIds={selectedNewsletterIds} onToggleNewsletters={onToggleNewsletters} />
      )))}
    </div>
  );
}

// ── 회차 우선 뷰: 회차 → 발송 그룹 ──────────────────────────────────
function RoundFirstView({ company, newsletters, openKeys, onToggle, isCompleteTab, selectedIds, onSelectRoundBulk, onPreview, activeTab, onResumeRound, onEditRound, onEditRoundGroups }: {
  company: CompanyData; newsletters: Newsletter[];
  openKeys: Set<string>; onToggle: (k: string) => void; isCompleteTab: boolean;
  selectedIds: Set<string>;
  onSelectRoundBulk: (selectionIds: string[], checked: boolean) => void;
  onPreview: (t: PreviewTarget) => void; activeTab: TabType;
  onResumeRound: (nl: Newsletter, roundIdx: number, groupId?: string | null) => void;
  onEditRound: (nl: Newsletter, roundIdx: number, groupId?: string | null) => void;
  onEditRoundGroups: (nl: Newsletter, roundIdx: number) => void;
}) {
  const types = useMemo(() => {
    const all = company.groups.flatMap(g => g.types)
      .map(t => ({ ...t, visibleRounds: filterRounds(t.rounds, activeTab) }))
      .filter(t => t.visibleRounds.length > 0);
    // 실제 유형이 있으면 합성 '전체 대상'(기업 전체 중복 행)은 제외 — 인원 중복 방지
    const hasReal = all.some(t => t.typeName !== '전체 대상');
    return hasReal ? all.filter(t => t.typeName !== '전체 대상') : all;
  }, [company.groups, activeTab]);
  if (types.length === 0) return null;

  const roundNums = Array.from(new Set(types.flatMap(t => t.visibleRounds.map(r => r.round)))).sort((a, b) => a - b);

  // 같은 뉴스레터(=동일 발송 본문)를 받는 유형끼리 묶는다. authoring이 있으면 그 안에서 발송 그룹으로 세분화.
  // 제작 여부(made)·주제는 그룹 단위로 판정 — generatedContent.rounds[].groups[]에 실제 생성된 그룹만 담기므로,
  // 같은 뉴스레터의 다른 그룹이 만들어졌다고 해서 안 만든 그룹까지 '제작완료'로 뜨지 않도록 한다.
  function sendGroupsFor(typesInRound: typeof types, rn: number, fallbackTopic: string | null) {
    const byNl = new Map<number | undefined, typeof types>();
    for (const t of typesInRound) {
      const arr = byNl.get(t.newsletterId) ?? [];
      arr.push(t);
      byNl.set(t.newsletterId, arr);
    }
    const result: { label: string; members: typeof types; topic: string | null; groupId: string | null; made: boolean }[] = [];
    for (const [nlId, members] of byNl) {
      const nl = newsletters.find(n => n.id === nlId);
      const savedRound = nl?.generatedContent?.rounds?.find(r => r.vol === rn);
      const savedGroups = savedRound?.groups ?? null;
      const roundHeadline = savedRound?.generated?.headline?.trim() || null;
      // 특정 타깃(그룹 id 또는 'general')이 실제로 생성됐는지 + 그 생성 본문의 헤드라인.
      // generatedContent에 그룹 정보(groups)가 있으면 그룹 단위로, 없으면(레거시) 회차 헤드라인 유무로 판정.
      const madeInfo = (targetId: string | null, targetTypes: string[]): { made: boolean; headline: string | null } => {
        if (savedGroups && savedGroups.length > 0) {
          const sg = (targetId ? savedGroups.find(g => g.groupId === targetId) : undefined)
            ?? (targetId === null ? savedGroups.find(g => g.groupId === 'general') : undefined)
            ?? (targetTypes.length ? savedGroups.find(g => g.groupId !== 'general' && g.types.length > 0 && g.types.join('·') === targetTypes.join('·')) : undefined);
          return { made: !!sg?.generated?.headline?.trim(), headline: sg?.generated?.headline?.trim() || null };
        }
        return { made: !!roundHeadline, headline: roundHeadline };
      };
      const cgs = nl?.authoring?.rounds?.[rn - 1]?.customGroups;
      if (cgs && cgs.length > 0) {
        const used = new Set<string>();
        for (const cg of cgs) {
          const mem = members.filter(t => cg.types.includes(t.typeName));
          if (mem.length === 0) continue;
          mem.forEach(m => used.add(m.typeName));
          const { made, headline } = madeInfo(cg.id, cg.types);
          // 주제: authoring 주제 우선, 없으면 생성 헤드라인(제작된 경우). 안 만든 그룹은 회차 헤드라인으로 폴백하지 않음.
          const topic = cg.topic?.trim() || (made ? headline : null);
          result.push({ label: mem.map(m => m.typeName).join(' / '), members: mem, topic, groupId: cg.id, made });
        }
        const rest = members.filter(t => !used.has(t.typeName));
        if (rest.length) {
          const { made, headline } = madeInfo(null, rest.map(m => m.typeName));
          result.push({ label: rest.map(m => m.typeName).join(' / '), members: rest, topic: made ? (headline ?? fallbackTopic) : null, groupId: null, made });
        }
      } else {
        // authoring 없음 → 같은 뉴스레터를 받는 유형은 한 그룹으로 (회차 공통 주제)
        const { made, headline } = madeInfo(null, members.map(m => m.typeName));
        result.push({ label: members.map(m => m.typeName).join(' / '), members, topic: made ? (headline ?? fallbackTopic) : fallbackTopic, groupId: null, made });
      }
    }
    return result;
  }

  return (
    <div>
      {roundNums.map(rn => {
        const typesInRound = types.filter(t => t.visibleRounds.some(r => r.round === rn));
        const rep = typesInRound.map(t => t.visibleRounds.find(r => r.round === rn)).find(Boolean);
        if (!rep) return null;
        const totalCount = typesInRound.reduce((s, t) => s + t.count, 0);
        const roundKey = `c${company.companyId}-r${rn}`;
        const open = openKeys.has(roundKey);
        // 회차 내 모든 유형(발송 그룹)이 완료돼야 헤더를 '제작완료'로 표시 — 하나라도 미완이면 '제작 중'
        const roundInstances = typesInRound.map(t => t.visibleRounds.find(r => r.round === rn)).filter((r): r is RoundData => !!r);
        const allDone = roundInstances.length > 0 && roundInstances.every(r => r.status === 'completed');
        const groups = sendGroupsFor(typesInRound, rn, rep.topic);
        // 회차 발송일 — 여러 유형이 같은 회차를 나눠 받아도 회차 단위로 한 번만 표시
        const dateLabel = findRoundDateLabel(
          newsletters.filter(n => n.companyId === company.companyId), rn
        );
        // 회차 내 모든 발송 그룹이 실제로 발송완료됐는지 (발송일 옆에 뱃지로 병기)
        const allSent = groups.length > 0 && groups.every(grp => {
          const nl = newsletters.find(n => n.id === grp.members[0]?.newsletterId);
          return !!nl && isSendGroupSent(nl.sentGroups, rn, grp.members.map(m => m.typeName));
        });
        return (
          <div key={rn}>
            {/* 회차 헤더 */}
            <button onClick={() => onToggle(roundKey)}
              className="w-full flex items-center gap-3 pl-8 pr-5 py-2.5 bg-gray-50 hover:bg-gray-100/70 border-b border-gray-100 transition-colors text-left">
              <span className="text-xs font-bold text-gray-700 w-11 flex-shrink-0">{rn}회차</span>
              <span className={`text-[11px] flex-shrink-0 ${dateLabel ? 'text-gray-400' : 'text-gray-300 italic'}`}>{dateLabel ? toShortDateLabel(dateLabel) : '발송일 미정'}</span>
              {allSent && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 flex-shrink-0">발송완료</span>
              )}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium flex-shrink-0 w-9 text-center">{rep.stage}</span>
              <span className="flex-1" />
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${allDone ? 'bg-emerald-50 text-emerald-600' : 'bg-[#55A4DA]/10 text-[#55A4DA]'}`}>{allDone ? '제작완료' : '제작 중'}</span>
              <span className="text-xs text-gray-400">{totalCount}명</span>
              <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {/* 발송 그룹 행 */}
            {open && groups.map(grp => {
              const ids = grp.members.map(t => `${t.typeName}-${rn}`);
              const allSel = ids.length > 0 && ids.every(id => selectedIds.has(id));
              const nl = newsletters.find(n => n.id === grp.members[0]?.newsletterId);
              const count = grp.members.reduce((s, t) => s + t.count, 0);
              // 제작 완료 여부는 그룹 단위로 — 같은 뉴스레터의 다른 그룹 제작으로 이 그룹까지 완료 처리되지 않도록
              const grpDone = grp.made;
              const isSent = !!nl && isSendGroupSent(nl.sentGroups, rn, grp.members.map(m => m.typeName));
              return (
                <div key={grp.label} className={`flex items-center gap-3 ${isCompleteTab ? 'pl-14' : 'pl-16'} pr-5 py-2.5 bg-white border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors`}>
                  {isCompleteTab && grpDone && (
                    <input type="checkbox" className="w-3.5 h-3.5 accent-[#55A4DA] cursor-pointer flex-shrink-0"
                      checked={allSel} onChange={e => onSelectRoundBulk(ids, e.target.checked)} />
                  )}
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#EAF4FC] text-[#2E7DB5] flex-shrink-0">{grp.label}</span>
                  <span className={`flex-1 text-sm min-w-0 truncate ${grp.topic ? 'text-gray-600' : 'text-gray-300 italic'}`}>{grp.topic ?? '주제 미선정'}</span>
                  {isSent && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 flex-shrink-0">발송완료</span>
                  )}
                  <span className="text-xs text-gray-400 flex-shrink-0">{count}명</span>
                  <div className="flex-shrink-0 flex items-center gap-1.5">
                    {grpDone ? (
                      <>
                        <button
                          onClick={() => { if (nl && !isSent) onEditRound(nl, rn - 1, grp.groupId); }}
                          disabled={!nl || isSent}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                          title={isSent ? '발송 완료된 그룹은 수정할 수 없습니다.' : '수정하기 · 콘텐츠 구성(5단계)'}
                        >
                          {isSent && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          )}
                          수정하기
                        </button>
                        <button onClick={() => onPreview({ companyName: company.companyName, polarity: 'negative', typeName: grp.label, count, round: rep })}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-[#55A4DA] bg-[#55A4DA] text-white hover:bg-[#3A8BC4] transition-colors whitespace-nowrap">미리보기</button>
                      </>
                    ) : (
                      <button
                        onClick={() => { if (nl) onResumeRound(nl, rn - 1, grp.groupId); }}
                        disabled={!nl}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors whitespace-nowrap disabled:opacity-50"
                      >이어만들기</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── 1단계: 기업 행 ───────────────────────────────────────────────────
function CompanyRow({ company, openKeys, onToggle, isCompleteTab, onPreview, activeTab, selectedIds, onSelectRound, onSelectRoundBulk, onDelete, onSend, selectedNewsletterIds, onToggleNewsletters, newsletters, onContinue, onEdit, onResumeRound, onEditTypes, onEditRoundGroups, onEditRound }: {
  company: CompanyData; openKeys: Set<string>; onToggle: (k: string) => void;
  isCompleteTab: boolean; onPreview: (t: PreviewTarget) => void; activeTab: TabType;
  selectedIds: Set<string>; onSelectRound: (selectionId: string, checked: boolean) => void;
  onSelectRoundBulk: (selectionIds: string[], checked: boolean) => void;
  onDelete: (company: CompanyData) => void;
  onSend: (company: CompanyData) => void;
  selectedNewsletterIds: Set<number>; onToggleNewsletters: (ids: number[]) => void;
  newsletters: Newsletter[];
  onContinue: (nl: Newsletter) => void; onEdit: (nl: Newsletter) => void;
  onResumeRound: (nl: Newsletter, roundIdx: number, groupId?: string | null) => void;
  onEditTypes: (nl: Newsletter) => void;
  onEditRoundGroups: (nl: Newsletter, roundIdx: number) => void;
  onEditRound: (nl: Newsletter, roundIdx: number, groupId?: string | null) => void;
}) {
  // 이 기업의 캠페인(뉴스레터) — 이어서/수정 대상
  const companyNewsletters = newsletters.filter(n => n.companyId === company.companyId);
  const key = `c${company.companyId}`;
  const isOpen = openKeys.has(key);

  const hasVisible = useMemo(() =>
    company.groups.some(g => g.types.some(t => filterRounds(t.rounds, activeTab).length > 0)),
    [company.groups, activeTab]
  );

  const allRounds = useMemo(() => company.groups.flatMap(g => g.types.flatMap(t => t.rounds)), [company.groups]);
  // 여러 유형이 같은 회차를 공유하므로 회차 번호 기준으로 중복 제거해 실제 회차 수/완료 수 계산
  const distinctRounds = useMemo(() => {
    const map = new Map<number, RoundData>();
    allRounds.forEach(r => { if (!map.has(r.round) || r.status === 'completed') map.set(r.round, r); });
    return Array.from(map.values());
  }, [allRounds]);
  const completedCount = distinctRounds.filter(r => r.status === 'completed').length;
  const totalCount = distinctRounds.length;
  const progressPct = totalCount > 0 ? Math.round(completedCount / totalCount * 100) : 0;
  // 다음 발송 예정 회차(가장 빠른 미완료 회차)의 발송일
  const nextRound = [...distinctRounds].filter(r => r.status !== 'completed').sort((a, b) => a.round - b.round)[0];
  const nextDateLabel = nextRound ? findRoundDateLabel(companyNewsletters, nextRound.round) : null;

  if (!hasVisible) return null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3 shadow-sm">
      {/* 1단계 헤더 */}
      <button onClick={() => onToggle(key)}
        className="w-full flex items-center gap-4 px-5 py-4 bg-gray-50/80 hover:bg-gray-100/60 transition-colors text-left">
        <CompanyLogo name={company.companyName} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800">{company.companyName}</span>
            <span className="text-xs text-gray-400">리더 {company.totalLeaders}명</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400">{completedCount}/{totalCount}회차 완료</span>
            {nextRound && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-400">
                  다음 발송 {nextDateLabel ? toShortDateLabel(nextDateLabel) : '미정'}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-36 bg-gray-200 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-[#55A4DA]" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-[11px] text-gray-400">{progressPct}%</span>
          </div>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{formatRelativeTime(company.updatedAt)}</span>
        {completedCount > 0 && (
          <button
            onClick={e => { e.stopPropagation(); onSend(company); }}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-xs font-semibold transition-colors"
            title="발송"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
            발송
          </button>
        )}
        {companyNewsletters.length > 0 && (
          <button
            onClick={e => { e.stopPropagation(); onEditTypes(companyNewsletters[0]); }}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 text-xs font-semibold transition-colors"
            title="수정하기 · 스토리라인 설정(1단계)부터"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            수정하기
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onDelete(company); }}
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
          title="삭제"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* 회차 → 발송 그룹 드릴다운 */}
          <RoundFirstView company={company} newsletters={newsletters}
            openKeys={openKeys} onToggle={onToggle} isCompleteTab={isCompleteTab}
            selectedIds={selectedIds} onSelectRoundBulk={onSelectRoundBulk}
            onPreview={onPreview} activeTab={activeTab}
            onResumeRound={onResumeRound} onEditRound={onEditRound} onEditRoundGroups={onEditRoundGroups} />

        </>
      )}
    </div>
  );
}

// ── 메인 콘텐츠 ─────────────────────────────────────────────────────
function NewslettersContent() {
  const router = useRouter();
  const resetDraft = useNewNewsletterDraftStore(s => s.resetDraft);
  const setDraft = useNewNewsletterDraftStore(s => s.setDraft);
  const removeNewsletter = useNewsletterStore(s => s.removeNewsletter);
  const draftCompanyIds = useNewNewsletterDraftStore(s => s.companyIds);
  const draftWizardStep = useNewNewsletterDraftStore(s => s.wizardStep);
  const companies = useCompanyStore(s => s.companies);

  // 이어서/수정: 기존 캠페인의 제작 스냅샷으로 위저드를 미리 채워 진입
  async function seedFromNewsletter(nl: Newsletter, mode: 'continue' | 'edit', opts?: { targetRoundIdx?: number; targetStep?: WizardStep; targetGroupId?: string | null }) {
    const a = nl.authoring ?? null;
    const storyline = a?.storyline?.length ? a.storyline : DEFAULT_STORYLINE;
    const totalRounds = a?.totalRounds && a.totalRounds > 0 ? a.totalRounds : (nl.totalRounds || storyline.length);
    const roundDistribution = a?.roundDistribution ?? [];
    // authoring.rounds가 없거나(레거시) totalRounds와 개수가 안 맞으면 폴백으로 생성 — 콘텐츠 구성 화면 진입 차단 방지
    const baseRounds = (a?.rounds && a.rounds.length === totalRounds)
      ? a.rounds
      : makeFallbackRounds(totalRounds, storyline.length);
    const generatedRounds = nl.generatedContent?.rounds ?? [];
    // 완료(본문 생성)된 회차 인덱스 집합 — vol은 1-based
    const madeIdx = new Set(
      generatedRounds.filter(r => r.generated?.headline).map(r => r.vol - 1)
    );
    // 완료 회차의 비어 있는 구성(주제·콘텐츠·인터랙션·설문)은 저장 본문에서 복원 —
    // 수정/이어서 진입 직후 AI가 새로 자동 선택하지 않고 원래 쓰인 구성이 그대로 보이도록.
    // 콘텐츠 풀을 조회해 실물 아이템으로 복원 (조회 실패 시 저장 섹션 정보로 재구성).
    const pool = madeIdx.size > 0 ? await getContentList().catch(() => [] as ContentPoolItem[]) : [];
    const rounds = baseRounds.map((r, i) => {
      // 이어서: 미완성 회차는 주제·콘텐츠를 비워 새로 작성
      if (mode === 'continue' && !madeIdx.has(i)) return { ...r, topic: '', contents: [] };
      return restoreRoundFromSaved(r, generatedRounds.find(sr => sr.vol - 1 === i), pool);
    });
    // 이어서 진입 회차: 지정 회차 우선 → 저장된 마지막 회차 → 첫 미완성 회차(모두 완료면 0)
    const firstIncomplete = baseRounds.findIndex((_, i) => !madeIdx.has(i));
    const activeRoundIdx = opts?.targetRoundIdx
      ?? (mode === 'continue' && a?.lastActiveRoundIdx != null
        ? a.lastActiveRoundIdx
        : (firstIncomplete >= 0 ? firstIncomplete : 0));
    resetDraft();
    setDraft({
      companyIds: [nl.companyId],
      customStoryline: storyline,
      totalRounds,
      roundDistribution,
      rounds,
      // 이어서 만들기는 저장된 마지막 단계로 복원(없으면 5단계), 수정은 지정 단계(없으면 1단계)
      wizardStep: opts?.targetStep ?? (mode === 'continue' ? ((a?.lastWizardStep as WizardStep | undefined) ?? 5) : 1),
      editingNewsletterId: mode === 'edit' ? nl.id : null,
      // 완료 회차 본문을 항상 전달해 미리보기에서 보이도록 (continue/edit 공통)
      seededGeneratedContent: nl.generatedContent ?? null,
      seededActiveRoundIdx: activeRoundIdx,
      seededStartDate: a?.startDate ?? null,
      seededDeliveryInterval: a?.deliveryInterval ?? null,
      seededScheduleDateOverrides: a?.scheduleDateOverrides ?? null,
      // 5단계에서 클릭한 그룹 탭을 자동 선택 (없으면 일반형)
      seededPreviewTargetId: opts?.targetGroupId ?? null,
    });
    // 초안 복구 팝업 억제
    if (typeof window !== 'undefined') {
      localStorage.setItem('newsletter_draft_saved', JSON.stringify({ savedByUser: true }));
    }
    router.push('/admin/newsletters/new/configure');
  }
  // 탭 제거 — 목록은 '제작완료' 기준으로 통일
  const activeTab: TabType = '제작완료';
  const [showRecovery, setShowRecovery] = useState(false);
  const hasDraft = draftCompanyIds.length > 0 || draftWizardStep > 1;
  const draftCompanyNames = draftCompanyIds.map(id => companies.find(c => c.id === id)?.name ?? '').filter(Boolean);
  const draftStepLabel = (['', '스토리라인 구성 중', '회차 설계 중', '발송 주기 설정 중', '그룹 설정 중', '콘텐츠 구성 중'] as const)[draftWizardStep] ?? '작업 중';
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [selectedRoundsByCompany, setSelectedRoundsByCompany] = useState<Map<number, Set<string>>>(new Map());
  const [sendConfirmTarget, setSendConfirmTarget] = useState<SendConfirmTarget | null>(null);
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
  const newsletters = useNewsletterStore(s => s.newsletters);
  // DB에 중복 캠페인 행이 있어도 화면엔 1건만 — (companyId+title) 기준 본문 많은 최신 1건만 사용
  const newslettersDeduped = useMemo(() => {
    const score = (n: Newsletter) => (n.generatedContent?.rounds ?? []).filter(r => r?.generated?.headline).length;
    const byKey = new Map<string, Newsletter>();
    for (const n of newsletters) {
      const k = `${n.companyId}::${n.title}`;
      const prev = byKey.get(k);
      if (!prev || score(n) > score(prev) || (score(n) === score(prev) && n.updatedAt > prev.updatedAt)) byKey.set(k, n);
    }
    return [...byKey.values()];
  }, [newsletters]);
  const participants = useParticipantStore(s => s.participants);
  const [savedPreview, setSavedPreview] = useState<{ title: string; content: SavedNewsletterContent } | null>(null);

  // companyStore + participantStore + newsletterStore에서 CompanyData 동적 생성
  const allCompanies = useMemo<CompanyData[]>(() => {
    const result: CompanyData[] = [];

    for (const company of companies) {
      const companyPs = participants.filter(p => p.companyId === company.id);
      // 해당 기업의 뉴스레터 목록 (유형 매칭 또는 기업 전체 대상)
      const companyNLs = newslettersDeduped.filter(n => n.companyId === company.id);
      // 직책자도 없고 뉴스레터도 없으면 스킵 (뉴스레터가 있으면 표시)
      if (companyPs.length === 0 && companyNLs.length === 0) continue;

      function buildRoundsFromNL(nl: typeof companyNLs[number]): RoundData[] {
        return Array.from({ length: nl.totalRounds }, (_, i) => {
          // 실제 생성 본문(headline)이 있는 회차만 '제작완료'로 판정 — 아직 안 만든 회차는 미리보기 숨김
          const headline = nl.generatedContent?.rounds[i]?.generated?.headline ?? null;
          const isMade = !!headline;
          return {
            id: `nl-${nl.id}-r${i + 1}`,
            round: i + 1,
            stage: STAGES[i % STAGES.length],
            topic: headline,
            status: (isMade ? 'completed' : 'inProgress') as RoundStatus,
            progressPct: isMade ? 100 : 0,
          };
        });
      }

      function buildTypes(ps: typeof companyPs): TypeData[] {
        const typeMap = new Map<string, number>();
        ps.forEach(p => typeMap.set(p.leadershipType, (typeMap.get(p.leadershipType) ?? 0) + 1));

        return Array.from(typeMap.entries()).map(([typeName, count]) => {
          // 1순위: 유형이 정확히 일치하는 뉴스레터
          // 2순위: 기업 전체 대상 뉴스레터 (leadershipType이 '미지정' 등)
          const nl = companyNLs.find(n => n.leadershipType === typeName)
            ?? companyNLs.find(n => !n.leadershipType || n.leadershipType === '미지정');

          const rounds = nl ? buildRoundsFromNL(nl) : [];
          return { typeName, count, rounds, newsletterId: nl?.id };
        });
      }

      // 긍정/부정 구분 없이 이 기업 직책자 전체를 하나의 그룹으로 (유형별 세부는 buildTypes가 처리)
      const groups: PolarityGroup[] = [];
      if (companyPs.length > 0) {
        groups.push({ polarity: 'negative', newsletterIds: companyNLs.map(n => n.id), totalCount: companyPs.length, types: buildTypes(companyPs) });
      }

      // 어느 유형에도 매칭되지 않은 뉴스레터를 그룹에 fallback으로 붙여 목록에서 누락되지 않게 한다.
      const attachedNLIds = new Set<number>();
      groups.forEach(g => g.types.forEach(t => { if (t.newsletterId != null) attachedNLIds.add(t.newsletterId); }));
      for (const nl of companyNLs) {
        if (attachedNLIds.has(nl.id)) continue;
        let grp = groups[0];
        if (!grp) {
          grp = { polarity: 'negative', newsletterIds: [], totalCount: companyPs.length, types: [] };
          groups.push(grp);
        }
        if (!grp.newsletterIds.includes(nl.id)) grp.newsletterIds.push(nl.id);
        const typeName = nl.leadershipType && nl.leadershipType !== '미지정' ? nl.leadershipType : '전체 대상';
        grp.types.push({ typeName, count: companyPs.length, rounds: buildRoundsFromNL(nl), newsletterId: nl.id });
        attachedNLIds.add(nl.id);
      }

      const latestNL = companyNLs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

      result.push({
        companyId: company.id,
        companyName: company.name,
        totalLeaders: companyPs.length,
        groups,
        updatedAt: latestNL?.updatedAt ?? company.startDate,
      });
    }

    return result;
  }, [companies, participants, newslettersDeduped]);

  // 미리보기: 제작완료 + 생성 본문이 저장된 뉴스레터면 콘텐츠 구성 단계와 동일한 미리보기 모달, 아니면 기존 요약 카드
  function handlePreview(target: PreviewTarget) {
    const nl = newsletters.find(n =>
      n.companyName === target.companyName && n.status === '제작완료' &&
      n.generatedContent && n.generatedContent.rounds.length > 0
    );
    if (nl?.generatedContent) setSavedPreview({ title: nl.title, content: nl.generatedContent });
    else setPreviewTarget(target);
  }

  function handleNewDraft() {
    localStorage.removeItem('newsletter_draft_saved');
    resetDraft();
    setShowRecovery(false);
    router.push('/admin/newsletters/new');
  }

  function handleContinueDraft() {
    setShowRecovery(false);
    router.push('/admin/newsletters/new/configure');
  }

  useEffect(() => {
    setSelectedRoundsByCompany(new Map());
    setSelectedNewsletterIds(new Set());
    setOpenKeys(new Set());
  }, [activeTab]);

  const isCompleteTab = activeTab === '제작완료';

  const filteredCompanies = useMemo(() => {
    let list = [...allCompanies].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (companyFilter) list = list.filter(c => c.companyName === companyFilter);
    if (search.trim()) list = list.filter(c => c.companyName.includes(search.trim()));
    return list;
  }, [allCompanies, companyFilter, search]);

  function toggleKey(k: string) {
    setOpenKeys(prev => { const next = new Set(prev); next.has(k) ? next.delete(k) : next.add(k); return next; });
  }

  function handleSelectRound(companyId: number, selectionId: string, checked: boolean) {
    setSelectedRoundsByCompany(prev => {
      const next = new Map(prev);
      const ids = new Set(next.get(companyId) ?? []);
      checked ? ids.add(selectionId) : ids.delete(selectionId);
      next.set(companyId, ids);
      return next;
    });
  }

  function handleSelectRoundBulk(companyId: number, selectionIds: string[], checked: boolean) {
    setSelectedRoundsByCompany(prev => {
      const next = new Map(prev);
      const ids = new Set(next.get(companyId) ?? []);
      selectionIds.forEach(id => checked ? ids.add(id) : ids.delete(id));
      next.set(companyId, ids);
      return next;
    });
  }

  const totalSelected = useMemo(() =>
    Array.from(selectedRoundsByCompany.values()).reduce((s, rounds) => s + rounds.size, 0),
    [selectedRoundsByCompany]
  );

  function handleGlobalSend() {
    const selections = filteredCompanies
      .map(c => {
        const ids = selectedRoundsByCompany.get(c.companyId);
        if (!ids || ids.size === 0) return null;

        // selection ID "독재형-1" → typeName="독재형", roundNum=1
        const typeMap = new Map<string, Set<number>>();
        for (const id of ids) {
          const lastDash = id.lastIndexOf('-');
          if (lastDash < 0) continue;
          const typeName = id.slice(0, lastDash);
          const roundNum = Number(id.slice(lastDash + 1));
          if (!Number.isFinite(roundNum)) continue;
          const set = typeMap.get(typeName) ?? new Set();
          set.add(roundNum);
          typeMap.set(typeName, set);
        }

        const typeRounds: TypeRoundSelection[] = Array.from(typeMap.entries())
          .map(([typeName, nums]) => ({ typeName, roundNums: [...nums].sort((a, b) => a - b) }));

        if (typeRounds.length === 0) return null;
        return { company: c, typeRounds };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    if (selections.length === 0) return;
    setSendConfirmTarget({ selections });
  }

  const [deleteTarget, setDeleteTarget] = useState<CompanyData | null>(null);
  const [sendModalCompany, setSendModalCompany] = useState<CompanyData | null>(null);
  const [selectedNewsletterIds, setSelectedNewsletterIds] = useState<Set<number>>(new Set());
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deleteSelectedConfirm, setDeleteSelectedConfirm] = useState(false);

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    newsletters.filter(n => n.companyId === deleteTarget.companyId).forEach(n => removeNewsletter(n.id));
    setDeleteTarget(null);
  }

  function handleDeleteAll() {
    filteredCompanies.forEach(c =>
      newsletters.filter(n => n.companyId === c.companyId).forEach(n => removeNewsletter(n.id))
    );
    setSelectedNewsletterIds(new Set());
    setDeleteAllConfirm(false);
  }

  function handleDeleteSelected() {
    selectedNewsletterIds.forEach(id => removeNewsletter(id));
    setSelectedNewsletterIds(new Set());
    setDeleteSelectedConfirm(false);
  }

  function toggleNewsletterSelect(ids: number[]) {
    setSelectedNewsletterIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }

  const allFilteredNlIds = useMemo(() =>
    filteredCompanies.flatMap(c => c.groups.flatMap(g => g.newsletterIds)),
    [filteredCompanies]
  );
  const allFilteredSelected = allFilteredNlIds.length > 0 &&
    allFilteredNlIds.every(id => selectedNewsletterIds.has(id));

  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  // 발송 결과 토스트 자동 닫기
  useEffect(() => {
    if (!sendResult) return;
    const timer = setTimeout(() => setSendResult(null), 5000);
    return () => clearTimeout(timer);
  }, [sendResult]);

  async function handleSendConfirm() {
    if (!sendConfirmTarget || isSending) return;
    setIsSending(true);
    setSendResult(null);

    let totalSent = 0;
    let hasError = false;
    const errorMessages: string[] = [];

    try {
      for (const { company, typeRounds } of sendConfirmTarget.selections) {
        for (const { typeName, roundNums } of typeRounds) {
          // 해당 유형의 직책자 목록 필터 (유형명 그대로 매칭)
          const typeParticipants = participants.filter(p =>
            p.companyId === company.companyId && p.leadershipType === typeName
          );
          if (typeParticipants.length === 0) continue;

          // 해당 유형의 뉴스레터 찾기 (생성 본문이 있는 제작완료 뉴스레터)
          const nl = newsletters.find(n => {
            if (n.companyId !== company.companyId || n.status !== '제작완료') return false;
            if (!n.generatedContent || n.generatedContent.rounds.length === 0) return false;
            return n.leadershipType === typeName;
          });
          if (!nl?.generatedContent) continue;

          // 선택된 회차별로 발송
          for (const roundNum of roundNums) {
            const savedRound = nl.generatedContent.rounds[roundNum - 1];
            if (!savedRound) continue;

            const recipients = typeParticipants.map(p => ({
              email: p.email,
              name: p.name,
              token: undefined as string | undefined,
            }));

            const res = await fetch('/api/newsletter/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipients,
                round: {
                  vol: savedRound.vol,
                  dateLabel: savedRound.dateLabel,
                  generated: savedRound.generated,
                },
                companyName: company.companyName,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              totalSent += data.sent ?? 0;
            } else {
              const err = await res.json().catch(() => ({ error: '발송 실패' }));
              const errMsg = err.error ?? '발송 실패';
              console.error(`[발송 실패] ${company.companyName} ${typeName} ${roundNum}회차:`, errMsg);
              errorMessages.push(`${company.companyName} ${typeName} ${roundNum}회차: ${errMsg}`);
              hasError = true;
            }
          }
        }
      }

      setSendResult({
        success: !hasError,
        message: hasError
          ? `일부 발송에 실패했습니다. (${totalSent}건 발송 완료)\n${errorMessages.join('\n')}`
          : `${totalSent}건의 이메일이 발송되었습니다.`,
      });
    } catch (err) {
      setSendResult({
        success: false,
        message: err instanceof Error ? err.message : '발송 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSending(false);
      setSelectedRoundsByCompany(new Map());
      setSendConfirmTarget(null);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 상단 토퍼 */}
      <div className="bg-white border-b border-gray-200 px-8 h-[65px] flex items-center flex-shrink-0">
        <div className="flex items-center gap-2 text-[17px] text-gray-900 font-semibold">
          <span className="font-bold">뉴스레터 제작</span>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 px-8 py-6 flex flex-col overflow-hidden bg-white">
        {/* 새로 만들기 */}
        <button
          onClick={() => {
            try {
              const saved = localStorage.getItem('newsletter_draft_saved');
              const savedByUser = saved ? (JSON.parse(saved) as { savedByUser?: boolean })?.savedByUser : false;
              if (hasDraft && !savedByUser) {
                setShowRecovery(true);
                return;
              }
            } catch {}
            localStorage.removeItem('newsletter_draft_saved');
            resetDraft();
            router.push('/admin/newsletters/new');
          }}
          className="w-full flex items-center gap-3 border-2 border-dashed border-[#55A4DA]/40 hover:border-[#55A4DA] bg-[#55A4DA]/5 hover:bg-[#55A4DA]/10 rounded-xl px-6 py-4 mb-5 transition-all group text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-[#55A4DA] group-hover:bg-[#3A8BC4] flex items-center justify-center flex-shrink-0 transition-colors shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[#2E7DB5] group-hover:text-[#1A6BA0] transition-colors">새로 만들기</p>
            <p className="text-xs text-gray-400 mt-0.5">새 뉴스레터를 제작합니다</p>
          </div>
        </button>

        {/* 검색 + 기업 필터 */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 w-52">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="기업명 검색" value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-full" />
          </div>
          <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 bg-gray-50 outline-none focus:border-[#55A4DA] transition-colors cursor-pointer">
            <option value="">전체 기업</option>
            {allCompanies.map(c => <option key={c.companyId} value={c.companyName}>{c.companyName}</option>)}
          </select>
        </div>

        {/* 선택 액션 바 */}
        {filteredCompanies.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={e => {
                  if (e.target.checked) setSelectedNewsletterIds(new Set(allFilteredNlIds));
                  else setSelectedNewsletterIds(new Set());
                }}
                className="w-4 h-4 rounded border-gray-300 accent-[#55A4DA] cursor-pointer"
              />
              <span className="text-xs text-gray-500">전체선택</span>
            </label>
            {selectedNewsletterIds.size > 0 && (
              <button
                onClick={() => setDeleteSelectedConfirm(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                선택 삭제 ({selectedNewsletterIds.size})
              </button>
            )}
            <button
              onClick={() => setDeleteAllConfirm(true)}
              className="ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              전체삭제
            </button>
          </div>
        )}

        {/* 드릴다운 목록 */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredCompanies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <svg className="w-12 h-12 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium">뉴스레터가 없습니다.</p>
              <p className="text-xs text-gray-300 mt-1">새로 만들기를 눌러 뉴스레터를 제작해보세요.</p>
            </div>
          ) : (
            filteredCompanies.map(company => (
              <CompanyRow key={company.companyId} company={company} openKeys={openKeys}
                onToggle={toggleKey} isCompleteTab={isCompleteTab} onPreview={handlePreview}
                activeTab={activeTab}
                selectedIds={selectedRoundsByCompany.get(company.companyId) ?? new Set()}
                onSelectRound={(selectionId, checked) => handleSelectRound(company.companyId, selectionId, checked)}
                onSelectRoundBulk={(ids, checked) => handleSelectRoundBulk(company.companyId, ids, checked)}
                onDelete={setDeleteTarget}
                onSend={setSendModalCompany}
                selectedNewsletterIds={selectedNewsletterIds}
                onToggleNewsletters={toggleNewsletterSelect}
                newsletters={newslettersDeduped}
                onContinue={nl => seedFromNewsletter(nl, 'continue')}
                onResumeRound={(nl, roundIdx, groupId) => seedFromNewsletter(nl, 'continue', { targetRoundIdx: roundIdx, targetStep: 5, targetGroupId: groupId })}
                onEdit={nl => seedFromNewsletter(nl, 'edit', { targetStep: 5 })}
                onEditTypes={nl => seedFromNewsletter(nl, 'edit', { targetStep: 1 })}
                onEditRoundGroups={(nl, roundIdx) => seedFromNewsletter(nl, 'edit', { targetStep: 4, targetRoundIdx: roundIdx })}
                onEditRound={(nl, roundIdx, groupId) => seedFromNewsletter(nl, 'edit', { targetStep: 5, targetRoundIdx: roundIdx, targetGroupId: groupId })}
              />
            ))
          )}
        </div>
      </div>

      {/* 하단 고정 발송 바 */}
      {isCompleteTab && totalSelected > 0 && (
        <div className="flex-shrink-0 border-t border-gray-200 px-8 py-3 bg-white flex items-center justify-between shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="w-2 h-2 rounded-full bg-[#55A4DA] flex-shrink-0" />
            <span className="font-semibold text-gray-800">{totalSelected}개</span> 선택됨
          </div>
          <button
            onClick={handleGlobalSend}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-[#55A4DA] hover:bg-[#3A8BC4] text-white shadow-sm transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            발송 ({totalSelected})
          </button>
        </div>
      )}

      {/* 개별 삭제 확인 */}
      {deleteTarget && (
        <DeleteConfirmModal
          title="뉴스레터를 삭제하시겠습니까?"
          description={<><span className="font-semibold text-gray-700">"{deleteTarget.companyName}"</span>의 뉴스레터가 모두 삭제됩니다.<br />삭제 후 복구할 수 없습니다.</>}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {/* 선택 삭제 확인 */}
      {deleteSelectedConfirm && (
        <DeleteConfirmModal
          title="선택한 뉴스레터를 삭제하시겠습니까?"
          description={<><span className="font-semibold text-gray-700">{selectedNewsletterIds.size}개 뉴스레터</span>가 삭제됩니다.<br />삭제 후 복구할 수 없습니다.</>}
          onConfirm={handleDeleteSelected}
          onClose={() => setDeleteSelectedConfirm(false)}
        />
      )}
      {/* 전체삭제 확인 */}
      {deleteAllConfirm && (
        <DeleteConfirmModal
          title="전체 뉴스레터를 삭제하시겠습니까?"
          description={<><span className="font-semibold text-gray-700">{filteredCompanies.length}개 기업</span>의 뉴스레터가 모두 삭제됩니다.<br />삭제 후 복구할 수 없습니다.</>}
          onConfirm={handleDeleteAll}
          onClose={() => setDeleteAllConfirm(false)}
        />
      )}
      {previewTarget && <PreviewModal target={previewTarget} onClose={() => setPreviewTarget(null)} />}
      <SavedNewsletterPreviewModal
        open={!!savedPreview}
        onClose={() => setSavedPreview(null)}
        title={savedPreview?.title ?? ''}
        content={savedPreview?.content ?? null}
      />
      {sendConfirmTarget && (
        <SendConfirmModal target={sendConfirmTarget} onConfirm={handleSendConfirm}
          onClose={() => setSendConfirmTarget(null)} isSending={isSending} />
      )}
      {showRecovery && (
        <RecoveryModal companyNames={draftCompanyNames} stepLabel={draftStepLabel}
          onNew={handleNewDraft} onContinue={handleContinueDraft} onClose={() => setShowRecovery(false)} />
      )}
      {sendModalCompany && (
        <SendRoundModal company={sendModalCompany} newsletters={newsletters}
          participants={participants} onClose={() => setSendModalCompany(null)} />
      )}
      {/* 발송 결과 토스트 */}
      {sendResult && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 max-w-lg w-full px-4">
          <div className={`flex items-start gap-2.5 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
            sendResult.success ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {sendResult.success ? (
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="whitespace-pre-line">{sendResult.message}</span>
            <button onClick={() => setSendResult(null)} className="ml-2 text-white/70 hover:text-white">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewslettersPage() {
  return (
    <Suspense fallback={null}>
      <NewslettersContent />
    </Suspense>
  );
}
