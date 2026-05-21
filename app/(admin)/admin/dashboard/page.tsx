'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCompanyStore } from '@/store/companyStore';

const TABS = ['전체 기업', '코칭 진행 중', '코칭 완료', '미시작'];

const statusDot: Record<string, string> = {
  '코칭 진행 중': 'bg-[#55A4DA]',
  '코칭 완료': 'bg-emerald-400',
  '준비 중': 'bg-yellow-400',
  '미시작': 'bg-gray-300',
};

const statusText: Record<string, string> = {
  '코칭 진행 중': 'text-[#2E7DB5]',
  '코칭 완료': 'text-emerald-600',
  '준비 중': 'text-yellow-600',
  '미시작': 'text-gray-400',
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('전체 기업');
  const companies = useCompanyStore(s => s.companies);
  const router = useRouter();

  const filtered = activeTab === '전체 기업'
    ? companies
    : companies.filter(c => c.status === activeTab);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── 상단 토퍼 ── */}
      <div className="bg-white border-b border-gray-200 px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[15px] text-gray-400 font-semibold">
          <span>리더십 코칭 관리</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-800 font-bold">고객사 현황</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="기업 검색"
              className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-28"
            />
          </div>
          <Link href="/admin/companies/new" className="flex items-center gap-2 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            기업 추가
          </Link>
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="flex-1 px-8 py-6 flex flex-col overflow-hidden bg-white">
        {/* 탭 */}
        <div className="flex gap-6 border-b border-gray-200 mb-6">
          {TABS.map((tab) => (
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
            </button>
          ))}
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden flex-1">
          {/* 테이블 헤더 */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 bg-gray-50/60">
            <p className="text-sm text-gray-500 font-medium">기업 목록</p>
            <p className="text-sm font-semibold text-[#55A4DA]">{filtered.length}개 기업</p>
          </div>

          {/* 컬럼 헤더 */}
          <div className="grid grid-cols-[3fr_1fr_1fr_40px] px-6 py-2.5 bg-gray-50 border-b border-gray-200">
            {['기업명', '대상 리더', '코칭 현황', ''].map((h) => (
              <p key={h} className="text-xs font-semibold text-gray-400 tracking-wider uppercase">{h}</p>
            ))}
          </div>

          {/* 행 */}
          <div className="divide-y divide-gray-100 overflow-y-auto flex-1">
            {filtered.map((company) => (
              <div
                key={company.id}
                onClick={() => router.push(`/admin/companies/${company.id}/participants`)}
                className="grid grid-cols-[3fr_1fr_1fr_40px] px-6 py-4 items-center hover:bg-gray-50/70 transition-colors cursor-pointer"
              >
                {/* 기업명 + 아바타 */}
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${company.color} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-xs font-bold">{company.initials}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{company.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">대상 리더 {company.participantCount}명</p>
                  </div>
                </div>

                {/* 대상 리더 수 */}
                <p className="text-sm font-medium text-gray-700">{company.participantCount}명</p>

                {/* 코칭 현황 */}
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[company.status]}`} />
                  <span className={`text-sm font-medium ${statusText[company.status]}`}>{company.status}</span>
                </div>

                {/* 더보기 */}
                <button
                  onClick={e => e.stopPropagation()}
                  className="text-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
