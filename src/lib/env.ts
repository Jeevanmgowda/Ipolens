import { z } from 'zod';

/**
 * Central, Zod-validated server environment.
 *
 * Every variable is optional at parse time so that the app can boot and report a clear
 * "feature not configured" error instead of crashing. Use the `require*` helpers at the
 * point where a feature actually needs its configuration.
 */

const boolish = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().optional(),
  POSTGRES_URL: z.string().optional(),

  UPSTASH_REDIS_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_ANALYSIS_MODEL: z.string().default('gemini-2.5-pro'),
  GEMINI_FAST_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_EMBED_MODEL: z.string().default('gemini-embedding-001'),

  UPSTOX_API_KEY: z.string().optional(),
  UPSTOX_API_SECRET: z.string().optional(),
  UPSTOX_REDIRECT_URI: z.string().optional(),
  UPSTOX_ACCESS_TOKEN: z.string().optional(),

  PAN_ENCRYPTION_KEY: z.string().optional(),
  PAN_HASH_SECRET: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),

  REGISTRAR_DIRECT_QUERY: boolish,

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  TWILIO_TEMPLATE_ALLOTTED_SID: z.string().optional(),
  TWILIO_TEMPLATE_NOT_ALLOTTED_SID: z.string().optional(),

  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:alerts@ipolens.in'),

  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  CLIENT_URL: z.string().default('http://localhost:3000'),
});

export type ServerEnv = z.infer<typeof EnvSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached && process.env.NODE_ENV !== 'test') return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}

/** The AI provider rejected the call because the API key is out of quota or rate-limited. */
export class AiQuotaError extends Error {
  constructor(public readonly provider: string, detail?: string) {
    super(`${provider} API quota or rate limit exceeded for the configured key. Try again later or raise the quota.${detail ? ` (${detail})` : ''}`);
    this.name = 'AiQuotaError';
  }
}

export class ConfigurationError extends Error {
  constructor(public readonly feature: string, public readonly missing: string[]) {
    super(`${feature} is not configured. Missing: ${missing.join(', ')}`);
    this.name = 'ConfigurationError';
  }
}

function requireKeys<K extends keyof ServerEnv>(feature: string, keys: K[]): Required<Pick<ServerEnv, K>> {
  const e = env();
  const missing = keys.filter((k) => !e[k]);
  if (missing.length) throw new ConfigurationError(feature, missing as string[]);
  return e as unknown as Required<Pick<ServerEnv, K>>;
}

export const requireGemini = () => requireKeys('Gemini AI', ['GEMINI_API_KEY']);
export const requireTwilio = () =>
  requireKeys('Twilio WhatsApp', ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM']);
export const requireVapid = () => requireKeys('Web Push', ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']);

export function databaseUrl(): string | undefined {
  const e = env();
  return e.DATABASE_URL || e.POSTGRES_URL;
}

/** Secret used to derive PAN hashes (Redis keys). Never falls back to a constant in production. */
export function panHashSecret(): string {
  const e = env();
  const secret = e.PAN_HASH_SECRET || e.PAN_ENCRYPTION_KEY || e.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (e.NODE_ENV === 'production') {
    throw new ConfigurationError('PAN hashing', ['PAN_HASH_SECRET']);
  }
  return 'ipolens-dev-only-pan-hash-secret';
}
