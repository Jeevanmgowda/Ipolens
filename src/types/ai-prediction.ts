export type TradingSignalType =
  | 'STRONG BUY'
  | 'BUY'
  | 'HOLD / ACCUMULATE'
  | 'TRIM / TAKE PROFIT'
  | 'SELL / AVOID';

export type TrendDirection = 'BULLISH' | 'NEUTRAL' | 'BEARISH';

export interface KeyPriceLevel {
  level: number;
  label: string;
  type: 'support' | 'resistance' | 'pivot' | 'stop_loss' | 'target';
  strength: 'Minor' | 'Moderate' | 'Major';
}

export interface TechnicalTelemetry {
  rsi14: number;
  rsiCondition: 'Oversold' | 'Neutral' | 'Overbought';
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    trend: 'Bullish Crossover' | 'Bearish Crossover' | 'Bullish Expansion' | 'Bearish Expansion' | 'Neutral';
  };
  emaStructure: {
    ema9: number;
    ema21: number;
    sma50: number;
    alignment: 'Bullish Stack' | 'Bearish Stack' | 'Mean Reverting' | 'Neutral';
  };
  volumeRatio: number; // e.g. 1.34 = +34% above 20-period avg
  volumeTrend: 'Heavy Accumulation' | 'Normal' | 'Distribution Surge' | 'Low Volume Squeeze';
  supportLevels: number[];
  resistanceLevels: number[];
  pivotPoint: number;
  detectedPattern: string;
}

export interface TradeSetup {
  timeframe: string;
  recommendedHorizon: string; // e.g. 'Intraday (1D)' | 'Short-Term Swing (2-5 Days)' | 'Positional'
  entryRange: {
    low: number;
    high: number;
  };
  target1: number;
  target1GainPct: number;
  target2: number;
  target2GainPct: number;
  stopLoss: number;
  stopLossRiskPct: number;
  riskRewardRatio: string; // e.g. '1 : 2.6'
  triggerCondition: string;
  invalidationLevel: number;
  riskManagementNote: string;
}

export interface AiStockPrediction {
  symbol: string;
  companyName: string;
  timeframe: string;
  currentPrice: number;
  priceChange: number;
  priceChangePct: number;
  signal: TradingSignalType;
  convictionScore: number; // 0 to 100
  trendDirection: TrendDirection;
  actionSummary: string;
  technicalTelemetry: TechnicalTelemetry;
  tradeSetup: TradeSetup;
  institutionalAnalysis: {
    priceActionNarrative: string;
    confluenceFactors: string[];
    riskFactors: string[];
    institutionalVerdict: string;
  };
  engineModel: string;
  generatedAt: string;
}

export interface AiPredictionRequest {
  symbol: string;
  companyName?: string;
  timeframe?: string;
  currentPrice?: number;
  candles?: Array<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>;
}

export interface AiPredictionResponse {
  success: boolean;
  data?: AiStockPrediction;
  error?: string;
}
