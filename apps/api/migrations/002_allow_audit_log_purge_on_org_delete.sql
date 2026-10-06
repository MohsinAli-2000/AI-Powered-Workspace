-- 002_allow_audit_log_purge_on_org_delete.sql
-- Enables authorized permanent deletion of an organization by allowing audit_logs to cascade-delete
-- ONLY when explicitly authorized in the transaction (app.allow_audit_log_purge = 'on').
-- audit_logs remains append-only for all other operations.

CREATE OR REPLACE FUNCTION public.prevent_audit_log_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'DELETE' AND current_setting('app.allow_audit_log_purge', true) = 'on' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'audit_logs are append-only';
END;
$function$;
