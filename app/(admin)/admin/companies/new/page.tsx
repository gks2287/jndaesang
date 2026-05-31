'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCompanyStore, CoachingStatus } from '@/store/companyStore';

const INDUSTRIES = ['화학/소재', '자동차 부품', '반도체', '철강', '배터리/전자', '소비재', '화학', '에너지', '금융', 'IT/소프트웨어', '유통/물류', '제약/바이오', '건설/부동산', '기타'];
const STATUS_OPTIONS = ['진행 전', '진행 중', '진행 완료'];

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

export default function NewCompanyPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    industry: '',
    participantCount: '',
    hrName: '',
    hrEmail: '',
    startDate: '',
    endDate: '',
    status: '진행 전',
    note: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const addCompany = useCompanyStore(s => s.addCompany);

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 400));
    addCompany({
      name: form.name,
      industry: form.industry,
      participantCount: Number(form.participantCount),
      status: form.status as CoachingStatus,
      hrName: form.hrName,
      hrEmail: form.hrEmail,
      startDate: form.startDate,
      endDate: form.endDate,
      note: form.note,
    });
    setSubmitting(false);
    router.push('/admin/dashboard');
  };

  const initials = getInitials(form.name);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 상단 토퍼 */}
      <div className="bg-white border-b border-gray-200 px-8 h-[65px] flex items-center justify-between">
        <div className="flex items-center gap-2 text-[15px] text-gray-400 font-semibold">
          <Link href="/admin/dashboard" className="hover:text-gray-600 transition-colors">리더십 코칭 관리</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link href="/admin/dashboard" className="hover:text-gray-600 transition-colors">고객사 현황</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-800 font-bold">기업 추가</span>
        </div>
        <Link
          href="/admin/dashboard"
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ✕ 취소
        </Link>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8">

          {/* 미리보기 아바타 */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#55A4DA] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg font-bold">{initials || '?'}</span>
            </div>
            <div>
              <p className="text-base font-bold text-gray-800">{form.name || '기업명을 입력하세요'}</p>
              <p className="text-sm text-gray-400">{form.industry || '업종 미선택'}</p>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* 기본 정보 */}
          <section>
            <h2 className="text-[11px] tracking-[0.2em] text-gray-400 font-semibold mb-4">기본 정보</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">기업명 <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="예) LG화학"
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">업종 <span className="text-red-400">*</span></label>
                  <select
                    value={form.industry}
                    onChange={e => set('industry', e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition bg-white"
                  >
                    <option value="">업종 선택</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">대상 직책자 수 <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={form.participantCount}
                      onChange={e => set('participantCount', e.target.value)}
                      placeholder="0"
                      required
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition pr-8"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">명</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">코칭 상태</label>
                  <select
                    value={form.status}
                    onChange={e => set('status', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition bg-white"
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* 코칭 기간 */}
          <section>
            <h2 className="text-[11px] tracking-[0.2em] text-gray-400 font-semibold mb-4">코칭 기간</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">시작일 <span className="text-red-400">*</span></label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => set('startDate', e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">종료일 <span className="text-red-400">*</span></label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={e => set('endDate', e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition"
                />
              </div>
            </div>
          </section>

          {/* 다면진단 보고서 */}
          <section>
            <h2 className="text-[11px] tracking-[0.2em] text-gray-400 font-semibold mb-4">다면진단 보고서</h2>
            <label className="block w-full border-2 border-dashed border-gray-200 rounded-lg px-6 py-8 cursor-pointer hover:border-[#55A4DA] hover:bg-[#55A4DA]/5 transition-colors group">
              <input
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.pptx,.ppt"
                multiple
                className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files ?? []);
                  setFiles(prev => [...prev, ...files]);
                }}
              />
              <div className="flex flex-col items-center gap-2 text-center">
                <svg className="w-8 h-8 text-gray-300 group-hover:text-[#55A4DA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-medium text-gray-500 group-hover:text-[#55A4DA]">파일을 드래그하거나 클릭해서 업로드</p>
                <p className="text-xs text-gray-400">PDF, Excel, CSV, PPT 지원 · 최대 50MB</p>
              </div>
            </label>
            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((file, i) => (
                  <li key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <svg className="w-4 h-4 text-[#55A4DA] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm text-gray-700 truncate">{file.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-300 hover:text-red-400 transition-colors ml-3 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* HR 담당자 */}
          <section>
            <h2 className="text-[11px] tracking-[0.2em] text-gray-400 font-semibold mb-4">HR 담당자</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">담당자명</label>
                <input
                  type="text"
                  value={form.hrName}
                  onChange={e => set('hrName', e.target.value)}
                  placeholder="홍길동"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">이메일</label>
                <input
                  type="email"
                  value={form.hrEmail}
                  onChange={e => set('hrEmail', e.target.value)}
                  placeholder="hr@company.com"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition"
                />
              </div>
            </div>
          </section>

          {/* 비고 */}
          <section>
            <h2 className="text-[11px] tracking-[0.2em] text-gray-400 font-semibold mb-4">비고</h2>
            <textarea
              value={form.note}
              onChange={e => set('note', e.target.value)}
              placeholder="추가 메모사항을 입력하세요"
              rows={3}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition resize-none"
            />
          </section>

          {/* 버튼 */}
          <div className="flex gap-3 pt-2 pb-8">
            <Link
              href="/admin/dashboard"
              className="flex-1 py-3 border border-gray-200 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors text-center"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 bg-[#55A4DA] hover:bg-[#3A8BC4] disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  저장 중...
                </>
              ) : '기업 추가'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
