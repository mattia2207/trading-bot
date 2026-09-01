DROP INDEX "trade_records_owner_symbol_open_idx";--> statement-breakpoint
CREATE INDEX "trade_records_owner_status_idx" ON "trade_records" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "trade_records_owner_symbol_idx" ON "trade_records" USING btree ("owner_user_id","symbol");