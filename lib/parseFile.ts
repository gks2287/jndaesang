// 서버 전용 파일 텍스트 추출 유틸 — .docx / .pdf / .txt / .xlsx / .csv 지원.
// xlsx·csv는 표 데이터를 CSV 텍스트로 변환해 수치·분포를 보존한다.

export const SUPPORTED_EXTENSIONS = ['docx', 'pdf', 'txt', 'xlsx', 'csv'] as const;

export function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

// File에서 텍스트를 추출한다. 지원하지 않는 형식이면 throw.
export async function extractFileText(file: File): Promise<string> {
  const ext = getExtension(file.name);

  if (ext === 'txt' || ext === 'csv') {
    return await file.text();
  }

  if (ext === 'docx') {
    const mammoth = (await import('mammoth')).default;
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === 'pdf') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (ext === 'xlsx') {
    const XLSX = await import('xlsx');
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    // 모든 시트를 CSV로 변환해 합친다 (시트명 헤더 포함)
    return wb.SheetNames
      .map(name => {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
        return `# 시트: ${name}\n${csv}`;
      })
      .join('\n\n')
      .trim();
  }

  throw new Error('지원하지 않는 파일 형식입니다. (pdf / docx / txt / xlsx / csv)');
}
