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

interface SavedRoundItem {
  newsletterId: number;
  roundNum: number;
  companyId: number;
  companyName: string;
  leadershipType: string;
  stage: string;
  topic: string | null;
  updatedAt: string;
}

export default function NewsletterStoragePage() {
  const router = useRouter();
  const newsletters = useNewsletterStore(s => s.newsletters);
  const toggleRoundSaved = useNewsletterStore(s => s.toggleRoundSaved);
  const companies = useCompanyStore(s => s.companies);
  const resetDraft = useNewNewsletterDraftStore(s => s.resetDraft);

  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [preview, setPreview] = useState<{ title: string; content: SavedNewsletterContent } | null>(null);
  const [reuseToast, setReuseToast] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ nlId: number; roundNum: number } | null>(null);

  // 저장된 회차 목록 펼치기
  const allSavedRounds = useMemo<SavedRoundItem[]>(() => {
    const items: SavedRoundItem[] = [];
    for (const nl of newsletters) {
      if (!nl.savedRounds || nl.savedRounds.length === 0) continue;
      for (const roundNum of nl.savedRounds) {
        const topic = nl.generatedContent?.rounds[roundNum - 1]?.generated?.headline ?? null;
        items.push({
          newsletterId: nl.id,
          roundNum,
          companyId: nl.companyId,
          companyName: nl.companyName ?? '',
          leadershipType: nl.leadershipType,
          stage: STAGES[(roundNum - 1) % STAGES.length],
          topic,
          updatedAt: nl.updatedAt,
        });
      }
    }
    return items.sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt) || a.roundNum - b.roundNum
    );
  }, [newsletters]);

  const filtered = useMemo(() => {
    let list = allSavedRounds;
    if (companyFilter) list = list.filter(r => r.companyId === Number(companyFilter));
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(r =>
        r.companyName.includes(q) || r.leadershipType.includes(q) || (r.topic ?? '').includes(q)
      );
    }
    return list;
  }, [allSavedRounds, companyFilter, search]);

  const savedCompanyIds = useMemo(() =>
    [...new Set(allSavedRounds.map(r => r.companyId))],
    [allSavedRounds]
  );
  const savedCompanies = companies.filter(c => savedCompanyIds.includes(c.id));

  function handleReuse(item: SavedRoundItem) {
    resetDraft();
    router.push('/admin/newsletters/new');
    setReuseToast(`"${item.companyName} ${item.leadershipType} ${item.roundNum}회차" 구성을 참고해 새 뉴스레터를 만듭니다.`);
    setTimeout(() => setReuseToast(null), 4000);
  }

  function handlePreview(item: SavedRoundItem) {
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
          <span className="ml-2 text-xs text-gray-400 font-normal">마음에 드는 회차를 저장하고 재활용하세요</span>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 px-8 py-6 overflow-y-auto bg-white">
        {/* 안내 배너 */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
          <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-600 leading-relaxed">
            <span className="font-semibold">뉴스레터 제작</span> 탭에서 완료된 각 회차 옆 북마크(
            <svg className="inline w-3 h-3 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            ) 버튼으로 회차별로 개별 저장할 수 있습니다.
          </p>
        </div>

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
            {savedCompanies.map(c => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* 카드 목록 */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <svg className="w-14 h-14 mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <p className="text-sm font-medium">
              {allSavedRounds.length === 0 ? '아직 저장된 회차가 없습니다.' : '검색 결과가 없습니다.'}
            </p>
            <p className="text-xs text-gray-300 mt-1">뉴스레터 제작 탭에서 완료된 회차 옆 북마크를 눌러보세요.</p>
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
                    <button
                      onClick={() => setRemoveTarget({ nlId: item.newsletterId, roundNum: item.roundNum })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#55A4DA] hover:text-red-400 hover:bg-red-50 transition-colors"
                      title="저장 해제"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 저장 해제 확인 모달 */}
      {removeTarget !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">저장소에서 제거하시겠습니까?</h3>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  뉴스레터 자체는 삭제되지 않으며, 저장소 목록에서만 제거됩니다.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRemoveTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button onClick={() => { toggleRoundSaved(removeTarget.nlId, removeTarget.roundNum); setRemoveTarget(null); }}
                className="px-4 py-2 text-sm font-bold bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">
                제거
              </button>
            </div>
          </div>
        </div>
      )}

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
