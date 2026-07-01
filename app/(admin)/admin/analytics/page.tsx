'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCompanyStore } from '@/store/companyStore';
import { useParticipantStore, type LeadershipType } from '@/store/participantStore';
import { DonutChart } from '@/components/ui/donut-chart';
import CompanyLogo from '@/components/CompanyLogo';

const YEARS = ['2026', '2025', '2024'];

const LEADERSHIP_COLORS: Record<LeadershipType, string> = {
  '독재형':     '#2E7DB5',
  '방관형':     '#55A4DA',
  '성과압박형': '#7EC8E3',
  '불통형':     '#A8D8EA',
  '불명확형':   '#9B7BB8',
  '감정기복형': '#B8D4E8',
  '완벽주의형': '#4A90C4',
  '우유부단형': '#6EB5D8',
  '코칭형':     '#34C97A',
  '민주형':     '#50C4A0',
  '서번트형':   '#38B2AC',
  '비전형':     '#4299E1',
  '관계중심형': '#68D391',
};

const statusDot: Record<string, string> = {
  '진행 중':   'bg-brand',
  '진행 완료': 'bg-emerald-400',
  '진행 전':   'bg-gray-300',
};
const statusText: Record<string, string> = {
  '진행 중':   'text-brand-dark',
  '진행 완료': 'text-emerald-600',
  '진행 전':   'text-text-secondary',
};


const STATUS_TOGGLES = ['진행 전', '진행 중', '진행 완료'] as const;
type StatusToggle = typeof STATUS_TOGGLES[number];

