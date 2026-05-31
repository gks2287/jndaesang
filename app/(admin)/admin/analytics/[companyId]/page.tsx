'use client';

import { useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCompanyStore } from '@/store/companyStore';
import { useParticipantStore, type LeadershipType, type Participant } from '@/store/participantStore';
import * as XLSX from 'xlsx';

const LEADERSHIP_COLORS: Record<LeadershipType, string> = {
  '독재형':    '#2E7DB5',
  '방관형':    '#55A4DA',
  '성과압박형': '#7EC8E3',
  '불통형':    '#A8D8EA',
  '불명확형':  '#4A90C4',
  '감정기복형': '#B8D4E8',
};

const statusDot: Record<string, string> = {
  '진행 중':   'bg-[#55A4DA]',
  '진행 완료': 'bg-emerald-400',
  '진행 전':   'bg-gray-300',
};
const statusText: Record<string, string> = {
  '진행 중':   'text-[#2E7DB5]',
  '진행 완료': 'text-emerald-600',
  '진행 전':   'text-gray-400',
};
const deliveryBadge: Record<string, string> = {
  '완료':    'bg-emerald-50 text-emerald-600',
  '열람':    'bg-blue-50 text-[#55A4DA]',
  '발송완료': 'bg-gray-100 text-gray-500',
  '미발송':  'bg-gray-50 text-gray-400',
};

function DonutChart({ segments, total }: {
  segments: { type: LeadershipType; count: number }[];
  total: number;
}) {
  let cum = 0;
  return (
    <svg viewBox="0 0 100 100" className="w-36 h-36">
      <g style={{ transform: 'rotate(-90deg)', transformOrigin: '50px 50px' }}>
        {total === 0 ? (
          <circle cx="50" cy="50" r="32" fill="none" stroke="#f3f4f6" strokeWidth="12" />
        ) : segments.filter(s => s.count > 0).map((seg, i) => {
          const pct = (seg.count / total) * 100;
          const offset = -cum;
          cum += pct;
          return (
            <circle
              key={i}
              cx="50" cy="50" r="32"
              fill="none"
              stroke={LEADERSHIP_COLORS[seg.type]}
              strokeWidth="12"
              pathLength="100"
              strokeDasharray={`${pct} 100`}
              strokeDashoffset={offset}
            />
          );
        })}
      </g>
      <text x="50" y="47" textAnchor="middle" className="text-xs" fontSize="14" fontWeight="700" fill="#1f2937">{total}</text>
      <text x="50" y="59" textAnchor="middle" fontSize="8" fill="#9ca3af">명</text>
    </svg>
  );
}

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

