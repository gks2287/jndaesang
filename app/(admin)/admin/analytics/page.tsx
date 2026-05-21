'use client';

import { useState, useMemo } from 'react';

// ── 임시 마스터 데이터 (API 연동 시 교체) ─────────────────────────────────
const COMPANIES = [
  { id: 'all', name: '전체 기업' },
  { id: 'c1', name: '삼성전자' },
  { id: 'c2', name: 'LG화학' },
  { id: 'c3', name: '현대모비스' },
];

const LEADERSHIP_TYPES = [
  { id: 'all', name: '전체 유형' },
  { id: 'lt1', name: '독선형' },
  { id: 'lt2', name: '방임형' },
  { id: 'lt3', name: '감정기복형' },
  { id: 'lt4', name: '성과압박형' },
];

// ── 임시 지표 데이터 ──────────────────────────────────────────────────────
const MOCK_STATS: Record<string, Record<string, { sent: number; openRate: number; taskRate: number; activeCampaigns: number }>> = {
  all: {
    all:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt1:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt2:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt3:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt4:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
  },
  c1: {
    all:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt1:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt2:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt3:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt4:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
  },
  c2: {
    all:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt1:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt2:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt3:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt4:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
  },
  c3: {
    all:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt1:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt2:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt3:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
    lt4:  { sent: 0, openRate: 0, taskRate: 0, activeCampaigns: 0 },
  },
};

// ── 컴포넌트 ──────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [companyId, setCompanyId] = useState('all');
  const [leadershipTypeId, setLeadershipTypeId] = useState('all');

  const stats = useMemo(
    () => MOCK_STATS[companyId]?.[leadershipTypeId] ?? MOCK_STATS['all']['all'],
    [companyId, leadershipTypeId],
  );

  const selectedCompany = COMPANIES.find((c) => c.id === companyId);
  const selectedType = LEADERSHIP_TYPES.find((t) => t.id === leadershipTypeId);

  const summaryCards = [
    { label: '총 발송 수', value: stats.sent.toLocaleString(), sub: '누적' },
    { label: '열람률', value: `${stats.openRate}%`, sub: '최근 30일' },
    { label: '과제 완료율', value: `${stats.taskRate}%`, sub: '최근 30일' },
    { label: '활성 캠페인', value: stats.activeCampaigns.toString(), sub: '진행 중' },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[#F8FAFC]">
      {/* ── 헤더 + 필터 ── */}
      <div className="px-6 pt-6 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          {/* 타이틀 */}
          <div>
            <p className="text-[11px] tracking-[0.2em] text-gray-400 font-medium mb-0.5">ANALYTICS</p>
            <h1 className="text-xl font-bold text-gray-800">데이터 대시보드</h1>
          </div>

          {/* 필터 */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* 기업 필터 */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1">
                기업
              </label>
              <div className="relative">
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="appearance-none bg-[#F4F6FA] border border-gray-200 text-sm text-gray-700 font-medium rounded-xl px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-[#55A4DA]/40 cursor-pointer min-w-[140px]"
                >
                  {COMPANIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* 구분선 */}
            <div className="h-10 w-px bg-gray-200" />

            {/* 리더십 유형 필터 */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1">
                리더십 유형
              </label>
              <div className="relative">
                <select
                  value={leadershipTypeId}
                  onChange={(e) => setLeadershipTypeId(e.target.value)}
                  className="appearance-none bg-[#F4F6FA] border border-gray-200 text-sm text-gray-700 font-medium rounded-xl px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-[#55A4DA]/40 cursor-pointer min-w-[150px]"
                >
                  {LEADERSHIP_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* 초기화 버튼 */}
            {(companyId !== 'all' || leadershipTypeId !== 'all') && (
              <button
                onClick={() => { setCompanyId('all'); setLeadershipTypeId('all'); }}
                className="text-xs text-[#55A4DA] hover:text-[#3A8BC4] font-medium transition-colors"
              >
                초기화
              </button>
            )}
          </div>
        </div>

      </div>
      <div className="border-b border-gray-200 mx-6 mt-4" />

      {/* ── 대시보드 본문 ── */}
      {companyId === 'all' ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#55A4DA]/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-gray-700">기업을 선택해주세요</p>
            <p className="text-sm text-gray-400 mt-1">우측 상단 기업 필터에서 조회할 기업을 선택하면<br />대시보드가 표시됩니다.</p>
          </div>
        </div>
      ) : (
      <div className="p-8 space-y-6">
        {/* 요약 카드 */}
        <div className="grid grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-400 font-medium">{card.label}</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{card.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* 차트 영역 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">주간 열람 추이</h2>
            <p className="text-xs text-gray-400 mb-4">
              {selectedCompany?.name ?? '전체 기업'} · {selectedType?.name ?? '전체 유형'}
            </p>
            <div className="h-48 flex items-center justify-center text-sm text-gray-300">
              차트 준비 중
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">리더십 유형별 분포</h2>
            <p className="text-xs text-gray-400 mb-4">
              {selectedCompany?.name ?? '전체 기업'} 기준
            </p>
            <div className="h-48 flex items-center justify-center text-sm text-gray-300">
              차트 준비 중
            </div>
          </div>
        </div>

        {/* 고객사별 현황 테이블 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            {companyId === 'all' ? '고객사별 현황' : `${selectedCompany?.name} · 직책자 현황`}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {(companyId === 'all'
                    ? ['고객사', '직책자 수', '발송 수', '열람률', '과제 완료율']
                    : ['직책자', '리더십 유형', '발송 수', '열람률', '과제 완료율']
                  ).map((col) => (
                    <th key={col} className="text-left text-xs text-gray-400 font-medium pb-3 pr-6">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-300 text-sm">
                    데이터 없음
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
