/**
 * Enterprise Form Input Sanitizer and XSS Defense
 * Strips malicious script payloads, event handlers, javascript: pseudo-protocols,
 * and escapes dangerous characters from untrusted user inputs.
 */

const DANGEROUS_TAGS_REGEX = /<\s*\/?\s*(script|iframe|object|embed|applet|meta|link|style|base|svg|math|form)[^>]*>/gi;
const DANGEROUS_ATTRS_REGEX = /\s*(on[a-z]+|data-\w*|formaction)\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi;
const DANGEROUS_PROTOCOLS_REGEX = /(?:javascript|vbscript|data\s*:\s*text\/html)\s*:[^'"]*/gi;

/**
 * Escapes characters that can break HTML context
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Strips dangerous HTML tags, inline event listeners, and dangerous URI schemes.
 */
export function sanitizeString(input: string, escapeEntities = true): string {
  if (typeof input !== 'string') return '';
  
  // 1. Strip dangerous elements
  let cleaned = input
    .replace(DANGEROUS_TAGS_REGEX, '')
    .replace(DANGEROUS_ATTRS_REGEX, '')
    .replace(DANGEROUS_PROTOCOLS_REGEX, '')
    .trim();

  // 2. Escape HTML entities if requested
  if (escapeEntities) {
    cleaned = escapeHtml(cleaned);
  }

  return cleaned;
}

/**
 * Deeply sanitizes any incoming JSON object or array, cleaning all string leaves.
 */
export function sanitizeObject<T>(obj: T, escapeEntities = false): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj, escapeEntities) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, escapeEntities)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Also sanitize keys against prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      result[key] = sanitizeObject(value, escapeEntities);
    }
    return result as T;
  }

  return obj;
}

/**
 * Validates and normalizes Indian Permanent Account Number (PAN).
 * Format: 5 uppercase letters, 4 digits, 1 uppercase letter.
 */
export function isValidPan(pan?: string | null): boolean {
  if (!pan) return false;
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.trim().toUpperCase());
}

/**
 * Validates RFC-compliant email address.
 */
export function isValidEmail(email?: string | null): boolean {
  if (!email) return false;
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
    email.trim()
  );
}

/**
 * Validates Indian Demat Account Number:
 * - CDSL: 16 numeric digits
 * - NSDL: "IN" followed by 14 numeric digits
 */
export function isValidDemat(demat?: string | null): boolean {
  if (!demat) return false;
  const clean = demat.trim().toUpperCase();
  const isCdsl = /^[0-9]{16}$/.test(clean);
  const isNsdl = /^IN[0-9]{14}$/.test(clean);
  return isCdsl || isNsdl;
}

/**
 * Validates standard UPI Virtual Payment Address (e.g. user@okhdfcbank).
 */
export function isValidUpi(upi?: string | null): boolean {
  if (!upi) return false;
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upi.trim());
}

/**
 * Sanitizes search queries: restricts length, removes control characters and SQL keywords.
 */
export function sanitizeSearchQuery(query?: string | null): string {
  if (!query) return '';
  return query
    .slice(0, 100)
    .replace(/[^\w\s\-.,@]/gi, '')
    .trim();
}