function MonthlyChart({ members, year }: { members: Participant[]; year: number }) {
  const data = useMemo(() => {
    return MONTH_LABELS.map((label, i) => {
      const month = String(i + 1).padStart(2, '0');
      const prefix = `${year}-${month}`;
      const count = members.filter(p => p.lastOpenedAt?.startsWith(prefix)).length;
      return { label, count };
    });
  }, [members, year]);

  const max = Math.max(...data.map(d => d.count), 1);
  const chartH = 120;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${12 * 36} ${chartH + 28}`} className="w-full">
        {/* 가이드 라인 */}
        {[0, 0.5, 1].map((ratio) => {
          const y = chartH - ratio * chartH;
          return (
            <line key={ratio} x1="0" y1={y} x2={12 * 36} y2={y}
              stroke="#f3f4f6" strokeWidth="1" />
          );
        })}
        {data.map((d, i) => {
          const barH = max > 0 ? (d.count / max) * chartH : 0;
          const x = i * 36 + 8;
          const barW = 20;
          const y = chartH - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH}
                rx="4" fill={barH > 0 ? '#55A4DA' : '#f3f4f6'} />
              {d.count > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle"
                  fontSize="9" fill="#6b7280" fontWeight="600">
                  {d.count}
                </text>
              )}
              <text x={x + barW / 2} y={chartH + 16} textAnchor="middle"
                fontSize="9" fill="#9ca3af">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {data.every(d => d.count === 0) && (
        <p className="text-center text-xs text-gray-300 -mt-6">열람 데이터가 없습니다.</p>
      )}
    </div>
  );
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = Number(params.companyId);

  const companies = useCompanyStore(s => s.companies);
  const participants = useParticipantStore(s => s.participants);

  const company = companies.find(c => c.id === companyId);
  const members = useMemo(() => participants.filter(p => p.companyId === companyId), [participants, companyId]);

  const years = useMemo(() => [...new Set(members.map(p => p.year))].sort((a, b) => b - a), [members]);
  const [activeYear, setActiveYear] = useState<number>(() => years[0] ?? new Date().getFullYear());
  const [activeLeadership, setActiveLeadership] = useState<LeadershipType | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const yearMembers = useMemo(() => members.filter(p => p.year === activeYear), [members, activeYear]);

  const stats = useMemo(() => {
    const total = yearMembers.length;
    const sent = yearMembers.filter(p => p.deliveryStatus !== '미발송').length;
    const opened = yearMembers.filter(p => p.deliveryStatus === '열람' || p.deliveryStatus === '완료').length;
    const completed = yearMembers.filter(p => p.deliveryStatus === '완료').length;
    return {
      total,
      openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      sent,
    };
  }, [yearMembers]);

  const leadershipDist = useMemo(() =>
    (Object.keys(LEADERSHIP_COLORS) as LeadershipType[]).map(type => ({
      type,
      count: yearMembers.filter(p => p.leadershipType === type).length,
    })),
    [yearMembers],
  );

  const handleDownloadExcel = () => {
    const rows = yearMembers.map(p => {
      const opened = p.deliveryStatus === '열람' || p.deliveryStatus === '완료';
      const participationRate = p.stepTotal > 0 ? Math.round((p.stepCurrent / p.stepTotal) * 100) : 0;
      return {
        이름: p.name,
        부서: p.department,
        직급: p.position,
        리더십유형: p.leadershipType,
        발송상태: p.deliveryStatus,
        진행단계: `${p.stepCurrent}/${p.stepTotal}`,
        열람률: opened ? '100%' : '0%',
        최근열람: p.lastOpenedAt ?? '-',
        참여율: `${participationRate}%`,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '직책자현황');
    XLSX.writeFile(wb, `${company?.name ?? 'analytics'}_${activeYear}.xlsx`);
    setDownloadOpen(false);
  };

  const handleDownloadPng = async () => {
    setDownloadOpen(false);
    const { default: html2canvas } = await import('html2canvas');
    const el = pageRef.current;
    if (!el) return;

    const prevOverflow = el.style.overflow;
    const prevHeight = el.style.height;
    const prevMaxHeight = el.style.maxHeight;
    el.style.overflow = 'visible';
    el.style.height = el.scrollHeight + 'px';
    el.style.maxHeight = 'none';

    const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });

    el.style.overflow = prevOverflow;
    el.style.height = prevHeight;
    el.style.maxHeight = prevMaxHeight;

    const link = document.createElement('a');
    link.download = `${company?.name ?? 'analytics'}_${activeYear}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (!company) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        기업 정보를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-8 h-[65px] flex-shrink-0 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[15px] font-bold text-gray-800">{company.name}</span>
        <div className="flex items-center gap-1.5 ml-1">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[company.status]}`} />
          <span className={`text-xs font-medium ${statusText[company.status]}`}>{company.status}</span>
        </div>
      </div>

      {/* 본문 */}
      <div ref={pageRef} className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

        {/* 기업 정보 카드 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-start gap-6">
          <div className={`w-14 h-14 rounded-2xl ${company.color} flex items-center justify-center flex-shrink-0`}>
            <span className="text-white text-base font-bold">{company.initials}</span>
          </div>
          <div className="flex-1 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">업종</p>
              <p className="text-sm font-medium text-gray-700">{company.industry}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">진단 기간</p>
              <p className="text-sm font-medium text-gray-700">{company.startDate} ~ {company.endDate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">HR 담당자</p>
              <p className="text-sm font-medium text-gray-700">{company.hrName || '—'}</p>
              {company.hrEmail && <p className="text-xs text-gray-400">{company.hrEmail}</p>}
            </div>
          </div>
        </div>

        {/* 연도 탭 + 리더십 유형 필터 */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {years.map(y => (
              <button
                key={y}
                onClick={() => setActiveYear(y)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeYear === y
                    ? 'bg-[#55A4DA] text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {y}년
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">리더십 유형</span>
            <select
              value={activeLeadership ?? ''}
              onChange={e => setActiveLeadership((e.target.value as LeadershipType) || null)}
              className="text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-8 appearance-none cursor-pointer hover:border-gray-300 focus:outline-none focus:border-[#55A4DA] transition-colors"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '14px' }}
            >
              <option value="">전체</option>
              {(Object.keys(LEADERSHIP_COLORS) as LeadershipType[]).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            {/* 다운로드 버튼 */}
            <div ref={downloadRef} className="relative">
              <button
                onClick={() => setDownloadOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                다운로드
                <svg className={`w-3.5 h-3.5 transition-transform ${downloadOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {downloadOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDownloadOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 w-44 overflow-hidden">
                    <button
                      onClick={handleDownloadExcel}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <span className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </span>
                      <div className="text-left">
                        <p className="font-medium text-gray-800">엑셀 다운로드</p>
                        <p className="text-[11px] text-gray-400">.xlsx 형식</p>
                      </div>
                    </button>
                    <div className="mx-4 my-1 border-t border-gray-100" />
                    <button
                      onClick={handleDownloadPng}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </span>
                      <div className="text-left">
                        <p className="font-medium text-gray-800">이미지 다운로드</p>
                        <p className="text-[11px] text-gray-400">.png 형식</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 핵심 지표 */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '대상 리더', value: stats.total, unit: '명', color: 'text-gray-800' },
            { label: '발송 완료', value: stats.sent, unit: '명', color: 'text-gray-800' },
            { label: '열람률', value: stats.openRate, unit: '%', color: 'text-[#55A4DA]' },
            { label: '참여 완료율', value: stats.completionRate, unit: '%', color: 'text-emerald-500' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-center">
              <p className="text-xs text-gray-400 mb-2">{item.label}</p>
              <p className={`text-3xl font-bold ${item.color}`}>
                {item.value}
                <span className="text-sm font-medium text-gray-400 ml-1">{item.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* 월간 열람 추이 + 리더십 유형 분포 */}
        <div className="grid grid-cols-2 gap-4">

          {/* 월간 열람 추이 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm font-bold text-gray-800 mb-5">월간 열람 추이</p>
            <MonthlyChart members={yearMembers} year={activeYear} />
          </div>

          {/* 리더십 유형 분포 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm font-bold text-gray-800 mb-5">리더십 유형 분포</p>
            <div className="flex items-center gap-8">
              <DonutChart segments={leadershipDist} total={stats.total} />
              <div className="flex flex-col gap-3 flex-1">
                {leadershipDist.map(seg => (
                  <div key={seg.type} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: LEADERSHIP_COLORS[seg.type] }} />
                    <span className="text-sm text-gray-600 flex-1">{seg.type}</span>
                    <span className="text-sm font-bold text-gray-800">{seg.count}명</span>
                    {stats.total > 0 && (
                      <span className="text-xs text-gray-400 w-8 text-right">
                        {Math.round((seg.count / stats.total) * 100)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* 리더 목록 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-800">직책자 현황</p>
          </div>
          {yearMembers.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-300 text-sm">
              데이터가 없습니다.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-400">
                  <th className="px-6 py-3 text-left font-medium">이름</th>
                  <th className="px-6 py-3 text-left font-medium">부서 / 직급</th>
                  <th className="px-6 py-3 text-left font-medium">리더십 유형</th>
                  <th className="px-6 py-3 text-left font-medium">발송 상태</th>
                  <th className="px-6 py-3 text-left font-medium">진행 단계</th>
                  <th className="px-6 py-3 text-left font-medium">최근 열람</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {yearMembers.filter(p => activeLeadership === null || p.leadershipType === activeLeadership).map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 text-sm font-medium text-gray-800">{p.name}</td>
                    <td className="px-6 py-3.5 text-sm text-gray-500">{p.department} · {p.position}</td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: LEADERSHIP_COLORS[p.leadershipType] }} />
                        <span className="text-sm text-gray-600">{p.leadershipType}</span>
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${deliveryBadge[p.deliveryStatus]}`}>
                        {p.deliveryStatus}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#55A4DA] rounded-full"
                            style={{ width: `${p.stepTotal > 0 ? (p.stepCurrent / p.stepTotal) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{p.stepCurrent}/{p.stepTotal}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-gray-400">{p.lastOpenedAt ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
