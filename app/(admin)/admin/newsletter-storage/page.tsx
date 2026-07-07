'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useNewsletterStore } from '@/store/newsletterStore';
import { useCompanyStore } from '@/store/companyStore';
import { useNewNewsletterDraftStore } from '@/store/newNewsletterDraftStore';
import CompanyLogo from '@/components/CompanyLogo';
import { SavedNewsletterPreviewModal, type SavedNewsletterContent } from '@/components/newsletter/NewsletterRender';

const STAGES = ['수용', '분석', '실행', '적용', '공유', '성찰'];

const leadershipColor: Record<string, string> = {
  '독재형': 'bg-red-100 text-red-700', '방관형': 'bg-orange-100 text-orange-700',
  '성과압박형': 'bg-purple-100 text-purple-700', '불통형': 'bg-pink-100 text-pink-700',
  '불명확형': 'bg-indigo-100 text-indigo-700', '감정기복형': 'bg-amber-100 text-amber-700',
  '코칭형': 'bg-blue-100 text-blue-700', '민주형': 'bg-sky-100 text-sky-700',
  '비전형': 'bg-teal-100 text-teal-700', '지원형': 'bg-green-100 text-green-700',
  '혁신형': 'bg-violet-100 text-violet-700',
};

interface StorageRoundItem {
  newsletterId: number;
  roundNum: number;
  companyId: number;
  companyName: string;
  leadershipType: string;
  stage: string;
  topic: string | null;
  updatedAt: string;
  sent: boolean;
}

export default function NewsletterStoragePage() {
  const router = useRouter();
  const newsletters = useNewsletterStore(s => s.newsletters);
  const companies = useCompanyStore(s => s.companies);
  const resetDraft = useNewNewsletterDraftStore(s => s.resetDraft);

  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [preview, setPreview] = useState<{ title: string; content: SavedNewsletterContent } | null>(null);
  const [reuseToast, setReuseToast] = useState<string | null>(null);

  // 제작완료 뉴스레터의 모든 회차 자동 표시
  const allRounds = useMemo<StorageRoundItem[]>(() => {
    const items: StorageRoundItem[] = [];
    for (const nl of newsletters) {
      if (nl.status !== '제작완료' || !nl.generatedContent) continue;
      const sentRounds = new Set(
        (nl.sentGroups ?? []).map(k => Number(k.split('|')[0])).filter(n => Number.isInteger(n) && n > 0)
      );
      for (let i = 0; i < nl.generatedContent.rounds.length; i++) {
        const round = nl.generatedContent.rounds[i];
        if (!round?.generated?.headline) continue;
        const roundNum = i + 1;
        items.push({
          newsletterId: nl.id,
          roundNum,
          companyId: nl.companyId,
          companyName: nl.companyName ?? '',
          leadershipType: nl.leadershipType,
          stage: STAGES[(roundNum - 1) % STAGES.length],
          topic: round.generated?.headline ?? null,
          updatedAt: nl.updatedAt,
          sent: sentRounds.has(roundNum),
        });
      }
    }
    return items.sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt) || a.roundNum - b.roundNum
    );
  }, [newsletters]);

  const filtered = useMemo(() => {
    let list = allRounds;
    if (companyFilter) list = list.filter(r => r.companyId === Number(companyFilter));
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(r =>
        r.companyName.includes(q) || r.leadershipType.includes(q) || (r.topic ?? '').includes(q)
      );
    }
    return list;
  }, [allRounds, companyFilter, search]);

  const storageCompanyIds = useMemo(() =>
    [...new Set(allRounds.map(r => r.companyId))],
    [allRounds]
  );
  const storageCompanies = companies.filter(c => storageCompanyIds.includes(c.id));

  function handleReuse(item: StorageRoundItem) {
    resetDraft();
    router.push('/admin/newsletters/new');
    setReuseToast(`"${item.companyName} ${item.leadershipType} ${item.roundNum}회차" 구성을 참고해 새 뉴스레터를 만듭니다.`);
    setTimeout(() => setReuseToast(null), 4000);
  }

  function handlePreview(item: StorageRoundItem) {
    const nl = newsletters.find(n => n.id === item.newsletterId);
    if (nl?.generatedContent && nl.generatedContent.rounds.length > 0) {
      setPreview({ title: `${item.companyName} ${item.leadershipType} ${item.roundNum}회차`, content: nl.generatedContent });
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-8 h-[65px] flex items-center justify-between flex-shrink-0">
        <div>
          <span className="text-[17px] font-bold text-gray-900">뉴스레터 저장소</span>
          <span className="ml-2 text-xs text-gray-400 font-normal">제작완료된 뉴스레터 회차가 자동으로 저장됩니다</span>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 px-8 py-6 overflow-y-auto bg-white">
        {/* 검색 + 필터 */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 w-56">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="기업명·유형·주제 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-full"
            />
          </div>
          <select
            value={companyFilter}
            onChange={e => setCompanyFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 bg-gray-50 outline-none focus:border-[#55A4DA] transition-colors cursor-pointer"
          >
            <option value="">전체 기업</option>
            {storageCompanies.map(c => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* 카드 목록 */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <svg className="w-14 h-14 mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium">
              {allRounds.length === 0 ? '아직 제작완료된 뉴스레터가 없습니다.' : '검색 결과가 없습니다.'}
            </p>
            <p className="text-xs text-gray-300 mt-1">뉴스레터 제작을 완료하면 이 목록에 자동으로 표시됩니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {filtered.map(item => {
              const nl = newsletters.find(n => n.id === item.newsletterId);
              const hasContent = !!(nl?.generatedContent && nl.generatedContent.rounds.length >= item.roundNum);
              return (
                <div
                  key={`${item.newsletterId}-${item.roundNum}`}
                  className="flex items-center gap-4 border border-gray-200 rounded-xl px-5 py-3.5 bg-white hover:shadow-sm transition-shadow"
                >
                  <CompanyLogo name={item.companyName} size={36} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-500">{item.roundNum}회차</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{item.stage}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${leadershipColor[item.leadershipType] ?? 'bg-gray-100 text-gray-500'}`}>
                        {item.leadershipType}
                      </span>
                      {item.sent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-600">발송완료</span>
                      )}
                    </div>
                    <p className={`text-sm mt-0.5 truncate ${item.topic ? 'text-gray-700 font-medium' : 'text-gray-300 italic'}`}>
                      {item.topic ?? '주제 미선정'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.companyName}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handlePreview(item)}
                      disabled={!hasContent}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#55A4DA] text-white hover:bg-[#3A8BC4] transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      확인
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SavedNewsletterPreviewModal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ''}
        content={preview?.content ?? null}
      />

      {reuseToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 px-4">
          <div className="flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-lg bg-gray-800 text-white text-sm font-medium whitespace-nowrap">
            <svg className="w-4 h-4 flex-shrink-0 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {reuseToast}
          </div>
        </div>
      )}
    </div>
  );
}
