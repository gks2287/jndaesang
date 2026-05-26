'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCompanyStore } from '@/store/companyStore';
import { useParticipantStore } from '@/store/participantStore';
import { useNewNewsletterDraftStore } from '@/store/newNewsletterDraftStore';

const POSITIVE_TYPES = ['코칭형', '민주형', '서번트형', '비전형', '관계중심형'] as const;
const NEGATIVE_TYPES = ['독재형', '방관형', '불통형', '성과압박형', '감정기복형', '완벽주의형', '우유부단형'] as const;

const leadershipColor: Record<string, string> = {
  '코칭형':    'bg-blue-100 text-blue-600',
  '민주형':    'bg-sky-100 text-sky-600',
  '서번트형':  'bg-teal-100 text-teal-600',
  '비전형':    'bg-cyan-100 text-cyan-600',
  '관계중심형': 'bg-emerald-100 text-emerald-600',
  '독재형':    'bg-red-100 text-red-600',
  '방관형':    'bg-orange-100 text-orange-600',
  '불통형':    'bg-pink-100 text-pink-600',
  '성과압박형': 'bg-purple-100 text-purple-600',
  '감정기복형': 'bg-amber-100 text-amber-600',
  '완벽주의형': 'bg-rose-100 text-rose-600',
  '우유부단형': 'bg-yellow-100 text-yellow-600',
};

