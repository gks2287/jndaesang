'use client';

import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCompanyStore, CoachingStatus } from '@/store/companyStore';
import { useParticipantStore, type LeadershipType } from '@/store/participantStore';

const INDUSTRIES = ['화학/소재', '자동차 부품', '반도체', '철강', '배터리/전자', '소비재', '화학', '에너지', '금융', 'IT/소프트웨어', '유통/물류', '제약/바이오', '건설/부동산', '기타'];
const STATUS_OPTIONS = ['진행 전', '진행 중', '진행 완료'];
const LEADERSHIP_TYPES: LeadershipType[] = ['독재형', '방관형', '성과압박형', '불통형', '불명확형', '감정기복형'];

const leadershipColor: Record<LeadershipType, string> = {
  '독재형':    'bg-red-100 text-red-600',
  '방관형':    'bg-orange-100 text-orange-600',
  '성과압박형': 'bg-purple-100 text-purple-600',
  '불통형':    'bg-pink-100 text-pink-600',
  '불명확형':  'bg-indigo-100 text-indigo-600',
  '감정기복형': 'bg-amber-100 text-amber-600',
};

type DraftParticipant = {
  name: string;
  department: string;
  position: string;
  email: string;
  leadershipType: LeadershipType;
};

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

export default function NewCompanyPage() {
  const router = useRouter();
  const companies = useCompanyStore(s => s.companies);
  const addCompany = useCompanyStore(s => s.addCompany);
  const addParticipants = useParticipantStore(s => s.addParticipants);

  const currentYear = new Date().getFullYear();

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

  const [draftParticipants, setDraftParticipants] = useState<DraftParticipant[]>([]);
  const [showAddRow, setShowAddRow] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addForm, setAddForm] = useState<DraftParticipant>({
    name: '', department: '', position: '', email: '', leadershipType: '불명확형',
  });
  const participantFileRef = useRef<HTMLInputElement>(null);

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const newCompanyId = useMemo(
    () => companies.length > 0 ? Math.max(...companies.map(c => c.id)) + 1 : 1,
    [companies],
  );

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
    if (draftParticipants.length > 0) {
      addParticipants(draftParticipants.map(p => ({
        ...p,
        companyId: newCompanyId,
        year: currentYear,
        assessmentRound: 1,
        deliveryStatus: '미발송' as const,
        lastOpenedAt: null,
        stepCurrent: 0,
        stepTotal: 6,
      })));
    }
    setSubmitting(false);
    router.push('/admin/dashboard');
  };

  function saveAddRow() {
    if (!addForm.name.trim()) return;
    setDraftParticipants(prev => [...prev, { ...addForm }]);
    setAddForm({ name: '', department: '', position: '', email: '', leadershipType: '불명확형' });
    setShowAddRow(false);
  }

  async function handleParticipantFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const { read, utils } = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
    const VALID: LeadershipType[] = ['독재형', '방관형', '성과압박형', '불통형', '불명확형', '감정기복형'];
    const parsed: DraftParticipant[] = rows
      .filter(r => r['이름']?.trim())
      .map(r => ({
        name: r['이름']?.trim() ?? '',
        department: r['부서']?.trim() ?? '',
        position: r['직책']?.trim() ?? '',
        email: r['이메일']?.trim() ?? '',
        leadershipType: (VALID.includes(r['리더십유형']?.trim() as LeadershipType)
          ? r['리더십유형'].trim()
          : '불명확형') as LeadershipType,
      }));
    if (parsed.length > 0) setDraftParticipants(prev => [...prev, ...parsed]);
  }

  const initials = getInitials(form.name);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 상단 토퍼 */}
      <div className="bg-white border-b border-gray-200 px-8 h-[65px] flex items-center justify-between">
        <div className="flex items-center gap-2 text-[15px] text-gray-800 font-semibold">
          <span className="font-bold">기업 추가</span>
        </div>
        <Link href="/admin/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ✕ 취소
        </Link>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">

          {/* 미리보기 아바타 */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#55A4DA] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg font-bold">{initials || '?'}</span>
            </div>
            <div>
              <p className="text-base font-bold text-gray-800">{form.name || '기업명을 입력하세요'}</p>
              <p className="text-sm text-gray-400">{form.industry || '산업군 미선택'}</p>
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
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">산업군 <span className="text-red-400">*</span></label>
                  <select
                    value={form.industry}
                    onChange={e => set('industry', e.target.value)}
                    required
                    className={inputCls + ' bg-white'}
                  >
                    <option value="">산업군 선택</option>
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
                      className={inputCls + ' pr-8'}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">명</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">코칭 상태</label>
                  <select
                    value={form.status}
                    onChange={e => set('status', e.target.value)}
                    className={inputCls + ' bg-white'}
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
                <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">종료일 <span className="text-red-400">*</span></label>
                <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} required className={inputCls} />
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
                  const picked = Array.from(e.target.files ?? []);
                  setFiles(prev => [...prev, ...picked]);
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

          {/* 직책자 */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[11px] tracking-[0.2em] text-gray-400 font-semibold">
                직책자
                {draftParticipants.length > 0 && (
                  <span className="ml-2 text-[#55A4DA]">{draftParticipants.length}명</span>
                )}
              </h2>

              {/* 직책자 추가 버튼 */}
              <div className="relative">
                <input ref={participantFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleParticipantFile} />
                <button
                  type="button"
                  onClick={() => setAddMenuOpen(v => !v)}
                  className="flex items-center gap-2 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-sm font-semibold px-3.5 py-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  직책자 추가
                  <svg className={`w-3.5 h-3.5 transition-transform ${addMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {addMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden p-1.5">
                      <button
                        type="button"
                        onClick={() => { setAddMenuOpen(false); participantFileRef.current?.click(); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-[#55A4DA]/8 hover:text-[#2E7DB5] transition-colors group"
                      >
                        <span className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-[#55A4DA]/15 flex items-center justify-center transition-colors flex-shrink-0">
                          <svg className="w-4 h-4 text-gray-500 group-hover:text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </span>
                        <div className="text-left">
                          <p className="text-sm font-semibold">파일로 추가</p>
                          <p className="text-[11px] text-gray-400 font-normal">엑셀·CSV 일괄 업로드</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAddMenuOpen(false); setShowAddRow(true); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-[#55A4DA]/8 hover:text-[#2E7DB5] transition-colors group"
                      >
                        <span className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-[#55A4DA]/15 flex items-center justify-center transition-colors flex-shrink-0">
                          <svg className="w-4 h-4 text-gray-500 group-hover:text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </span>
                        <div className="text-left">
                          <p className="text-sm font-semibold">개별 추가</p>
                          <p className="text-[11px] text-gray-400 font-normal">직접 정보 입력</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 overflow-hidden">
              {/* 테이블 헤더 */}
              <div className="grid grid-cols-[2fr_1.2fr_1fr_2fr_1.4fr_40px] px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                {['이름', '부서', '직책', '이메일', '리더십 유형', ''].map(h => (
                  <p key={h} className="text-xs font-semibold text-gray-400 tracking-wider uppercase">{h}</p>
                ))}
              </div>

              <div className="divide-y divide-gray-100">
                {draftParticipants.length === 0 && !showAddRow && (
                  <div className="flex items-center justify-center h-16 text-sm text-gray-300">
                    직책자를 추가하세요
                  </div>
                )}

                {draftParticipants.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-[2fr_1.2fr_1fr_2fr_1.4fr_40px] px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-sm text-gray-500 truncate">{p.department}</p>
                    <p className="text-sm text-gray-500">{p.position}</p>
                    <p className="text-xs text-gray-400 truncate">{p.email}</p>
                    <span className={`inline-flex w-fit text-xs font-semibold px-2.5 py-0.5 rounded-full ${leadershipColor[p.leadershipType]}`}>
                      {p.leadershipType}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDraftParticipants(prev => prev.filter((_, i) => i !== idx))}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                {showAddRow && (
                  <div className="grid grid-cols-[2fr_1.2fr_1fr_2fr_1.4fr_40px] px-4 py-2.5 items-center bg-emerald-50/40 gap-2">
                    <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="이름" className={rowInputCls} />
                    <input value={addForm.department} onChange={e => setAddForm(f => ({ ...f, department: e.target.value }))} placeholder="부서" className={rowInputCls} />
                    <input value={addForm.position} onChange={e => setAddForm(f => ({ ...f, position: e.target.value }))} placeholder="직책" className={rowInputCls} />
                    <input value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="이메일" className={rowInputCls} />
                    <select value={addForm.leadershipType} onChange={e => setAddForm(f => ({ ...f, leadershipType: e.target.value as LeadershipType }))} className={rowInputCls}>
                      {LEADERSHIP_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={saveAddRow} className="text-xs font-semibold text-emerald-600 px-1.5 py-1 rounded hover:bg-emerald-100 transition-colors">추가</button>
                      <button type="button" onClick={() => setShowAddRow(false)} className="text-xs text-gray-400 px-1.5 py-1 rounded hover:bg-gray-100 transition-colors">✕</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* HR 담당자 */}
          <section>
            <h2 className="text-[11px] tracking-[0.2em] text-gray-400 font-semibold mb-4">HR 담당자</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">담당자명</label>
                <input type="text" value={form.hrName} onChange={e => set('hrName', e.target.value)} placeholder="홍길동" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">이메일</label>
                <input type="email" value={form.hrEmail} onChange={e => set('hrEmail', e.target.value)} placeholder="hr@company.com" className={inputCls} />
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
              className={inputCls + ' resize-none'}
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

const inputCls = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition';
const rowInputCls = 'w-full text-xs text-gray-700 border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-[#55A4DA] transition-all';
