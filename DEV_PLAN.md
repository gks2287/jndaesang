# J&컴퍼니 리더십 코칭 뉴스레터 서비스 — 개발 계획

## 서비스 개요

고객사의 다면진단 결과를 기반으로 부정적 리더십 유형의 직책자에게  
개인 맞춤형 리더십 개선 콘텐츠를 제공하는 후속 코칭 서비스.

- 직책자: 로그인 없이 이메일 링크(token) → 개인 전용 뉴스레터 페이지 접근
- 관리자: 고객사/직책자/진단 결과 관리, 뉴스레터 생성·편집·발송, 대시보드 분석
- HR 담당자: 고객사 단위 현황 조회

---

## 기술 스택

| 영역 | 선택 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript |
| DB | PostgreSQL |
| ORM | Prisma |
| 인증 | NextAuth.js (관리자/HR) + JWT 토큰 (직책자) |
| 이메일 발송 | Resend |
| 스타일 | Tailwind CSS + shadcn/ui |
| 상태관리 | Zustand (클라이언트) + React Query (서버 상태) |
| 파일 저장 | AWS S3 (또는 Cloudflare R2) |
| AI 생성 | OpenAI API (콘텐츠 블록 문구 생성) |
| 배포 | Vercel + Supabase (PostgreSQL) |

---

## 프로젝트 구조

```
/
├── app/
│   ├── (admin)/              # 관리자 영역 (레이아웃 분리)
│   │   ├── admin/
│   │   │   ├── dashboard/
│   │   │   ├── companies/
│   │   │   ├── participants/
│   │   │   ├── assessments/
│   │   │   ├── content/
│   │   │   ├── campaigns/
│   │   │   └── analytics/
│   ├── (hr)/                 # HR 계정 영역
│   │   └── hr/
│   │       ├── dashboard/
│   │       └── participants/
│   ├── (participant)/        # 직책자 영역 (token 기반)
│   │   └── newsletter/
│   │       ├── [token]/
│   │       │   ├── page.tsx          # 뉴스레터 상세 페이지
│   │       │   ├── interaction/
│   │       │   ├── satisfaction/
│   │       │   └── mypage/
│   ├── api/
│   │   ├── admin/
│   │   ├── hr/
│   │   ├── newsletter/
│   │   └── webhook/
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

## DB 스키마 (Prisma)

```prisma
// prisma/schema.prisma 구현 대상 모델 목록

