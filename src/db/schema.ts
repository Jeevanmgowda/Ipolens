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
  pan: varchar('pan', { length: 16 }).notNull(),                   // Masked/Secure PAN
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
