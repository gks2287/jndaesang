'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCompanyStore } from '@/store/companyStore';
import { useParticipantStore, type LeadershipType, type Participant } from '@/store/participantStore';
import * as XLSX from 'xlsx';
import CompanyLogo from '@/components/CompanyLogo';

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

function RoundChart({ members }: { members: Participant[] }) {
  const data = useMemo(() => {
    const maxStep = Math.max(...members.map(p => p.stepTotal), 0);
    if (maxStep === 0) return [];
    return Array.from({ length: maxStep }, (_, i) => {
      const round = i + 1;
      const count = members.filter(p => p.stepCurrent >= round).length;
      return { label: `${round}회차`, count };
    });
  }, [members]);

  const total = members.length;
  const max = Math.max(...data.map(d => d.count), 1);
  const chartH = 120;
  const colW = data.length > 0 ? Math.max(36, Math.min(60, 432 / data.length)) : 36;
  const barW = Math.round(colW * 0.5);
  const svgW = colW * data.length;

  if (data.length === 0) {
    return <p className="text-center text-xs text-gray-300 py-10">회차 데이터가 없습니다.</p>;
  }

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${svgW} ${chartH + 28}`} className="w-full">
        {[0, 0.5, 1].map((ratio) => {
          const y = chartH - ratio * chartH;
          return (
            <line key={ratio} x1="0" y1={y} x2={svgW} y2={y}
              stroke="#f3f4f6" strokeWidth="1" />
          );
        })}
        {data.map((d, i) => {
          const barH = max > 0 ? (d.count / max) * chartH : 0;
          const x = i * colW + (colW - barW) / 2;
          const y = chartH - barH;
          const rate = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH}
                rx="4" fill={barH > 0 ? '#55A4DA' : '#f3f4f6'} />
              {d.count > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle"
                  fontSize="9" fill="#6b7280" fontWeight="600">
                  {d.count}명 ({rate}%)
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
    </div>
  );
}

// ── 실제 직책자 응답 → 응답 요약/활동 로그 데이터 ──
type QuestionType = '주관식' | '체크리스트' | '만족도 설문' | '퀴즈' | '시나리오';

type CompanyResponseRow = {
  kind: string;
  elementKey: string;
  response: Record<string, unknown>;
  roundIndex: number;
  updatedAt: string;
  participant: { id: number; name: string; position: string; leadershipType: string };
};

type TypeQuestion = {
  round: number;
  type: QuestionType;
  question: string;
  summary?: string;
  responses: { name: string; answer: string }[];
};

// 응답 1건 → 답변 문자열 (활동 로그 탭 표시용)
function responseAnswerText(row: CompanyResponseRow): string {
  const r = row.response ?? {};
  if (row.kind === 'quiz') {
    return `선택: ${String(r.selectedLabel ?? '')} — ${r.correct ? '정답 ✅' : '오답 ❌'}`;
  }
  if (row.kind === 'scenario') {
    return String(r.selectedLabel ?? '');
  }
  if (row.kind === 'selfcheck') {
    const items = Array.isArray(r.items) ? (r.items as string[]) : [];
    const checked = new Set(Array.isArray(r.checkedItems) ? (r.checkedItems as string[]) : []);
    if (items.length > 0) return items.map(it => `${checked.has(it) ? '✅' : '☐'} ${it}`).join('\n');
    return [...checked].map(it => `✅ ${it}`).join('\n') || '체크된 항목 없음';
  }
  if (row.kind === 'survey-always') {
    const helpful = Array.isArray(r.helpful) ? (r.helpful as string[]) : [];
    const comment = String(r.comment ?? '').trim();
    return [`만족도: ${String(r.rating ?? '')}`, ...helpful.map(h => `도움됨: ${h}`), ...(comment ? [comment] : [])].join('\n');
  }
  // survey-periodic
  const answers = Array.isArray(r.answers) ? (r.answers as { question: string; type: string; answer: unknown }[]) : [];
  return answers
    .filter(a => (Array.isArray(a.answer) ? a.answer.length > 0 : String(a.answer ?? '').trim().length > 0))
    .map(a => `${a.question} → ${Array.isArray(a.answer) ? (a.answer as string[]).join(', ') : String(a.answer)}`)
    .join('\n');
}

const KIND_TO_TYPE: Record<string, QuestionType> = {
  'quiz': '퀴즈',
  'scenario': '시나리오',
  'selfcheck': '체크리스트',
  'survey-always': '만족도 설문',
  'survey-periodic': '만족도 설문',
};

// 회차·요소별 그룹핑 (응답 요약/활동 로그 공용)
function buildTypeQuestions(rows: CompanyResponseRow[]): TypeQuestion[] {
  const groups = new Map<string, CompanyResponseRow[]>();
  for (const row of rows) {
    const key = `${row.roundIndex}|${row.kind}|${row.elementKey}`;
    const list = groups.get(key);
    if (list) list.push(row); else groups.set(key, [row]);
  }
  return [...groups.entries()]
    .map(([, list]) => {
      const first = list[0];
      const question = first.kind === 'quiz'
        ? String(first.response?.question ?? first.elementKey)
        : first.elementKey;
      // 퀴즈는 정답률 요약 제공
      let summary: string | undefined;
      if (first.kind === 'quiz') {
        const correct = list.filter(row => Boolean(row.response?.correct)).length;
        summary = `정답률 ${Math.round((correct / list.length) * 100)}% (${correct}/${list.length}명 정답)`;
      }
      return {
        round: first.roundIndex,
        type: KIND_TO_TYPE[first.kind] ?? '주관식',
        question,
        summary,
        responses: list.map(row => ({ name: row.participant.name, answer: responseAnswerText(row) })),
      };
    })
    .sort((a, b) => a.round - b.round);
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
    })).filter(seg => seg.count > 0), // 해당 기업에 실제 존재하는 유형만
    [yearMembers],
  );

  const [activeLogRound, setActiveLogRound] = useState<number | 'all'>('all');
  const [activeBottomTab, setActiveBottomTab] = useState<'summary' | 'log'>('summary');

  const typeSummary = useMemo(() => {
    if (!activeLeadership) return null;
    const tm = yearMembers.filter(p => p.leadershipType === activeLeadership);
    if (tm.length === 0) return null;

    const sent = tm.filter(p => p.deliveryStatus !== '미발송').length;
    const opened = tm.filter(p => p.deliveryStatus === '열람' || p.deliveryStatus === '완료').length;
    const completed = tm.filter(p => p.deliveryStatus === '완료').length;
    const inProgress = tm.filter(p => p.deliveryStatus === '열람').length;
    const notSent = tm.filter(p => p.deliveryStatus === '미발송').length;
    const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;

    const avgProgress = Math.round(
      tm.reduce((s, p) => s + (p.stepTotal > 0 ? (p.stepCurrent / p.stepTotal) * 100 : 0), 0) / tm.length
    );
    const avgStep = Math.round(
      tm.reduce((s, p) => s + p.stepCurrent, 0) / tm.length * 10
    ) / 10;
    const maxStep = tm[0]?.stepTotal ?? 6;

    // 전체 평균 열람률
    const totalSent = yearMembers.filter(p => p.deliveryStatus !== '미발송').length;
    const totalOpened = yearMembers.filter(p => p.deliveryStatus === '열람' || p.deliveryStatus === '완료').length;
    const overallOpenRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
    const openDiff = openRate - overallOpenRate;

    // 전체 유형 중 열람률 순위
    const allTypeRates = (Object.keys(LEADERSHIP_COLORS) as LeadershipType[])
      .map(t => {
        const ps = yearMembers.filter(p => p.leadershipType === t);
        const s = ps.filter(p => p.deliveryStatus !== '미발송').length;
        const o = ps.filter(p => p.deliveryStatus === '열람' || p.deliveryStatus === '완료').length;
        return { type: t, rate: s > 0 ? Math.round((o / s) * 100) : 0, count: ps.length };
      })
      .filter(x => x.count > 0)
      .sort((a, b) => b.rate - a.rate);

    const rank = allTypeRates.findIndex(x => x.type === activeLeadership) + 1;
    const total = allTypeRates.length;

    // 열람률 라인
    let openLine = '';
    if (rank === 1 && total > 1) {
      openLine = `열람률 ${openRate}%로 전체 ${total}개 유형 중 1위입니다. 전체 평균(${overallOpenRate}%)보다 ${Math.abs(openDiff)}%p 높아 참여 의지가 두드러집니다.`;
    } else if (rank === total && total > 1) {
      openLine = `열람률 ${openRate}%로 전체 ${total}개 유형 중 최하위입니다. 전체 평균(${overallOpenRate}%)보다 ${Math.abs(openDiff)}%p 낮아 발송 후 추가 독려가 필요합니다.`;
    } else {
      const diffStr = openDiff >= 0 ? `${openDiff}%p 높은` : `${Math.abs(openDiff)}%p 낮은`;
      openLine = `열람률 ${openRate}%로 전체 평균(${overallOpenRate}%)보다 ${diffStr} 수준이며, ${total}개 유형 중 ${rank}위입니다.`;
    }
    if (notSent > 0) openLine += ` (미발송 ${notSent}명 제외)`;

    // 진행률 라인
    let progressLine = '';
    if (completed === tm.length) {
      progressLine = `${tm.length}명 전원이 전 ${maxStep}회차를 완료했습니다. 코칭 프로그램을 성공적으로 이수한 유형입니다.`;
    } else if (completed > 0) {
      progressLine = `${tm.length}명 중 ${completed}명이 전 회차를 완료했고, ${inProgress}명이 현재 진행 중입니다. 평균 ${avgStep}회차 진행 중(진행률 ${avgProgress}%).`;
    } else if (avgProgress >= 50) {
      progressLine = `전원 코칭이 진행 중이며 평균 ${avgStep}회차까지 완료(진행률 ${avgProgress}%)했습니다. 꾸준한 참여가 이어지고 있습니다.`;
    } else {
      progressLine = `평균 진행률 ${avgProgress}%(${avgStep}/${maxStep}회차)로 초기 단계에 머물고 있습니다. 참여 촉진을 위한 추가 액션이 권장됩니다.`;
    }

    return { lines: [openLine, progressLine], count: tm.length };
  }, [activeLeadership, yearMembers]);

  const typeMembers = useMemo(
    () => activeLeadership ? yearMembers.filter(p => p.leadershipType === activeLeadership) : [],
    [yearMembers, activeLeadership],
  );

  const availableRounds = useMemo(() => {
    if (!activeLeadership || typeMembers.length === 0) return [];
    const maxStep = Math.max(...typeMembers.map(p => p.stepCurrent), 0);
    return Array.from({ length: maxStep }, (_, i) => i + 1);
  }, [typeMembers, activeLeadership]);

  // 이 기업 전체 직책자의 실제 응답 로드
  const [companyResponses, setCompanyResponses] = useState<CompanyResponseRow[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/participant-responses?companyId=${companyId}`);
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { responses: CompanyResponseRow[] };
        if (alive) setCompanyResponses(data.responses);
      } catch (e) {
        console.error('기업 응답 로드 오류:', e);
      }
    })();
    return () => { alive = false; };
  }, [companyId]);

  const typeQuestions = useMemo(() => {
    if (!activeLeadership) return [];
    const memberIds = new Set(typeMembers.map(p => p.id));
    const rows = companyResponses
      .filter(row => memberIds.has(row.participant.id))
      .filter(row => activeLogRound === 'all' || row.roundIndex === activeLogRound);
    return buildTypeQuestions(rows);
  }, [companyResponses, typeMembers, activeLeadership, activeLogRound]);

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
        발송회차: p.deliveryStatus !== '미발송' ? `${p.assessmentRound}회차` : '-',
        최근발송일자: p.lastOpenedAt ?? '-',
        뱃지개수: p.stepCurrent,
        진행단계: `${p.stepCurrent}/${p.stepTotal}`,
        열람률: opened ? '100%' : '0%',
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
        <span className="text-[17px] font-bold text-gray-900">{company.name}</span>
        <div className="flex items-center gap-1.5 ml-1">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[company.status]}`} />
          <span className={`text-xs font-medium ${statusText[company.status]}`}>{company.status}</span>
        </div>
      </div>

      {/* 본문 */}
      <div ref={pageRef} className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

        {/* 연도 탭 */}
        {years.length > 0 && (
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
        )}

        {/* 기업 정보 카드 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-start gap-6">
          <CompanyLogo name={company.name} logoUrl={company.logoUrl} size={56} />
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

        {/* 리더십 유형 필터 */}
        <div className="flex items-center justify-end">
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

        {/* 유형 요약 배너 */}
        {typeSummary && activeLeadership && (
          <div className="flex items-start gap-4 px-6 py-5 rounded-2xl border"
            style={{ backgroundColor: `${LEADERSHIP_COLORS[activeLeadership]}0d`, borderColor: `${LEADERSHIP_COLORS[activeLeadership]}40` }}>
            <span className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: LEADERSHIP_COLORS[activeLeadership] }} />
            <div className="flex-1">
              <p className="text-sm font-bold mb-2" style={{ color: LEADERSHIP_COLORS[activeLeadership] }}>
                {activeLeadership} · {typeSummary.count}명
              </p>
              {typeSummary.lines.map((line, i) => (
                <p key={i} className="text-sm text-gray-600 leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* 핵심 지표 + 월간 열람 추이 */}
        <div className="flex gap-4 items-stretch">
          {/* 핵심 지표 */}
          <div className="flex flex-col gap-4 flex-shrink-0 w-[32%]">
            {[
              { label: '대상 리더', value: stats.total, unit: '명', color: 'text-gray-800' },
              { label: '발송 완료', value: stats.sent, unit: '명', color: 'text-gray-800' },
              { label: '열람률', value: stats.openRate, unit: '%', color: 'text-[#55A4DA]' },
              { label: '참여 완료율', value: stats.completionRate, unit: '%', color: 'text-emerald-500' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-center flex-1 flex flex-col items-center justify-center">
                <p className="text-xs text-gray-400 mb-2">{item.label}</p>
                <p className={`text-3xl font-bold ${item.color}`}>
                  {item.value}
                  <span className="text-sm font-medium text-gray-400 ml-1">{item.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* 회차별 열람 추이 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex-1">
            <p className="text-sm font-bold text-gray-800 mb-5">회차별 열람 추이</p>
            <RoundChart members={yearMembers} />
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
            (() => {
              const tableMembers = yearMembers.filter(p => activeLeadership === null || p.leadershipType === activeLeadership);
              const maxRounds = Math.max(...tableMembers.map(p => p.stepTotal), 0);
              const rounds = Array.from({ length: maxRounds }, (_, i) => i + 1);
              const byType = activeLeadership !== null;
              const hasRounds = rounds.length > 0;
              return (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-400">
                      <th className="px-6 py-3 text-left font-medium" rowSpan={hasRounds ? 2 : 1}>이름</th>
                      <th className="px-6 py-3 text-left font-medium" rowSpan={hasRounds ? 2 : 1}>부서 / 직급</th>
                      {!byType && (
                        <th className="px-6 py-3 text-left font-medium" rowSpan={hasRounds ? 2 : 1}>리더십 유형</th>
                      )}
                      <th className="px-6 py-3 text-left font-medium" rowSpan={hasRounds ? 2 : 1}>발송 회차</th>
                      <th className="px-6 py-3 text-left font-medium" rowSpan={hasRounds ? 2 : 1}>최근 발송 일자</th>
                      <th className="px-6 py-3 text-left font-medium" rowSpan={hasRounds ? 2 : 1}>뱃지 개수</th>
                      {hasRounds && (
                        <th className="px-4 py-2 text-center font-medium border-l border-gray-200" colSpan={rounds.length}>
                          회차별 참여
                        </th>
                      )}
                    </tr>
                    {hasRounds && (
                      <tr className="bg-gray-50 text-xs text-gray-400 border-t border-gray-100">
                        {rounds.map(r => (
                          <th key={r} className="px-2 py-2 text-center font-medium min-w-[52px] whitespace-nowrap border-l border-gray-100 first:border-l-gray-200">
                            {rounds.length <= 6 ? `${r}회차` : r}
                          </th>
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tableMembers.map(p => {
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3.5 text-sm font-medium text-gray-800">{p.name}</td>
                          <td className="px-6 py-3.5 text-sm text-gray-500">{p.department} · {p.position}</td>
                          {!byType && (
                            <td className="px-6 py-3.5">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: `${LEADERSHIP_COLORS[p.leadershipType] ?? '#9CA3AF'}22`, color: LEADERSHIP_COLORS[p.leadershipType] ?? '#6B7280' }}>
                                {p.leadershipType}
                              </span>
                            </td>
                          )}
                          <td className="px-6 py-3.5 text-sm text-gray-700">
                            {p.deliveryStatus === '미발송'
                              ? <span className="text-gray-300">—</span>
                              : <span>{p.assessmentRound}회차</span>
                            }
                          </td>
                          <td className="px-6 py-3.5 text-sm text-gray-500">
                            {p.lastOpenedAt ?? <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              <span className="text-sm font-semibold text-gray-700">{p.stepCurrent}</span>
                            </div>
                          </td>
                          {rounds.map(r => {
                            const done = p.stepCurrent >= r;
                            const notSent = p.deliveryStatus === '미발송' && p.stepCurrent < r;
                            return (
                              <td key={r} className="px-3 py-3.5 text-center border-l border-gray-100 first:border-l-gray-200">
                                {notSent ? (
                                  <span className="text-[11px] text-gray-300 font-medium">—</span>
                                ) : done ? (
                                  <span className="text-[13px] font-bold text-emerald-500">O</span>
                                ) : (
                                  <span className="text-[13px] font-bold text-red-300">X</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()
          )}
        </div>

        {/* 유형별 활동 데이터 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
            {/* 제목 + 유형 뱃지 */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <p className="text-sm font-bold text-gray-800">유형별 활동 데이터</p>
              {activeLeadership && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: LEADERSHIP_COLORS[activeLeadership] }} />
                  <span className="text-xs text-gray-400">{activeLeadership} · {typeMembers.length}명</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 ml-auto">
              {/* 탭 버튼 */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveBottomTab('summary')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeBottomTab === 'summary' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  응답 요약
                </button>
                <button
                  onClick={() => setActiveBottomTab('log')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeBottomTab === 'log' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  활동 로그
                </button>
              </div>

              {/* 회차 필터 */}
              {activeLeadership && availableRounds.length > 0 && (
                <div className="flex gap-1">
                  <button
                    onClick={() => setActiveLogRound('all')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeLogRound === 'all' ? 'bg-[#55A4DA] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    전체
                  </button>
                  {availableRounds.map(r => (
                    <button
                      key={r}
                      onClick={() => setActiveLogRound(r)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeLogRound === r ? 'bg-[#55A4DA] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {r}회차
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!activeLeadership ? (
            <div className="flex flex-col items-center justify-center h-28 gap-2">
              <svg className="w-6 h-6 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm text-gray-300">리더십 유형을 선택하면 해당 유형 리더들의 활동 데이터를 확인할 수 있습니다.</p>
            </div>
          ) : typeQuestions.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-sm text-gray-300">
              활동 내역이 없습니다.
            </div>
          ) : activeBottomTab === 'summary' ? (
            /* 응답 요약 탭 */
            <div className="p-5 space-y-4 max-h-[520px] overflow-y-auto">
              {typeQuestions.map((q, i) => (
                <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                  {/* 질문 헤더 */}
                  <div className="px-4 py-3 bg-gray-50 flex items-center gap-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      q.type === '주관식'      ? 'bg-purple-50 text-purple-600' :
                      q.type === '체크리스트'  ? 'bg-blue-50 text-blue-600' :
                      q.type === '만족도 설문' ? 'bg-gray-200 text-gray-500' :
                                                 'bg-amber-50 text-amber-600'
                    }`}>{q.type}</span>
                    <span className="text-sm font-medium text-gray-700 flex-1">{q.question}</span>
                    <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">{q.responses.length}명 응답</span>
                    <span className="text-[11px] text-gray-300 flex-shrink-0 ml-1">{q.round}회차</span>
                  </div>

                  {/* 집계 내용 */}
                  {q.type === '체크리스트' ? (
                    <div className="px-4 py-4 space-y-3">
                      {(q.responses[0]?.answer.split('\n') ?? []).map((line, li) => {
                        const itemText = line.replace(/^[✅☐]\s*/, '');
                        const checkedCount = q.responses.filter(r => r.answer.split('\n')[li]?.startsWith('✅')).length;
                        const rate = q.responses.length > 0 ? Math.round((checkedCount / q.responses.length) * 100) : 0;
                        return (
                          <div key={li}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-gray-600">{itemText}</span>
                              <span className="text-xs text-gray-400 tabular-nums">{checkedCount}/{q.responses.length}명 <span className="text-[#55A4DA] font-semibold">{rate}%</span></span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#55A4DA] rounded-full transition-all" style={{ width: `${rate}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (() => {
                    const summary = q.summary;

                    // 만족도 설문·시나리오: 응답 빈도 순위 계산
                    const rankItems: { text: string; count: number }[] = [];
                    if (q.type === '만족도 설문' || q.type === '시나리오') {
                      const freq: Record<string, number> = {};
                      q.responses.forEach(r => {
                        r.answer.split(/\n/).forEach(chunk => {
                          const t = chunk.trim();
                          if (t.length > 4) freq[t] = (freq[t] ?? 0) + 1;
                        });
                      });
                      Object.entries(freq)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 4)
                        .forEach(([text, count]) => rankItems.push({ text, count }));
                    }

                    return (
                      <div className="px-4 py-4 space-y-3">
                        {/* 만족도 설문·시나리오: 응답 빈도 순위 */}
                        {rankItems.length > 0 && (
                          <div className="space-y-2">
                            {rankItems.map((item, ri) => (
                              <div key={ri} className="flex items-center gap-3">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                                  ri === 0 ? 'bg-[#55A4DA] text-white' :
                                  ri === 1 ? 'bg-[#7EC8E3] text-white' :
                                             'bg-gray-100 text-gray-400'
                                }`}>{ri + 1}</span>
                                <p className="text-xs text-gray-600 flex-1 leading-snug">{item.text}</p>
                                <span className="text-[11px] text-gray-400 flex-shrink-0">{item.count}명</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 요약 텍스트 (퀴즈 정답률 등) */}
                        {summary && (
                          <p className="text-xs text-gray-600 leading-relaxed">{summary}</p>
                        )}
                        {!summary && rankItems.length === 0 && (
                          <p className="text-xs text-gray-300">개별 응답은 활동 로그 탭에서 확인할 수 있습니다.</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          ) : (
            /* 활동 로그 탭 */
            <div className="p-5 space-y-4 max-h-[520px] overflow-y-auto">
              {typeQuestions.map((q, i) => (
                <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                  {/* 질문 헤더 */}
                  <div className="px-4 py-3 bg-gray-50 flex items-center gap-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      q.type === '주관식'      ? 'bg-purple-50 text-purple-600' :
                      q.type === '체크리스트'  ? 'bg-blue-50 text-blue-600' :
                      q.type === '만족도 설문' ? 'bg-gray-200 text-gray-500' :
                                                 'bg-amber-50 text-amber-600'
                    }`}>{q.type}</span>
                    <span className="text-sm font-medium text-gray-700 flex-1">{q.question}</span>
                    <span className="text-[11px] text-gray-300 flex-shrink-0">{q.round}회차</span>
                  </div>
                  {/* 응답 목록 (이름 포함) */}
                  <div className="divide-y divide-gray-50">
                    {q.responses.map((r, j) => (
                      <div key={j} className="px-4 py-3 flex gap-4 hover:bg-gray-50/60 transition-colors">
                        <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0 pt-0.5">{r.name}</span>
                        <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line flex-1">{r.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
