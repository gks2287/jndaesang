'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saveId, setSaveId] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email: userId,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      } else {
        router.push('/admin/dashboard');
      }
    } catch {
      setError('로그인 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      {/* 전체 카드 컨테이너 */}
      <div className="w-full max-w-[960px] bg-white shadow-[0_4px_32px_rgba(85,164,218,0.15)] border border-gray-100 rounded-sm overflow-hidden">

        {/* ── 상단 헤더 (로고 영역) ── */}
        <div className="flex items-center gap-4 px-8 py-5 border-b border-gray-100">
          <Image
            src="/logo.png"
            alt="J&Company"
            width={80}
            height={36}
            className="h-9 w-auto object-contain"
            priority
          />
          <div className="w-px h-8 bg-gray-300" />
          <div>
            <p className="text-[15px] font-bold text-gray-800 leading-tight tracking-wide">
              J&amp; COMPANY
            </p>
            <p className="text-[11px] text-gray-400 tracking-wider mt-0.5">
              리더십 다면진단 후속 코칭 서비스
            </p>
          </div>
        </div>

        {/* ── 메인 2열 레이아웃 ── */}
        <div className="flex min-h-[380px]">

          {/* ── 왼쪽 패널 (파란색) ── */}
          <div className="relative flex-[2] min-w-0 bg-[#55A4DA] flex flex-col justify-between px-6 py-8 overflow-hidden">
            {/* 배경 데코 원 */}
            <div className="absolute -bottom-12 -right-12 w-52 h-52 rounded-full bg-white/10" />
            <div className="absolute -bottom-4 right-16 w-32 h-32 rounded-full bg-white/10" />

            {/* 환영 텍스트 */}
            <div className="relative z-10">
              <p className="text-white/70 text-[11px] tracking-[0.2em] font-medium mb-3">
                LEADERSHIP MANAGEMENT
              </p>
              <h2 className="text-white text-[clamp(1.2rem,2.5vw,2rem)] font-bold leading-snug">
                다면진단 기반<br />맞춤형 리더십 코칭 서비스
              </h2>
            </div>

            {/* 현재 기간 */}
            <div className="relative z-10">
              <p className="text-white text-[1.6rem] font-bold tracking-tight leading-snug">
                {currentDate}
              </p>
              <div className="w-8 h-0.5 bg-white/60 mt-4" />
            </div>
          </div>

          {/* ── 오른쪽 패널 (로그인 폼) ── */}
          <div className="flex-[3] min-w-0 flex flex-col px-10 pt-8 pb-4">
            <p className="text-[11px] tracking-[0.2em] text-gray-400 font-medium mb-2">
              ADMIN LOGIN
            </p>
            <h1 className="text-2xl font-bold text-gray-900 mb-5">
              관리자 로그인
            </h1>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* ID */}
              <div>
                <label className="block text-[11px] font-semibold tracking-widest text-gray-500 mb-2">
                  ID
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="이메일 또는 아이디 입력"
                  required
                  autoComplete="username"
                  className="w-full px-4 py-3 border border-gray-200 rounded-sm text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition bg-white"
                />
              </div>

              {/* PASSWORD */}
              <div>
                <label className="block text-[11px] font-semibold tracking-widest text-gray-500 mb-2">
                  PASSWORD
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 입력"
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-3 border border-gray-200 rounded-sm text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#55A4DA] focus:ring-1 focus:ring-[#55A4DA]/30 transition bg-white pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* 아이디 저장 */}
              <div className="flex items-center gap-2">
                <input
                  id="saveId"
                  type="checkbox"
                  checked={saveId}
                  onChange={(e) => setSaveId(e.target.checked)}
                  className="w-4 h-4 border-gray-300 rounded-sm accent-[#55A4DA] cursor-pointer"
                />
                <label htmlFor="saveId" className="text-sm text-gray-500 cursor-pointer select-none">
                  아이디 저장
                </label>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              {/* 로그인 버튼 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#55A4DA] hover:bg-[#3A8BC4] disabled:opacity-60 text-white font-bold py-3.5 rounded-sm tracking-[0.15em] text-sm transition-colors duration-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    로그인 중...
                  </>
                ) : (
                  'LOGIN'
                )}
              </button>
            </form>

            {/* 접근 권한 문의 구분선 */}
            <div className="flex items-center gap-3 mt-6">
              <div className="flex-1 h-px bg-gray-200" />
              <p className="text-xs text-gray-400 whitespace-nowrap">접근 권한 문의</p>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* 계정 도움말 */}
            <div className="mt-auto pt-4">
              <div className="grid grid-cols-3 gap-3 mb-3">
                {/* 계정 문의 */}
                <button className="flex flex-col items-center gap-1.5 py-4 border border-gray-200 rounded-sm hover:border-[#55A4DA] hover:bg-[#55A4DA]/5 transition group">
                  <svg className="w-5 h-5 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-700 group-hover:text-[#55A4DA]">계정 문의</span>
                  <span className="text-[10px] text-gray-400">Account Help</span>
                </button>

                {/* 비밀번호 재설정 */}
                <button className="flex flex-col items-center gap-1.5 py-4 border border-gray-200 rounded-sm hover:border-[#55A4DA] hover:bg-[#55A4DA]/5 transition group">
                  <svg className="w-5 h-5 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-700 group-hover:text-[#55A4DA]">비밀번호 재설정</span>
                  <span className="text-[10px] text-gray-400">Reset Password</span>
                </button>

                {/* 서비스 안내 */}
                <button className="flex flex-col items-center gap-1.5 py-4 border border-gray-200 rounded-sm hover:border-[#55A4DA] hover:bg-[#55A4DA]/5 transition group">
                  <svg className="w-5 h-5 text-[#55A4DA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-700 group-hover:text-[#55A4DA]">서비스 안내</span>
                  <span className="text-[10px] text-gray-400">Service Guide</span>
                </button>
              </div>
            </div>

            {/* 하단 카피 */}
            <p className="text-center text-xs text-gray-400 mt-auto">
              © 2026 J&amp;Company. 리더십 다면진단 후속 코칭 서비스. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
