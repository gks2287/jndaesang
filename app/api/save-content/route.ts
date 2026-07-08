import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MOCK_CONTENT_POOL } from '@/lib/mockData/contentPool';
import type { ContentPoolItem } from '@/lib/api/contentPool';

// 서버리스 파일 저장(fs.writeFile)은 Vercel 읽기 전용 FS에서 실패하므로 DB(Prisma)로 영속화한다.
// 기존 파일 기반 목데이터(MOCK_CONTENT_POOL)는 테이블이 비어 있을 때 최초 1회 자동 시드한다.

type DbRow = {
  id: string; type: string; title: string; category: string; duration: number;
  author: string; tags: string[]; thumbnail: string; thumbnailUrl: string | null;
  body: string; summary: string | null; createdAt: string; insertedAt: Date;
};

function toItem(row: DbRow): ContentPoolItem {
  return {
    id: row.id,
    type: row.type as ContentPoolItem['type'],
    title: row.title,
    category: row.category as ContentPoolItem['category'],
    duration: row.duration,
    author: row.author,
    tags: row.tags,
    thumbnail: row.thumbnail,
    thumbnailUrl: row.thumbnailUrl ?? undefined,
    body: row.body,
    summary: row.summary ?? undefined,
    createdAt: row.createdAt,
  };
}

// 테이블이 비어 있으면 기존 목데이터를 시드(배열 순서 = 최신순으로 보존)
async function ensureSeeded(): Promise<void> {
  const count = await prisma.contentPoolItem.count();
  if (count > 0) return;
  const base = Date.now();
  await prisma.contentPoolItem.createMany({
    data: MOCK_CONTENT_POOL.map((it, i) => ({
      id: it.id,
      type: it.type,
      title: it.title,
      category: it.category,
      duration: it.duration,
      author: it.author,
      tags: it.tags ?? [],
      thumbnail: it.thumbnail ?? '',
      thumbnailUrl: it.thumbnailUrl ?? null,
      body: it.body ?? '',
      summary: it.summary ?? null,
      createdAt: it.createdAt,
      insertedAt: new Date(base - i * 1000), // 앞쪽일수록 최신
    })),
    skipDuplicates: true,
  });
}

function nextId(existingIds: string[], type: 'original' | 'curation'): string {
  const prefix = type === 'original' ? 'jsa' : 'src';
  const nums = existingIds
    .filter(id => id.startsWith(prefix + '-'))
    .map(id => parseInt(id.split('-')[1], 10))
    .filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export async function GET() {
  try {
    await ensureSeeded();
    const rows = await prisma.contentPoolItem.findMany({ orderBy: { insertedAt: 'desc' } });
    return NextResponse.json((rows as DbRow[]).map(toItem));
  } catch (e) {
    console.error('[save-content GET]', e);
    return NextResponse.json({ error: '데이터를 읽을 수 없습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const body = await req.json() as Omit<ContentPoolItem, 'id' | 'createdAt'>;
    const existing = await prisma.contentPoolItem.findMany({ select: { id: true } });
    const id = nextId(existing.map(r => r.id), body.type);
    const created = await prisma.contentPoolItem.create({
      data: {
        id,
        type: body.type,
        title: body.title,
        category: body.category,
        duration: body.duration,
        author: body.author,
        tags: body.tags ?? [],
        thumbnail: body.thumbnail ?? '',
        thumbnailUrl: body.thumbnailUrl ?? null,
        body: body.body ?? '',
        summary: body.summary ?? null,
        createdAt: new Date().toISOString().slice(0, 10),
      },
    });
    const item = toItem(created as DbRow);
    return NextResponse.json({ success: true, id: item.id, item });
  } catch (e) {
    console.error('[save-content POST]', e);
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as Partial<ContentPoolItem> & { id: string };
    const { id, createdAt: _c, ...patch } = body;
    const data: Record<string, unknown> = { ...patch };
    if ('thumbnailUrl' in data) data.thumbnailUrl = patch.thumbnailUrl ?? null;
    if ('summary' in data) data.summary = patch.summary ?? null;
    const exists = await prisma.contentPoolItem.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
    }
    await prisma.contentPoolItem.update({ where: { id }, data });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[save-content PUT]', e);
    return NextResponse.json({ error: '수정에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json() as { id: string };
    const exists = await prisma.contentPoolItem.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
    }
    await prisma.contentPoolItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[save-content DELETE]', e);
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
  }
}
