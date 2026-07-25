import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

// 세션 토큰 쿠키에서 Expires/Max-Age를 제거해 '세션 쿠키'로 만든다.
// NextAuth는 로그인·세션 갱신 시 쿠키에 expires(=now+maxAge)를 강제로 넣어
// 브라우저를 닫아도 남는 영구 쿠키가 된다. 이 속성을 떼면 브라우저 종료 시
// 쿠키가 삭제되어 재로그인이 필요해진다.
// JWT 자체의 만료(3시간 롤링, lib/auth.ts)는 서버에서 그대로 유지되므로,
// 결과적으로 "창 닫으면 재로그인" + "3시간 미활동 시 재로그인"이 함께 적용된다.
function toSessionCookie(res: Response): Response {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (setCookies.length === 0) return res;

  const headers = new Headers(res.headers);
  headers.delete('set-cookie'); // 전부 지우고 아래에서 다시 추가(잘못된 병합 방지)

  for (const cookie of setCookies) {
    if (cookie.includes('next-auth.session-token')) {
      headers.append(
        'set-cookie',
        cookie.replace(/;\s*Expires=[^;]+/i, '').replace(/;\s*Max-Age=[^;]+/i, ''),
      );
    } else {
      headers.append('set-cookie', cookie);
    }
  }

  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function auth(req: NextRequest, ctx: { params: { nextauth: string[] } }): Promise<Response> {
  const res = (await handler(req, ctx)) as Response;
  return toSessionCookie(res);
}

export { auth as GET, auth as POST };
