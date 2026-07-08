'use client';

import type { LeadershipInfo } from '@/store/leadershipInfoStore';

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-[#55A4DA] focus:outline-none focus:ring-1 focus:ring-[#55A4DA]/30 transition';
const areaCls = inputCls + ' resize-y leading-relaxed';

export function emptyLeadershipInfoRow(): LeadershipInfo {
  return { type: '', definition: '', characteristics: '', developmentPoints: '' };
}

// 다면진단 보고서 AI 추출과 동일한 형식(type/definition/characteristics/developmentPoints)을
// 파일 업로드 없이 직접 입력·편집하는 행 기반 폼. 저장 방식은 부모(신규/수정 페이지)마다 달라
// controlled(rows/onChange)로만 편집을 담당하고, 저장 API 호출은 부모가 처리한다.
export function LeadershipInfoManualForm({
  rows,
  onChange,
}: {
  rows: LeadershipInfo[];
  onChange: (rows: LeadershipInfo[]) => void;
}) {
  function updateRow(idx: number, field: keyof LeadershipInfo, value: string) {
    onChange(rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }
  function addRow() {
    onChange([...rows, emptyLeadershipInfoRow()]);
  }
  function removeRow(idx: number) {
    onChange(rows.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => (
        <div key={idx} className="relative rounded-xl border border-gray-200 p-4 space-y-2.5 bg-gray-50/50">
          <button
            type="button"
            onClick={() => removeRow(idx)}
            className="absolute top-3 right-3 text-gray-300 hover:text-red-400 transition-colors"
            title="이 유형 삭제"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="grid grid-cols-2 gap-3 pr-7">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">유형명</label>
              <input
                type="text"
                value={row.type}
                onChange={e => updateRow(idx, 'type', e.target.value)}
                placeholder="예: 독재형"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">정의 (한 줄)</label>
              <input
                type="text"
                value={row.definition}
                onChange={e => updateRow(idx, 'definition', e.target.value)}
                placeholder="예: 일방적 지시와 통제 중심의 리더십"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">특성</label>
            <textarea
              rows={2}
              value={row.characteristics}
              onChange={e => updateRow(idx, 'characteristics', e.target.value)}
              placeholder="이 유형의 행동 특성을 구체적으로 적어주세요"
              className={areaCls}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">개발 포인트 (선택)</label>
            <textarea
              rows={2}
              value={row.developmentPoints ?? ''}
              onChange={e => updateRow(idx, 'developmentPoints', e.target.value)}
              placeholder="코칭 방향을 적어주세요"
              className={areaCls}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-[#55A4DA] hover:text-[#55A4DA] transition-colors"
      >
        + 유형 추가
      </button>
    </div>
  );
}
