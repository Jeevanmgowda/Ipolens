import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getAuthenticatedUser } from '@/lib/security/session';
import { publicErrorMessage } from '@/lib/security/apiError';

const execFileAsync = promisify(execFile);

/** Constant-time comparison of the Authorization header with `Bearer <CRON_SECRET>` (audit L2). */
function isValidCronAuth(authHeader: string, cronSecret: string | undefined): boolean {
  if (!cronSecret) return false;
  const given = crypto.createHash('sha256').update(authHeader).digest();
  const expected = crypto.createHash('sha256').update(`Bearer ${cronSecret}`).digest();
  return crypto.timingSafeEqual(given, expected);
}

const ROOT_DATA_FILE = path.resolve(process.cwd(), 'data', 'ipos.json');
const SCRIPTS_DATA_FILE = path.resolve(process.cwd(), 'scripts', 'data', 'ipos.json');

function getAvailableDataFile(): string | null {
  if (fs.existsSync(ROOT_DATA_FILE)) return ROOT_DATA_FILE;
  if (fs.existsSync(SCRIPTS_DATA_FILE)) return SCRIPTS_DATA_FILE;
  return null;
}

export async function GET() {
  try {
    const dataFile = getAvailableDataFile();

    if (!dataFile) {
      return NextResponse.json({
        exists: false,
        message: 'No scraped data feed found at data/ipos.json. Run "npm run scrape" to generate it.',
        totalCount: 0,
        summary: { open: 0, upcoming: 0, closed: 0, listed: 0 },
        generatedAt: null,
        ageMinutes: null,
      });
    }

    const raw = fs.readFileSync(dataFile, 'utf-8');
    const parsed = JSON.parse(raw);
    const ipos = Array.isArray(parsed.ipos) ? parsed.ipos : [];

    let ageMinutes: number | null = null;
    if (parsed.generatedAt) {
      const genTime = new Date(parsed.generatedAt).getTime();
      if (!isNaN(genTime)) {
        ageMinutes = Math.round((Date.now() - genTime) / (1000 * 60));
      }
    }

    const summary = parsed.summary || {
      open: ipos.filter((r: any) => r.status === 'open' || r.status === 'Active').length,
      upcoming: ipos.filter((r: any) => r.status === 'upcoming' || r.status === 'Forthcoming').length,
      closed: ipos.filter((r: any) => r.status === 'closed' || r.status === 'Closed').length,
      listed: ipos.filter((r: any) => r.status === 'listed' || r.status === 'Listed').length,
    };

    return NextResponse.json({
      exists: true,
      path: path.relative(process.cwd(), dataFile),
      generatedAt: parsed.generatedAt || null,
      ageMinutes,
      totalCount: ipos.length,
      summary,
      sources: ['NSE India (Official Exchange)', 'BSE India (Official Exchange)', 'InvestorGain GMP (Market Intel)'],
      sampleSymbols: ipos.slice(0, 5).map((r: any) => r.symbol),
    });
  } catch (error: any) {
    return NextResponse.json(
      { exists: false, error: publicErrorMessage(error, 'Failed to inspect scraper feed status') },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // 1. Enforce RBAC or CRON_SECRET authentication
    const authHeader = req.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuthorized = isValidCronAuth(authHeader, cronSecret);

    const user = await getAuthenticatedUser(req);
    const isAdminUser = user && user.role === 'admin';

    if (!isCronAuthorized && !isAdminUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied: Administrative privileges or a valid CRON_SECRET is required.',
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    // Strictly validate and clamp monthsBack (integer between 1 and 12)
    const rawMonths = Number(body.months);
    const monthsBack = Number.isInteger(rawMonths) ? Math.min(12, Math.max(1, rawMonths)) : 1;
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'scraper', 'merge.py');

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { success: false, error: 'Scraper script scripts/scraper/merge.py not found.' },
        { status: 404 }
      );
    }

    // Execute python scripts/scraper/merge.py safely
    // execFile with an argument array: no shell, so nothing can be injected (audit L2).
    const { stdout, stderr } = await execFileAsync('python', [scriptPath, '--months', String(monthsBack)], {
      timeout: 45000,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    const dataFile = getAvailableDataFile();
    let resultPayload: any = null;
    if (dataFile && fs.existsSync(dataFile)) {
      try {
        resultPayload = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
      } catch {
        // optional parse
      }
    }

    const isProd = process.env.NODE_ENV === 'production';

    return NextResponse.json({
      success: true,
      message: 'Scraper completed successfully.',
      stdout: isProd ? 'Execution completed.' : stdout.trim(),
      stderr: isProd ? undefined : (stderr.trim() || undefined),
      generatedAt: resultPayload?.generatedAt,
      totalCount: resultPayload?.totalCount || (resultPayload?.ipos?.length ?? 0),
      summary: resultPayload?.summary,
    });
  } catch (error: any) {
    const isProd = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      {
        success: false,
        error: isProd ? 'Internal server error executing scraper' : (error.message || 'Failed to execute scraper worker'),
        stderr: isProd ? undefined : (error.stderr?.toString() || undefined),
      },
      { status: 500 }
    );
  }
}

