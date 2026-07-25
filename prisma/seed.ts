import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// 슈퍼관리자 계정 시드.
// 비밀번호는 평문으로 저장하지 않고 bcrypt 해시로만 DB에 보관한다.
// 재실행해도 안전하도록 upsert 사용(중복 생성 없이 비밀번호/권한만 갱신).
async function main() {
  const email = process.env.SUPER_ADMIN_ID ?? 'jnhrcompany2017';
  const password = process.env.SUPER_ADMIN_PASSWORD ?? 'jnhrcompany2017';
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, role: 'super_admin', name: '슈퍼관리자' },
    create: { email, passwordHash, role: 'super_admin', name: '슈퍼관리자' },
  });

  console.log(`슈퍼관리자 계정 준비 완료: ${admin.email} (role=${admin.role})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
