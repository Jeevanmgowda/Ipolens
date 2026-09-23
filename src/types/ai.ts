export type AnalystVerdict = 'Subscribe' | 'Avoid' | 'Neutral';

export interface FinancialMetric {
  label: string;
  fy22?: string;
  fy23?: string;
  fy24?: string;
  status: 'positive' | 'neutral' | 'negative';
}

export interface DrhpAnalysisResult {
  symbol: string;
  companyName: string;
  verdict: AnalystVerdict;
  verdictReason: string;
  confidenceScore: number; // e.g. 88%
  topStrengths: string[]; // exactly top 3 strengths
  topRisks: string[];     // exactly top 3 risks
  financials: {
    revenueCagr: string;
    ebitdaMargin: string;
    patMargin: string;
    debtToEquity: string;
    peRatio: string;
    industryPe: string;
  };
  metricsTable: FinancialMetric[];
  businessMoat: string;
  disclaimer: string;
  generatedAt: string;
  source: string;
}