export default function NewNewsletterPage() {
  const router = useRouter();
  const companies = useCompanyStore(s => s.companies);
  const rawParticipants = useParticipantStore(s => s.participants);
  const draft = useNewNewsletterDraftStore();

  const [companyIds, setCompanyIds] = useState<number[]>(draft.companyIds);
  const [companySearch, setCompanySearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(draft.selectedTypes);
  const [selectedLeaders, setSelectedLeaders] = useState<number[]>(draft.selectedLeaders);

  // draft store 동기화
  useEffect(() => {
    draft.setDraft({
      kind: '일반형',
      companyIds,
      targetCategory: 'leadership',
      selectedTypes,
      selectedDepts: [],
      selectedAbilities: [],
      selectedLeaders,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyIds, selectedTypes, selectedLeaders]);

  function toggleCompany(id: number) {
    setCompanyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const companyParticipants = useMemo(
    () => rawParticipants.filter(p => companyIds.includes(p.companyId)),
    [rawParticipants, companyIds],
  );

  const filteredLeaders = useMemo(() => {
    if (selectedTypes.length === 0) return companyParticipants;
    return companyParticipants.filter(p => selectedTypes.includes(p.leadershipType));
  }, [companyParticipants, selectedTypes]);

  const filteredCompanies = companies.filter(c =>
    !companySearch.trim() || c.name.includes(companySearch.trim())
  );

  useEffect(() => {
    setSelectedTypes([]);
    setSelectedLeaders([]);
  }, [companyIds]);

  useEffect(() => {
    setSelectedLeaders(filteredLeaders.map(p => p.id));
  }, [filteredLeaders]);

  const step1Done = companyIds.length > 0;
  const step2Done = selectedTypes.length > 0;
  const step3Done = selectedLeaders.length > 0;
  const allDone = step1Done && step2Done && step3Done;

  function toggleType(t: string) {
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }
  function toggleLeader(id: number) {
    setSelectedLeaders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleAllLeaders() {
    setSelectedLeaders(prev => prev.length === filteredLeaders.length ? [] : filteredLeaders.map(p => p.id));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 상단 토퍼 */}
      <div className="bg-white border-b border-gray-200 px-8 py-3.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-[15px] text-gray-400 font-semibold">
          <Link href="/admin/newsletters" className="hover:text-gray-600 transition-colors">뉴스레터 제작</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-800 font-bold">새로 만들기</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/admin/newsletters')}
            className="text-sm font-medium text-gray-500 border border-gray-200 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">취소</button>
          <button
            onClick={() => {
              const params = new URLSearchParams({
                kind: '일반형',
                companyIds: companyIds.join(','),
                types: selectedTypes.join(','),
                depts: '',
                abilities: '',
                leaders: String(selectedLeaders.length),
              });
              router.push(`/admin/newsletters/new/configure?${params.toString()}`);
            }}
            disabled={!allDone}
            className={`text-sm font-semibold px-5 py-1.5 rounded-lg transition-colors ${allDone ? 'bg-[#55A4DA] hover:bg-[#3A8BC4] text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
            뉴스레터 내용 생성 →
          </button>
        </div>
      </div>

      {/* 스텝 흐름 인디케이터 */}
      <div className="bg-white border-b border-gray-200 px-8 py-3 flex items-center gap-2 flex-shrink-0">
        {[
          { n: 1, label: '기업 선택', done: step1Done, active: false },
          { n: 2, label: '유형 선택', done: step2Done, active: step1Done && !step2Done },
          { n: 3, label: '리더 선택', done: step3Done, active: step2Done && !step3Done },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                s.done || s.active ? 'bg-[#55A4DA] text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                {s.done ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : s.n}
              </span>
              <span className={`text-xs font-semibold ${s.done || s.active ? 'text-[#55A4DA]' : 'text-gray-400'}`}>{s.label}</span>
            </div>
            {i < 2 && (
              <svg className={`w-4 h-4 ${s.done ? 'text-[#55A4DA]/40' : 'text-gray-200'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            )}
          </div>
        ))}
      </div>

      {/* 본문: 좌→우 3컬럼 */}
      <div className="flex-1 flex overflow-hidden bg-gray-50">

        {/* ── 1. 기업 선택 ── */}
        <div className="w-[240px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-800">기업 선택</p>
          </div>
          <div className="px-3 pt-3 pb-2 space-y-2">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="기업명 검색" value={companySearch} onChange={e => setCompanySearch(e.target.value)}
                className="flex-1 bg-transparent text-xs text-gray-600 placeholder-gray-400 outline-none" />
            </div>
            {companyIds.length > 0 && (
              <p className="text-[11px] font-semibold text-[#55A4DA] px-1">{companyIds.length}개 기업 선택</p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredCompanies.map(c => {
              const selected = companyIds.includes(c.id);
              return (
                <button key={c.id} onClick={() => toggleCompany(c.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    selected ? 'bg-[#55A4DA]/5' : 'hover:bg-gray-50'
                  }`}>
                  <Checkbox checked={selected} />
                  <div className={`w-8 h-8 rounded-lg ${c.color} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-[10px] font-bold">{c.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{c.name}</p>
                    <p className="text-[11px] text-gray-400">{c.industry}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 2. 대상 유형 설정 ── */}
        <div className={`w-[280px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col transition-opacity ${step1Done ? '' : 'opacity-40 pointer-events-none'}`}>
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-800">유형 선택</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* 긍정적 리더십 유형 */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                <p className="text-xs font-bold text-blue-700">긍정적 리더십 유형</p>
              </div>
              <div className="space-y-1.5">
                {POSITIVE_TYPES.map(t => (
                  <button key={t} onClick={() => toggleType(t)}
                    className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                      selectedTypes.includes(t) ? `${leadershipColor[t]} border-current` : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    <Checkbox checked={selectedTypes.includes(t)} />
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* 부정적 리더십 유형 */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                <p className="text-xs font-bold text-red-700">부정적 리더십 유형</p>
              </div>
              <div className="space-y-1.5">
                {NEGATIVE_TYPES.map(t => (
                  <button key={t} onClick={() => toggleType(t)}
                    className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                      selectedTypes.includes(t) ? `${leadershipColor[t]} border-current` : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    <Checkbox checked={selectedTypes.includes(t)} />
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. 리더 설정 ── */}
        <div className={`flex-1 min-w-0 bg-white flex flex-col transition-opacity ${step2Done ? '' : 'opacity-40 pointer-events-none'}`}>
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-800">리더 선택</p>
            {filteredLeaders.length > 0 && (
              <span className="text-xs font-semibold text-[#55A4DA]">{selectedLeaders.length} / {filteredLeaders.length}명</span>
            )}
          </div>

          {/* 전체 선택 */}
          <div className="flex items-center gap-2.5 px-5 py-2 border-b border-gray-100 bg-gray-50/60">
            <button onClick={toggleAllLeaders} className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              selectedLeaders.length === filteredLeaders.length && filteredLeaders.length > 0
                ? 'bg-[#55A4DA] border-[#55A4DA]' : 'border-gray-300 hover:border-gray-400'
            }`}>
              {selectedLeaders.length === filteredLeaders.length && filteredLeaders.length > 0 && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              )}
            </button>
            <span className="text-[11px] text-gray-500 font-medium">전체 선택</span>
          </div>

          {/* 컬럼 헤더 */}
          <div className="grid grid-cols-[28px_2fr_1.2fr_1fr_1.2fr] gap-3 px-5 py-2 bg-gray-50 border-b border-gray-200">
            <span />
            {['이름', '부서', '직책', '리더십 유형'].map(h => (
              <p key={h} className="text-[11px] font-semibold text-gray-400">{h}</p>
            ))}
          </div>

          {/* 리스트 */}
          <div className="flex-1 divide-y divide-gray-100 overflow-y-auto">
            {filteredLeaders.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-gray-400">
                조건에 해당하는 리더가 없습니다.
              </div>
            ) : (
              filteredLeaders.map(p => {
                const checked = selectedLeaders.includes(p.id);
                const lc = leadershipColor[p.leadershipType] ?? 'bg-gray-100 text-gray-500';
                return (
                  <button key={p.id} onClick={() => toggleLeader(p.id)}
                    className={`w-full grid grid-cols-[28px_2fr_1.2fr_1fr_1.2fr] gap-3 px-5 py-3 items-center text-left transition-colors ${
                      checked ? 'bg-[#55A4DA]/5' : 'hover:bg-gray-50'
                    }`}>
                    <Checkbox checked={checked} />
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#55A4DA]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#55A4DA] text-[10px] font-bold">{p.name[0]}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{p.email}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 truncate">{p.department}</p>
                    <p className="text-xs text-gray-600">{p.position}</p>
                    <span className={`inline-flex w-fit text-[11px] font-semibold px-2 py-0.5 rounded-full ${lc}`}>{p.leadershipType}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
      checked ? 'bg-[#55A4DA] border-[#55A4DA]' : 'border-gray-300'
    }`}>
      {checked && (
        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </span>
  );
}
