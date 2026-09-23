import { NextRequest, NextResponse } from 'next/server';
import { generateIpoInsight } from '@/lib/services/prospectus-analyzer.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyName, drhpSummary } = body;

    if (!companyName) {
      return NextResponse.json({ error: 'companyName is required' }, { status: 400 });
    }

    const context = drhpSummary || `Draft Red Herring Prospectus for ${companyName} (IPO Offering).`;
    const insight = await generateIpoInsight(companyName, context);

    return NextResponse.json({
      success: true,
      companyName,
      insight,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
