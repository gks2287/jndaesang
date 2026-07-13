import { withAuth } from 'next-auth/middleware';

// 관리자 영역(/admin/*)은 로그인(NextAuth 세션)이 있어야만 접근 가능.
// 미인증 접근은 로그인 페이지(/auth/login)로 리다이렉트되며, 원래 목적지는 callbackUrl로 전달된다.
// 참여자 페이지(/newsletter/[token])와 로그인/인증 API는 matcher에서 제외해 공개로 둔다.
export default withAuth({
  pages: {
    signIn: '/auth/login',
  },
});

export const config = {
  matcher: ['/admin/:path*'],
};
