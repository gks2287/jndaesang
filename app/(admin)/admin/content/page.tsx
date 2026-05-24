'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  getContentList,
  addContent,
  updateContent,
  deleteContent,
  type ContentPoolItem,
  type ContentSource,
  type ContentCategory,
} from '@/lib/api/contentPool';

// ── 상수 ─────────────────────────────────────────────────────────
const SOURCES: ContentSource[] = ['original', 'curation'];
const SOURCE_LABELS: Record<ContentSource, string> = { original: 'J& 오리지널', curation: '큐레이션' };
const CATEGORIES: ContentCategory[] = ['아티클', '인터뷰', '책 추천', '성공 사례', '카드뉴스', '웹툰', '영상'];

const CATEGORY_COLOR: Record<ContentCategory, string> = {
  아티클: 'bg-gray-100 text-gray-600',
  인터뷰: 'bg-blue-50 text-blue-600',
  '책 추천': 'bg-amber-50 text-amber-700',
  '성공 사례': 'bg-emerald-50 text-emerald-700',
  카드뉴스: 'bg-purple-50 text-purple-600',
  웹툰: 'bg-pink-50 text-pink-600',
  영상: 'bg-red-50 text-red-600',
};

// ── Form 타입 & 헬퍼 ──────────────────────────────────────────────
type FormData = {
  title: string;
  type: ContentSource;
  category: ContentCategory;
  duration: string;
  author: string;
  tagInput: string;
  tags: string[];
  thumbnail: string;
  body: string;
};

const EMPTY_FORM: FormData = {
  title: '',
  type: 'original',
  category: '아티클',
  duration: '',
  author: '',
  tagInput: '',
  tags: [],
  thumbnail: '',
  body: '',
};

function itemToForm(item: ContentPoolItem): FormData {
  return {
    title: item.title,
    type: item.type,
    category: item.category,
    duration: String(item.duration),
    author: item.author,
    tagInput: '',
    tags: [...item.tags],
    thumbnail: item.thumbnail,
    body: item.body,
  };
}

