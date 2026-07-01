'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useNewNewsletterDraftStore } from '@/store/newNewsletterDraftStore';
import { useCompanyStore } from '@/store/companyStore';
import { useNewsletterStore, type Newsletter } from '@/store/newsletterStore';
import CompanyLogo from '@/components/CompanyLogo';
import { useParticipantStore, POSITIVE_TYPES, NEGATIVE_TYPES } from '@/store/participantStore';
import { SavedNewsletterPreviewModal, type SavedNewsletterContent } from '@/components/newsletter/NewsletterRender';

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

function filterRounds(rounds: RoundData[], tab: TabType): RoundData[] {
  if (tab === '제작 중') return rounds.filter(r => r.status === 'inProgress');
  if (tab === '제작완료') return rounds.filter(r => r.status === 'completed');
  return rounds;
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

// ── 4단계: 회차 행 ───────────────────────────────────────────────────
function RoundRow({ round, companyName, polarity, typeName, count, isCompleteTab, isSelected, onSelect, onPreview, isSavedRound, onToggleSaveRound }: {
  round: RoundData; companyName: string; polarity: Polarity; typeName: string; count: number;
  isCompleteTab: boolean; isSelected: boolean;
  onSelect: (selectionId: string, checked: boolean) => void;
  onPreview: (t: PreviewTarget) => void;
  isSavedRound?: boolean;
  onToggleSaveRound?: (roundNum: number) => void;
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
      {isDone && onToggleSaveRound && (
        <button
          onClick={() => onToggleSaveRound(round.round)}
          className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors ${
            isSavedRound ? 'text-[#55A4DA]' : 'text-gray-300 hover:text-[#55A4DA]'
          }`}
          title={isSavedRound ? '저장소에서 제거' : '저장소에 저장'}
        >
          <svg className="w-3.5 h-3.5" fill={isSavedRound ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      )}
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
function TypeRow({ typeData, visibleRounds, companyId, companyName, polarity, openKeys, onToggle, isCompleteTab, selectedIds, onSelectRound, onPreview, selectedNewsletterIds, onToggleNewsletters, savedRounds, onToggleRoundSaved }: {
  typeData: TypeData; visibleRounds: RoundData[]; companyId: number; companyName: string; polarity: Polarity;
  openKeys: Set<string>; onToggle: (k: string) => void; isCompleteTab: boolean;
  selectedIds: Set<string>; onSelectRound: (selectionId: string, checked: boolean) => void;
  onPreview: (t: PreviewTarget) => void;
  selectedNewsletterIds: Set<number>; onToggleNewsletters: (ids: number[]) => void;
  savedRounds?: number[]; onToggleRoundSaved?: (roundNum: number) => void;
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
          onPreview={onPreview}
          isSavedRound={savedRounds?.includes(round.round)}
          onToggleSaveRound={onToggleRoundSaved} />
      ))}
    </div>
  );
}

// ── 2단계: 긍정/부정 행 ──────────────────────────────────────────────
function PolarityRow({ group, companyId, companyName, openKeys, onToggle, isCompleteTab, selectedIds, onSelectRound, onPreview, activeTab, selectedNewsletterIds, onToggleNewsletters, newsletters, onToggleRoundSaved }: {
  group: PolarityGroup; companyId: number; companyName: string;
  openKeys: Set<string>; onToggle: (k: string) => void; isCompleteTab: boolean;
  selectedIds: Set<string>; onSelectRound: (selectionId: string, checked: boolean) => void;
  onPreview: (t: PreviewTarget) => void; activeTab: TabType;
  selectedNewsletterIds: Set<number>; onToggleNewsletters: (ids: number[]) => void;
  newsletters: Newsletter[]; onToggleRoundSaved: (nlId: number, roundNum: number) => void;
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
        className={`w-full flex items-center gap-3 pl-8 pr-5 py-2.5 border-b border-gray-100 transition-colors text-left ${isPositive ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'bg-red-50/20 hover:bg-red-50/40'}`}>
        {group.newsletterIds.length > 0 && (
          <input
            type="checkbox"
            checked={group.newsletterIds.every(id => selectedNewsletterIds.has(id))}
            onClick={e => e.stopPropagation()}
            onChange={e => { e.stopPropagation(); onToggleNewsletters(group.newsletterIds); }}
            className="w-3.5 h-3.5 rounded border-gray-300 accent-[#55A4DA] cursor-pointer flex-shrink-0"
          />
        )}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isPositive ? 'bg-blue-400' : 'bg-red-400'}`} />
        <span className={`text-sm font-semibold flex-1 ${isPositive ? 'text-blue-700' : 'text-red-700'}`}>
          {isPositive ? '긍정적 리더' : '부정적 리더'}
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
            onPreview={onPreview}
            isSavedRound={positiveNL?.savedRounds?.includes(round.round)}
            onToggleSaveRound={positiveNL ? (rn) => onToggleRoundSaved(positiveNL.id, rn) : undefined} />
        ));
      })() : visibleTypes.map(t => {
        const nl = newsletters.find(n => n.companyId === companyId && n.leadershipType === t.typeName);
        return (
          <TypeRow key={t.typeName} typeData={t} visibleRounds={t.visibleRounds}
            companyId={companyId} companyName={companyName} polarity={group.polarity}
            openKeys={openKeys} onToggle={onToggle} isCompleteTab={isCompleteTab}
            selectedIds={selectedIds} onSelectRound={onSelectRound}
            onPreview={onPreview}
            selectedNewsletterIds={selectedNewsletterIds} onToggleNewsletters={onToggleNewsletters}
            savedRounds={nl?.savedRounds}
            onToggleRoundSaved={nl ? (rn) => onToggleRoundSaved(nl.id, rn) : undefined} />
        );
      }))}
    </div>
  );
}

