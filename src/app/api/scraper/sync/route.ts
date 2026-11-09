import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
      { exists: false, error: error.message || 'Failed to inspect scraper feed status' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const monthsBack = typeof body.months === 'number' ? body.months : 1;
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'scraper', 'merge.py');

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { success: false, error: 'Scraper script scripts/scraper/merge.py not found.' },
        { status: 404 }
      );
    }

    // Execute python scripts/scraper/merge.py
    const cmd = `python "${scriptPath}" --months ${monthsBack}`;
    const { stdout, stderr } = await execAsync(cmd, {
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

    return NextResponse.json({
      success: true,
      message: 'Scraper completed successfully.',
      stdout: stdout.trim(),
      stderr: stderr.trim() || undefined,
      generatedAt: resultPayload?.generatedAt,
      totalCount: resultPayload?.totalCount || (resultPayload?.ipos?.length ?? 0),
      summary: resultPayload?.summary,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute scraper worker',
        stderr: error.stderr?.toString() || undefined,
      },
      { status: 500 }
    );
  }
}

