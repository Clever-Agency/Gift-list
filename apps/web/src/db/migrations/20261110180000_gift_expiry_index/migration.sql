-- Wish-expiry cron scans open wishes that still have a date (Story 2.6).
CREATE INDEX "Gift_status_expiresOn_idx" ON "Gift"("status", "expiresOn");
