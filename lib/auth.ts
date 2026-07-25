import { NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // 입력값은 로그인 폼의 ID 필드(이메일 또는 아이디) → admin_users.email 과 매칭
        const user = await prisma.adminUser.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name || user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    // 롤링 세션: 세션이 조회될 때(페이지 이동·창 포커스 등 활동)마다 만료 시각이 갱신되고,
    // 마지막 활동 후 3시간 동안 사용이 없으면 만료된다. 사용 중에는 계속 유지.
    maxAge: 3 * 60 * 60, // 3시간 (미활동 만료 창)
    updateAge: 15 * 60, // 15분마다 활동 시 토큰 갱신
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
};

// 현재 로그인한 관리자(admin_users 레코드)를 세션 email로 조회한다.
// 세션이 없거나 계정이 삭제됐으면 null. 라우트에서 인증·역할 확인에 사용.
export async function getCurrentAdmin() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  return prisma.adminUser.findUnique({ where: { email } });
}
