import zlib from 'zlib';

// Decompression-bomb limits (docs/security/BASELINE_AUDIT.md, H2).
const MAX_STREAMS = 400;
const MAX_INFLATED_PER_STREAM = 8 * 1024 * 1024;
const MAX_INFLATED_TOTAL = 64 * 1024 * 1024;

function inflateCapped(data: Buffer): Buffer | null {
  try {
    return zlib.inflateSync(data, { maxOutputLength: MAX_INFLATED_PER_STREAM });
  } catch {
    try {
      return zlib.inflateRawSync(data, { maxOutputLength: MAX_INFLATED_PER_STREAM });
    } catch {
      return null; // not zlib data, or larger than the per-stream cap
    }
  }
}

/**
 * Best-effort text extraction from a PDF buffer. Scans for stream/endstream with
 * indexOf (linear time, no backtracking regex over the whole file) and caps both
 * per-stream and total decompressed size.
 */
export function extractPdfText(buffer: Buffer): string {
  const textBlocks: string[] = [];
  const rawString = buffer.toString('binary');

  let cursor = 0;
  let streamCount = 0;
  let inflatedTotal = 0;
  while (streamCount < MAX_STREAMS && inflatedTotal < MAX_INFLATED_TOTAL) {
    const start = rawString.indexOf('stream', cursor);
    if (start === -1) break;
    let dataStart = start + 'stream'.length;
    if (rawString[dataStart] === '\r') dataStart++;
    if (rawString[dataStart] !== '\n') {
      cursor = start + 1;
      continue;
    }
    dataStart++;
    const end = rawString.indexOf('endstream', dataStart);
    if (end === -1) break;
    cursor = end + 'endstream'.length;
    streamCount++;

    const inflated = inflateCapped(Buffer.from(rawString.slice(dataStart, end).replace(/\r?\n$/, ''), 'binary'));
    if (!inflated) continue;
    inflatedTotal += inflated.length;
    const decompressed = inflated.toString('utf-8');

    if (decompressed.length > 10) {
      const tjMatches = decompressed.match(/\(([^()]+)\)\s*Tj/g) || [];
      for (const m of tjMatches) {
        const cleaned = m.replace(/\)\s*Tj$/, '').replace(/^\(/, '').trim();
        if (cleaned.length > 2) textBlocks.push(cleaned);
      }

      const tjArrMatches = decompressed.match(/\[([^\]]+)\]\s*TJ/g) || [];
      for (const m of tjArrMatches) {
        const innerStrings = m.match(/\(([^()]+)\)/g) || [];
        const combined = innerStrings.map((s) => s.slice(1, -1)).join('').trim();
        if (combined.length > 2) textBlocks.push(combined);
      }
    }
  }

  // Direct uncompressed text operators
  if (textBlocks.length < 20) {
    const directMatches = rawString.match(/\(([^()]{3,})\)Tj/g) || [];
    for (const m of directMatches.slice(0, 3000)) {
      const cleaned = m.slice(1, -3).trim();
      if (cleaned.length > 2 && !/^[\x00-\x1F\x7F]+$/.test(cleaned)) {
        textBlocks.push(cleaned);
      }
    }
  }

  // Fallback: printable runs
  if (textBlocks.length < 20) {
    const asciiChunks = rawString.match(/[A-Za-z0-9\s₹%.,;:/\-()]{20,}/g) || [];
    for (const chunk of asciiChunks.slice(0, 200)) {
      const trimmed = chunk.trim();
      if (!trimmed.includes('xref') && !trimmed.includes('trailer') && !trimmed.includes('startxref')) {
        textBlocks.push(trimmed);
      }
    }
  }

  return textBlocks.join(' ').replace(/\s+/g, ' ').trim();
}
