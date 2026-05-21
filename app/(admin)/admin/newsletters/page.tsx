'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useNewsletterStore, type NewsletterStatus } from '@/store/newsletterStore';

const TABS: Array<'최근' | NewsletterStatus> = ['최근', '제작 중', '제작완료'];

const statusStyle: Record<NewsletterStatus, { bg: string; text: string; dot: string }> = {
  '제작 중':  { bg: 'bg-yellow-50', text: 'text-yellow-600', dot: 'bg-yellow-400' },
  '제작완료': { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400' },
};

const leadershipColor: Record<string, string> = {
  '독재형':    'bg-red-100 text-red-600',
  '방관형':    'bg-orange-100 text-orange-600',
  '성과압박형': 'bg-purple-100 text-purple-600',
  '불통형':    'bg-pink-100 text-pink-600',
  '불명확형':  'bg-indigo-100 text-indigo-600',
  '감정기복형': 'bg-amber-100 text-amber-600',
};

function NewslettersContent() {
  const newsletters = useNewsletterStore(s => s.newsletters);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'최근' | NewsletterStatus>('최근');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === '제작 중' || tab === '제작완료') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    let list = newsletters;
    if (activeTab !== '최근') list = list.filter(n => n.status === activeTab);
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(n =>
        n.title.includes(q) ||
        n.companyName.includes(q) ||
        n.leadershipType.includes(q)
      );
    }
    return list;
  }, [newsletters, activeTab, search]);

  const countByStatus = useMemo(() => ({
    '제작 중': newsletters.filter(n => n.status === '제작 중').length,
    '제작완료': newsletters.filter(n => n.status === '제작완료').length,
  }), [newsletters]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 상단 토퍼 */}
      <div className="bg-white border-b border-gray-200 px-8 py-3.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-[15px] text-gray-400 font-semibold">
          <span>리더십 코칭 관리</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-800 font-bold">뉴스레터 제작</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="뉴스레터 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-32"
            />
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 px-8 py-6 flex flex-col overflow-hidden bg-white">
        {/* 탭 */}
        <div className="flex gap-6 border-b border-gray-200 mb-6 pl-2">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-[#55A4DA] text-[#55A4DA]'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab}
              {tab !== '최근' && (
                <span className="ml-1.5 text-xs text-gray-400">
                  {countByStatus[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 새로 만들기 */}
        <Link
          href="/admin/newsletters/new"
          className="flex items-center gap-3 border-2 border-dashed border-[#55A4DA]/40 hover:border-[#55A4DA] bg-[#55A4DA]/5 hover:bg-[#55A4DA]/10 rounded-xl px-6 py-4 mb-5 transition-all group"
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
        </Link>

        {/* 카드 목록 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden flex-1">
          {/* 목록 헤더 */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50/60">
            <p className="text-sm text-gray-500 font-medium">뉴스레터 목록</p>
            <p className="text-sm font-semibold text-[#55A4DA]">{filtered.length}건</p>
          </div>

          {/* 컬럼 헤더 */}
          <div className="grid grid-cols-[2fr_1.8fr_1.5fr_1fr_80px] px-6 py-2.5 bg-gray-50 border-b border-gray-200">
            {['기업명', '뉴스레터 생성 대상', '뉴스레터 생성 현황', '수정일', ''].map(h => (
              <p key={h} className="text-xs font-semibold text-gray-400 tracking-wider">{h}</p>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-16">
              <svg className="w-12 h-12 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium">뉴스레터가 없습니다.</p>
              <p className="text-xs text-gray-300 mt-1">새로 만들기를 눌러 뉴스레터를 제작해보세요.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 overflow-y-auto flex-1">
              {filtered.map(n => {
                const st = statusStyle[n.status];
                const lc = leadershipColor[n.leadershipType] ?? 'bg-gray-100 text-gray-500';
                const progressPct = Math.round((n.stepCount / 6) * 100);

                return (
                  <div
                    key={n.id}
                    className="grid grid-cols-[2fr_1.8fr_1.5fr_1fr_80px] px-6 py-4 items-center hover:bg-gray-50/70 transition-colors cursor-pointer"
                  >
                    {/* 기업명 */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#55A4DA]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#55A4DA] text-xs font-bold">{n.companyName.slice(0, 2)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{n.companyName}</p>
                        <p className="text-xs text-gray-400 truncate">{n.title}</p>
                      </div>
                    </div>

                    {/* 뉴스레터 생성 대상 */}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${lc}`}>{n.leadershipType}</span>
                      <span className="text-xs text-gray-400">· 스텝 {n.stepCount}/6</span>
                    </div>

                    {/* 뉴스레터 생성 현황 */}
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {n.status}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${n.status === '제작완료' ? 'bg-emerald-400' : 'bg-[#55A4DA]'}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${n.status === '제작완료' ? 'text-emerald-600' : 'text-[#55A4DA]'}`}>
                          {progressPct}%
                        </span>
                      </div>
                    </div>

                    {/* 수정일 */}
                    <p className="text-sm text-gray-500">{n.updatedAt}</p>

                    {/* 화살표 */}
                    <div className="flex items-center justify-end">
                      <span className="text-xs text-[#55A4DA] font-medium">상세 →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
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
