# CLAUDE.md

이 파일은 Claude Code가 이 프로젝트에서 작업할 때 참고하는 설정 파일입니다.

---

## 프로젝트 개요

**J&컴퍼니 리더십 코칭 뉴스레터 서비스**

고객사의 다면진단 결과를 기반으로, 부정적 리더십 유형을 보이는 직책자에게
개인 맞춤형 리더십 개선 콘텐츠를 제공하는 후속 코칭 서비스.

- **직책자**: 로그인 없이 이메일 링크(token)로 개인 전용 뉴스레터 페이지 접근
- **J&컴퍼니 관리자**: 고객사/직책자/진단 결과 관리, 뉴스레터 생성·편집·발송, 대시보드 분석
- **HR 담당자**: 고객사 단위 현황 조회

자세한 개발 계획은 `DEV_PLAN.md` 참고.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript |
| DB | PostgreSQL |
| ORM | Prisma |
| 인증 | NextAuth.js (관리자/HR) + JWT 토큰 (직책자) |
| 이메일 | Resend |
| 스타일 | Tailwind CSS + shadcn/ui |
| 상태관리 | Zustand + React Query |
| AI 문구 생성 | OpenAI API |
| 파일 저장 | AWS S3 (또는 Cloudflare R2) |
| 배포 | Vercel + Supabase (PostgreSQL) |

---

## 개발 환경 설정

```bash
# 의존성 설치
npm install

# DB 마이그레이션
npx prisma migrate dev

# Prisma 클라이언트 생성
npx prisma generate

# 시드 데이터 삽입
npx prisma db seed

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 타입 체크
npm run type-check
```

---

## 프로젝트 구조

```
/
├── app/
│   ├── (admin)/              # 관리자 영역
│   │   └── admin/
│   │       ├── dashboard/
│   │       ├── companies/
│   │       ├── participants/
│   │       ├── assessments/
│   │       ├── content/
│   │       ├── campaigns/
│   │       └── analytics/
│   ├── (hr)/                 # HR 계정 영역
│   │   └── hr/
│   ├── (participant)/        # 직책자 영역 (token 기반)
│   │   └── newsletter/
│   │       └── [token]/
│   │           ├── page.tsx
│   │           ├── interaction/
│   │           ├── satisfaction/
│   │           └── mypage/
│   ├── api/
│   │   ├── admin/
│   │   ├── hr/
│   │   └── newsletter/
│   └── auth/
├── prisma/
│   └── schema.prisma
├── components/
│   ├── admin/
│   ├── newsletter/
│   └── ui/
├── lib/
│   ├── auth.ts
│   ├── email.ts
│   ├── ai.ts
│   └── db.ts
└── types/
```

---

## 인증 구조

| 사용자 | 방식 |
|--------|------|
| 관리자 (super_admin / manager) | NextAuth.js Credentials — 세션 기반 |
| HR 담당자 | NextAuth.js Credentials — 세션 기반 |
| 직책자 | 이메일 링크 token — `/newsletter/[token]` 진입, 로그인 없음 |

---

## 핵심 도메인 개념

- **LeadershipType**: 부정적 리더십 유형 마스터 (코드, 이름, 코칭 방향)
- **AssessmentResult**: 직책자별 다면진단 결과 (유형 분류 포함)
- **NewsletterCampaign**: 고객사 단위 캠페인 (발송 주기, 콘텐츠 비율 설정)
- **NewsletterStep**: 캠페인의 단계별 스토리라인
- **NewsletterContentBlock**: 스텝 안의 콘텐츠 블록 (AI 생성 문구 포함)
- **NewsletterDelivery**: 직책자별 발송 이력 + 개인 token
- **InteractionElement / Response**: 퀴즈, 성찰, 체크리스트 등 과제
- **ParticipantActivityLog**: 모든 행동 이벤트의 통합 로그

---

## 코드 컨벤션

- 언어: TypeScript (strict 모드)
- 들여쓰기: 공백 2칸
- 문자열: 작은따옴표
- 세미콜론: 사용
- 컴포넌트: 함수형 + 화살표 함수
- API Route: Next.js App Router Route Handler (`route.ts`)
- DB 접근: Prisma Client (`lib/db.ts`) 통해서만
- 서버/클라이언트 컴포넌트 명확히 구분 (`'use client'` 명시)

---

## 환경변수

`.env.local` 파일 필요. 아래 키 세팅 필수:

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
OPENAI_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=
NEXT_PUBLIC_APP_URL=
```

---

## 주의사항

- 직책자 token은 `nanoid`로 생성, 만료일(`token_expires_at`) 반드시 검증
- 콘텐츠 블록 AI 생성 문구(`generated_text`)와 관리자 편집 문구(`edited_text`) 구분 — 실제 발송 시 `edited_text` 우선 사용
- 직책자 페이지에서 모든 행동(열람, 클릭, 제출)은 `participant_activity_logs`에 기록
- 발송 API는 Rate Limiting 적용 필수
- HR 계정은 소속 고객사 데이터만 접근 가능 (company_id 기반 필터 강제)
