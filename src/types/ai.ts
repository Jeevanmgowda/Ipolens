export type AnalystVerdict = 'Subscribe' | 'Avoid' | 'Neutral';

export interface FinancialMetric {
  label: string;
  fy22?: string;
  fy23?: string;
  fy24?: string;
  status: 'positive' | 'neutral' | 'negative';
}

export interface CitationItem {
  claim: string;
  pageNumber: number;
  excerpt: string;
}

export interface RagChunk {
  id: string;
  section: string;
  pageNumber: number;
  content: string;
  keywords: string[];
}

export interface RetrievedChunk {
  id: string;
  section: string;
  pageNumber: number;
  snippet: string;
  score: number;
}

export interface RagQueryResult {
  question: string;
  answer: string;
  confidenceScore: number;
  retrievedChunks: RetrievedChunk[];
  pageCitations: number[];
  notFound?: boolean;
}

export interface DrhpSectionOverview {
  id: string;
  title: string;
  chapterNumber: number;
  pageRange: string;
  summary: string;
  keyFindings: string[];
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ForensicRiskCategory {
  category: string;
  rating: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number; // 0 - 100 (higher = safer)
  detail: string;
  citationPage?: number;
  section?: string;
}

export interface QaInteraction {
  question: string;
  answer: string;
  pageCitations: number[];
  retrievedChunks?: RetrievedChunk[];
  notFound?: boolean;
}

export interface LiveIpoTelemetry {
  status: string;
  priceBand: string;
  issueSizeCr: number;
  lotSize: number;
  minInvestment: number;
  subscriptionTotal?: number;
  subscriptionRetail?: number;
  subscriptionNii?: number;
  subscriptionQib?: number;
  gmpEstimate?: number;
  expectedListingGainPct?: number;
  registrarName?: string;
  registrarUrl?: string;
  issueDates?: string;
  series?: string;
}

export interface DrhpAnalysisResult {
  symbol: string;
  companyName: string;
  verdict: AnalystVerdict;
  verdictReason: string;
  confidenceScore: number; // e.g. 88%
  topStrengths: string[]; // top strengths with citations
  topRisks: string[];     // top risks with citations
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
  // Phase 4 Document Grounding & Citations
  documentName?: string;
  pageCount?: number;
  extractionQuality?: 'HIGH' | 'MEDIUM' | 'SCANNED_DEGRADED' | 'SYNTHESIZED';
  issueStructure?: {
    freshIssueCr?: number;
    ofsCr?: number;
    totalSizeCr?: number;
  };
  useOfProceeds?: string[];
  promotersShareholding?: {
    promoterNames?: string[];
    preIpoPct?: number;
    postIpoPct?: number;
  };
  litigations?: string[];
  citations?: CitationItem[];
  qaHistory?: QaInteraction[];
  liveTelemetry?: LiveIpoTelemetry;
  ragIndexReady?: boolean;
  sections?: DrhpSectionOverview[];
  forensicRiskMatrix?: ForensicRiskCategory[];
}