export default function AnalyticsPage() {
  const [activeYear, setActiveYear] = useState('2026');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusToggle | null>(null);
  const companies = useCompanyStore(s => s.companies);
  const participants = useParticipantStore(s => s.participants);

  const filteredCompanies = useMemo(() =>
    companies.filter(c =>
      c.startDate?.startsWith(activeYear) || c.endDate?.startsWith(activeYear)
    ),
    [companies, activeYear],
  );

  const companyStats = useMemo(() =>
    filteredCompanies.map(company => {
      const members = participants.filter(p => p.companyId === company.id);
      const sent = members.filter(p => p.deliveryStatus !== '미발송').length;
      const opened = members.filter(p => p.deliveryStatus === '열람' || p.deliveryStatus === '완료').length;
      const completed = members.filter(p => p.deliveryStatus === '완료').length;
      const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
      const completionRate = members.length > 0 ? Math.round((completed / members.length) * 100) : 0;

      const leadershipDist = (Object.keys(LEADERSHIP_COLORS) as LeadershipType[]).map(type => ({
        type,
        count: members.filter(p => p.leadershipType === type).length,
      }));

      return { company, total: members.length, openRate, completionRate, leadershipDist };
    }),
    [filteredCompanies, participants],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 상단 토퍼 */}
      <div className="bg-surface border-b border-border-light px-8 h-[65px] flex items-center flex-shrink-0">
        <div className="flex items-center gap-2 text-[17px] text-text-primary font-bold">
          <span>데이터 대시보드</span>
        </div>
      </div>

      {/* 연도 탭 */}
      <div className="bg-surface border-b border-border-light px-8 flex-shrink-0">
        <div className="flex gap-6">
          {YEARS.map(year => (
            <button
              key={year}
              onClick={() => setActiveYear(year)}
              className={`pb-3 pt-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeYear === year
                  ? 'border-brand text-brand'
                  : 'border-transparent text-text-secondary hover:text-text-secondary'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* 검색 + 상태 필터 */}
      <div className="bg-surface border-b border-border-light px-8 py-3 flex items-center justify-end gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {STATUS_TOGGLES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(prev => prev === s ? null : s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                statusFilter === s
                  ? s === '진행 중'   ? 'bg-brand border-brand text-text-onBrand'
                  : s === '진행 완료' ? 'bg-emerald-500 border-emerald-500 text-white'
                                      : 'bg-gray-400 border-gray-400 text-white'
                  : 'bg-surface border-border-light text-text-secondary hover:border-gray-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                statusFilter === s ? 'bg-white/70'
                : s === '진행 중'   ? 'bg-brand'
                : s === '진행 완료' ? 'bg-emerald-400'
                                    : 'bg-gray-300'
              }`} />
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-surface-subtle border border-border-light rounded-lg px-3 py-1.5">
          <svg className="w-3.5 h-3.5 text-icon flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="기업명 검색"
            className="bg-transparent text-sm text-text-secondary placeholder-placeholder outline-none w-32"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-icon hover:text-text-secondary transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {(() => {
          const filtered = companyStats.filter(({ company }) => {
            const matchSearch = company.name.includes(searchQuery.trim());
            const matchStatus = statusFilter === null || company.status === statusFilter;
            return matchSearch && matchStatus;
          });

          if (filteredCompanies.length === 0) return (
            <div className="flex flex-col items-center justify-center h-64 text-icon">
              <p className="text-sm">{activeYear}년 기업 데이터가 없습니다.</p>
            </div>
          );

          if (filtered.length === 0) return (
            <div className="flex flex-col items-center justify-center h-64 text-icon">
              <p className="text-sm">검색 결과가 없습니다.</p>
            </div>
          );

          return (
          <div className="grid grid-cols-3 gap-6">
            {filtered.map(({ company, total, openRate, completionRate, leadershipDist }) => (
              <Link
                key={company.id}
                href={`/admin/analytics/${company.id}`}
                className="bg-surface rounded-2xl border border-border-light shadow-sm p-5 hover:border-brand/40 hover:shadow-md transition-all group flex flex-col"
              >
                {/* 기업 헤더 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <CompanyLogo name={company.name} size={40} />
                    <div>
                      <p className="text-sm font-bold text-text-primary group-hover:text-brand transition-colors">{company.name}</p>
                      <p className="text-xs text-text-secondary">{company.industry}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[company.status]}`} />
                    <span className={`text-xs font-medium ${statusText[company.status]}`}>{company.status}</span>
                  </div>
                </div>

                {/* 도넛 차트 + 범례 */}
                <div className="flex items-center justify-center gap-12 py-1">
                  <div className="flex-shrink-0">
                    <DonutChart
                      segments={leadershipDist.filter(s => s.count > 0).map(s => ({
                        value: s.count,
                        color: LEADERSHIP_COLORS[s.type],
                        label: s.type,
                      }))}
                      size={120}
                      strokeWidth={14}
                    />
                  </div>

                  {/* 범례 */}
                  <div className="flex flex-col gap-2 min-w-0">
                    {leadershipDist.filter(s => s.count > 0).map(seg => (
                      <div key={seg.type} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: LEADERSHIP_COLORS[seg.type] }} />
                        <span className="text-[10px] text-text-secondary whitespace-nowrap">{seg.type}</span>
                        <span className="text-[10px] text-text-secondary ml-auto pl-2">{seg.count}명</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 하단 지표 */}
                <div className="grid grid-cols-3 gap-2 border-t border-border-light mt-2 pt-3">
                  <div className="text-center">
                    <p className="text-base font-bold text-text-primary">{total}<span className="text-xs font-medium text-text-secondary ml-0.5">명</span></p>
                    <p className="text-[10px] text-text-secondary mt-0.5">대상 리더</p>
                  </div>
                  <div className="text-center border-x border-border-light">
                    <p className="text-base font-bold text-brand">{openRate}<span className="text-xs font-medium text-text-secondary ml-0.5">%</span></p>
                    <p className="text-[10px] text-text-secondary mt-0.5">열람률</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-emerald-500">{completionRate}<span className="text-xs font-medium text-text-secondary ml-0.5">%</span></p>
                    <p className="text-[10px] text-text-secondary mt-0.5">참여율</p>
                  </div>
                </div>

                {company.startDate && (
                  <p className="text-[10px] text-icon mt-3">{company.startDate} ~ {company.endDate}</p>
                )}
              </Link>
            ))}
          </div>
          );
        })()}
      </div>
    </div>
  );
}
