import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { callClaude } from '@/lib/api/claude';
import type { ContentCategory } from '@/lib/api/contentPool';

const VALID_CATEGORIES: ContentCategory[] = [
  '아티클', '인터뷰', '책 추천', '성공 사례', '카드뉴스', '웹툰', '영상',
];

const THUMBNAILS_DIR = path.join(process.cwd(), 'public', 'images', 'thumbnails');

// 브라우저에서 렌더링 가능한 이미지 타입만 허용 (wmf/emf 제외)
const BROWSER_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export interface ParsedContent {
  title: string;
  category: ContentCategory;
  duration: number;
  author: string;
  tags: string[];
  body: string;
  summary: string;
  thumbnail: string;
}

const SYSTEM_PROMPT = `당신은 J&Company의 콘텐츠 분류 전문가입니다.
주어진 문서를 분석하고 JSON 형식으로만 응답합니다. 다른 텍스트는 절대 포함하지 마세요.`;

function buildUserPrompt(text: string): string {
  const truncated = text.slice(0, 3000);
  return `아래 문서를 읽고 다음 정보를 JSON으로 추출해주세요:
{
  "title": "독자가 읽고 싶어지도록 자연스럽고 흥미롭게 작성한 제목. 딱딱하거나 한자어 표현은 피하고 구어체로 작성하세요.",
  "category": "다음 중 하나: 아티클|인터뷰|책 추천|성공 사례|카드뉴스|웹툰|영상",
  "duration": 반드시 1 또는 2 중 하나의 숫자 (전체 뉴스레터가 4-5분이므로 개별 콘텐츠는 1-2분이어야 합니다),
  "author": "작성자 이름 (없으면 J&Company 코칭팀)",
  "tags": ["핵심 키워드 3~5개 배열"],
  "summary": "한 줄 요약 (50자 이내)"
}
JSON만 응답하고 다른 텍스트는 포함하지 마세요.

문서 내용:
${truncated}`;
}

function cleanBodyText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.txt')) {
    return file.text();
  }

  if (name.endsWith('.docx')) {
    const mammoth = (await import('mammoth')).default;
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (name.endsWith('.pdf')) {
    // 서버리스(Vercel)에서 브라우저 전역(DOMMatrix 등)에 의존하지 않는 unpdf 사용
    const { extractText: extractPdfText, getDocumentProxy } = await import('unpdf');
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(data);
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return typeof text === 'string' ? text : (text as string[]).join('\n\n');
  }

  throw new Error('지원하지 않는 파일 형식입니다. (.docx, .pdf, .txt만 지원)');
}