// ── 1단계: 기업 행 ───────────────────────────────────────────────────
function CompanyRow({ company, openKeys, onToggle, isCompleteTab, onPreview, activeTab, selectedIds, onSelectRound, onSelectRoundBulk, onDelete, selectedNewsletterIds, onToggleNewsletters, newsletters, onToggleSaved }: {
  company: CompanyData; openKeys: Set<string>; onToggle: (k: string) => void;
  isCompleteTab: boolean; onPreview: (t: PreviewTarget) => void; activeTab: TabType;
  selectedIds: Set<string>; onSelectRound: (selectionId: string, checked: boolean) => void;
  onSelectRoundBulk: (selectionIds: string[], checked: boolean) => void;
  onDelete: (company: CompanyData) => void;
  selectedNewsletterIds: Set<number>; onToggleNewsletters: (ids: number[]) => void;
  newsletters: Newsletter[]; onToggleSaved: (id: number, roundNum: number) => void;
}) {
  const key = `c${company.companyId}`;
  const isOpen = openKeys.has(key);

  const hasVisible = useMemo(() =>
    company.groups.some(g => g.types.some(t => filterRounds(t.rounds, activeTab).length > 0)),
    [company.groups, activeTab]
  );

  const allRounds = useMemo(() => company.groups.flatMap(g => g.types.flatMap(t => t.rounds)), [company.groups]);
  const completedCount = allRounds.filter(r => r.status === 'completed').length;
  const totalCount = allRounds.length;
  const progressPct = totalCount > 0 ? Math.round(completedCount / totalCount * 100) : 0;

  const availableRoundNums = useMemo(() => {
    const nums = new Set<number>();
    allRounds.filter(r => r.status === 'completed').forEach(r => nums.add(r.round));
    return Array.from(nums).sort((a, b) => a - b);
  }, [allRounds]);


  // 회차번호 → 해당 회차의 모든 "유형명-회차번호" selectionId 목록
  const roundToSelectionIds = useMemo(() => {
    const map = new Map<number, string[]>();
    company.groups.forEach(g => {
      if (g.polarity === 'positive') {
        // 긍정 리더는 회차 번호 기준 통합 selectionId 사용 (TypeRow 없이 렌더)
        const seen = new Set<number>();
        g.types.forEach(t => t.rounds.filter(r => r.status === 'completed').forEach(r => {
          if (seen.has(r.round)) return;
          seen.add(r.round);
          const arr = map.get(r.round) ?? [];
          arr.push(`긍정 리더-${r.round}`);
          map.set(r.round, arr);
        }));
      } else {
        g.types.forEach(t => t.rounds.filter(r => r.status === 'completed').forEach(r => {
          const arr = map.get(r.round) ?? [];
          arr.push(`${t.typeName}-${r.round}`);
          map.set(r.round, arr);
        }));
      }
    });
    return map;
  }, [company.groups]);

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
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-36 bg-gray-200 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-[#55A4DA]" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-[11px] text-gray-400">{progressPct}%</span>
          </div>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{formatRelativeTime(company.updatedAt)}</span>
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
          {/* 2~4단계 드릴다운 */}
          <div>
            {company.groups.map(group => (
              <PolarityRow key={group.polarity} group={group} companyId={company.companyId}
                companyName={company.companyName} openKeys={openKeys} onToggle={onToggle}
                isCompleteTab={isCompleteTab} selectedIds={selectedIds}
                onSelectRound={onSelectRound} onPreview={onPreview} activeTab={activeTab}
                selectedNewsletterIds={selectedNewsletterIds} onToggleNewsletters={onToggleNewsletters}
                newsletters={newsletters} onToggleRoundSaved={onToggleSaved} />
            ))}
          </div>

          {/* 회차별 전체선택 */}
          {isCompleteTab && availableRoundNums.length > 0 && (
            <div className="border-t border-gray-100 px-5 py-2.5 bg-gray-50/40 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 font-medium flex-shrink-0">회차별 전체선택:</span>
              {availableRoundNums.map(num => {
                const ids = roundToSelectionIds.get(num) ?? [];
                const isActive = ids.length > 0 && ids.every(id => selectedIds.has(id));
                return (
                  <button key={num} onClick={() => onSelectRoundBulk(ids, !isActive)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                      isActive
                        ? 'bg-[#55A4DA] border-[#55A4DA] text-white'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-[#55A4DA] hover:text-[#55A4DA]'
                    }`}>
                    {num}회차
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── 메인 콘텐츠 ─────────────────────────────────────────────────────
function NewslettersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const resetDraft = useNewNewsletterDraftStore(s => s.resetDraft);
  const removeNewsletter = useNewsletterStore(s => s.removeNewsletter);
  const toggleRoundSaved = useNewsletterStore(s => s.toggleRoundSaved);
  const draftCompanyIds = useNewNewsletterDraftStore(s => s.companyIds);
  const draftWizardStep = useNewNewsletterDraftStore(s => s.wizardStep);
  const companies = useCompanyStore(s => s.companies);
  const [activeTab, setActiveTab] = useState<TabType>('최근');
  const [showRecovery, setShowRecovery] = useState(false);
  const hasDraft = draftCompanyIds.length > 0 || draftWizardStep > 1;
  const draftCompanyNames = draftCompanyIds.map(id => companies.find(c => c.id === id)?.name ?? '').filter(Boolean);
  const draftStepLabel = (['', '스토리라인 구성 중', '회차 설계 중', '유형 배분 중', '콘텐츠 구성 중', '발송 주기 설정 중'] as const)[draftWizardStep] ?? '작업 중';
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [selectedRoundsByCompany, setSelectedRoundsByCompany] = useState<Map<number, Set<string>>>(new Map());
  const [sendConfirmTarget, setSendConfirmTarget] = useState<SendConfirmTarget | null>(null);
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
  const newsletters = useNewsletterStore(s => s.newsletters);
  const participants = useParticipantStore(s => s.participants);
  const [savedPreview, setSavedPreview] = useState<{ title: string; content: SavedNewsletterContent } | null>(null);

  // companyStore + participantStore + newsletterStore에서 CompanyData 동적 생성
  const allCompanies = useMemo<CompanyData[]>(() => {
    const result: CompanyData[] = [];

    for (const company of companies) {
      const companyPs = participants.filter(p => p.companyId === company.id);
      if (companyPs.length === 0) continue;

      // 해당 기업의 뉴스레터 목록 (유형 매칭 또는 기업 전체 대상)
      const companyNLs = newsletters.filter(n => n.companyId === company.id);

      const positivePs = companyPs.filter(p => POSITIVE_TYPES.includes(p.leadershipType));
      const negativePs = companyPs.filter(p => NEGATIVE_TYPES.includes(p.leadershipType));

      function buildRoundsFromNL(nl: typeof companyNLs[number]): RoundData[] {
        return Array.from({ length: nl.totalRounds }, (_, i) => ({
          id: `nl-${nl.id}-r${i + 1}`,
          round: i + 1,
          stage: STAGES[i % STAGES.length],
          topic: nl.generatedContent?.rounds[i]?.generated?.headline ?? null,
          status: (i < nl.completedRounds ? 'completed' : 'inProgress') as RoundStatus,
          progressPct: i < nl.completedRounds ? 100 : 0,
        }));
      }

      function buildTypes(ps: typeof companyPs): TypeData[] {
        const typeMap = new Map<string, number>();
        ps.forEach(p => typeMap.set(p.leadershipType, (typeMap.get(p.leadershipType) ?? 0) + 1));

        return Array.from(typeMap.entries()).map(([typeName, count]) => {
          // 1순위: 유형이 정확히 일치하는 뉴스레터
          // 2순위: 기업 전체 대상 뉴스레터 (leadershipType이 '미지정' 등)
          const nl = companyNLs.find(n => n.leadershipType === typeName)
            ?? companyNLs.find(n =>
              !POSITIVE_TYPES.includes(n.leadershipType as typeof POSITIVE_TYPES[number])
              && !NEGATIVE_TYPES.includes(n.leadershipType as typeof NEGATIVE_TYPES[number])
            );

          const rounds = nl ? buildRoundsFromNL(nl) : [];
          return { typeName, count, rounds, newsletterId: nl?.id };
        });
      }

      const positiveNLIds = companyNLs.filter(n => n.leaderType === 'positive').map(n => n.id);
      const negativeNLIds = companyNLs.filter(n => n.leaderType === 'negative').map(n => n.id);

      const groups: PolarityGroup[] = [];
      if (positivePs.length > 0) {
        groups.push({ polarity: 'positive', newsletterIds: positiveNLIds, totalCount: positivePs.length, types: buildTypes(positivePs) });
      }
      if (negativePs.length > 0) {
        groups.push({ polarity: 'negative', newsletterIds: negativeNLIds, totalCount: negativePs.length, types: buildTypes(negativePs) });
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
  }, [companies, participants, newsletters]);

  // 미리보기: 제작완료 + 생성 본문이 저장된 뉴스레터면 콘텐츠 구성 단계와 동일한 미리보기 모달, 아니면 기존 요약 카드
  function handlePreview(target: PreviewTarget) {
    const nl = newsletters.find(n =>
      n.companyName === target.companyName && n.status === '제작완료' &&
      n.generatedContent && n.generatedContent.rounds.length > 0
    );
    if (nl?.generatedContent) setSavedPreview({ title: nl.title, content: nl.generatedContent });
    else setPreviewTarget(target);
  }

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === '제작 중' || tab === '제작완료') setActiveTab(tab as TabType);
  }, [searchParams]);

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

  const countByStatus = useMemo(() => {
    const all = allCompanies.flatMap(c => c.groups.flatMap(g => g.types.flatMap(t => t.rounds)));
    return { '제작 중': all.filter(r => r.status === 'inProgress').length, '제작완료': all.filter(r => r.status === 'completed').length };
  }, [allCompanies]);

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
          // 해당 유형의 직책자 목록 필터
          const isPositive = typeName === '긍정 리더';
          const typeParticipants = participants.filter(p => {
            if (p.companyId !== company.companyId) return false;
            if (isPositive) return POSITIVE_TYPES.includes(p.leadershipType);
            return p.leadershipType === typeName;
          });
          if (typeParticipants.length === 0) continue;

          // 해당 유형의 뉴스레터 찾기 (생성 본문이 있는 제작완료 뉴스레터)
          const nl = newsletters.find(n => {
            if (n.companyId !== company.companyId || n.status !== '제작완료') return false;
            if (!n.generatedContent || n.generatedContent.rounds.length === 0) return false;
            if (isPositive) return n.leaderType === 'positive';
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

        {/* 탭 */}
        <div className="flex gap-6 border-b border-gray-200 mb-4 pl-2">
          {(['최근', '제작 중', '제작완료'] as TabType[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab ? 'border-[#55A4DA] text-[#55A4DA]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {tab}
              {tab !== '최근' && <span className="ml-1.5 text-xs text-gray-400">{countByStatus[tab]}</span>}
            </button>
          ))}
        </div>

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
                selectedNewsletterIds={selectedNewsletterIds}
                onToggleNewsletters={toggleNewsletterSelect}
                newsletters={newsletters}
                onToggleSaved={toggleRoundSaved}
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
