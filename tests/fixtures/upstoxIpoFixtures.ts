/**
 * Authentic Upstox Developer API v2 Sample Response Fixtures
 * Calibrated to official May/August 2026 Upstox IPO endpoints:
 * GET https://api.upstox.com/v2/ipos?status={status}&issue_type={issue_type}
 * GET https://api.upstox.com/v2/ipos/{ipo_id}
 */

export interface UpstoxApiListingResponse {
  status: 'success';
  data: Array<{
    id: string;
    symbol: string;
    name: string;
    status: 'upcoming' | 'open' | 'closed' | 'listed';
    isin: string;
    issue_type: 'regular' | 'sme';
    issue_size: number;
    industry: string;
    minimum_price: number;
    maximum_price: number;
    bidding_start_date: string;
    bidding_end_date: string;
    daily_start_time: string;
    daily_end_time: string;
    face_value: number;
    lot_size: number;
    minimum_quantity: number;
    cut_off_price: number;
    listing_price?: number;
    listing_exchange?: string;
    total_subscription?: number;
    investors?: Array<{
      category: string;
      description: string;
      subscription_rate: number;
    }>;
  }>;
}

export interface UpstoxApiDetailResponse {
  status: 'success';
  data: {
    id: string;
    symbol: string;
    name: string;
    status: string;
    isin: string;
    issue_type: string;
    issue_size: number;
    industry: string;
    minimum_price: number;
    maximum_price: number;
    bidding_start_date: string;
    bidding_end_date: string;
    lot_size: number;
    minimum_quantity: number;
    cut_off_price: number;
    listing_price?: number;
    timeline: {
      bidding_start_date: string;
      bidding_end_date: string;
      allotment_date: string;
      refund_initiation_date: string;
      demat_credit_date: string;
      listing_date: string;
    };
    registrar_info: {
      name: string;
      website: string;
      email: string;
      contact_number: string;
    };
    total_subscription: number;
    investors: Array<{
      category: 'RETAIL' | 'INDIVIDUAL' | 'HNI' | 'NII' | 'QIB' | 'EMPLOYEE';
      description: string;
      subscription_rate: number;
      shares_offered: number;
      shares_bid: number;
    }>;
  };
}

export const UPSTOX_FIXTURE_OPEN_MAINBOARD: UpstoxApiDetailResponse = {
  status: 'success',
  data: {
    id: 'swiggy-limited-ipo',
    symbol: 'SWIGGY',
    name: 'Swiggy Limited',
    status: 'open',
    isin: 'INE00H001014',
    issue_type: 'regular',
    issue_size: 113274300000,
    industry: 'Consumer Digital Platforms',
    minimum_price: 371,
    maximum_price: 390,
    bidding_start_date: '2024-11-06T10:00:00+05:30',
    bidding_end_date: '2024-11-08T17:00:00+05:30',
    lot_size: 38,
    minimum_quantity: 38,
    cut_off_price: 390,
    timeline: {
      bidding_start_date: '2024-11-06',
      bidding_end_date: '2024-11-08',
      allotment_date: '2024-11-11',
      refund_initiation_date: '2024-11-12',
      demat_credit_date: '2024-11-12',
      listing_date: '2024-11-13',
    },
    registrar_info: {
      name: 'Link Intime India Private Limited',
      website: 'https://linkintime.co.in',
      email: 'swiggy.ipo@linkintime.co.in',
      contact_number: '+91 22 4918 6200',
    },
    total_subscription: 3.59,
    investors: [
      {
        category: 'RETAIL',
        description: 'Retail Individual Investors',
        subscription_rate: 1.14,
        shares_offered: 28900000,
        shares_bid: 32946000,
      },
      {
        category: 'NII',
        description: 'Non-Institutional Investors (HNI)',
        subscription_rate: 0.41,
        shares_offered: 43350000,
        shares_bid: 17773500,
      },
      {
        category: 'QIB',
        description: 'Qualified Institutional Buyers',
        subscription_rate: 6.02,
        shares_offered: 86700000,
        shares_bid: 521934000,
      },
    ],
  },
};

export const UPSTOX_FIXTURE_OPEN_SME: UpstoxApiDetailResponse = {
  status: 'success',
  data: {
    id: 'premier-energies-sme-ipo',
    symbol: 'PREMIER',
    name: 'Premier Solar Tech (NSE SME)',
    status: 'open',
    isin: 'INE0V6F01027',
    issue_type: 'sme',
    issue_size: 650000000,
    industry: 'Renewable Solar Tech',
    minimum_price: 110,
    maximum_price: 115,
    bidding_start_date: '2024-11-05T10:00:00+05:30',
    bidding_end_date: '2024-11-07T17:00:00+05:30',
    lot_size: 1200,
    minimum_quantity: 1200,
    cut_off_price: 115,
    timeline: {
      bidding_start_date: '2024-11-05',
      bidding_end_date: '2024-11-07',
      allotment_date: '2024-11-08',
      refund_initiation_date: '2024-11-10',
      demat_credit_date: '2024-11-10',
      listing_date: '2024-11-11',
    },
    registrar_info: {
      name: 'Bigshare Services Pvt Ltd',
      website: 'https://bigshareonline.com',
      email: 'ipo@bigshareonline.com',
      contact_number: '+91 22 6263 8200',
    },
    total_subscription: 42.15,
    investors: [
      {
        category: 'RETAIL',
        description: 'Retail Individual',
        subscription_rate: 38.4,
        shares_offered: 2500000,
        shares_bid: 96000000,
      },
      {
        category: 'NII',
        description: 'Non-Institutional Buyers',
        subscription_rate: 45.9,
        shares_offered: 2500000,
        shares_bid: 114750000,
      },
    ],
  },
};

export const UPSTOX_FIXTURE_UPCOMING: UpstoxApiDetailResponse = {
  status: 'success',
  data: {
    id: 'nse-limited-ipo',
    symbol: 'NSE',
    name: 'National Stock Exchange of India Ltd',
    status: 'upcoming',
    isin: 'INE000000001',
    issue_type: 'regular',
    issue_size: 100000000000,
    industry: 'Financial Market Exchanges',
    minimum_price: 1750,
    maximum_price: 1785,
    bidding_start_date: '2025-04-10T10:00:00+05:30',
    bidding_end_date: '2025-04-14T17:00:00+05:30',
    lot_size: 14,
    minimum_quantity: 14,
    cut_off_price: 1785,
    timeline: {
      bidding_start_date: '2025-04-10',
      bidding_end_date: '2025-04-14',
      allotment_date: '2025-04-15',
      refund_initiation_date: '2025-04-16',
      demat_credit_date: '2025-04-16',
      listing_date: '2025-04-17',
    },
    registrar_info: {
      name: 'KFin Technologies Limited',
      website: 'https://kfintech.com',
      email: 'einward.ris@kfintech.com',
      contact_number: '1800 309 4001',
    },
    total_subscription: 0,
    investors: [],
  },
};
