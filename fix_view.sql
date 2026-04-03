DROP VIEW IF EXISTS client_stats;
CREATE VIEW client_stats AS
SELECT
  studio_id,
  client_email,
  MAX(client_name) as client_name,
  COUNT(*) as total_sessions,
  SUM(duration_hours) as total_hours,
  SUM(base_price) as total_base_price,
  SUM(discount_amount) as total_discounts,
  SUM(final_price) as total_spent,
  MIN(session_date) as first_session,
  MAX(session_date) as last_session
FROM client_sessions
GROUP BY studio_id, client_email;
GRANT SELECT ON client_stats TO authenticated;
