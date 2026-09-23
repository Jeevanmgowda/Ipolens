export interface TokenMapping {
  symbol: string;
  token: string;
  exchange: 'NSE' | 'BSE';
  companyName: string;
  series: 'EQ' | 'SME';
}

// Master symbol-to-token registry for landmark listed IPOs on NSE Equity
export const SYMBOL_TOKEN_REGISTRY: Record<string, TokenMapping> = {
  TATATECH: {
    symbol: 'TATATECH',
    token: '1594',
    exchange: 'NSE',
    companyName: 'Tata Technologies Limited',
    series: 'EQ',
  },
  BAJAJHFL: {
    symbol: 'BAJAJHFL',
    token: '19385',
    exchange: 'NSE',
    companyName: 'Bajaj Housing Finance Limited',
    series: 'EQ',
  },
  PREMIERENE: {
    symbol: 'PREMIERENE',
    token: '18992',
    exchange: 'NSE',
    companyName: 'Premier Energies Limited',
    series: 'EQ',
  },
  KRN: {
    symbol: 'KRN',
    token: '20721',
    exchange: 'NSE',
    companyName: 'KRN Heat Exchanger and Refrigeration Limited',
    series: 'EQ',
  },
  SWIGGY: {
    symbol: 'SWIGGY',
    token: '22401',
    exchange: 'NSE',
    companyName: 'Swiggy Limited',
    series: 'EQ',
  },
  HYUNDAI: {
    symbol: 'HYUNDAI',
    token: '22150',
    exchange: 'NSE',
    companyName: 'Hyundai Motor India Limited',
    series: 'EQ',
  },
  NETWEB: {
    symbol: 'NETWEB',
    token: '14234',
    exchange: 'NSE',
    companyName: 'Netweb Technologies India Limited',
    series: 'EQ',
  },
  IREDA: {
    symbol: 'IREDA',
    token: '14820',
    exchange: 'NSE',
    companyName: 'Indian Renewable Energy Dev Agency Limited',
    series: 'EQ',
  },
  DOMS: {
    symbol: 'DOMS',
    token: '15330',
    exchange: 'NSE',
    companyName: 'DOMS Industries Limited',
    series: 'EQ',
  },
  JYOTICNC: {
    symbol: 'JYOTICNC',
    token: '15998',
    exchange: 'NSE',
    companyName: 'Jyoti CNC Automation Limited',
    series: 'EQ',
  },
  MANKIND: {
    symbol: 'MANKIND',
    token: '13116',
    exchange: 'NSE',
    companyName: 'Mankind Pharma Limited',
    series: 'EQ',
  },
  DEEDEV: {
    symbol: 'DEEDEV',
    token: '18490',
    exchange: 'NSE',
    companyName: 'DEE Development Engineers Limited',
    series: 'EQ',
  },
  CONCORDBIO: {
    symbol: 'CONCORDBIO',
    token: '14428',
    exchange: 'NSE',
    companyName: 'Concord Biotech Limited',
    series: 'EQ',
  },
  NORTHARC: {
    symbol: 'NORTHARC',
    token: '20235',
    exchange: 'NSE',
    companyName: 'Northern Arc Capital Limited',
    series: 'EQ',
  },
  ARKADE: {
    symbol: 'ARKADE',
    token: '20240',
    exchange: 'NSE',
    companyName: 'Arkade Developers Limited',
    series: 'EQ',
  },
  WCIL: {
    symbol: 'WCIL',
    token: '20245',
    exchange: 'NSE',
    companyName: 'Western Carriers (India) Limited',
    series: 'EQ',
  },
  FIRSTCRY: {
    symbol: 'FIRSTCRY',
    token: '18880',
    exchange: 'NSE',
    companyName: 'Brainbees Solutions Limited',
    series: 'EQ',
  },
  OLAELEC: {
    symbol: 'OLAELEC',
    token: '18865',
    exchange: 'NSE',
    companyName: 'Ola Electric Mobility Limited',
    series: 'EQ',
  },
  AKUMS: {
    symbol: 'AKUMS',
    token: '18790',
    exchange: 'NSE',
    companyName: 'Akums Drugs and Pharmaceuticals Limited',
    series: 'EQ',
  },
  CEIGALL: {
    symbol: 'CEIGALL',
    token: '18820',
    exchange: 'NSE',
    companyName: 'Ceigall India Limited',
    series: 'EQ',
  },
};

export class SymbolTokenService {
  /**
   * Resolves an NSE symbol (e.g., 'TATATECH') to its exchange token (e.g., '1594')
   */
  static getTokenBySymbol(symbol: string): string | null {
    const clean = symbol.toUpperCase().replace(/\.NS$/, '').replace(/^NSE:/, '').trim();
    if (SYMBOL_TOKEN_REGISTRY[clean]) {
      return SYMBOL_TOKEN_REGISTRY[clean].token;
    }
    return null;
  }

  /**
   * Resolves an exchange token back to its stock symbol and metadata
   */
  static getSymbolByToken(token: string): TokenMapping | null {
    const cleanToken = token.trim();
    for (const item of Object.values(SYMBOL_TOKEN_REGISTRY)) {
      if (item.token === cleanToken) {
        return item;
      }
    }
    return null;
  }

  /**
   * Retrieves all active tokens for live subscription feeds
   */
  static getAllTokens(): string[] {
    return Object.values(SYMBOL_TOKEN_REGISTRY).map((i) => i.token);
  }
}
