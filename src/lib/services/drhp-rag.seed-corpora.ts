import type { RagChunk, DrhpSectionOverview, ForensicRiskCategory } from '@/types/ai';

export interface IndexedDrhpDocument {
  symbol: string;
  companyName: string;
  documentName: string;
  pageCount: number;
  indexedAt: string;
  chunks: RagChunk[];
  sections: DrhpSectionOverview[];
  forensicRiskMatrix: ForensicRiskCategory[];
}

/**
 * Pre-seeded DRHP knowledge bases for the top Live IPO Radar tickers.
 * Built fresh on each call so `indexedAt` reflects the time of seeding.
 */
export function buildSeedCorpora(): IndexedDrhpDocument[] {
  return [
    // 1. JIO PLATFORMS (JIOPLAT)
    {
      symbol: 'JIOPLAT',
      companyName: 'Jio Platforms Limited',
      documentName: 'SEBI_JPL_DRHP_Filing.pdf',
      pageCount: 540,
      indexedAt: new Date().toISOString(),
      chunks: [
        {
          id: 'jpl-1',
          section: 'Objects of the Offer',
          pageNumber: 42,
          content: 'Objects of the Issue: Gross proceeds from the Fresh Issue of ₹30,000 Cr shall be utilized towards (i) ₹18,500 Cr for pan-India 5G standalone cell densification and fiber backhaul deployment, (ii) ₹6,500 Cr for AI hyperscale computing data centers across Navi Mumbai and Jamnagar, and (iii) General corporate purposes.',
          keywords: ['5g', 'capex', 'fiber', 'data center', 'objects', 'fresh issue'],
        },
        {
          id: 'jpl-2',
          section: 'Capital Structure & Promoter Holdings',
          pageNumber: 78,
          content: 'Capital Structure: The Promoter, Reliance Industries Limited, holds 100% of the pre-offer equity share capital of the Company. Post the Offer for Sale of ₹20,000 Cr, promoter holding shall stand at 84.8%, strictly adhering to SEBI minimum public shareholding norms. Mandatory promoter lock-in of 18 months applies.',
          keywords: ['promoter', 'reliance', 'lock-in', 'shareholding', 'dilution'],
        },
        {
          id: 'jpl-3',
          section: 'Financial Statements & Operating Performance',
          pageNumber: 164,
          content: 'Financial Statements: Restated consolidated revenue from operations grew at a 21.4% 3-year CAGR from ₹76,977 Cr in FY22 to ₹1,12,400 Cr in FY24. Operating EBITDA expanded to 51.8% driven by subscriber ARPU growth to ₹204.5. Net Debt to Equity ratio is 0.18 with robust annual free cash flow exceeding ₹28,000 Cr.',
          keywords: ['revenue', 'cagr', 'ebitda', 'margin', 'arpu', 'debt'],
        },
        {
          id: 'jpl-4',
          section: 'Risk Factors & Regulatory Scrutiny',
          pageNumber: 94,
          content: 'Risk Factors: (i) Capital-intensive industry requiring sustained Capex in 6G technology and spectrum auctions conducted by the Department of Telecommunications (DoT), (ii) Intense competition in cloud services and enterprise software from global hyperscalers, (iii) Cybersecurity vulnerabilities inherent in nationwide digital infrastructure.',
          keywords: ['risk', 'spectrum', 'dot', 'telecom', 'capex', 'cybersecurity'],
        },
        {
          id: 'jpl-5',
          section: 'Outstanding Litigation & Defaults',
          pageNumber: 288,
          content: 'Outstanding Litigation: There are no material civil or criminal proceedings pending against the Promoters that jeopardize the operating status. Direct tax appeals totaling ₹412 Cr are actively contested before the ITAT with favorable legal opinions from senior counsel.',
          keywords: ['litigation', 'tax', 'itat', 'proceedings', 'appeals'],
        },
        {
          id: 'jpl-6',
          section: 'Business Moat & Subscriber Metrics',
          pageNumber: 110,
          content: 'Business Moat: Over 470 million active digital subscribers forming the largest telecom ecosystem in India. Comprehensive digital stack spanning 5G Standalone network, JioCinema, JioFiber broadband, and UPI merchant rails create unassailable network effects.',
          keywords: ['subscribers', 'moat', '5g', 'jiocinema', 'ecosystem'],
        },
      ],
      sections: [
        {
          id: 'jpl-s1',
          title: 'Objects of the Offer & Capex Allocation',
          chapterNumber: 1,
          pageRange: 'Pages 38–54',
          summary: 'Utilization of ₹30,000 Cr fresh issue proceeds for 5G Standalone and hyperscale AI cloud centers.',
          keyFindings: ['₹18,500 Cr 5G network expansion', '₹6,500 Cr AI data center clusters', 'Zero bank debt prepayment required'],
          riskRating: 'LOW',
        },
        {
          id: 'jpl-s2',
          title: 'Promoter Shareholding & RIL Control',
          chapterNumber: 2,
          pageRange: 'Pages 55–85',
          summary: 'Reliance Industries retains 84.8% post-issue equity stake with 18-month lock-in.',
          keyFindings: ['RIL controls 84.8% post-IPO', 'Anchor lock-in 50% 30-day, 50% 90-day', 'Full SEBI compliance'],
          riskRating: 'LOW',
        },
        {
          id: 'jpl-s3',
          title: 'Operational Margins & ARPU Trajectory',
          chapterNumber: 3,
          pageRange: 'Pages 150–210',
          summary: 'Industry-leading 51.8% EBITDA margins with ARPU expanding to ₹204.5.',
          keyFindings: ['21.4% 3-year revenue CAGR', 'Debt-to-equity at conservative 0.18', 'Free cash flows > ₹28,000 Cr'],
          riskRating: 'LOW',
        },
      ],
      forensicRiskMatrix: [
        {
          category: 'Customer Concentration',
          rating: 'LOW',
          score: 95,
          detail: '470M+ distributed retail & B2B subscriber base with no single enterprise exceeding 1.2% of turnover.',
          citationPage: 110,
          section: 'Business Operations',
        },
        {
          category: 'Promoter Dilution & OFS Exit',
          rating: 'LOW',
          score: 90,
          detail: '60% Fresh Issue / 40% OFS. RIL maintains absolute strategic voting control at 84.8%.',
          citationPage: 78,
          section: 'Capital Structure',
        },
        {
          category: 'Debt & Financial Leverage',
          rating: 'LOW',
          score: 92,
          detail: '0.18 D/E ratio supported by ₹28,000+ Cr annual operating cash flows.',
          citationPage: 164,
          section: 'Financial Information',
        },
        {
          category: 'Litigations & Regulatory Notices',
          rating: 'LOW',
          score: 88,
          detail: 'Contingent tax disputes accounted for with adequate reserves; no promoter governance sanctions.',
          citationPage: 288,
          section: 'Outstanding Litigation',
        },
        {
          category: 'Valuation vs Telecom Sector',
          rating: 'LOW',
          score: 86,
          detail: 'Valuation at 34.5x P/E is justified by dominant market share and high operating margins.',
          citationPage: 215,
          section: 'Basis for Offer Price',
        },
      ],
    },

    // 2. SWIGGY (SWIGGY)
    {
      symbol: 'SWIGGY',
      companyName: 'Swiggy Limited',
      documentName: 'SEBI_SWIGGY_DRHP_Filing.pdf',
      pageCount: 620,
      indexedAt: new Date().toISOString(),
      chunks: [
        {
          id: 'swiggy-1',
          section: 'Objects of the Offer',
          pageNumber: 52,
          content: 'Objects of the Offer: Fresh issue proceeds of ₹4,499 Cr will be utilized towards (i) ₹1,178 Cr for investment in dark store network of Instamart, (ii) ₹1,032 Cr for brand marketing and user incentives, (iii) ₹703 Cr for technology and cloud infrastructure, and (iv) inorganic growth acquisitions.',
          keywords: ['instamart', 'dark store', 'marketing', 'objects', 'fresh issue'],
        },
        {
          id: 'swiggy-2',
          section: 'Financial Statements & Unit Economics',
          pageNumber: 180,
          content: 'Financial Performance: Gross Order Value (GOV) reached ₹35,000 Cr across food delivery and Instamart quick commerce. Food delivery contribution margin improved to 6.8% of GOV. Instamart dark store network reached 550+ hubs with dark-store level EBITDA breakeven achieved in mature clusters.',
          keywords: ['gov', 'instamart', 'contribution margin', 'ebitda', 'quick commerce'],
        },
        {
          id: 'swiggy-3',
          section: 'Risk Factors & Industry Competition',
          pageNumber: 98,
          content: 'Risk Factors: (i) Intense duopolistic competition from Zomato and Blinkit in food delivery and 10-minute quick commerce, (ii) Gig worker regulatory frameworks and minimum wage state policies, (iii) Historical consolidated net losses of ₹2,350 Cr in FY24.',
          keywords: ['zomato', 'blinkit', 'gig worker', 'competition', 'net loss', 'risks'],
        },
        {
          id: 'swiggy-4',
          section: 'Capital Structure & Major Shareholders',
          pageNumber: 88,
          content: 'Shareholding Pattern: Major institutional backers include Prosus (32.6%), SoftBank, and Accel. Pre-IPO promoter holding is zero as the company is professionally managed. OFS comprises ₹6,828 Cr from financial investors.',
          keywords: ['prosus', 'softbank', 'accel', 'shareholding', 'ofs'],
        },
      ],
      sections: [
        {
          id: 'sw-s1',
          title: 'Quick Commerce & Instamart Expansion Plan',
          chapterNumber: 1,
          pageRange: 'Pages 48–65',
          summary: 'Scaling dark stores from 550 to 900+ hubs across tier-1 and tier-2 Indian metropolitan areas.',
          keyFindings: ['₹1,178 Cr dedicated to dark store expansion', 'Average order delivery time: 12.4 minutes', 'Mature stores cash flow positive'],
          riskRating: 'MEDIUM',
        },
        {
          id: 'sw-s2',
          title: 'Contribution Margins & Path to Net Profitability',
          chapterNumber: 2,
          pageRange: 'Pages 175–220',
          summary: 'Food delivery business delivers steady 6.8% contribution margin while quick commerce scales.',
          keyFindings: ['Food delivery adjusted EBITDA positive', 'Instamart unit economics improving', 'Consolidated losses narrowing YoY'],
          riskRating: 'MEDIUM',
        },
      ],
      forensicRiskMatrix: [
        {
          category: 'Customer Concentration',
          rating: 'LOW',
          score: 92,
          detail: 'Millions of end-consumers with high app retention; zero B2B counterparty concentration.',
          citationPage: 120,
          section: 'Business Model',
        },
        {
          category: 'Promoter Dilution & OFS Exit',
          rating: 'MEDIUM',
          score: 65,
          detail: 'Professionally managed company without identified promoter; VC investors selling ₹6,828 Cr in OFS.',
          citationPage: 88,
          section: 'Capital Structure',
        },
        {
          category: 'Debt & Financial Leverage',
          rating: 'LOW',
          score: 85,
          detail: 'Zero long-term bank debt with ₹4,800+ Cr in cash & equivalents.',
          citationPage: 190,
          section: 'Balance Sheet',
        },
        {
          category: 'Litigations & Gig Worker Policy',
          rating: 'MEDIUM',
          score: 68,
          detail: 'State gig-worker welfare legislation (e.g. Karnataka & Rajasthan) may impact rider payout costs.',
          citationPage: 104,
          section: 'Risk Factors',
        },
        {
          category: 'Valuation vs Peers',
          rating: 'MEDIUM',
          score: 70,
          detail: 'Priced at an EV/GOV discount of ~25% compared to peer Zomato, offering re-rating potential.',
          citationPage: 235,
          section: 'Basis for Offer Price',
        },
      ],
    },

    // 3. HYUNDAI MOTOR INDIA (HYUNDAI)
    {
      symbol: 'HYUNDAI',
      companyName: 'Hyundai Motor India Limited',
      documentName: 'SEBI_HYUNDAI_DRHP_Filing.pdf',
      pageCount: 512,
      indexedAt: new Date().toISOString(),
      chunks: [
        {
          id: 'hmil-1',
          section: 'Objects of the Offer',
          pageNumber: 36,
          content: 'Objects of the Issue: 100% Offer for Sale of 142,194,700 Equity Shares by Promoter Hyundai Motor Company (Korea) totaling ₹27,870 Cr. The Company will not receive any proceeds from the Offer. All proceeds go to the Selling Shareholder.',
          keywords: ['ofs', 'promoter', 'korea', 'objects', '100% ofs'],
        },
        {
          id: 'hmil-2',
          section: 'Financial Performance & Profitability',
          pageNumber: 152,
          content: 'Financial Statements: Revenue from operations stood at ₹69,829 Cr in FY24 with PAT of ₹6,060 Cr (PAT margin of 8.7%). RoCE was exceptionally strong at 28.5% and RoNW at 24.2%. Strong balance sheet with net cash position and zero long-term borrowings.',
          keywords: ['revenue', 'pat', 'margin', 'roce', 'ronw', 'net cash'],
        },
        {
          id: 'hmil-3',
          section: 'Royalty & Related Party Disclosures',
          pageNumber: 198,
          content: 'Related Party Transactions & Royalty: Royalty paid to parent Hyundai Motor Company is capped at 3.5% of revenue, in line with international automotive standards. The Talegaon manufacturing plant acquisition will expand capacity from 824,000 units to over 1,000,000 units by FY26.',
          keywords: ['royalty', 'parent', 'talegaon', 'capacity', 'related party'],
        },
      ],
      sections: [
        {
          id: 'hmil-s1',
          title: 'Offer Structure: 100% OFS Disclosures',
          chapterNumber: 1,
          pageRange: 'Pages 32–45',
          summary: 'Mega ₹27,870 Cr OFS by Korean parent entity with zero fresh issue proceeds to the company.',
          keyFindings: ['Entire issue is OFS by parent', 'Zero dilution of operating balance sheet', 'Parent retains 82.5% stake'],
          riskRating: 'MEDIUM',
        },
      ],
      forensicRiskMatrix: [
        {
          category: 'Promoter Dilution & OFS Exit',
          rating: 'MEDIUM',
          score: 62,
          detail: '100% of the ₹27,870 Cr issue is OFS by parent entity; no fresh growth capital enters company.',
          citationPage: 36,
          section: 'Objects of the Offer',
        },
        {
          category: 'Debt & Financial Leverage',
          rating: 'LOW',
          score: 95,
          detail: 'Debt-free entity with robust annual free cash flow exceeding ₹5,000 Cr.',
          citationPage: 152,
          section: 'Financial Statements',
        },
        {
          category: 'Royalty to Parent Entity',
          rating: 'MEDIUM',
          score: 72,
          detail: 'Royalty payable to HMC Korea fixed at 3.5% of revenue, impacting operating margins.',
          citationPage: 198,
          section: 'Related Party Disclosures',
        },
      ],
    },

    // 4. BAJAJ HOUSING FINANCE (BAJAJHFL)
    {
      symbol: 'BAJAJHFL',
      companyName: 'Bajaj Housing Finance Limited',
      documentName: 'SEBI_BAJAJHFL_DRHP_Filing.pdf',
      pageCount: 480,
      indexedAt: new Date().toISOString(),
      chunks: [
        {
          id: 'bhfl-1',
          section: 'Objects of the Offer',
          pageNumber: 44,
          content: 'Objects of the Issue: Total issue of ₹6,560 Cr comprising Fresh Issue of ₹3,560 Cr to augment Tier-I capital base to meet future business requirements, and OFS of ₹3,000 Cr by Bajaj Finance Limited.',
          keywords: ['tier-1', 'capital base', 'fresh issue', 'bajaj finance', 'objects'],
        },
        {
          id: 'bhfl-2',
          section: 'Asset Quality & AUM Metrics',
          pageNumber: 135,
          content: 'Asset Quality & Balance Sheet: Assets Under Management (AUM) crossed ₹97,071 Cr with pristine asset quality. Gross NPA stands at 0.27% and Net NPA at 0.10%, the lowest among major Indian housing finance companies. Capital Adequacy Ratio (CRAR) is 21.1%.',
          keywords: ['aum', 'gnpa', 'nnpa', 'crar', 'capital adequacy', 'housing finance'],
        },
      ],
      sections: [
        {
          id: 'bhfl-s1',
          title: 'Tier-I Capital Augmentation & RBI Compliance',
          chapterNumber: 1,
          pageRange: 'Pages 40–58',
          summary: 'Strengthening capital adequacy above 24% to support 30%+ AUM expansion.',
          keyFindings: ['₹3,560 Cr fresh Tier-I equity', 'GNPA: 0.27% / NNPA: 0.10%', 'Backed by Bajaj Group brand'],
          riskRating: 'LOW',
        },
      ],
      forensicRiskMatrix: [
        {
          category: 'Asset Quality & Credit Risk',
          rating: 'LOW',
          score: 96,
          detail: 'Best-in-class GNPA of 0.27% backed by 85%+ prime salaried customer profile.',
          citationPage: 135,
          section: 'Asset Quality',
        },
        {
          category: 'Promoter Backing & Parentage',
          rating: 'LOW',
          score: 94,
          detail: 'Subsidiary of Bajaj Finance & Bajaj Finserv; blue-chip governance track record.',
          citationPage: 60,
          section: 'Promoters',
        },
      ],
    },

    // 5. HD FIRE PROTECT (HDFP)
    {
      symbol: 'HDFP',
      companyName: 'HD Fire Protect Limited',
      documentName: 'SEBI_HDFP_DRHP_Filing.pdf',
      pageCount: 380,
      indexedAt: new Date().toISOString(),
      chunks: [
        {
          id: 'hdfp-1',
          section: 'Objects of the Offer',
          pageNumber: 38,
          content: 'Objects of the Issue: Total issue of ₹350 Cr comprising Fresh Issue of ₹250 Cr for setting up a specialized automated foundry unit in Thane and ₹100 Cr OFS by promoters. ₹60 Cr earmarked for long-term working capital.',
          keywords: ['foundry', 'thane', 'working capital', 'objects', 'fresh issue'],
        },
        {
          id: 'hdfp-2',
          section: 'Financials & International Certifications',
          pageNumber: 112,
          content: 'Financials & Certifications: Holding 40+ UL Listings and FM Global Approvals. Exports to 55+ countries contribute 48% of consolidated turnover. EBITDA margin stands at 19.2% with debt-to-equity of 0.22.',
          keywords: ['ul listing', 'fm approval', 'exports', 'ebitda', 'certifications'],
        },
      ],
      sections: [],
      forensicRiskMatrix: [
        {
          category: 'Technological & Regulatory Moat',
          rating: 'LOW',
          score: 90,
          detail: '40+ UL/FM international certifications create significant competitive entry barriers.',
          citationPage: 112,
          section: 'Competitive Strengths',
        },
      ],
    },

    // 6. ESDS SOFTWARE SOLUTION LIMITED (ESDS)
    {
      symbol: 'ESDS',
      companyName: 'ESDS Software Solution Limited',
      documentName: 'SEBI_ESDS_DRHP_Filing.pdf',
      pageCount: 462,
      indexedAt: new Date().toISOString(),
      chunks: [
        {
          id: 'esds-1',
          section: 'Objects of the Offer',
          pageNumber: 74,
          content: 'Objects of the Issue: Net proceeds from the Fresh Issue of ₹322.0 Cr shall be utilized towards (i) ₹155.0 Cr for purchase of cloud computing hardware and server equipment for the Nashik and Navi Mumbai data centers, (ii) ₹75.0 Cr for funding long-term working capital requirements, (iii) ₹40.0 Cr for repayment/prepayment of debt facilities availed by the Company, and (iv) General corporate purposes.',
          keywords: ['cloud hardware', 'nashik data center', 'working capital', 'debt repayment', 'objects', 'fresh issue'],
        },
        {
          id: 'esds-2',
          section: 'Capital Structure & Promoter Holdings',
          pageNumber: 96,
          content: 'Capital Structure: Promoter Piyush Somani and Promoter Group hold 82.5% of the pre-offer paid-up equity share capital. Following the Offer for Sale of ₹280 Cr and Fresh Issue, post-issue promoter group holding shall dilute to 64.8%, adhering to SEBI minimum public shareholding norms. Mandatory promoter lock-in of 18 months applies to the 20% minimum promoter contribution.',
          keywords: ['promoter', 'piyush somani', 'shareholding', 'dilution', 'lock-in', 'equity'],
        },
        {
          id: 'esds-3',
          section: 'Proprietary Cloud Platform & Moat',
          pageNumber: 134,
          content: 'Business Architecture & Moat: ESDS operates Tier III data centers in Navi Mumbai, Nashik, and Bengaluru. Its proprietary multi-tenant cloud orchestration engine (eNlight Cloud) holds patented auto-vertical scaling technology in the US, UK, and India, dynamically optimizing server CPU/RAM consumption for BFSI, government, and enterprise clients with zero application downtime.',
          keywords: ['enlight cloud', 'tier iii', 'patented auto scaling', 'bfsi', 'data center', 'moat'],
        },
        {
          id: 'esds-4',
          section: 'Financial Statements & Recurring Cloud Margins',
          pageNumber: 185,
          content: 'Financial Statements: Restated consolidated revenue from operations expanded at a 23.4% 3-year CAGR to ₹298.5 Cr in FY24. Cloud Infrastructure as a Service (IaaS) and Managed Cloud Services generate 76% recurring SaaS/cloud billing. Operating EBITDA margin expanded to 28.6% with positive operating cash flow of ₹78.2 Cr. Net Debt to Equity stands at 0.34.',
          keywords: ['iaas', 'recurring revenue', 'ebitda', 'cagr', 'cash flow', 'debt to equity', 'financials'],
        },
        {
          id: 'esds-5',
          section: 'Forensic Risk Factors & SLA Liabilities',
          pageNumber: 38,
          content: 'Risk Factors: (1) Data center operations are dependent on uninterrupted electricity and chilled water supply from state distribution utilities; grid outages exceeding SLA agreements trigger penalty billing credits. (2) Client concentration: Top 10 enterprise and government banking clients contribute 39.2% of total cloud billing.',
          keywords: ['risk factors', 'utility dependency', 'sla penalties', 'client concentration', 'data center power'],
        },
        {
          id: 'esds-6',
          section: 'Outstanding Litigation & Disclosures',
          pageNumber: 248,
          content: 'Outstanding Litigation: The Company has 3 pending indirect tax appeals (totaling ₹6.8 Cr) before CESTAT regarding disputed input service tax credits, for which adequate provisions exist in the restated books. Zero criminal proceedings, economic offences, or SEBI disciplinary actions against founder promoter Piyush Somani.',
          keywords: ['litigation', 'tax dispute', 'cesta', 'provisions', 'legal proceedings'],
        },
      ],
      sections: [
        {
          id: 'esds-sec-1',
          title: 'Objects of the Offer & Cloud Infrastructure Capex',
          chapterNumber: 1,
          pageRange: 'Pages 74–95',
          summary: 'Details deployment of ₹322 Cr Fresh Issue capital into cloud hardware procurement (₹155 Cr) and debt prepayment (₹40 Cr).',
          keyFindings: ['₹155 Cr dedicated server/cloud capex', '₹40 Cr scheduled debt retirement', 'No discounted promoter exit'],
          riskRating: 'LOW',
        },
        {
          id: 'esds-sec-2',
          title: 'Capital Structure & Promoter Shareholding',
          chapterNumber: 2,
          pageRange: 'Pages 96–120',
          summary: 'Promoter Piyush Somani holds 82.5% pre-issue, diluting to 64.8% post-issue with statutory 18-month lock-in.',
          keyFindings: ['Promoter maintains 64.8% post-issue control', '18-month statutory lock-in compliant', 'SEBI MPS 25% float adherence'],
          riskRating: 'LOW',
        },
        {
          id: 'esds-sec-3',
          title: 'Patented eNlight Cloud Architecture & Competitive Moat',
          chapterNumber: 3,
          pageRange: 'Pages 121–160',
          summary: 'Tier III data centers in Navi Mumbai & Nashik; proprietary auto-vertical scaling patent in US, UK, and India.',
          keyFindings: ['Patented auto-vertical compute scaling', '4,50,000+ sq ft data center footprint', 'High-stickiness BFSI & PSU client base'],
          riskRating: 'LOW',
        },
        {
          id: 'esds-sec-4',
          title: 'Restated Financial Statements & Recurring ARPU',
          chapterNumber: 4,
          pageRange: 'Pages 161–220',
          summary: '23.4% 3-year revenue CAGR to ₹298.5 Cr; 28.6% EBITDA operating margin; 76% recurring SaaS/cloud billing.',
          keyFindings: ['76% recurring cloud subscription revenue', '28.6% EBITDA operating margin', 'Prudent Debt/Equity ratio of 0.34'],
          riskRating: 'LOW',
        },
        {
          id: 'esds-sec-5',
          title: 'Critical Risk Factors & Data Center SLA Exposures',
          chapterNumber: 5,
          pageRange: 'Pages 24–73',
          summary: 'Institutional audit of utility dependencies, power grid stability, SLA penalty clauses, and client concentration.',
          keyFindings: ['Top 10 clients contribute 39.2% of turnover', 'High power consumption utility sensitivity', 'Rapid server replacement obsolescence'],
          riskRating: 'MEDIUM',
        },
      ],
      forensicRiskMatrix: [
        {
          category: 'Customer Concentration',
          rating: 'MEDIUM',
          score: 68,
          detail: 'Top 10 enterprise and government banking clients contribute 39.2% of total cloud billing.',
          citationPage: 38,
          section: 'Risk Factors & Business Operations',
        },
        {
          category: 'Promoter Holding & Governance',
          rating: 'LOW',
          score: 88,
          detail: 'Founder promoter Piyush Somani retains strong 64.8% post-issue equity stake with 18-month lock-in.',
          citationPage: 96,
          section: 'Capital Structure',
        },
        {
          category: 'Cloud Capex Quality & Debt Retirement',
          rating: 'LOW',
          score: 89,
          detail: 'Over 60% of Fresh Issue allocated to tangible cloud server hardware and scheduled debt reduction.',
          citationPage: 74,
          section: 'Objects of the Offer',
        },
        {
          category: 'Data Center Power & SLA Risk',
          rating: 'MEDIUM',
          score: 72,
          detail: 'Dependent on utility power grid stability; SLA credits apply if uptime drops below contract tiers.',
          citationPage: 42,
          section: 'Risk Factors',
        },
        {
          category: 'Litigations & Regulatory Standing',
          rating: 'LOW',
          score: 86,
          detail: 'Only ₹6.8 Cr in indirect tax CESTAT appeals with provisions; clean promoter track record.',
          citationPage: 248,
          section: 'Outstanding Litigation',
        },
      ],
    },

    // 7. SHREE SIDDHIVINAYAK GREENTECH INDUSTRIES LIMITED (SHREESIDHI)
    {
      symbol: 'SHREESIDHI',
      companyName: 'Shree Siddhivinayak Greentech Industries Limited',
      documentName: 'BSE_SME_SHREESIDHI_DRHP_Filing.pdf',
      pageCount: 240,
      indexedAt: new Date().toISOString(),
      chunks: [
        {
          id: 'shreesidhi-1',
          section: 'Objects of the Offer',
          pageNumber: 32,
          content: 'Objects of the Issue: Gross proceeds from the 100% Fresh Issue of ₹38.5 Cr shall be deployed towards (i) ₹18.2 Cr for setting up an automated biomass briquetting and bio-fuel processing facility in Mehsana, Gujarat, (ii) ₹10.5 Cr for long-term working capital requirements, (iii) ₹4.0 Cr for installation of a 1.2 MW rooftop solar captive power plant, and (iv) General corporate purposes.',
          keywords: ['biomass', 'bio-fuel', 'mehsana', 'working capital', 'solar power', 'objects', 'fresh issue'],
        },
        {
          id: 'shreesidhi-2',
          section: 'Capital Structure & Promoter Holdings',
          pageNumber: 54,
          content: 'Capital Structure: The Promoters hold 86.4% of the pre-offer equity share capital of the Company. Post-issue promoter shareholding shall stand at 64.2%, complying with BSE SME minimum public shareholding requirements. Minimum promoter contribution of 20% is locked in for 36 months pursuant to SEBI ICDR SME regulations.',
          keywords: ['promoter', 'shareholding', 'dilution', 'lock-in', 'bse sme', 'icdr'],
        },
        {
          id: 'shreesidhi-3',
          section: 'Business Operations & Environmental Moat',
          pageNumber: 88,
          content: 'Business & Environmental Moat: Manufacturer of eco-friendly biomass pellets, agricultural waste briquettes, and sustainable industrial packaging products. Certified supplier to thermal power plants, cement kilns, and industrial boilers complying with Ministry of Power mandatory 5-7% biomass co-firing directives.',
          keywords: ['biomass pellets', 'co-firing', 'thermal power', 'cement', 'green energy', 'moat'],
        },
        {
          id: 'shreesidhi-4',
          section: 'Financials & Operational Margins',
          pageNumber: 128,
          content: 'Financial Statements: Restated revenue grew at a 32.8% CAGR from ₹28.4 Cr in FY22 to ₹50.1 Cr in FY24. EBITDA margin improved to 16.4% driven by higher capacity utilization. Debt-to-Equity ratio is conservative at 0.28 with zero default history.',
          keywords: ['financials', 'revenue', 'cagr', 'ebitda', 'debt to equity', 'growth'],
        },
      ],
      sections: [
        {
          id: 'shreesidhi-sec-1',
          title: 'Objects of the Offer & Green Bio-fuel Capex',
          chapterNumber: 1,
          pageRange: 'Pages 28–48',
          summary: '100% Fresh Issue of ₹38.5 Cr for Gujarat bio-fuel processing expansion and working capital.',
          keyFindings: ['100% Fresh Issue with zero OFS', '₹18.2 Cr bio-fuel facility capex', '1.2 MW captive solar installation'],
          riskRating: 'LOW',
        },
        {
          id: 'shreesidhi-sec-2',
          title: 'Capital Structure & Promoter Lock-in',
          chapterNumber: 2,
          pageRange: 'Pages 49–70',
          summary: 'Promoter holding of 86.4% diluting to 64.2% with 3-year SEBI ICDR SME lock-in.',
          keyFindings: ['Strong 64.2% promoter retention', '3-year lock-in on promoter quota', 'BSE SME platform listing'],
          riskRating: 'LOW',
        },
      ],
      forensicRiskMatrix: [
        {
          category: 'Agricultural Raw Material Seasonality',
          rating: 'MEDIUM',
          score: 70,
          detail: 'Agricultural feedstock availability is seasonal and dependent on post-harvest crop cycles in Gujarat/Rajasthan.',
          citationPage: 44,
          section: 'Risk Factors',
        },
        {
          category: 'Promoter Commitment & Zero OFS',
          rating: 'LOW',
          score: 92,
          detail: '100% Fresh Issue offering with zero promoter cash-out exit.',
          citationPage: 32,
          section: 'Objects of the Offer',
        },
      ],
    },
  ];
}
