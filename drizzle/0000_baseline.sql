CREATE TABLE "exchange_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"snapshot_type" varchar(32) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_pans" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) DEFAULT 'default_user' NOT NULL,
	"name" varchar(128) NOT NULL,
	"relationship" varchar(32) NOT NULL,
	"pan" varchar(16) NOT NULL,
	"pan_encrypted" text,
	"broker" varchar(64) NOT NULL,
	"demat_id" varchar(64),
	"bank_upi" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ipo_applications" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) DEFAULT 'default_user' NOT NULL,
	"ipo_symbol" varchar(32) NOT NULL,
	"company_name" varchar(256) NOT NULL,
	"pan_id" varchar(64) NOT NULL,
	"pan_number" varchar(16) NOT NULL,
	"holder_name" varchar(128) NOT NULL,
	"relationship" varchar(32) NOT NULL,
	"category" varchar(32) NOT NULL,
	"lots" integer NOT NULL,
	"shares" integer NOT NULL,
	"bid_price" numeric(12, 2) NOT NULL,
	"blocked_amount" numeric(14, 2) NOT NULL,
	"status" varchar(32) DEFAULT 'Applied' NOT NULL,
	"allotted_shares" integer DEFAULT 0,
	"applied_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ipo_gmp_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"ipo_id" varchar(64) NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"gmp" numeric(10, 2) NOT NULL,
	"gmp_percent" numeric(8, 2),
	"source" varchar(64) DEFAULT 'Market Feed',
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ipo_subscription" (
	"id" serial PRIMARY KEY NOT NULL,
	"ipo_id" varchar(64) NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"retail" numeric(8, 2) DEFAULT '0.00' NOT NULL,
	"nii" numeric(8, 2) DEFAULT '0.00' NOT NULL,
	"qib" numeric(8, 2) DEFAULT '0.00' NOT NULL,
	"employee" numeric(8, 2) DEFAULT '0.00',
	"total" numeric(8, 2) DEFAULT '0.00' NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ipos" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"company_name" varchar(256) NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"series" varchar(16) DEFAULT 'EQ',
	"price_low" numeric(12, 2),
	"price_high" numeric(12, 2),
	"lot_size" integer,
	"issue_size" varchar(64),
	"open_date" varchar(64),
	"close_date" varchar(64),
	"allotment_date" varchar(64),
	"listing_date" varchar(64),
	"registrar" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ipos_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "market_ohlc" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"timeframe" varchar(16) NOT NULL,
	"timestamp" timestamp NOT NULL,
	"open" numeric(12, 2) NOT NULL,
	"high" numeric(12, 2) NOT NULL,
	"low" numeric(12, 2) NOT NULL,
	"close" numeric(12, 2) NOT NULL,
	"volume" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"ltp" numeric(12, 2) NOT NULL,
	"open" numeric(12, 2) NOT NULL,
	"high" numeric(12, 2) NOT NULL,
	"low" numeric(12, 2) NOT NULL,
	"previous_close" numeric(12, 2) NOT NULL,
	"volume" integer DEFAULT 0 NOT NULL,
	"change" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"change_percent" numeric(8, 2) DEFAULT '0.00' NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "market_quotes_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "market_watchlist" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) DEFAULT 'default_user' NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"company_name" varchar(256) NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"type" varchar(32) NOT NULL,
	"title" varchar(256) NOT NULL,
	"message" text NOT NULL,
	"symbol" varchar(32),
	"read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_holdings" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) DEFAULT 'default_user' NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"isin" varchar(32) NOT NULL,
	"company_name" varchar(256) NOT NULL,
	"quantity" integer NOT NULL,
	"average_buy_price" numeric(12, 2) NOT NULL,
	"current_price" numeric(12, 2) NOT NULL,
	"is_ipo_allotment" boolean DEFAULT false,
	"imported_from_broker" varchar(64),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"email" varchar(256) NOT NULL,
	"password_hash" text NOT NULL,
	"salt" varchar(64) NOT NULL,
	"role" varchar(32) DEFAULT 'retail' NOT NULL,
	"investor_category" varchar(32) DEFAULT 'Retail' NOT NULL,
	"primary_pan" varchar(32),
	"avatar_url" text,
	"terms_accepted" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
