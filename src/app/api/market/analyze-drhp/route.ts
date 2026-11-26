import { NextRequest, NextResponse } from 'next/server';
import { generateIpoInsight } from '@/lib/services/prospectus-analyzer.service';
import { apiErrorResponse } from '@/lib/security/apiError';
import { requireAiAccess } from '@/lib/security/aiGuard';
import { CompanyNameSchema, firstIssue } from '@/lib/security/schemas';
import { z } from 'zod';

const AnalyzeDrhpBodySchema = z.object({
  companyName: CompanyNameSchema.min(1, 'companyName is required'),
  drhpSummary: z.string().max(30_000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const access = await requireAiAccess(req);
    if ('response' in access) return access.response;

    const parsed = AnalyzeDrhpBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 });
    }
    const { companyName, drhpSummary } = parsed.data;

    const context = drhpSummary || `Draft Red Herring Prospectus for ${companyName} (IPO Offering).`;
    const insight = await generateIpoInsight(companyName, context);

    return NextResponse.json({
      success: true,
      companyName,
      insight,
    });
  } catch (err: any) {
    return apiErrorResponse(err, '/api/market/analyze-drhp');
  }
}
