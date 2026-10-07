import { pgTable, text, varchar, integer, numeric, boolean, timestamp, serial, jsonb } from 'drizzle-orm/pg-core';

/**
 * IPOLENS Production Database Schema (Drizzle ORM for PostgreSQL / Supabase / Neon)
 * Maps domain models for multi-PAN family bidding, applications, holdings, and exchange telemetry.
 */

// 1. Family PAN Profiles Table
export const familyPansTable = pgTable('family_pans', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull().default('default_user'),
  name: varchar('name', { length: 128 }).notNull(),
  relationship: varchar('relationship', { length: 32 }).notNull(), // 'Self' | 'Spouse' | 'Parent' | 'Child' | 'HUF' | 'Other'
  pan: varchar('pan', { length: 16 }).notNull(),                   // Masked/Secure PAN (e.g. ABCDE****F)
  panEncrypted: text('pan_encrypted'),                            // AES-256-GCM Encrypted PAN string
  broker: varchar('broker', { length: 64 }).notNull(),             // 'Zerodha' | 'Groww' | 'AngelOne' | 'Upstox'
  dematId: varchar('demat_id', { length: 64 }),                    // DP Client ID
  bankUpi: varchar('bank_upi', { length: 64 }),                    // UPI ID for ASBA mandate
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 2. IPO Applications Table (SEBI Multi-PAN Bidding Tracker)
export const ipoApplicationsTable = pgTable('ipo_applications', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull().default('default_user'),
  ipoSymbol: varchar('ipo_symbol', { length: 32 }).notNull(),
  companyName: varchar('company_name', { length: 256 }).notNull(),
  panId: varchar('pan_id', { length: 64 }).notNull(),
  panNumber: varchar('pan_number', { length: 16 }).notNull(),      // Masked PAN
  holderName: varchar('holder_name', { length: 128 }).notNull(),
  relationship: varchar('relationship', { length: 32 }).notNull(),
  category: varchar('category', { length: 32 }).notNull(),         // 'Retail' | 'sNII' | 'bNII' | 'Employee'
  lots: integer('lots').notNull(),
  shares: integer('shares').notNull(),
  bidPrice: numeric('bid_price', { precision: 12, scale: 2 }).notNull(),
  blockedAmount: numeric('blocked_amount', { precision: 14, scale: 2 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('Applied'), // 'Applied' | 'Mandate Approved' | 'Allotted' | 'Not Allotted' | 'Refunded'
  allottedShares: integer('allotted_shares').default(0),
  appliedAt: timestamp('applied_at').notNull().defaultNow(),
});

// 3. Demat Portfolio Holdings Table (Credential-free Broker Ingestion)
export const portfolioHoldingsTable = pgTable('portfolio_holdings', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull().default('default_user'),
  symbol: varchar('symbol', { length: 32 }).notNull(),
  isin: varchar('isin', { length: 32 }).notNull(),
  companyName: varchar('company_name', { length: 256 }).notNull(),
  quantity: integer('quantity').notNull(),
  averageBuyPrice: numeric('average_buy_price', { precision: 12, scale: 2 }).notNull(),
  currentPrice: numeric('current_price', { precision: 12, scale: 2 }).notNull(),
  isIpoAllotment: boolean('is_ipo_allotment').default(false),
  importedFromBroker: varchar('imported_from_broker', { length: 64 }), // 'Zerodha' | 'Groww' | 'AngelOne' | 'Upstox'
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 4. Exchange Telemetry & Subscription Snapshots Table
export const exchangeSnapshotsTable = pgTable('exchange_snapshots', {
  id: serial('id').primaryKey(),
  symbol: varchar('symbol', { length: 32 }).notNull(),
  snapshotType: varchar('snapshot_type', { length: 32 }).notNull(), // 'SUBSCRIPTION' | 'CANDLES' | 'REGISTRAR'
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Type inference exports
export type FamilyPanSelect = typeof familyPansTable.$inferSelect;
export type FamilyPanInsert = typeof familyPansTable.$inferInsert;

export type IpoApplicationSelect = typeof ipoApplicationsTable.$inferSelect;
export type IpoApplicationInsert = typeof ipoApplicationsTable.$inferInsert;

export type PortfolioHoldingSelect = typeof portfolioHoldingsTable.$inferSelect;
export type PortfolioHoldingInsert = typeof portfolioHoldingsTable.$inferInsert;

export type ExchangeSnapshotSelect = typeof exchangeSnapshotsTable.$inferSelect;
export type ExchangeSnapshotInsert = typeof exchangeSnapshotsTable.$inferInsert;

// 5. Master IPOs Directory Table
export const iposTable = pgTable('ipos', {
  id: varchar('id', { length: 64 }).primaryKey(),
  companyName: varchar('company_name', { length: 256 }).notNull(),
  symbol: varchar('symbol', { length: 32 }).notNull().unique(),
  status: varchar('status', { length: 32 }).notNull(), // 'Upcoming' | 'Open' | 'Closed' | 'Listed'
  series: varchar('series', { length: 16 }).default('EQ'), // 'EQ' | 'SME'
  priceLow: numeric('price_low', { precision: 12, scale: 2 }),
  priceHigh: numeric('price_high', { precision: 12, scale: 2 }),
  lotSize: integer('lot_size'),
  issueSize: varchar('issue_size', { length: 64 }),
  openDate: varchar('open_date', { length: 64 }),
  closeDate: varchar('close_date', { length: 64 }),
  allotmentDate: varchar('allotment_date', { length: 64 }),
  listingDate: varchar('listing_date', { length: 64 }),
  registrar: varchar('registrar', { length: 128 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 6. IPO Subscription Telemetry Table
export const ipoSubscriptionsTable = pgTable('ipo_subscription', {
  id: serial('id').primaryKey(),
  ipoId: varchar('ipo_id', { length: 64 }).notNull(),
  symbol: varchar('symbol', { length: 32 }).notNull(),
  retail: numeric('retail', { precision: 8, scale: 2 }).notNull().default('0.00'),
  nii: numeric('nii', { precision: 8, scale: 2 }).notNull().default('0.00'),
  qib: numeric('qib', { precision: 8, scale: 2 }).notNull().default('0.00'),
  employee: numeric('employee', { precision: 8, scale: 2 }).default('0.00'),
  total: numeric('total', { precision: 8, scale: 2 }).notNull().default('0.00'),
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
});

// 7. IPO Grey Market Premium (GMP) History Table
export const ipoGmpHistoryTable = pgTable('ipo_gmp_history', {
  id: serial('id').primaryKey(),
  ipoId: varchar('ipo_id', { length: 64 }).notNull(),
  symbol: varchar('symbol', { length: 32 }).notNull(),
  gmp: numeric('gmp', { precision: 10, scale: 2 }).notNull(),
  gmpPercent: numeric('gmp_percent', { precision: 8, scale: 2 }),
  source: varchar('source', { length: 64 }).default('Market Feed'),
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
});

// 8. Live Market Quotes Table
export const marketQuotesTable = pgTable('market_quotes', {
  id: serial('id').primaryKey(),
  symbol: varchar('symbol', { length: 32 }).notNull().unique(),
  ltp: numeric('ltp', { precision: 12, scale: 2 }).notNull(),
  open: numeric('open', { precision: 12, scale: 2 }).notNull(),
  high: numeric('high', { precision: 12, scale: 2 }).notNull(),
  low: numeric('low', { precision: 12, scale: 2 }).notNull(),
  previousClose: numeric('previous_close', { precision: 12, scale: 2 }).notNull(),
  volume: integer('volume').notNull().default(0),
  change: numeric('change', { precision: 12, scale: 2 }).notNull().default('0.00'),
  changePercent: numeric('change_percent', { precision: 8, scale: 2 }).notNull().default('0.00'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

// 9. Market OHLC Candle History Table
export const marketOhlcTable = pgTable('market_ohlc', {
  id: serial('id').primaryKey(),
  symbol: varchar('symbol', { length: 32 }).notNull(),
  timeframe: varchar('timeframe', { length: 16 }).notNull(), // '1m' | '5m' | '15m' | '30m' | '1H' | '1D' | '1W' | '1M'
  timestamp: timestamp('timestamp').notNull(),
  open: numeric('open', { precision: 12, scale: 2 }).notNull(),
  high: numeric('high', { precision: 12, scale: 2 }).notNull(),
  low: numeric('low', { precision: 12, scale: 2 }).notNull(),
  close: numeric('close', { precision: 12, scale: 2 }).notNull(),
  volume: integer('volume').notNull().default(0),
});

// 10. User Market Watchlist Table
export const marketWatchlistTable = pgTable('market_watchlist', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull().default('default_user'),
  symbol: varchar('symbol', { length: 32 }).notNull(),
  companyName: varchar('company_name', { length: 256 }).notNull(),
  addedAt: timestamp('added_at').notNull().defaultNow(),
});

// 11. Registered Users Table (Enterprise Authentication & DPDP Compliance)
export const usersTable = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  email: varchar('email', { length: 256 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  salt: varchar('salt', { length: 64 }).notNull(),
  role: varchar('role', { length: 32 }).notNull().default('retail'), // 'retail' | 'hni' | 'institutional' | 'admin'
  investorCategory: varchar('investor_category', { length: 32 }).notNull().default('Retail'), // 'Retail' | 'sNII' | 'bNII' | 'Institutional'
  primaryPan: varchar('primary_pan', { length: 32 }),
  avatarUrl: text('avatar_url'),
  termsAccepted: boolean('terms_accepted').default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 12. User Sessions Table (HttpOnly Session Security)
export const sessionsTable = pgTable('user_sessions', {
  id: varchar('id', { length: 128 }).primaryKey(), // Session token
  userId: varchar('user_id', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 13. In-App & Multi-Channel Notifications Table
export const notificationsTable = pgTable('notifications', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(), // 'GMP_JUMP' | 'SUBSCRIPTION_MILESTONE' | 'ALLOTMENT_OUT' | 'LOCKIN_EXPIRY' | 'SYSTEM'
  title: varchar('title', { length: 256 }).notNull(),
  message: text('message').notNull(),
  symbol: varchar('symbol', { length: 32 }),
  read: boolean('read').notNull().default(false),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// New Type inference exports
export type IpoMasterSelect = typeof iposTable.$inferSelect;
export type IpoMasterInsert = typeof iposTable.$inferInsert;

export type IpoSubscriptionSelect = typeof ipoSubscriptionsTable.$inferSelect;
export type IpoSubscriptionInsert = typeof ipoSubscriptionsTable.$inferInsert;

export type IpoGmpHistorySelect = typeof ipoGmpHistoryTable.$inferSelect;
export type IpoGmpHistoryInsert = typeof ipoGmpHistoryTable.$inferInsert;

export type MarketQuoteSelect = typeof marketQuotesTable.$inferSelect;
export type MarketQuoteInsert = typeof marketQuotesTable.$inferInsert;

export type MarketOhlcSelect = typeof marketOhlcTable.$inferSelect;
export type MarketOhlcInsert = typeof marketOhlcTable.$inferInsert;

export type MarketWatchlistSelect = typeof marketWatchlistTable.$inferSelect;
export type MarketWatchlistInsert = typeof marketWatchlistTable.$inferInsert;

export type UserSelect = typeof usersTable.$inferSelect;
export type UserInsert = typeof usersTable.$inferInsert;

export type SessionSelect = typeof sessionsTable.$inferSelect;
export type SessionInsert = typeof sessionsTable.$inferInsert;

export type NotificationSelect = typeof notificationsTable.$inferSelect;
export type NotificationInsert = typeof notificationsTable.$inferInsert;

