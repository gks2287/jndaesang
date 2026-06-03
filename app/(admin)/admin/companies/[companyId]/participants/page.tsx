'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useCompanyStore } from '@/store/companyStore';
import { useParticipantStore, type DeliveryStatus, type LeadershipType, type Participant } from '@/store/participantStore';
import { useMemo } from 'react';


const deliveryBadge: Record<DeliveryStatus, { bg: string; text: string; dot: string }> = {
  '열람':     { bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-400' },
  '발송완료': { bg: 'bg-yellow-50', text: 'text-yellow-600', dot: 'bg-yellow-400' },
  '미발송':   { bg: 'bg-gray-100',  text: 'text-gray-400',   dot: 'bg-gray-300' },
  '완료':     { bg: 'bg-emerald-50',text: 'text-emerald-600',dot: 'bg-emerald-400' },
};

const leadershipColor: Record<LeadershipType, string> = {
  '독재형':   'bg-red-100 text-red-600',
  '방관형':   'bg-orange-100 text-orange-600',
  '성과압박형':'bg-purple-100 text-purple-600',
  '불통형':   'bg-pink-100 text-pink-600',
  '불명확형': 'bg-indigo-100 text-indigo-600',
  '감정기복형':'bg-amber-100 text-amber-600',
};

const VALID_LEADERSHIP: LeadershipType[] = ['독재형', '방관형', '성과압박형', '불통형', '불명확형', '감정기복형'];

function parseRows(rows: Record<string, string>[], companyId: number, year: number): Omit<Participant, 'id'>[] {
  return rows
    .filter(row => row['이름']?.trim())
    .map(row => ({
      companyId,
      year,
      name: row['이름']?.trim() ?? '',
      department: row['부서']?.trim() ?? '',
      position: row['직책']?.trim() ?? '',
      email: row['이메일']?.trim() ?? '',
      leadershipType: (VALID_LEADERSHIP.includes(row['리더십유형']?.trim() as LeadershipType)
        ? row['리더십유형'].trim()
        : '불명확형') as LeadershipType,
      assessmentRound: 1,
      deliveryStatus: '미발송',
      lastOpenedAt: null,
      stepCurrent: 0,
      stepTotal: 6,
    }));
}

export default function ParticipantsPage() {
  const params = useParams();
  const companyId = Number(params.companyId);

  const company = useCompanyStore(s => s.companies.find(c => c.id === companyId));
  const rawParticipants = useParticipantStore(s => s.participants);
  const addParticipants = useParticipantStore(s => s.addParticipants);
  const allParticipants = useMemo(
    () => rawParticipants.filter(p => p.companyId === companyId),
    [rawParticipants, companyId],
  );
  const years = useMemo(
    () => [...new Set(allParticipants.map(p => p.year))].sort((a, b) => b - a),
    [allParticipants],
  );

  const [activeYear, setActiveYear] = useState<number | null>(null);
  const selectedYear = activeYear ?? years[0] ?? new Date().getFullYear();

  const participants = useMemo(
    () => allParticipants.filter(p => p.year === selectedYear),
    [allParticipants, selectedYear],
  );

const [search, setSearch] = useState('');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ count: number; error?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const { read, utils } = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      const parsed = parseRows(rows, companyId, selectedYear);
      if (parsed.length === 0) {
        setUploadResult({ count: 0, error: '유효한 데이터가 없습니다. 헤더를 확인해주세요.' });
      } else {
        addParticipants(parsed);
        setUploadResult({ count: parsed.length });
      }
    } catch {
      setUploadResult({ count: 0, error: '파일을 읽는 중 오류가 발생했습니다.' });
    }
    setTimeout(() => setUploadResult(null), 4000);
  }

  const filtered = participants
    .filter(p =>
      p.name.includes(search) ||
      p.position.includes(search) ||
      p.leadershipType.includes(search) ||
      p.email.includes(search)
    );

  if (!company) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        존재하지 않는 기업입니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 업로드 토스트 */}
      {uploadResult && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium transition-all ${
          uploadResult.error ? 'bg-red-500 text-white' : 'bg-gray-900 text-white'
        }`}>
          {uploadResult.error ? (
            <>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {uploadResult.error}
            </>
          ) : (
            <>
              <svg className="w-4 h-4 flex-shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span><span className="text-emerald-400 font-bold">{uploadResult.count}명</span>이 목록에 추가됐습니다.</span>
            </>
          )}
        </div>
      )}

      {/* 상단 토퍼 */}
      <div className="bg-white border-b border-gray-200 px-8 h-[65px] flex items-center justify-between">
        <div className="flex items-center gap-2 text-[15px] text-gray-800">
          <span className="font-bold text-gray-800">{company.name}</span>
        </div>

        <Link
          href={`/admin/companies/${companyId}/edit`}
          className="flex items-center gap-1.5 text-sm text-gray-500 font-medium px-3.5 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:text-gray-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          기업 정보 편집
        </Link>
      </div>

      {/* 본문 */}
      <div className="flex-1 px-8 py-6 flex flex-col overflow-hidden bg-white">
        {/* 기업 요약 뱃지 */}
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl ${company.color} flex items-center justify-center flex-shrink-0`}>
            <span className="text-white text-xs font-bold">{company.initials}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-base font-bold text-gray-800">{company.name}</h2>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                company.status === '진행 중'   ? 'bg-blue-50 text-blue-600' :
                company.status === '진행 완료' ? 'bg-emerald-50 text-emerald-600' :
                company.status === '진행 전'   ? 'bg-yellow-50 text-yellow-600' :
                                                 'bg-gray-100 text-gray-400'
              }`}>
                {company.status}
              </span>
            </div>
            <p className="text-xs text-gray-400">{company.industry} · 대상 리더 {company.participantCount}명</p>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex items-end justify-between border-b border-gray-200 mb-5">
          <div className="flex gap-6">
            {years.length > 0 ? years.map(y => (
              <button
                key={y}
                onClick={() => setActiveYear(y)}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  y === selectedYear
                    ? 'border-[#55A4DA] text-[#55A4DA]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {y}년
              </button>
            )) : (
              <span className="pb-3 text-sm text-gray-300">등록된 연도 없음</span>
            )}
          </div>

          {/* 검색 */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 mb-2">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="이름, 직책, 유형 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-32"
            />
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden flex-1">
          {/* 테이블 헤더 바 */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50/60">
            <p className="text-sm text-gray-500 font-medium">직책자 목록</p>
            <div className="flex items-center gap-2">
              {/* 리더십 유형 필터 */}
              <div className="relative">
                <select className="appearance-none text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg pl-3 pr-7 py-1.5 outline-none cursor-pointer hover:border-[#55A4DA]/60 focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition-all shadow-sm">
                  <option value="">리더십 유형</option>
                  <option>독재형</option>
                  <option>방관형</option>
                  <option>성과압박형</option>
                  <option>불통형</option>
                  <option>불명확형</option>
                  <option>감정기복형</option>
                </select>
                <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {/* 직책 필터 */}
              <div className="relative">
                <select className="appearance-none text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg pl-3 pr-7 py-1.5 outline-none cursor-pointer hover:border-[#55A4DA]/60 focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition-all shadow-sm">
                  <option value="">직책</option>
                  <option>부장</option>
                  <option>차장</option>
                  <option>과장</option>
                </select>
                <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* 컬럼 헤더 */}
          <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr] px-6 py-2.5 bg-gray-50 border-b border-gray-200">
            {['이름', '부서', '직책', '리더십 유형'].map(h => (
              <p key={h} className="text-xs font-semibold text-gray-400 tracking-wider uppercase">{h}</p>
            ))}
          </div>

          {/* 행 */}
          <div className="divide-y divide-gray-100 overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                해당 직책자가 없습니다.
              </div>
            ) : (
              filtered.map(p => {
                const leaderColor = leadershipColor[p.leadershipType];

                return (
                  <Link
                    key={p.id}
                    href={`/admin/companies/${companyId}/participants/${p.id}`}
                    className="grid grid-cols-[2.5fr_1fr_1fr_1fr] px-6 py-4 items-center hover:bg-blue-50/40 transition-colors cursor-pointer"
                  >
                    {/* 이름 */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#55A4DA]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#55A4DA] text-xs font-bold">{p.name[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.email}</p>
                      </div>
                    </div>

                    {/* 부서 */}
                    <p className="text-sm text-gray-600">{p.department}</p>

                    {/* 직책 */}
                    <p className="text-sm text-gray-600">{p.position}</p>

                    {/* 리더십 유형 */}
                    <span className={`inline-flex w-fit text-xs font-semibold px-2.5 py-1 rounded-full ${leaderColor}`}>
                      {p.leadershipType}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
