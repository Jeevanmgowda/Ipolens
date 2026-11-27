/**
 * DRHP / RHP parsing: page-accurate text extraction, section tagging and chunking.
 * Page numbers are the PDF's physical page numbers, so every citation can be checked.
 */

export type DrhpSection =
  | 'cover'
  | 'risk_factors'
  | 'the_offer'
  | 'capital_structure'
  | 'objects_of_offer'
  | 'basis_for_offer_price'
  | 'industry_overview'
  | 'our_business'
  | 'management'
  | 'financial_statements'
  | 'mdna'
  | 'litigation'
  | 'other';

export const SECTION_LABELS: Record<DrhpSection, string> = {
  cover: 'Cover & Summary',
  risk_factors: 'Risk Factors',
  the_offer: 'The Offer',
  capital_structure: 'Capital Structure',
  objects_of_offer: 'Objects of the Offer',
  basis_for_offer_price: 'Basis for Offer Price',
  industry_overview: 'Industry Overview',
  our_business: 'Our Business',
  management: 'Our Management & Promoters',
  financial_statements: 'Restated Financial Information',
  mdna: "Management's Discussion and Analysis",
  litigation: 'Outstanding Litigation',
  other: 'Other',
};

// Standard SEBI ICDR DRHP chapter headings, matched on a heading-like line.
const HEADING_PATTERNS: Array<[DrhpSection, RegExp]> = [
  ['risk_factors', /^\s*(section\s+[ivx]+\s*[-:–]?\s*)?risk\s+factors\s*$/im],
  ['the_offer', /^\s*the\s+(offer|issue)\s*$/im],
  ['capital_structure', /^\s*capital\s+structure\s*$/im],
  ['objects_of_offer', /^\s*objects?\s+of\s+the\s+(offer|issue)\s*$/im],
  ['basis_for_offer_price', /^\s*basis\s+for\s+(the\s+)?(offer|issue)\s+price\s*$/im],
  ['industry_overview', /^\s*industry\s+overview\s*$/im],
  ['our_business', /^\s*(our\s+business|business\s+overview)\s*$/im],
  ['management', /^\s*(our\s+management|our\s+promoters?(\s+and\s+promoter\s+group)?)\s*$/im],
  ['financial_statements', /^\s*(restated\s+(consolidated\s+)?financial\s+(information|statements)|financial\s+information)\s*$/im],
  ['mdna', /^\s*management['’]?s\s+discussion\s+and\s+analysis/im],
  ['litigation', /^\s*outstanding\s+litigation(\s+and\s+material\s+developments)?\s*$/im],
];

/** Pages that are a table of contents mention every heading; skip them for section detection. */
function looksLikeContents(text: string): boolean {
  const hits = HEADING_PATTERNS.filter(([, re]) => re.test(text)).length;
  return hits >= 4 || /^\s*(table\s+of\s+)?contents\s*$/im.test(text.slice(0, 400));
}

export function detectSectionStart(pageText: string): DrhpSection | null {
  if (looksLikeContents(pageText)) return null;
  // Chapter headings sit at the top of the page; only inspect the first lines.
  const head = pageText.split('\n').slice(0, 8).join('\n');
  for (const [section, re] of HEADING_PATTERNS) if (re.test(head)) return section;
  return null;
}

export interface PageText {
  pageNumber: number;
  text: string;
  section: DrhpSection;
}

export function tagSections(pages: string[]): PageText[] {
  let current: DrhpSection = 'cover';
  return pages.map((raw, i) => {
    const text = raw.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').trim();
    const start = detectSectionStart(text);
    if (start) current = start;
    return { pageNumber: i + 1, text, section: current };
  });
}

export interface Chunk {
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
  section: DrhpSection;
  content: string;
}

/**
 * Chunks within a section (never across sections), ~targetWords words with overlap, keeping
 * page ranges. Content is prefixed with its section and page so the LLM can cite it.
 */
export function chunkPages(pages: PageText[], targetWords = 450, overlapWords = 80): Chunk[] {
  const chunks: Chunk[] = [];
  let idx = 0;
  let i = 0;
  while (i < pages.length) {
    const section = pages[i].section;
    const group: PageText[] = [];
    while (i < pages.length && pages[i].section === section) group.push(pages[i++]);

    const words: Array<{ w: string; page: number }> = [];
    for (const p of group) for (const w of p.text.split(/\s+/)) if (w) words.push({ w, page: p.pageNumber });

    for (let start = 0; start < words.length; start += targetWords - overlapWords) {
      const slice = words.slice(start, start + targetWords);
      if (slice.length < 25 && start > 0) break;
      chunks.push({
        chunkIndex: idx++,
        pageStart: slice[0].page,
        pageEnd: slice[slice.length - 1].page,
        section,
        content: slice.map((s) => s.w).join(' '),
      });
      if (start + targetWords >= words.length) break;
    }
  }
  return chunks;
}

/** Extracts one text string per physical page from a PDF. */
export async function extractPdfPages(data: Uint8Array): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  return Array.isArray(text) ? text : [text];
}
