/**
 * Client-safe classifier for text copied from a registrar's allotment page (the manual path:
 * the user verifies on the registrar site and pastes the result back). PANs are masked.
 */

export interface AllotmentScanResult {
  parsedSuccessfully: boolean;
  status: 'Allotted' | 'Not Allotted' | 'Pending' | 'Unknown';
  companyMatched?: string;
  panMatched?: string;
  applicationNo?: string;
  sharesApplied?: number;
  sharesAllotted?: number;
  rawConfidence: number;
  extractedSnippet: string;
}

export function scanRegistrarText(rawText: string): AllotmentScanResult {
  try {
    const text = (rawText || '').trim();
    if (!text) {
      return {
        parsedSuccessfully: false,
        status: 'Unknown',
        rawConfidence: 0,
        extractedSnippet: '',
      };
    }

    const lower = text.toLowerCase();

    // 1. Detect Allotted vs Not Allotted
    let status: 'Allotted' | 'Not Allotted' | 'Pending' | 'Unknown' = 'Unknown';
    let confidence = 0.5;

    // Patterns indicating successful allotment
    const positivePatterns = [
      /shares?\s*allotted[:\s]+([1-9]\d*)/i,
      /allotted\s*qty[:\s]+([1-9]\d*)/i,
      /allotment\s*status[:\s]+allotted/i,
      /status[:\s]+allotted/i,
      /successfully\s*allotted/i,
      /allotted\s*shares[:\s]+([1-9]\d*)/i,
      /shares\s*credited[:\s]+([1-9]\d*)/i,
    ];

    // Patterns indicating no allotment / rejection
    const negativePatterns = [
      /shares?\s*allotted[:\s]+0\b/i,
      /allotted\s*qty[:\s]+0\b/i,
      /not\s*allotted/i,
      /non-allotted/i,
      /status[:\s]+non[\s-]*allottee/i,
      /status[:\s]+not\s*allotted/i,
      /unsuccessful/i,
      /technical\s*rejection/i,
      /duplicate\s*pan/i,
      /refund\s*initiated/i,
    ];

    let sharesAllotted = 0;
    let sharesApplied = 0;

    // 1. Check definitive positive matches first (shares allotted > 0)
    for (const pattern of positivePatterns) {
      const m = text.match(pattern);
      if (m) {
        status = 'Allotted';
        confidence = 0.98;
        if (m[1]) {
          sharesAllotted = parseInt(m[1], 10);
        }
        break;
      }
    }

    // 2. If not confirmed allotted with shares > 0, check negative patterns
    if (status !== 'Allotted') {
      for (const pattern of negativePatterns) {
        if (pattern.test(text)) {
          status = 'Not Allotted';
          confidence = 0.96;
          break;
        }
      }
    }

    // Extract shares applied
    const appliedMatch = text.match(/(?:shares?\s*applied|applied\s*qty|bid\s*qty)[:\s]+(\d+)/i);
    if (appliedMatch && appliedMatch[1]) {
      sharesApplied = parseInt(appliedMatch[1], 10);
    }

    // If shares allotted wasn't captured from pattern but status is Allotted
    if (status === 'Allotted' && sharesAllotted === 0) {
      const qtyMatch = text.match(/(\d+)\s*(?:shares|equity\s*shares)/i);
      if (qtyMatch && qtyMatch[1]) {
        sharesAllotted = parseInt(qtyMatch[1], 10);
      }
    }

    // Extract PAN snippet if present
    const panMatch = text.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/i);
    const rawPan = panMatch ? panMatch[0].toUpperCase() : undefined;
    const panMatched = rawPan ? `${rawPan.slice(0, 5)}****${rawPan.slice(9)}` : undefined;

    // Extract Application No
    const appNoMatch = text.match(/(?:app(?:lication)?\s*(?:no|number)|bid\s*no)[:\s]+([A-Z0-9_-]+)/i);
    const applicationNo = appNoMatch ? appNoMatch[1] : undefined;

    // Extract Company Name
    const companyMatch = text.match(/(?:company|issue|security)(?:\s*name)?[:\s]+([^\n\r,]+)/i);
    const companyMatched = companyMatch ? companyMatch[1].trim() : undefined;

    // If still unknown, check for general keywords
    if (status === 'Unknown') {
      if (lower.includes('allotted') && !lower.includes('not allotted')) {
        status = 'Allotted';
        confidence = 0.75;
      } else if (lower.includes('refund') || lower.includes('zero')) {
        status = 'Not Allotted';
        confidence = 0.85;
      } else if (lower.includes('under process') || lower.includes('bidding in progress')) {
        status = 'Pending';
        confidence = 0.9;
      }
    }

    return {
      parsedSuccessfully: status !== 'Unknown',
      status,
      sharesApplied: sharesApplied || undefined,
      sharesAllotted: status === 'Not Allotted' ? 0 : sharesAllotted || undefined,
      panMatched,
      applicationNo,
      companyMatched,
      rawConfidence: confidence,
      extractedSnippet: text.slice(0, 160) + (text.length > 160 ? '...' : ''),
    };
  } catch {
    return {
      parsedSuccessfully: false,
      status: 'Unknown',
      rawConfidence: 0,
      extractedSnippet: typeof rawText === 'string' ? rawText.slice(0, 160) : '',
    };
  }
}
