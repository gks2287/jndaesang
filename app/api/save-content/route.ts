import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { ContentPoolItem } from '@/lib/api/contentPool';

const DATA_FILE = path.join(process.cwd(), 'lib', 'mockData', 'contentPool.ts');

async function readItems(): Promise<ContentPoolItem[]> {
  const content = await fs.readFile(DATA_FILE, 'utf-8');
  // '= [' 패턴으로 데이터 배열 시작점을 찾음 (ContentPoolItem[] 타입 표기의 '[' 와 구분)
  const markerIdx = content.indexOf('= [');
  const start = markerIdx === -1 ? -1 : markerIdx + 2;
  const end = content.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  return JSON.parse(content.slice(start, end + 1)) as ContentPoolItem[];
}

async function writeItems(items: ContentPoolItem[]): Promise<void> {
  const json = JSON.stringify(items, null, 2);
  const content = `import type { ContentPoolItem } from '@/lib/api/contentPool';\n\nexport const MOCK_CONTENT_POOL: ContentPoolItem[] = ${json};\n`;
  await fs.writeFile(DATA_FILE, content, 'utf-8');
}

function nextId(items: ContentPoolItem[], type: 'original' | 'curation'): string {
  const prefix = type === 'original' ? 'jsa' : 'src';
  const nums = items
    .map(i => i.id)
    .filter(id => id.startsWith(prefix + '-'))
    .map(id => parseInt(id.split('-')[1], 10))
    .filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export async function GET() {
  try {
    const items = await readItems();
    return NextResponse.json(items);
  } catch (e) {
    console.error('[save-content GET]', e);
    return NextResponse.json({ error: '데이터를 읽을 수 없습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Omit<ContentPoolItem, 'id' | 'createdAt'>;
    const items = await readItems();
    const newItem: ContentPoolItem = {
      ...body,
      id: nextId(items, body.type),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    await writeItems([newItem, ...items]);
    return NextResponse.json({ success: true, id: newItem.id, item: newItem });
  } catch (e) {
    console.error('[save-content POST]', e);
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as Partial<ContentPoolItem> & { id: string };
    const items = await readItems();
    const idx = items.findIndex(i => i.id === body.id);
    if (idx === -1) {
      return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
    }
    items[idx] = { ...items[idx], ...body };
    await writeItems(items);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[save-content PUT]', e);
    return NextResponse.json({ error: '수정에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json() as { id: string };
    const items = await readItems();
    const filtered = items.filter(i => i.id !== id);
    if (filtered.length === items.length) {
      return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
    }
    await writeItems(filtered);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[save-content DELETE]', e);
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
  }
}
