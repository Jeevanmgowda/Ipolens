import { NextResponse } from 'next/server';
import { AiTradingPredictionService } from '@/lib/services/ai-trading-prediction.service';
import { AiPredictionRequest } from '@/types/ai-prediction';

export const dynamic = 'force-dynamic';

/**
 * POST /api/market/ai-prediction
 * Generates an institutional AI stock trading forecast, entry/exit targets,
 * risk-to-reward metrics, and technical indicator telemetry for any IPO or stock.
 */
export async function POST(request: Request) {
  try {
    const body: AiPredictionRequest = await request.json();

    if (!body || !body.symbol) {
      return NextResponse.json(
        {
          success: false,
          error: 'Stock/IPO symbol is required for AI prediction analysis.',
        },
        { status: 400 }
      );
    }

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
        error: error.message || 'Failed to generate AI stock trading prediction.',
      },
      { status: 500 }
    );
  }
}
