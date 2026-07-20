-- AXIS delta SQL // V5 // Drop notification system
-- Apply in Supabase SQL editor if you already ran the original schema.
-- Safe to rerun. Removes the notification_rules table that backed the
-- in-browser Notification API system. All other tables stay intact.

SET statement_timeout = 0;

DROP TABLE IF EXISTS public.notification_rules CASCADE;

SELECT '⚡ AXIS V5 // NOTIFICATION TABLES REMOVED' as telemetry_confirmation;
