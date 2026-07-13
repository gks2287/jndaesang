import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';

// 로그인(관리자 세션) 없이 접근 가능한 공개 API — 참여자/인증 흐름에서만 사용.
// 이 목록 외의 모든 /api/* 는 로그인 세션이 있어야만 호출 가능(기본 차단).
const PUBLIC_API_PREFIXES = [
  '/api/auth',                 // NextAuth 로그인/세션 처리 자체
  '/api/newsletter/by-token',  // 참여자: 본인 토큰으로 데이터 조회
  '/api/newsletter/respond',   // 참여자: 인터랙션·설문 응답 저장
];

function isProtectedApi(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return false;
  return !PUBLIC_API_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}

// 관리자 영역(/admin/*)과 공개 목록을 제외한 모든 API를 세션으로 보호한다.
// - 페이지(/admin/*): 미인증 시 로그인 화면으로 리다이렉트(원래 목적지는 callbackUrl로 전달)
// - API: 미인증 시 401 JSON 반환 (리다이렉트 대신 명확한 인증 오류)
// 참여자 페이지(/newsletter/[token])와 공개 API는 그대로 로그인 없이 사용 가능.
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isAdminPage = pathname.startsWith('/admin');
  const protectedApi = isProtectedApi(pathname);
  if (!isAdminPage && !protectedApi) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  if (protectedApi) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  const login = req.nextUrl.clone();
  login.pathname = '/auth/login';
  login.search = '';
  login.searchParams.set('callbackUrl', pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // 관리자 페이지 + 전체 API. 공개 API는 미들웨어 내부에서 통과시킨다.
  matcher: ['/admin/:path*', '/api/:path*'],
};
