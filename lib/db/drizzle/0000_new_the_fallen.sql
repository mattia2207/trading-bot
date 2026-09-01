CREATE TABLE "quality_filter_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"min_score" integer DEFAULT 70 NOT NULL,
	"min_confidence" integer DEFAULT 60 NOT NULL,
	"min_confluence" integer DEFAULT 4 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset" varchar(20) NOT NULL,
	"timeframe" varchar(10) DEFAULT '1h' NOT NULL,
	"direction" varchar(10) NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"tp" numeric(20, 8),
	"sl" numeric(20, 8),
	"score" integer DEFAULT 0 NOT NULL,
	"confidence_score" integer DEFAULT 0 NOT NULL,
	"estimated_probability" integer DEFAULT 0 NOT NULL,
	"rsi" numeric(8, 4),
	"macd_histogram" numeric(16, 8),
	"ema50" numeric(20, 8),
	"ema100" numeric(20, 8),
	"ema200" numeric(20, 8),
	"atr" numeric(20, 8),
	"volume_ratio" numeric(8, 4),
	"trend" varchar(50),
	"momentum" varchar(50),
	"volatility" varchar(50),
	"confluence" integer DEFAULT 0 NOT NULL,
	"market_regime" varchar(50),
	"verdict" varchar(20),
	"false_signal_risk" varchar(20),
	"status" varchar(10) DEFAULT 'PENDING' NOT NULL,
	"qualified" boolean DEFAULT false NOT NULL,
	"quality_tier" varchar(10),
	"exit_price" numeric(20, 8),
	"profit_pct" numeric(10, 4),
	"max_profit_pct" numeric(10, 4),
	"max_drawdown_pct" numeric(10, 4),
	"duration_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_user_id" varchar(128) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"symbol" varchar(32),
	"detail" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fills" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_user_id" varchar(128) NOT NULL,
	"order_id" integer NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"quantity" numeric(28, 12) NOT NULL,
	"price" numeric(28, 12) NOT NULL,
	"fee" numeric(28, 12) DEFAULT '0' NOT NULL,
	"fee_asset" varchar(16) NOT NULL,
	"filled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_user_id" varchar(128) NOT NULL,
	"trade_id" integer,
	"symbol" varchar(32) NOT NULL,
	"side" varchar(8) NOT NULL,
	"order_type" varchar(32) NOT NULL,
	"status" varchar(24) DEFAULT 'CREATED' NOT NULL,
	"client_order_id" varchar(64) NOT NULL,
	"exchange_order_id" varchar(64),
	"quantity" numeric(28, 12) NOT NULL,
	"price" numeric(28, 12),
	"protection_order" boolean DEFAULT false NOT NULL,
	"raw_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"owner_user_id" varchar(128) PRIMARY KEY NOT NULL,
	"execution_mode" varchar(16) DEFAULT 'paper' NOT NULL,
	"testnet_enabled" boolean DEFAULT false NOT NULL,
	"risk_per_trade_pct" numeric(8, 4) DEFAULT '0.5' NOT NULL,
	"max_exposure_pct" numeric(8, 4) DEFAULT '20' NOT NULL,
	"max_open_positions" integer DEFAULT 2 NOT NULL,
	"max_daily_trades" integer DEFAULT 3 NOT NULL,
	"max_daily_loss_pct" numeric(8, 4) DEFAULT '2' NOT NULL,
	"cooldown_minutes" integer DEFAULT 1440 NOT NULL,
	"min_reward_risk" numeric(8, 4) DEFAULT '1.5' NOT NULL,
	"paper_starting_balance" numeric(20, 8) DEFAULT '10000' NOT NULL,
	"kill_switch_active" boolean DEFAULT false NOT NULL,
	"kill_switch_reason" text,
	"telegram_chat_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_user_id" varchar(128) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"symbol" varchar(32),
	"reason" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_user_id" varchar(128) NOT NULL,
	"signal_id" integer,
	"symbol" varchar(32) NOT NULL,
	"side" varchar(8) DEFAULT 'LONG' NOT NULL,
	"status" varchar(16) DEFAULT 'OPEN' NOT NULL,
	"quantity" numeric(28, 12) NOT NULL,
	"entry_price" numeric(28, 12) NOT NULL,
	"stop_loss" numeric(28, 12) NOT NULL,
	"take_profit" numeric(28, 12) NOT NULL,
	"realized_pnl" numeric(28, 12) DEFAULT '0' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "orders_owner_client_order_id_idx" ON "orders" USING btree ("owner_user_id","client_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_records_owner_symbol_open_idx" ON "trade_records" USING btree ("owner_user_id","symbol","status");