// ── ContentFormModal ──────────────────────────────────────────────
function ContentFormModal({
  mode,
  initialData,
  sourceType,
  onSave,
  onClose,
}: {
  mode: 'create' | 'edit';
  initialData?: ContentPoolItem;
  sourceType?: ContentSource;
  onSave: (data: Omit<ContentPoolItem, 'id' | 'createdAt'>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormData>(() => {
    if (initialData) return itemToForm(initialData);
    return { ...EMPTY_FORM, type: sourceType ?? 'original' };
  });
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  // TODO: API 키 발급 후 여기에 Claude API 파싱 로직 연결
  // 파일 → base64 변환 후 Claude API에 전달
  // 응답으로 받은 JSON으로 아래 폼 필드 자동 채우기
  function handleFileParse(file: File) {
    setSelectedFile(file);
  }

  // TODO: API 키 발급 후 여기에 Claude API 파싱 로직 연결
  // URL 전달 → Claude API가 내용 요약/파싱
  // 응답으로 받은 JSON으로 아래 폼 필드 자동 채우기
  function handleUrlParse(url: string) {
    setSourceUrl(url);
    patch('author', url);
  }

  const isValid =
    form.title.trim().length > 0 &&
    form.duration !== '' &&
    Number(form.duration) > 0 &&
    form.author.trim().length > 0 &&
    form.body.trim().length > 0;

  function patch<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tag = form.tagInput.trim();
      if (tag) {
        setForm(prev => ({
          ...prev,
          tags: prev.tags.includes(tag) ? prev.tags : [...prev.tags, tag],
          tagInput: '',
        }));
      }
    }
  }

  async function handleSubmit() {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: form.title.trim(),
        type: form.type,
        category: form.category,
        duration: Number(form.duration),
        author: form.author.trim(),
        tags: form.tags,
        thumbnail:
          form.thumbnail.trim() ||
          `https://picsum.photos/seed/${Date.now()}/400/225`,
        body: form.body.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition bg-white';
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1.5';
  const requiredMark = <span className="text-red-400">*</span>;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* 슬라이드 패널 */}
      <div
        className={`relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-800">
              {mode === 'create' ? '콘텐츠 등록' : '콘텐츠 수정'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">* 표시 항목은 필수 입력입니다.</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 바디 (스크롤) */}
        <div className="flex-1 overflow-y-auto p-6 pb-8 space-y-5">

          {/* J& 오리지널: 파일 업로드 영역 */}
          {form.type === 'original' && (
            <div className="space-y-2">
              <label className={labelCls}>파일 업로드 <span className="text-gray-300 font-normal">(선택 · docx / pdf / txt)</span></label>
              <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-200 rounded-xl py-5 px-4 cursor-pointer hover:border-[#55A4DA]/50 hover:bg-[#55A4DA]/5 transition-colors group">
                <input
                  type="file"
                  accept=".docx,.pdf,.txt"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleFileParse(file);
                  }}
                />
                {selectedFile ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-medium truncate max-w-xs">{selectedFile.name}</span>
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); setSelectedFile(null); }}
                      className="ml-1 text-gray-400 hover:text-red-400 transition-colors text-base leading-none"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <svg className="w-8 h-8 text-gray-300 group-hover:text-[#55A4DA]/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-xs text-gray-400">클릭하여 파일 선택</span>
                    <span className="text-[11px] text-gray-300">docx · pdf · txt</span>
                  </div>
                )}
              </label>
              {selectedFile && (
                <p className="text-xs text-amber-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  AI 자동 파싱은 준비 중입니다. 아래 필드를 직접 입력해주세요.
                </p>
              )}
            </div>
          )}

          {/* 큐레이션: URL 입력 영역 */}
          {form.type === 'curation' && (
            <div className="space-y-2">
              <label className={labelCls}>원문 URL <span className="text-gray-300 font-normal">(선택)</span></label>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={sourceUrl}
                  onChange={e => handleUrlParse(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <p className="text-xs text-amber-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                AI 자동 파싱은 준비 중입니다. 아래 필드를 직접 입력해주세요.
              </p>
            </div>
          )}

          {/* 구분선 */}
          {(form.type === 'original' || form.type === 'curation') && (
            <div className="border-t border-gray-100" />
          )}

          {/* 제목 */}
          <div>
            <label className={labelCls}>제목 {requiredMark}</label>
            <input
              className={inputCls}
              value={form.title}
              onChange={e => patch('title', e.target.value)}
              placeholder="콘텐츠 제목을 입력하세요"
            />
          </div>

          {/* 타입 */}
          <div>
            <label className={labelCls}>타입 {requiredMark}</label>
            <div className="flex gap-3">
              {SOURCES.map(src => (
                <button
                  key={src}
                  type="button"
                  onClick={() => patch('type', src)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                    form.type === src
                      ? 'border-[#55A4DA] bg-[#55A4DA]/5 text-[#55A4DA]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      form.type === src ? 'border-[#55A4DA] bg-[#55A4DA]' : 'border-gray-300'
                    }`}
                  >
                    {form.type === src && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  {src}
                </button>
              ))}
            </div>
          </div>

          {/* 분류 + 예상 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>분류 {requiredMark}</label>
              <select
                value={form.category}
                onChange={e => patch('category', e.target.value as ContentCategory)}
                className={inputCls}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>예상 시간(분) {requiredMark}</label>
              <input
                type="number"
                min={1}
                max={120}
                className={inputCls}
                value={form.duration}
                onChange={e => patch('duration', e.target.value)}
                placeholder="예: 5"
              />
            </div>
          </div>

          {/* 작성자/출처 */}
          <div>
            <label className={labelCls}>작성자/출처 {requiredMark}</label>
            <input
              className={inputCls}
              value={form.author}
              onChange={e => patch('author', e.target.value)}
              placeholder="예: J&Company 코칭팀"
            />
          </div>

          {/* 태그 (칩 UI) */}
          <div>
            <label className={labelCls}>
              태그 <span className="text-gray-300 font-normal">(선택 · Enter로 추가 · 주제도 태그로 관리)</span>
            </label>
            <div className="w-full border border-gray-200 rounded-xl p-2.5 focus-within:border-[#55A4DA] focus-within:ring-1 focus-within:ring-[#55A4DA]/30 transition bg-white min-h-[44px] flex flex-wrap gap-1.5 items-center">
              {form.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#55A4DA]/10 text-[#55A4DA] text-xs font-semibold rounded-lg"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() =>
                      setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))
                    }
                    className="text-[#55A4DA]/60 hover:text-[#55A4DA] leading-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={form.tagInput}
                onChange={e => patch('tagInput', e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={form.tags.length === 0 ? '태그 입력 후 Enter' : ''}
                className="flex-1 min-w-24 text-sm text-gray-700 placeholder-gray-300 outline-none bg-transparent"
              />
            </div>
          </div>

          {/* 썸네일 URL */}
          <div>
            <label className={labelCls}>
              썸네일 URL <span className="text-gray-300 font-normal">(선택 · 비워두면 자동 생성)</span>
            </label>
            <input
              className={inputCls}
              value={form.thumbnail}
              onChange={e => patch('thumbnail', e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* 본문 */}
          <div>
            <label className={labelCls}>본문 {requiredMark}</label>
            <textarea
              rows={7}
              className={`${inputCls} resize-none`}
              value={form.body}
              onChange={e => patch('body', e.target.value)}
              placeholder="본문 내용을 입력하세요 (마크다운 형식 사용 가능)"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <p className={`text-xs transition-colors ${isValid ? 'invisible' : 'text-amber-500'}`}>
            필수 항목을 모두 입력해주세요.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || saving}
              className={`px-5 py-2 text-sm font-bold rounded-lg transition-colors ${
                isValid && !saving
                  ? 'bg-[#55A4DA] hover:bg-[#3A8BC4] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? '저장 중...' : mode === 'create' ? '등록' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────
function DeleteConfirmModal({
  item,
  onConfirm,
  onClose,
}: {
  item: ContentPoolItem;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">이 콘텐츠를 삭제하시겠습니까?</h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
              <span className="font-semibold text-gray-700">"{item.title}"</span>
              <br />
              삭제 후 복구할 수 없습니다.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm font-bold bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-lg transition-colors"
          >
            {deleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ContentCard ───────────────────────────────────────────────────
function ContentCard({
  item,
  onEdit,
  onDelete,
}: {
  item: ContentPoolItem;
  onEdit: (item: ContentPoolItem) => void;
  onDelete: (item: ContentPoolItem) => void;
}) {
  const visibleTags = item.tags.slice(0, 3);
  const extraTags = item.tags.length - 3;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-[#55A4DA]/40 transition-all overflow-hidden group cursor-pointer"
      onClick={() => onEdit(item)}
    >
      {/* 썸네일 */}
      <div className="relative aspect-video bg-gray-100 overflow-hidden">
        <img
          src={item.thumbnail}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={e => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {/* 분류 뱃지 */}
        <div className="absolute top-2.5 left-2.5">
          <span
            className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-bold shadow-sm ${CATEGORY_COLOR[item.category]}`}
          >
            {item.category}
          </span>
        </div>
        {/* 재생 시간 */}
        <div className="absolute bottom-2.5 right-2.5 bg-black/60 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md">
          {item.duration}분
        </div>
        {/* hover 액션 버튼 */}
        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-2 gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            title="수정"
            className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow text-gray-600 hover:bg-[#55A4DA] hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item); }}
            title="삭제"
            className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow text-gray-600 hover:bg-red-500 hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* 카드 바디 */}
      <div className="p-4 space-y-3">
        <h3 className="text-sm font-bold text-gray-800 leading-snug line-clamp-2 group-hover:text-[#2E7DB5] transition-colors">
          {item.title}
        </h3>
        <p className="text-xs text-gray-400 truncate">{item.author}</p>
        <div className="flex flex-wrap gap-1">
          {visibleTags.map(tag => (
            <span
              key={tag}
              className="text-[10px] bg-gray-50 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded"
            >
              #{tag}
            </span>
          ))}
          {extraTags > 0 && (
            <span className="text-[10px] text-gray-400 px-1.5 py-0.5">+{extraTags}</span>
          )}
        </div>
        <div className="pt-1 border-t border-gray-100">
          <span className="text-[11px] text-gray-400">{item.createdAt}</span>
        </div>
      </div>
    </div>
  );
}

