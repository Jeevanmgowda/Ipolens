CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "drhp_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" varchar(64) NOT NULL,
	"model" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'RUNNING' NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drhp_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" varchar(64) NOT NULL,
	"chunk_index" integer NOT NULL,
	"page_start" integer NOT NULL,
	"page_end" integer NOT NULL,
	"section" varchar(64) NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(768)
);
--> statement-breakpoint
CREATE TABLE "drhp_documents" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"symbol" varchar(32),
	"company_name" varchar(256),
	"source_url" text,
	"file_name" varchar(256),
	"sha256" varchar(64) NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'QUEUED' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drhp_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" varchar(64) NOT NULL,
	"page_number" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gmp_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" varchar(64) NOT NULL,
	"coefficients" jsonb NOT NULL,
	"metrics" jsonb NOT NULL,
	"trained_on" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gmp_models_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "gmp_predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"model_version" varchar(64) NOT NULL,
	"predicted_gain_pct" double precision NOT NULL,
	"predicted_gmp" double precision,
	"lower_pct" double precision NOT NULL,
	"upper_pct" double precision NOT NULL,
	"drivers" jsonb NOT NULL,
	"features" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" varchar(64) NOT NULL,
	"channel" varchar(16) NOT NULL,
	"outcome" varchar(40) NOT NULL,
	"status" varchar(16) NOT NULL,
	"error" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_pnl_journal" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"application_id" varchar(64) NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"shares_applied" integer NOT NULL,
	"shares_allotted" integer NOT NULL,
	"issue_price" numeric(12, 2) NOT NULL,
	"invested_amount" numeric(14, 2) NOT NULL,
	"refund_amount" numeric(14, 2) NOT NULL,
	"listing_price" numeric(12, 2),
	"listing_gain_amount" numeric(14, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_pnl_journal_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "provider_tokens" (
	"provider" varchar(32) PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"expires_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD COLUMN "allotment_status" varchar(40) DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD COLUMN "checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD COLUMN "last_error_code" varchar(64);--> statement-breakpoint
ALTER TABLE "ipo_gmp_history" ADD COLUMN "fetched_at" timestamp;--> statement-breakpoint
ALTER TABLE "ipos" ADD COLUMN "registrar_slug" varchar(32);--> statement-breakpoint
ALTER TABLE "ipos" ADD COLUMN "registrar_company_id" varchar(64);--> statement-breakpoint
ALTER TABLE "ipos" ADD COLUMN "exchange" varchar(16);--> statement-breakpoint
ALTER TABLE "ipos" ADD COLUMN "isin" varchar(16);--> statement-breakpoint
ALTER TABLE "ipos" ADD COLUMN "issue_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "ipos" ADD COLUMN "listing_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "ipos" ADD COLUMN "fresh_issue_cr" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "ipos" ADD COLUMN "ofs_cr" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "ipos" ADD COLUMN "issue_size_cr" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "ipos" ADD COLUMN "source" varchar(64);--> statement-breakpoint
ALTER TABLE "ipos" ADD COLUMN "fetched_at" timestamp;--> statement-breakpoint
ALTER TABLE "ipos" ADD COLUMN "raw" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "drhp_analyses_doc_idx" ON "drhp_analyses" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "drhp_chunks_doc_idx" ON "drhp_chunks" USING btree ("document_id","section");--> statement-breakpoint
CREATE INDEX "drhp_chunks_embedding_idx" ON "drhp_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "drhp_documents_symbol_idx" ON "drhp_documents" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "drhp_documents_sha_idx" ON "drhp_documents" USING btree ("sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "drhp_pages_doc_page_idx" ON "drhp_pages" USING btree ("document_id","page_number");--> statement-breakpoint
CREATE INDEX "gmp_predictions_symbol_idx" ON "gmp_predictions" USING btree ("symbol","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_log_dedupe_idx" ON "notification_log" USING btree ("application_id","channel","outcome");--> statement-breakpoint
CREATE INDEX "pnl_journal_user_idx" ON "portfolio_pnl_journal" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ipo_applications_status_symbol_idx" ON "ipo_applications" USING btree ("allotment_status","ipo_symbol");--> statement-breakpoint
CREATE INDEX "ipo_applications_user_idx" ON "ipo_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ipo_gmp_history_symbol_idx" ON "ipo_gmp_history" USING btree ("symbol","recorded_at");--> statement-breakpoint
CREATE INDEX "ipo_subscription_symbol_idx" ON "ipo_subscription" USING btree ("symbol","recorded_at");--> statement-breakpoint
UPDATE "ipo_applications" SET "allotment_status" = CASE WHEN "status" = 'Allotted' THEN 'ALLOTTED' WHEN "status" IN ('Not Allotted', 'Refunded') THEN 'NOT_ALLOTTED' ELSE 'PENDING' END;