model AdminUser { ... }
model Company { ... }
model CompanyHrAccount { ... }
model Participant { ... }
model LeadershipType { ... }
model AssessmentResult { ... }
model ContentItem { ... }
model NewsletterCampaign { ... }
model NewsletterStep { ... }
model NewsletterContentBlock { ... }
model NewsletterDelivery { ... }
model NewsletterViewLog { ... }
model InteractionElement { ... }
model InteractionResponse { ... }
model SatisfactionResponse { ... }
model Reward { ... }
model ParticipantReward { ... }
model ParticipantActivityLog { ... }
```

---

## 개발 단계별 TODO

### Phase 0 — 프로젝트 초기 세팅
- [ ] `npx create-next-app@latest` (TypeScript, App Router, Tailwind)
- [ ] Prisma 설치 및 PostgreSQL 연결 설정
- [ ] shadcn/ui 초기화
- [ ] NextAuth.js 설치 및 기본 설정
- [ ] 환경변수 파일 구성 (`.env.local`)
- [ ] ESLint / Prettier 설정
- [ ] 폴더 구조 생성

---

### Phase 1 — DB 설계 및 Prisma 스키마
- [ ] `prisma/schema.prisma` 전체 모델 작성
  - [ ] AdminUser
  - [ ] Company, CompanyHrAccount
  - [ ] Participant, LeadershipType, AssessmentResult
  - [ ] ContentItem
  - [ ] NewsletterCampaign, NewsletterStep, NewsletterContentBlock
  - [ ] NewsletterDelivery, NewsletterViewLog
  - [ ] InteractionElement, InteractionResponse
  - [ ] SatisfactionResponse
  - [ ] Reward, ParticipantReward
  - [ ] ParticipantActivityLog
- [ ] `prisma migrate dev` 초기 마이그레이션
- [ ] Seed 데이터 작성 (LeadershipType 마스터, 테스트 계정)

---

### Phase 2 — 인증 시스템
- [ ] 관리자 로그인 (NextAuth.js Credentials Provider)
  - [ ] `/auth/admin/login` 페이지
  - [ ] 세션 기반 보호 미들웨어 (`middleware.ts`)
  - [ ] role 기반 접근 제어 (super_admin / manager)
- [ ] HR 계정 로그인
  - [ ] `/auth/hr/login` 페이지
  - [ ] HR 세션 분리 처리
- [ ] 직책자 토큰 인증
  - [ ] `GET /api/newsletter/[token]/verify` — 토큰 유효성 검증
  - [ ] 만료 토큰 처리 로직

---

### Phase 3 — 관리자: 고객사 / HR / 직책자 관리
- [ ] 고객사 CRUD API
  - [ ] `GET/POST /api/admin/companies`
  - [ ] `GET/PATCH/DELETE /api/admin/companies/[id]`
- [ ] 고객사 목록/상세 페이지
- [ ] HR 계정 생성 / 비활성화 API
- [ ] 직책자 CRUD API
  - [ ] `GET/POST /api/admin/participants`
  - [ ] CSV 일괄 업로드
- [ ] 직책자 목록/상세 페이지
- [ ] 직책자 토큰 재발급 기능

---

### Phase 4 — 관리자: 다면진단 결과 관리
- [ ] 리더십 유형 마스터 관리 API
- [ ] 진단 결과 등록 API
  - [ ] `POST /api/admin/assessments` (단건 / CSV 일괄)
  - [ ] `GET /api/admin/assessments`
- [ ] 진단 결과 목록 페이지 (고객사/직책자 필터)
- [ ] 리더십 유형별 통계 요약 뷰

---

### Phase 5 — 관리자: 콘텐츠 풀 관리
- [ ] 콘텐츠 CRUD API
  - [ ] `GET/POST /api/admin/content`
  - [ ] `GET/PATCH/DELETE /api/admin/content/[id]`
- [ ] 콘텐츠 목록 페이지 (유형/리더십 유형/태그 필터)
- [ ] 콘텐츠 등록/편집 폼
  - [ ] 외부 URL 입력
  - [ ] 자체 본문 에디터 (rich text)
  - [ ] 리더십 유형 태깅

---

### Phase 6 — 관리자: 뉴스레터 캠페인 생성 / 편집
- [ ] 캠페인 생성 API
  - [ ] `POST /api/admin/campaigns`
  - [ ] 콘텐츠 비율 설정 (일반/유형/개인 맞춤)
  - [ ] 발송 주기, 단계 수 설정
- [ ] 단계(Step) 자동 생성 로직
- [ ] 스텝별 콘텐츠 블록 구성 API
  - [ ] `POST /api/admin/campaigns/[id]/steps/[stepId]/blocks`
  - [ ] 콘텐츠 풀에서 블록 추가/제거/순서 변경
- [ ] AI 문구 자동 생성
  - [ ] `POST /api/admin/campaigns/[id]/steps/[stepId]/generate`
  - [ ] OpenAI API 연동 (직책자 이름, 리더십 유형, 콘텐츠 기반 프롬프트)
  - [ ] 생성 문구 편집 기능 (`edited_text` 저장)
- [ ] 인터랙션 요소 추가 (quiz, reflection, checklist, action_plan)
- [ ] 만족도 조사 포함 여부 설정
- [ ] 캠페인 미리보기 페이지
- [ ] 캠페인 상태 관리 (draft → scheduled → active → completed)

---

### Phase 7 — 뉴스레터 발송 시스템
- [ ] 발송 대상자 생성 로직 (`newsletter_deliveries` 레코드 생성)
  - [ ] 개인별 `access_token` 생성 (nanoid)
  - [ ] 개인 전용 `detail_page_url` 생성
- [ ] 이메일 템플릿 설계
  - [ ] 요약 카드 이미지 (preview_image_url) 생성 (Satori 또는 Puppeteer)
  - [ ] Resend를 이용한 HTML 이메일 발송
- [ ] 발송 API
  - [ ] `POST /api/admin/campaigns/[id]/steps/[stepId]/send`
- [ ] 발송 예약 기능 (scheduled_send_date 기반 cron)
- [ ] 발송 실패 재처리 로직
- [ ] 발송 이력 목록 페이지

---

### Phase 8 — 직책자: 뉴스레터 페이지
- [ ] 토큰 기반 접근 처리
  - [ ] `/newsletter/[token]` — 유효성 검증 후 열람 시작
  - [ ] 최초 접근 시 `opened_at` 기록
- [ ] 뉴스레터 상세 페이지
  - [ ] 콘텐츠 블록 순서대로 렌더링
  - [ ] block_type별 컴포넌트 (article, video, tip, checklist 등)
  - [ ] 외부 링크 클릭 추적
- [ ] 열람 로그 기록 API
  - [ ] `POST /api/newsletter/[token]/view`
  - [ ] scroll_depth, dwell_time_seconds 수집
- [ ] 인터랙션 페이지
  - [ ] `/newsletter/[token]/interaction`
  - [ ] quiz, reflection, checklist, action_plan 타입별 폼
  - [ ] `POST /api/newsletter/[token]/interaction`
- [ ] 만족도 조사
  - [ ] `/newsletter/[token]/satisfaction`
  - [ ] 점수 + 의견 + 도움 정도 입력
  - [ ] `POST /api/newsletter/[token]/satisfaction`

---

### Phase 9 — 직책자: 마이페이지
- [ ] `/newsletter/[token]/mypage`
- [ ] 수신한 뉴스레터 목록 (열람 여부 표시)
- [ ] 누적 활동 요약 (열람 수, 인터랙션 완료 수)
- [ ] 획득 보상 목록 (뱃지, 쿠폰)
- [ ] 리더십 유형 및 코칭 방향 안내

---

### Phase 10 — 보상 시스템
- [ ] 보상 마스터 CRUD (관리자)
- [ ] 보상 지급 조건 평가 로직
  - [ ] `condition_type`: 열람 횟수, 인터랙션 완료, 연속 참여 등
  - [ ] 이벤트 발생 시 조건 자동 평가 (activity_log 기록 시점 트리거)
- [ ] 보상 지급 API
- [ ] 직책자 마이페이지에 보상 노출

---

### Phase 11 — HR 계정 포털
- [ ] HR 로그인 및 세션 관리
- [ ] HR 대시보드
  - [ ] 소속 고객사의 직책자 목록
  - [ ] 직책자별 열람률, 참여율 요약
- [ ] 직책자 진단 결과 조회 (읽기 전용)
- [ ] 캠페인 현황 조회

---

### Phase 12 — 관리자: 분석 대시보드
- [ ] 캠페인별 대시보드
  - [ ] 전체 발송 수 / 열람 수 / 열람률
  - [ ] 단계별 열람률 추이 차트
  - [ ] 인터랙션 수행률
  - [ ] 만족도 평균 점수 추이
  - [ ] 보상 획득 현황
- [ ] 고객사별 대시보드
- [ ] 직책자별 상세 활동 이력
- [ ] 리더십 유형별 참여율 비교
- [ ] CSV 내보내기

---

### Phase 13 — 활동 로그 & 공통 처리
- [ ] `participant_activity_logs` 공통 기록 유틸 함수
  - [ ] open, click, submit, reward_earned 이벤트
- [ ] API 에러 핸들링 공통화
- [ ] 미들웨어 — 관리자/HR/직책자 영역 분리
- [ ] Rate limiting (발송, AI 생성 API)

---

### Phase 14 — 배포 및 운영
- [ ] Vercel 배포 설정
- [ ] Supabase PostgreSQL 연결
- [ ] 환경변수 관리 (Vercel 환경변수)
- [ ] 이메일 도메인 인증 (Resend)
- [ ] 발송 스케줄 cron 설정 (Vercel Cron Jobs)
- [ ] 에러 모니터링 (Sentry)
- [ ] 로그 모니터링 설정

---

## API 목록 요약

### 관리자 API (`/api/admin/*`)
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | `/companies` | 고객사 목록/생성 |
| GET/PATCH/DELETE | `/companies/[id]` | 고객사 상세/수정/삭제 |
| GET/POST | `/companies/[id]/hr-accounts` | HR 계정 관리 |
| GET/POST | `/participants` | 직책자 목록/생성 |
| POST | `/participants/bulk` | CSV 일괄 등록 |
| GET/POST | `/assessments` | 진단 결과 조회/등록 |
| GET/POST | `/content` | 콘텐츠 풀 조회/등록 |
| GET/POST | `/campaigns` | 캠페인 목록/생성 |
| GET/PATCH | `/campaigns/[id]` | 캠페인 상세/수정 |
| POST | `/campaigns/[id]/steps/[stepId]/blocks` | 콘텐츠 블록 추가 |
| POST | `/campaigns/[id]/steps/[stepId]/generate` | AI 문구 생성 |
| POST | `/campaigns/[id]/steps/[stepId]/send` | 뉴스레터 발송 |
| GET | `/analytics/campaigns/[id]` | 캠페인 분석 |

### 직책자 API (`/api/newsletter/*`)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/[token]/verify` | 토큰 유효성 검증 |
| POST | `/[token]/view` | 열람 로그 기록 |
| POST | `/[token]/interaction` | 인터랙션 응답 제출 |
| POST | `/[token]/satisfaction` | 만족도 제출 |
| GET | `/[token]/mypage` | 마이페이지 데이터 |

### HR API (`/api/hr/*`)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/dashboard` | HR 대시보드 데이터 |
| GET | `/participants` | 직책자 목록 |
| GET | `/participants/[id]` | 직책자 상세 |

---

## 개발 우선순위

```
1순위 (MVP)
  Phase 0~2  : 세팅, DB, 인증
  Phase 3~4  : 고객사/직책자/진단 결과 관리
  Phase 5~6  : 콘텐츠 풀, 캠페인 생성
  Phase 7    : 발송 시스템
  Phase 8    : 직책자 뉴스레터 페이지

2순위
  Phase 9    : 직책자 마이페이지
  Phase 10   : 보상 시스템
  Phase 11   : HR 포털
  Phase 12   : 분석 대시보드

3순위
  Phase 13~14 : 로그 정교화, 배포/운영
```

---

## 환경변수 목록 (`.env.local`)

```env
# DB
DATABASE_URL=

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Resend (이메일)
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# OpenAI
OPENAI_API_KEY=

# AWS S3 (이미지 저장)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=

# 앱
NEXT_PUBLIC_APP_URL=
```