// ── ContentPage (메인) ────────────────────────────────────────────
export default function ContentPage() {
  const [allItems, setAllItems] = useState<ContentPoolItem[]>([]);
  const [activeTab, setActiveTab] = useState<ContentSource>('original');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ContentCategory | ''>('');
  const [formModal, setFormModal] = useState<{
    mode: 'create' | 'edit';
    data?: ContentPoolItem;
    sourceType?: ContentSource;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentPoolItem | null>(null);

  const refresh = () => getContentList().then(setAllItems);

  useEffect(() => {
    void refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countByType = useMemo(
    () => ({
      original: allItems.filter(i => i.type === 'original').length,
      curation: allItems.filter(i => i.type === 'curation').length,
    }),
    [allItems],
  );

  const filtered = useMemo(() => {
    let items = allItems.filter(i => i.type === activeTab);
    if (categoryFilter) items = items.filter(i => i.category === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(
        i =>
          i.title.toLowerCase().includes(q) ||
          i.tags.some(t => t.toLowerCase().includes(q)),
      );
    }
    return items;
  }, [allItems, activeTab, categoryFilter, searchQuery]);

  async function handleSave(data: Omit<ContentPoolItem, 'id' | 'createdAt'>) {
    if (formModal?.mode === 'create') {
      await addContent(data);
      setActiveTab(data.type);
    } else if (formModal?.data) {
      await updateContent(formModal.data.id, data);
    }
    await refresh();
    setFormModal(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteContent(deleteTarget.id);
    await refresh();
    setDeleteTarget(null);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── 상단 토퍼 ── */}
      <div className="bg-white border-b border-gray-200 px-8 py-3.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-[15px] text-gray-400 font-semibold">
          <span>리더십 코칭 관리</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-800 font-bold">콘텐츠 풀</span>
        </div>
        <button
          onClick={() => setFormModal({ mode: 'create', sourceType: activeTab })}
          className="flex items-center gap-2 bg-[#55A4DA] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#3A8BC4] transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          콘텐츠 등록
        </button>
      </div>

      {/* ── 탭 + 필터 ── */}
      <div className="bg-white border-b border-gray-200 px-8 flex-shrink-0">
        {/* 탭 */}
        <div className="flex gap-6 border-b border-gray-100">
          {SOURCES.map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setCategoryFilter('');
                setSearchQuery('');
              }}
              className={`pb-3 pt-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'border-[#55A4DA] text-[#55A4DA]'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {SOURCE_LABELS[tab]}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab
                    ? 'bg-[#55A4DA]/10 text-[#55A4DA]'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {countByType[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* 필터 영역 */}
        <div className="py-3 space-y-2">
          {/* 검색창 */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="제목, 태그 검색..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition bg-white"
            />
          </div>

          {/* 분류 필터 — 가로 스크롤 */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  categoryFilter === cat
                    ? 'bg-[#55A4DA] text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 그리드 ── */}
      <div className="flex-1 overflow-y-auto bg-[#F8FAFC] px-8 py-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400">
            <svg className="w-12 h-12 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium">콘텐츠가 없습니다.</p>
            <p className="text-xs text-gray-300 mt-1">필터 조건을 변경하거나 콘텐츠를 등록하세요.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">
              <span className="font-semibold text-gray-600">{filtered.length}</span>개의 콘텐츠
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(item => (
                <ContentCard
                  key={item.id}
                  item={item}
                  onEdit={item => setFormModal({ mode: 'edit', data: item })}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── 등록/수정 모달 ── */}
      {formModal && (
        <ContentFormModal
          mode={formModal.mode}
          initialData={formModal.data}
          sourceType={formModal.sourceType}
          onSave={handleSave}
          onClose={() => setFormModal(null)}
        />
      )}

      {/* ── 삭제 확인 모달 ── */}
      {deleteTarget && (
        <DeleteConfirmModal
          item={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
