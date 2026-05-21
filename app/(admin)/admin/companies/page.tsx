export default function CompaniesPage() {
  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-gray-400 font-medium mb-0.5">COMPANIES</p>
          <h1 className="text-xl font-bold text-gray-800">고객사 관리</h1>
        </div>
        <button className="flex items-center gap-2 bg-[#55A4DA] hover:bg-[#3A8BC4] text-white text-sm font-semibold px-4 py-2 rounded-sm transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          등록
        </button>
      </div>
      <div className="flex-1 bg-[#D6EAF8] rounded-sm flex items-center justify-center">
        <p className="text-gray-600 text-base font-medium tracking-wide">고객사 목록</p>
      </div>
    </div>
  );
}
