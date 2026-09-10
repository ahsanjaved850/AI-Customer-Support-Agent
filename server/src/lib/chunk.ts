/**
 * Split text into overlapping chunks for embedding. Splits on paragraph
 * breaks first so chunks stay coherent, then packs paragraphs up to
 * `maxChars`, carrying a small overlap into the next chunk for context
 * continuity across boundaries.
 */
export function chunkText(text: string, maxChars = 800, overlapChars = 100): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length > maxChars && current) {
      chunks.push(current);
      const tail = current.slice(-overlapChars);
      current = `${tail}\n\n${paragraph}`;
    } else {
      current = candidate;
    }

    // A single paragraph longer than maxChars: hard-split it.
    while (current.length > maxChars * 1.5) {
      chunks.push(current.slice(0, maxChars));
      current = current.slice(maxChars - overlapChars);
    }
  }

  if (current.trim()) chunks.push(current);
  return chunks;
}
