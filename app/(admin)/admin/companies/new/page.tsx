'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCompanyStore, CoachingStatus } from '@/store/companyStore';
import { useParticipantStore, type LeadershipType } from '@/store/participantStore';
import { useLeadershipInfoStore, type LeadershipInfo } from '@/store/leadershipInfoStore';

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
  '완벽주의형': 'bg-violet-100 text-violet-600',
  '우유부단형': 'bg-rose-100 text-rose-600',
  '코칭형':    'bg-emerald-100 text-emerald-700',
  '민주형':    'bg-teal-100 text-teal-700',
  '서번트형':  'bg-cyan-100 text-cyan-700',
  '비전형':    'bg-sky-100 text-sky-700',
  '관계중심형': 'bg-blue-100 text-blue-700',
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

// 파일 크기 표시 (작은 파일은 KB/B로 — 0.0MB로 보이는 혼동 방지)
function fmtFileSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// 업로드 이미지를 정사각 축소 data URL로 (DB에 가볍게 저장)
function resizeImageToDataUrl(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) { reject(new Error('canvas 미지원')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 로드 실패')); };
    img.src = url;
  });
}

export default function NewCompanyPage() {
  const router = useRouter();
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

  // 다면진단 보고서 → AI 추출 리더십 유형 정보 (제출 전 미리보기/수정)
  const saveLeadershipInfo = useLeadershipInfoStore(s => s.updateInfo);
  const [extractedInfo, setExtractedInfo] = useState<LeadershipInfo[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [reportFileName, setReportFileName] = useState('');

  // 기업 로고 업로드 (선택) — 없으면 이니셜 아바타
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    try {
      setLogoDataUrl(await resizeImageToDataUrl(file, 256));
    } catch {
      // 실패 시 이니셜 유지
    }
  }

  async function handleReportExtract(file: File) {
    setExtracting(true);
    setExtractError(null);
    setReportFileName(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/leadership-info/extract', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '분석 실패');
      const info = (data.info ?? []) as LeadershipInfo[];
      if (info.length === 0) {
        setExtractError('보고서에서 리더십 유형을 찾지 못했습니다. 형식을 확인하거나 직접 입력해 주세요.');
      }
      setExtractedInfo(info);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.');
    } finally {
      setExtracting(false);
    }
  }
  function updateExtracted(idx: number, field: 'characteristics' | 'developmentPoints', value: string) {
    setExtractedInfo(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }
  function removeExtracted(idx: number) {
    setExtractedInfo(prev => prev.filter((_, i) => i !== idx));
  }

  // 직책자 유형 드롭다운 옵션: 업로드 파일에서 추출한 유형(워딩 그대로) 우선, 없으면 표준 목록
  const typeOptions = extractedInfo.length > 0
    ? Array.from(new Set(extractedInfo.map(i => i.type).filter(Boolean)))
    : LEADERSHIP_TYPES;

  const [draftParticipants, setDraftParticipants] = useState<DraftParticipant[]>([]);
  const [showAddRow, setShowAddRow] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addForm, setAddForm] = useState<DraftParticipant>({
    name: '', department: '', position: '', email: '', leadershipType: '불명확형',
  });
  const participantFileRef = useRef<HTMLInputElement>(null);

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const created = await addCompany({
      name: form.name,
      industry: form.industry,
      participantCount: Number(form.participantCount),
      status: form.status as CoachingStatus,
      hrName: form.hrName,
      hrEmail: form.hrEmail,
      startDate: form.startDate,
      endDate: form.endDate,
      note: form.note,
      logoUrl: logoDataUrl,
    });
    if (!created) {
      setSubmitting(false);
      alert('기업 생성에 실패했습니다. 다시 시도해주세요.');
      return;
    }
    if (draftParticipants.length > 0) {
      await addParticipants(draftParticipants.map(p => ({
        ...p,
        companyId: created.id,
        year: currentYear,
        assessmentRound: 1,
        deliveryStatus: '미발송' as const,
        lastOpenedAt: null,
        stepCurrent: 0,
        stepTotal: 6,
      })));
    }
    // 다면진단 보고서에서 추출한 리더십 유형 정보 저장 (이 기업 뉴스레터 맞춤용)
    if (extractedInfo.length > 0) {
      await saveLeadershipInfo(created.id, currentYear, extractedInfo, reportFileName || '다면진단 보고서');
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

  async function downloadTemplate() {
    const { utils, writeFile } = await import('xlsx');
    const ws = utils.aoa_to_sheet([
      ['이름', '부서', '직책', '이메일', '리더십유형'],
      ['홍길동', '인사팀', '부장', 'hong@example.com', '독재형'],
    ]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, '직책자');
    writeFile(wb, '직책자_업로드_템플릿.xlsx');
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
    const parsed: DraftParticipant[] = rows
      .filter(r => r['이름']?.trim())
      .map(r => ({
        name: r['이름']?.trim() ?? '',
        department: r['부서']?.trim() ?? '',
        position: r['직책']?.trim() ?? '',
        email: r['이메일']?.trim() ?? '',
        // 파일에 적힌 리더십 유형 워딩을 그대로 저장 (표준 목록 강제 없음)
        leadershipType: (r['리더십유형']?.trim() || '미지정') as LeadershipType,
      }));
    if (parsed.length > 0) setDraftParticipants(prev => [...prev, ...parsed]);
  }

  const initials = getInitials(form.name);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 상단 토퍼 */}
      <div className="bg-white border-b border-gray-200 px-8 h-[65px] flex items-center justify-between">
        <div className="flex items-center gap-2 text-[17px] text-gray-900 font-semibold">
          <span className="font-bold">기업 추가</span>
        </div>
        <Link href="/admin/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ✕ 취소
        </Link>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">

          {/* 미리보기 아바타 — 클릭하면 로고 이미지 첨부(선택) */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              title="클릭해서 로고 첨부"
              className="relative w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0 group"
              style={{ backgroundColor: logoDataUrl ? '#fff' : '#55A4DA' }}
            >
              {logoDataUrl
                ? <img src={logoDataUrl} alt="기업 로고" className="w-full h-full object-cover" />
                : <span className="text-white text-lg font-bold">{initials || '?'}</span>}
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
            <div>
              <p className="text-base font-bold text-gray-800">{form.name || '기업명을 입력하세요'}</p>
              <p className="text-sm text-gray-400">{form.industry || '산업군 미선택'}</p>
              {logoDataUrl
                ? <button type="button" onClick={() => setLogoDataUrl(null)} className="text-xs text-gray-400 hover:text-red-400 mt-1">로고 제거</button>
                : <p className="text-xs text-gray-300 mt-1">로고를 클릭해 이미지 첨부 (선택)</p>}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* 기본 정보 */}
          <section>
            <h2 className="text-sm tracking-[0.15em] text-gray-600 font-semibold mb-4">기본 정보</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">기업명 <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="예) J&Company"
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
            <h2 className="text-sm tracking-[0.15em] text-gray-600 font-semibold mb-4">코칭 기간</h2>
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
            <h2 className="text-sm tracking-[0.15em] text-gray-600 font-semibold mb-4">리더십 유형 정보</h2>
            <label className="block w-full border-2 border-dashed border-gray-200 rounded-lg px-6 py-8 cursor-pointer hover:border-[#55A4DA] hover:bg-[#55A4DA]/5 transition-colors group">
              <input
                type="file"
                accept=".pdf,.docx,.txt,.xlsx,.csv"
                multiple
                className="hidden"
                onChange={e => {
                  const picked = Array.from(e.target.files ?? []);
                  setFiles(prev => [...prev, ...picked]);
                  if (picked[0]) void handleReportExtract(picked[0]);
                }}
              />
              <div className="flex flex-col items-center gap-2 text-center">
                <svg className="w-8 h-8 text-gray-300 group-hover:text-[#55A4DA] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-medium text-gray-500 group-hover:text-[#55A4DA]">파일을 드래그하거나 클릭해서 업로드</p>
                <p className="text-xs text-gray-400">PDF, DOCX, TXT, Excel, CSV 지원 · 최대 50MB</p>
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
                      <span className="text-xs text-gray-400 flex-shrink-0">{fmtFileSize(file.size)}</span>
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

            {/* AI 추출 결과 — 제출 전 미리보기/수정 */}
            {extracting && (
              <div className="mt-4 flex items-center gap-2 text-sm text-[#2E7DB5]">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                보고서에서 리더십 유형을 분석하고 있어요...
              </div>
            )}
            {extractError && !extracting && (
              <p className="mt-4 text-sm text-amber-600">{extractError}</p>
            )}
            {extractedInfo.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-800">추출된 리더십 유형 <span className="text-[#55A4DA]">{extractedInfo.length}</span>개 <span className="text-xs font-normal text-gray-400">· 저장 전 수정할 수 있어요</span></p>
                </div>
                <div className="space-y-3">
                  {extractedInfo.map((it, idx) => (
                    <div key={idx} className="rounded-xl border border-[#E1EFFB] p-4" style={{ backgroundColor: '#F8FBFE' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#EAF4FC] text-[#2E7DB5]">{it.type}</span>
                        <button type="button" onClick={() => removeExtracted(idx)} className="text-xs text-gray-400 hover:text-red-400">제외</button>
                      </div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">특징</label>
                      <textarea
                        value={it.characteristics}
                        onChange={e => updateExtracted(idx, 'characteristics', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y focus:border-[#55A4DA] focus:outline-none focus:ring-1 focus:ring-[#55A4DA]/30 mb-2"
                      />
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">개발 포인트</label>
                      <textarea
                        value={it.developmentPoints ?? ''}
                        onChange={e => updateExtracted(idx, 'developmentPoints', e.target.value)}
                        rows={2}
                        placeholder="개발 포인트(선택)"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y focus:border-[#55A4DA] focus:outline-none focus:ring-1 focus:ring-[#55A4DA]/30"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">이 정보는 기업 생성 시 저장되고, 이 기업 뉴스레터 제작 시 주제·본문에 반영됩니다.</p>
              </div>
            )}
          </section>

          {/* 직책자 */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm tracking-[0.15em] text-gray-600 font-semibold">
                직책자
                {draftParticipants.length > 0 && (
                  <span className="ml-2 text-[#55A4DA]">{draftParticipants.length}명</span>
                )}
              </h2>

              {/* 템플릿 다운로드 + 직책자 추가 버튼 */}
              <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 px-3.5 py-1.5 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                템플릿 다운로드
              </button>
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
                    <span className={`inline-flex w-fit text-xs font-semibold px-2.5 py-0.5 rounded-full ${leadershipColor[p.leadershipType] ?? 'bg-gray-100 text-gray-600'}`}>
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
                      {typeOptions.map(t => <option key={t}>{t}</option>)}
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
            <h2 className="text-sm tracking-[0.15em] text-gray-600 font-semibold mb-4">HR 담당자</h2>
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
            <h2 className="text-sm tracking-[0.15em] text-gray-600 font-semibold mb-4">비고</h2>
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
