'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useCompanyStore, type CoachingStatus } from '@/store/companyStore';
import { useParticipantStore, type LeadershipType, type Participant } from '@/store/participantStore';
import { useLeadershipInfoStore, DEFAULT_INFO, type LeadershipInfo, type LeadershipInfoVersion } from '@/store/leadershipInfoStore';
import { useDiagnosisHistoryStore } from '@/store/diagnosisHistoryStore';

const LEADERSHIP_TYPES: LeadershipType[] = ['독재형', '방관형', '성과압박형', '불통형', '불명확형', '감정기복형'];
const EMPTY_HISTORY: LeadershipInfoVersion[] = [];
const COACHING_STATUSES: CoachingStatus[] = ['진행 중', '진행 완료', '진행 전'];

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

type EditingParticipant = Omit<Participant, 'id' | 'deliveryStatus' | 'lastOpenedAt' | 'stepCurrent' | 'stepTotal'>;

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

export default function CompanyEditPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = Number(params.companyId);

  // ── 스토어 ──
  const company = useCompanyStore(s => s.companies.find(c => c.id === companyId));
  const updateCompany = useCompanyStore(s => s.updateCompany);
  const deleteCompany = useCompanyStore(s => s.deleteCompany);

  const rawParticipants = useParticipantStore(s => s.participants);
  const allParticipants = useMemo(
    () => rawParticipants.filter(p => p.companyId === companyId),
    [rawParticipants, companyId],
  );
  const years = useMemo(
    () => [...new Set(allParticipants.map(p => p.year))].sort((a, b) => b - a),
    [allParticipants],
  );
  const updateParticipant = useParticipantStore(s => s.updateParticipant);
  const recordDiagnosis = useDiagnosisHistoryStore(s => s.record);
  const removeParticipant = useParticipantStore(s => s.removeParticipant);
  const addParticipants = useParticipantStore(s => s.addParticipants);

  // ── 연도별 직책자 ──
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(years[0] ?? currentYear);

  // ── 리더십 유형 정보 연도 (독립 탭) ──
  const [infoYear, setInfoYear] = useState<number>(years[0] ?? currentYear);

  const updateInfo = useLeadershipInfoStore(s => s.updateInfo);
  const loadLeadershipInfo = useLeadershipInfoStore(s => s.loadForCompany);
  const leadershipCurrent = useLeadershipInfoStore(s => s.current[`${companyId}-${infoYear}`] ?? DEFAULT_INFO);
  // 직책자 유형 드롭다운 옵션: 이 기업 리더십 카탈로그(파일 워딩) 기준, 없으면 표준 목록
  const typeOptions = leadershipCurrent.length > 0
    ? Array.from(new Set(leadershipCurrent.map(i => i.type).filter(Boolean)))
    : LEADERSHIP_TYPES;
  const leadershipHistory = useLeadershipInfoStore(s => s.history[`${companyId}-${infoYear}`] ?? EMPTY_HISTORY);
  useEffect(() => { void loadLeadershipInfo(companyId, infoYear); }, [companyId, infoYear, loadLeadershipInfo]);

  // ── 기업 정보 폼 ──
  const [companyForm, setCompanyForm] = useState({
    name: company?.name ?? '',
    industry: company?.industry ?? '',
    status: company?.status ?? '진행 전' as CoachingStatus,
    hrName: company?.hrName ?? '',
    hrEmail: company?.hrEmail ?? '',
    startDate: company?.startDate ?? '',
    endDate: company?.endDate ?? '',
    note: company?.note ?? '',
  });

  // ── 기업 로고 (선택) ──
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(company?.logoUrl ?? null);
  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    try { setLogoDataUrl(await resizeImageToDataUrl(file, 256)); } catch { /* 실패 시 유지 */ }
  }

  // ── 리더십 유형 정보 ──
  const [historyOpen, setHistoryOpen] = useState(false);
  const [uploadToast, setUploadToast] = useState<{ name: string } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 기업 삭제 ──
  const DELETE_PHRASE = '삭제하겠습니다';
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const participants = useMemo(
    () => allParticipants.filter(p => p.year === selectedYear),
    [allParticipants, selectedYear],
  );

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditingParticipant | null>(null);
  const [showAddRow, setShowAddRow] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const participantFileRef = useRef<HTMLInputElement>(null);
  const [addForm, setAddForm] = useState<EditingParticipant>({
    companyId, year: selectedYear, name: '', department: '', position: '',
    email: '', leadershipType: '불명확형', assessmentRound: 1,
  });

  if (!company) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">존재하지 않는 기업입니다.</div>;
  }

  // ── 핸들러: 기업 정보 ──
  async function saveCompany() {
    await updateCompany(companyId, { ...companyForm, logoUrl: logoDataUrl });
    router.push(`/admin/companies/${companyId}/participants`);
  }

  // ── 핸들러: 기업 삭제 (확인 문구 일치 시에만) ──
  function openDeleteModal() {
    setDeleteConfirmText('');
    setDeleteOpen(true);
  }
  async function handleDeleteCompany() {
    if (deleteConfirmText.trim() !== DELETE_PHRASE) return;
    setDeleting(true);
    const ok = await deleteCompany(companyId);
    setDeleting(false);
    if (ok) {
      router.push('/admin/companies');
    } else {
      alert('기업 삭제에 실패했습니다. 다시 시도해주세요.');
    }
  }

  // ── 핸들러: 리더십 파일 업로드 ──
  // 다면진단 보고서(pdf/docx/txt/xlsx/csv)를 실제로 파싱해 리더십 유형 정보를 추출한다.
  // 기업 추가 화면과 동일한 서버 파싱 API를 사용한다. (.json은 구조화된 수동 입력 포맷으로 직접 파싱)
  async function handleLeadershipFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setExtractError(null);

    // 수동 입력용 JSON은 그대로 사용
    if (file.name.toLowerCase().endsWith('.json')) {
      try {
        const parsed = JSON.parse(await file.text()) as LeadershipInfo[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          await updateInfo(companyId, infoYear, parsed, file.name);
          setUploadToast({ name: file.name });
          setTimeout(() => setUploadToast(null), 3000);
        } else {
          setExtractError('JSON에서 리더십 유형을 찾지 못했습니다.');
        }
      } catch {
        setExtractError('JSON 형식이 올바르지 않습니다.');
      }
      return;
    }

    // 다면진단 보고서 → 서버에서 텍스트 추출 + AI 유형 분석
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/leadership-info/extract', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setExtractError(data.error ?? '보고서 분석 중 오류가 발생했습니다.');
        return;
      }
      const info = (data.info ?? []) as LeadershipInfo[];
      if (info.length === 0) {
        setExtractError('보고서에서 리더십 유형을 찾지 못했습니다. 형식을 확인하거나 직접 입력해 주세요.');
        return;
      }
      await updateInfo(companyId, infoYear, info, file.name);
      setUploadToast({ name: file.name });
      setTimeout(() => setUploadToast(null), 3000);
    } catch {
      setExtractError('보고서 분석 중 오류가 발생했습니다.');
    } finally {
      setExtracting(false);
    }
  }

  // ── 핸들러: 직책자 편집 ──
  function startEdit(p: Participant) {
    setEditingId(p.id);
    setEditForm({ companyId: p.companyId, year: p.year, name: p.name, department: p.department, position: p.position, email: p.email, leadershipType: p.leadershipType, assessmentRound: p.assessmentRound });
  }
  function saveEdit() {
    if (editingId == null || !editForm) return;
    const prev = allParticipants.find(p => p.id === editingId);
    if (prev && prev.leadershipType !== editForm.leadershipType) {
      // 변경 전 유형을 히스토리에 기록
      recordDiagnosis(editingId, prev.leadershipType, prev.year);
    }
    updateParticipant(editingId, editForm);
    setEditingId(null); setEditForm(null);
  }
  function cancelEdit() { setEditingId(null); setEditForm(null); }

  // 추가 행 열기 — 리더십 유형 기본값을 이 기업 카탈로그(파일 워딩) 첫 유형으로 세팅
  function openAddRow() {
    setAddForm({ companyId, year: selectedYear, name: '', department: '', position: '', email: '', leadershipType: (typeOptions[0] ?? '미지정') as LeadershipType, assessmentRound: 1 });
    setShowAddRow(true);
  }

  function saveAddRow() {
    if (!addForm.name.trim()) return;
    addParticipants([{ ...addForm, year: selectedYear, companyId, deliveryStatus: '미발송', lastOpenedAt: null, stepCurrent: 0, stepTotal: 6 }]);
    setAddForm({ companyId, year: selectedYear, name: '', department: '', position: '', email: '', leadershipType: (typeOptions[0] ?? '미지정') as LeadershipType, assessmentRound: 1 });
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
    const parsed = rows
      .filter(r => r['이름']?.trim())
      .map(r => ({
        companyId, year: selectedYear,
        name: r['이름']?.trim() ?? '',
        department: r['부서']?.trim() ?? '',
        position: r['직책']?.trim() ?? '',
        email: r['이메일']?.trim() ?? '',
        // 파일에 적힌 리더십 유형 워딩을 그대로 저장 (표준 목록 강제 없음)
        leadershipType: (r['리더십유형']?.trim() || '미지정') as LeadershipType,
        assessmentRound: 1,
        deliveryStatus: '미발송' as const,
        lastOpenedAt: null,
        stepCurrent: 0,
        stepTotal: 6,
      }));
    if (parsed.length > 0) addParticipants(parsed);
  }

  function handleAddYear() {
    const prev = years.length > 0 ? Math.max(...years) : currentYear - 1;
    const next = prev + 1;
    if (years.includes(next)) return;

    // 이전 연도 직책자를 새 연도로 복사
    const prevParticipants = allParticipants.filter(p => p.year === prev);
    if (prevParticipants.length > 0) {
      addParticipants(prevParticipants.map(({ id: _id, ...rest }) => ({
        ...rest,
        year: next,
        deliveryStatus: '미발송',
        lastOpenedAt: null,
        stepCurrent: 0,
        stepTotal: 6,
      })));
    }

    setSelectedYear(next);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 토스트 */}
      {uploadToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-medium bg-gray-900 text-white">
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {`"${uploadToast.name}" 업로드 완료`}
        </div>
      )}

      {/* 상단 토퍼 */}
      <div className="bg-white border-b border-gray-200 px-8 h-[65px] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-[17px] text-gray-900 font-semibold">
          <span className="font-bold">기업 정보 편집</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="text-sm font-medium text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">취소</button>
          <button onClick={saveCompany} className="text-sm font-medium text-white bg-[#55A4DA] hover:bg-[#3A8BC4] px-4 py-2 rounded-lg transition-colors">저장</button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-8 py-6 bg-gray-50 space-y-5">

        {/* ── 1. 기업 기본 정보 ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-800 mb-5">기업 기본 정보</h2>
          {/* 기업 로고 — 클릭해서 변경 (없으면 이니셜) */}
          <div className="flex items-center gap-4 mb-5">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              title="클릭해서 로고 변경"
              className="relative w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0 group"
              style={{ backgroundColor: logoDataUrl ? '#fff' : '#55A4DA' }}
            >
              {logoDataUrl
                ? <img src={logoDataUrl} alt="기업 로고" className="w-full h-full object-cover" />
                : <span className="text-white text-lg font-bold">{(companyForm.name || company.name).slice(0, 2).toUpperCase()}</span>}
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
            <div>
              <p className="text-sm font-semibold text-gray-700">기업 로고</p>
              {logoDataUrl
                ? <button type="button" onClick={() => setLogoDataUrl(null)} className="text-xs text-gray-400 hover:text-red-400 mt-0.5">로고 제거</button>
                : <p className="text-xs text-gray-400 mt-0.5">클릭해 이미지 첨부 (선택 · 없으면 이니셜)</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <Field label="기업명"><input value={companyForm.name} onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))} className={inputCls} /></Field>
            <Field label="산업군"><input value={companyForm.industry} onChange={e => setCompanyForm(f => ({ ...f, industry: e.target.value }))} className={inputCls} /></Field>
            <Field label="코칭 상태">
              <select value={companyForm.status} onChange={e => setCompanyForm(f => ({ ...f, status: e.target.value as CoachingStatus }))} className={inputCls}>
                {COACHING_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="HR 담당자"><input value={companyForm.hrName} onChange={e => setCompanyForm(f => ({ ...f, hrName: e.target.value }))} placeholder="담당자 이름" className={inputCls} /></Field>
            <Field label="HR 이메일"><input type="email" value={companyForm.hrEmail} onChange={e => setCompanyForm(f => ({ ...f, hrEmail: e.target.value }))} placeholder="hr@company.com" className={inputCls} /></Field>
            <Field label="팔로업 시작일"><input type="date" value={companyForm.startDate} onChange={e => setCompanyForm(f => ({ ...f, startDate: e.target.value }))} className={inputCls} /></Field>
            <Field label="코칭 종료일"><input type="date" value={companyForm.endDate} onChange={e => setCompanyForm(f => ({ ...f, endDate: e.target.value }))} className={inputCls} /></Field>
            <Field label="메모" className="col-span-2">
              <textarea value={companyForm.note} onChange={e => setCompanyForm(f => ({ ...f, note: e.target.value }))} rows={2} className={inputCls + ' resize-none'} />
            </Field>
          </div>
        </div>

        {/* ── 2. 리더십 유형 정보 ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800">리더십 유형 정보</h2>
              <p className="text-xs text-gray-400 mt-0.5">연도별 다면진단 유형 정의 및 특징</p>
            </div>
            <div className="flex items-center gap-2">
              {leadershipHistory.length > 0 && (
                <button
                  onClick={() => setHistoryOpen(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  히스토리 {leadershipHistory.length}건
                </button>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.xlsx,.csv,.json" className="hidden" onChange={handleLeadershipFile} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#55A4DA] hover:bg-[#3A8BC4] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {extracting ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}
                {extracting ? '분석 중…' : `${infoYear}년 업로드`}
              </button>
            </div>
          </div>

          {/* 연도 탭 */}
          <div className="flex items-center gap-1.5 mb-4">
            {(years.length > 0 ? years : [currentYear]).map(y => (
              <button
                key={y}
                onClick={() => { setInfoYear(y); setHistoryOpen(false); }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  y === infoYear ? 'bg-[#55A4DA] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {y}년
              </button>
            ))}
          </div>

          {extractError && !extracting && (
            <p className="mb-4 text-xs text-amber-600">{extractError}</p>
          )}

          {/* 리더십 유형 카드 */}
          <div className="grid grid-cols-2 gap-3">
            {leadershipCurrent.map(info => (
              <div key={info.type} className="rounded-xl border border-gray-100 p-4 bg-gray-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${leadershipColor[info.type] ?? 'bg-gray-100 text-gray-600'}`}>{info.type}</span>
                </div>
                <p className="text-xs font-semibold text-gray-700 mb-1">{info.definition}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{info.characteristics}</p>
              </div>
            ))}
          </div>

          {/* 히스토리 */}
          {historyOpen && leadershipHistory.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 mb-3">{infoYear}년 업로드 히스토리</p>
              <div className="space-y-2">
                {leadershipHistory.map(v => (
                  <div key={v.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{v.fileName}</p>
                        <p className="text-xs text-gray-400">{v.uploadedAt}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => updateInfo(companyId, infoYear, v.info, `[복원] ${v.fileName}`)}
                      className="text-xs font-medium text-[#55A4DA] hover:underline"
                    >
                      이 버전으로 복원
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 3. 연도별 직책자 관리 ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            {/* 왼쪽: 제목 + 연도 탭 */}
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-gray-800">연도별 직책자 관리</h2>
              <div className="flex items-center gap-1.5">
                {years.map(y => (
                  <button
                    key={y}
                    onClick={() => { setSelectedYear(y); setShowAddRow(false); cancelEdit(); setHistoryOpen(false); }}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      y === selectedYear ? 'bg-[#55A4DA] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {y}년
                  </button>
                ))}
                <button
                  onClick={() => { setShowAddRow(false); cancelEdit(); handleAddYear(); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-400 border border-dashed border-gray-300 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  연도 추가
                </button>
              </div>
            </div>

            {/* 오른쪽: 템플릿 다운로드 + 직책자 추가 버튼 */}
            <div className="flex items-center gap-2">
              <button
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
                onClick={() => setAddMenuOpen(v => !v)}
                className="flex items-center gap-2 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-sm font-semibold px-3.5 py-1.5 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                직책자 추가
                <svg className={`w-3.5 h-3.5 transition-transform ${addMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {addMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden p-1.5">
                    <button
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
                      onClick={() => { setAddMenuOpen(false); openAddRow(); cancelEdit(); }}
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
            <div className="grid grid-cols-[2fr_1.2fr_1fr_2fr_1.4fr_0.8fr_88px] px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              {['이름', '부서', '직책', '이메일', '리더십 유형', '발송 회차', ''].map(h => (
                <p key={h} className="text-xs font-semibold text-gray-400 tracking-wider uppercase">{h}</p>
              ))}
            </div>

            <div className="divide-y divide-gray-100">
              {participants.length === 0 && !showAddRow && (
                <div className="flex items-center justify-center h-20 text-sm text-gray-400">
                  {selectedYear}년 직책자가 없습니다.
                </div>
              )}

              {participants.map(p =>
                editingId === p.id && editForm ? (
                  <div key={p.id} className="grid grid-cols-[2fr_1.2fr_1fr_2fr_1.4fr_0.8fr_88px] px-4 py-2.5 items-center bg-blue-50/40 gap-2">
                    <input value={editForm.name} onChange={e => setEditForm(f => f && ({ ...f, name: e.target.value }))} className={rowInputCls} />
                    <input value={editForm.department} onChange={e => setEditForm(f => f && ({ ...f, department: e.target.value }))} className={rowInputCls} />
                    <input value={editForm.position} onChange={e => setEditForm(f => f && ({ ...f, position: e.target.value }))} className={rowInputCls} />
                    <input value={editForm.email} onChange={e => setEditForm(f => f && ({ ...f, email: e.target.value }))} className={rowInputCls} />
                    <select value={editForm.leadershipType} onChange={e => setEditForm(f => f && ({ ...f, leadershipType: e.target.value as LeadershipType }))} className={rowInputCls}>
                      {typeOptions.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <input type="number" min={1} max={9} value={editForm.assessmentRound} onChange={e => setEditForm(f => f && ({ ...f, assessmentRound: Number(e.target.value) }))} className={rowInputCls} />
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={saveEdit} className="text-xs font-semibold text-[#55A4DA] px-2 py-1 rounded hover:bg-blue-100 transition-colors">저장</button>
                      <button onClick={cancelEdit} className="text-xs text-gray-400 px-2 py-1 rounded hover:bg-gray-100 transition-colors">취소</button>
                    </div>
                  </div>
                ) : (
                  <div key={p.id} className="grid grid-cols-[2fr_1.2fr_1fr_2fr_1.4fr_0.8fr_88px] px-4 py-3 items-center hover:bg-gray-50 transition-colors group">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-sm text-gray-500 truncate">{p.department}</p>
                    <p className="text-sm text-gray-500">{p.position}</p>
                    <p className="text-xs text-gray-400 truncate">{p.email}</p>
                    <span className={`inline-flex w-fit text-xs font-semibold px-2.5 py-0.5 rounded-full ${leadershipColor[p.leadershipType] ?? 'bg-gray-100 text-gray-600'}`}>{p.leadershipType}</span>
                    <p className="text-sm text-gray-500">{p.assessmentRound}회차</p>
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(p)} className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-200 transition-colors">편집</button>
                      <button onClick={() => removeParticipant(p.id)} className="text-xs text-red-400 px-2 py-1 rounded hover:bg-red-50 transition-colors">삭제</button>
                    </div>
                  </div>
                )
              )}

              {showAddRow && (
                <div className="grid grid-cols-[2fr_1.2fr_1fr_2fr_1.4fr_0.8fr_88px] px-4 py-2.5 items-center bg-emerald-50/40 gap-2">
                  <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="이름" className={rowInputCls} />
                  <input value={addForm.department} onChange={e => setAddForm(f => ({ ...f, department: e.target.value }))} placeholder="부서" className={rowInputCls} />
                  <input value={addForm.position} onChange={e => setAddForm(f => ({ ...f, position: e.target.value }))} placeholder="직책" className={rowInputCls} />
                  <input value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="이메일" className={rowInputCls} />
                  <select value={addForm.leadershipType} onChange={e => setAddForm(f => ({ ...f, leadershipType: e.target.value as LeadershipType }))} className={rowInputCls}>
                    {typeOptions.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <input type="number" min={1} max={9} value={addForm.assessmentRound} onChange={e => setAddForm(f => ({ ...f, assessmentRound: Number(e.target.value) }))} className={rowInputCls} />
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={saveAddRow} className="text-xs font-semibold text-emerald-600 px-2 py-1 rounded hover:bg-emerald-100 transition-colors">추가</button>
                    <button onClick={() => setShowAddRow(false)} className="text-xs text-gray-400 px-2 py-1 rounded hover:bg-gray-100 transition-colors">취소</button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── 위험 구역: 기업 삭제 ── */}
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 max-w-md mx-auto">
          <div className="flex flex-col items-center text-center gap-3">
            <div>
              <h2 className="text-sm font-bold text-red-600">기업 삭제</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                이 기업의 직책자·뉴스레터·리더십 정보가 모두 영구 삭제됩니다. 되돌릴 수 없습니다.
              </p>
            </div>
            <button
              onClick={openDeleteModal}
              className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors"
            >
              기업 삭제
            </button>
          </div>
        </div>

      </div>

      {/* ── 삭제 확인 모달 ── */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-base font-bold text-gray-900">정말 삭제하시겠어요?</h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              <span className="font-semibold text-gray-800">{company.name}</span> 기업과 소속 직책자·뉴스레터·리더십 정보가
              모두 <span className="font-semibold text-red-600">영구 삭제</span>됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <p className="text-xs text-gray-500 mt-4 mb-2">
              계속하려면 아래 입력란에 <span className="font-semibold text-red-600">{DELETE_PHRASE}</span> 를 입력하세요.
            </p>
            <input
              autoFocus
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={DELETE_PHRASE}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20 transition-all"
            />
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="text-sm font-medium text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                취소
              </button>
              <button
                onClick={handleDeleteCompany}
                disabled={deleting || deleteConfirmText.trim() !== DELETE_PHRASE}
                className="text-sm font-semibold text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/20 transition-all';
const rowInputCls = 'w-full text-xs text-gray-700 border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-[#55A4DA] transition-all';

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
