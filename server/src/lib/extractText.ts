import path from 'node:path';

/**
 * Pull plain text out of an uploaded file's buffer based on its extension.
 * Supports .txt/.md directly and .pdf via pdf-parse. Add more branches here
 * (e.g. .docx, .csv) as needed — this is the only place ingestion cares
 * about file format.
 */
export async function extractText(filename: string, buffer: Buffer): Promise<string> {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.txt' || ext === '.md') {
    return buffer.toString('utf-8');
  }

  if (ext === '.pdf') {
    const { default: pdfParse } = await import('pdf-parse');
    const result = await pdfParse(buffer);
    return result.text;
  }

  throw new Error(`Unsupported file type: ${ext || '(none)'}. Use .txt, .md, or .pdf.`);
}
