import { NextResponse } from 'next/server';
import { AiTradingPredictionService } from '@/lib/services/ai-trading-prediction.service';
import { AiPredictionRequest } from '@/types/ai-prediction';
import { publicErrorMessage } from '@/lib/security/apiError';
import { requireAiAccess } from '@/lib/security/aiGuard';
import { CompanyNameSchema, SymbolSchema, firstIssue } from '@/lib/security/schemas';
import { z } from 'zod';

const CandleSchema = z.object({
  time: z.string().max(40),
  open: z.number().finite().nonnegative(),
  high: z.number().finite().nonnegative(),
  low: z.number().finite().nonnegative(),
  close: z.number().finite().nonnegative(),
  volume: z.number().finite().nonnegative().optional(),
});

const AiPredictionBodySchema = z.object({
  symbol: SymbolSchema,
  companyName: CompanyNameSchema.optional(),
  timeframe: z.string().max(10).regex(/^[0-9A-Za-z]+$/).optional(),
  currentPrice: z.number().finite().positive().max(10_000_000).optional(),
  candles: z.array(CandleSchema).max(1000).optional(),
});

export const dynamic = 'force-dynamic';

/**
 * POST /api/market/ai-prediction
 * Generates an institutional AI stock trading forecast, entry/exit targets,
 * risk-to-reward metrics, and technical indicator telemetry for any IPO or stock.
 */
export async function POST(request: Request) {
  try {
    const access = await requireAiAccess(request);
    if ('response' in access) return access.response;

    const parsed = AiPredictionBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 });
    }
    const body: AiPredictionRequest = parsed.data;

    const prediction = await AiTradingPredictionService.analyzeStock(body);

    return NextResponse.json({
      success: true,
      data: prediction,
    });
  } catch (error: any) {
    console.error('[AiPredictionRoute] Error processing prediction request:', error);
    return NextResponse.json(
      {
        success: false,
        error: publicErrorMessage(error, 'Failed to generate AI stock trading prediction.'),
      },
      { status: 500 }
    );
  }
}
