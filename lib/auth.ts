import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

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

        // TODO: DB 조회로 교체
        // const user = await prisma.adminUser.findUnique({ where: { email: credentials.email } });
        // if (!user || !await bcrypt.compare(credentials.password, user.password_hash)) return null;

        // 개발용 임시 계정
        if (
          credentials.email === 'admin@jcompany.co.kr' &&
          credentials.password === 'admin1234'
        ) {
          return {
            id: '1',
            email: 'admin@jcompany.co.kr',
            name: '관리자',
            role: 'super_admin',
          };
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8시간
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