// docx 파일에서 첫 번째 브라우저 호환 이미지를 추출해 저장, 경로 반환
async function extractFirstDocxImage(fileBuffer: Buffer): Promise<string | null> {
  const mammoth = (await import('mammoth')).default;

  let savedPath: string | null = null;

  await mammoth.convertToHtml(
    { buffer: fileBuffer },
    {
      convertImage: mammoth.images.imgElement(async (element: {
        contentType: string;
        readAsBuffer: () => Promise<Buffer>;
      }) => {
        // 이미 저장했거나 브라우저 비호환 형식(wmf, emf 등)이면 스킵
        if (savedPath || !(element.contentType in BROWSER_IMAGE_TYPES)) {
          return { src: '' };
        }
        try {
          const buf = await element.readAsBuffer();
          const ext = BROWSER_IMAGE_TYPES[element.contentType];
          const filename = `content_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
          await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
          await fs.writeFile(path.join(THUMBNAILS_DIR, filename), buf);
          savedPath = `/images/thumbnails/${filename}`;
        } catch {
          // 쓰기 실패 시 무시하고 fallback으로
        }
        return { src: '' };
      }),
    },
  );

  return savedPath;
}

// public/images/thumbnails/ 에서 키워드 매칭 또는 랜덤 선택
async function pickThumbnail(title: string, tags: string[]): Promise<string> {
  let files: string[];
  try {
    const entries = await fs.readdir(THUMBNAILS_DIR);
    files = entries.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
  } catch {
    return '';
  }

  if (files.length === 0) return '';

  const keywords = [
    ...title.split(/[\s,_\-]+/),
    ...tags,
  ].map(k => k.toLowerCase()).filter(k => k.length > 1);

  const matched = files.find(f => {
    const lower = f.toLowerCase();
    return keywords.some(kw => lower.includes(kw));
  });

  const chosen = matched ?? files[Math.floor(Math.random() * files.length)];
  return `/images/thumbnails/${chosen}`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }

    // 텍스트 추출
    let text: string;
    let fileBuffer: Buffer | null = null;
    const isDocx = file.name.toLowerCase().endsWith('.docx');

    try {
      if (isDocx) {
        // docx는 arrayBuffer를 한 번만 읽어 텍스트·이미지 추출에 재사용
        fileBuffer = Buffer.from(await file.arrayBuffer());
        const mammoth = (await import('mammoth')).default;
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        text = result.value;
      } else {
        text = await extractText(file);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '파일을 읽을 수 없습니다.';
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    if (!text.trim()) {
      return NextResponse.json({ error: '파일에서 텍스트를 추출할 수 없습니다.' }, { status: 422 });
    }
    // ── 로그 1: 텍스트 추출 결과 ──
    console.log('[파싱] 추출 텍스트 길이:', text.length);
    console.log('[파싱] 텍스트 앞 500자:', text.slice(0, 500));

    // Claude API 호출
    const raw = await callClaude(buildUserPrompt(text), SYSTEM_PROMPT);
    // ── 로그 2: Claude 원본 응답 ──
    console.log('[파싱] Claude 원본 응답:', JSON.stringify(raw));

    // JSON 파싱 — 코드블록 제거 후 최외곽 { } 블록 추출 (앞뒤 설명 텍스트 무시)
    const stripped = raw.replace(/```(?:json)?/gi, '').trim();
    const jsonStart = stripped.indexOf('{');
    const jsonEnd = stripped.lastIndexOf('}');
    const jsonStr = jsonStart !== -1 && jsonEnd > jsonStart
      ? stripped.slice(jsonStart, jsonEnd + 1)
      : stripped;

    let parsed: Record<string, unknown>;
    try {
      // ── 로그 3: JSON.parse 시도 직전 ──
      console.log('[파싱] 파싱 시도할 문자열:', jsonStr);
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('[parse-content] JSON parse failed. raw:', raw);
      console.error('[parse-content] jsonStr attempted:', jsonStr.slice(0, 300));
      console.error('[parse-content] parse error:', parseErr);
      return NextResponse.json({ error: 'AI 응답을 파싱할 수 없습니다. 직접 입력해주세요.' }, { status: 500 });
    }

    // category 유효성 검증 및 fallback
    const category: ContentCategory = VALID_CATEGORIES.includes(parsed.category as ContentCategory)
      ? (parsed.category as ContentCategory)
      : '아티클';

    // duration: 1 또는 2만 허용
    const duration = Number(parsed.duration) === 2 ? 2 : 1;

    const tags = Array.isArray(parsed.tags) ? (parsed.tags as string[]).slice(0, 5) : [];
    const title = String(parsed.title ?? '');

    // 썸네일: docx 내 이미지 우선, 없으면 폴더에서 선택
    let thumbnail = '';
    if (isDocx && fileBuffer) {
      thumbnail = (await extractFirstDocxImage(fileBuffer)) ?? '';
    }
    if (!thumbnail) {
      thumbnail = await pickThumbnail(title, tags);
    }

    const result: ParsedContent = {
      title,
      category,
      duration,
      author: String(parsed.author ?? 'J&Company 코칭팀'),
      tags,
      body: cleanBodyText(text),
      summary: String(parsed.summary ?? ''),
      thumbnail,
    };

    return NextResponse.json(result);
  } catch (e) {
    console.error('[parse-content]', e);
    return NextResponse.json(
      { error: 'AI 분석 중 오류가 발생했습니다. 직접 입력해주세요.' },
      { status: 500 },
    );
  }
}
