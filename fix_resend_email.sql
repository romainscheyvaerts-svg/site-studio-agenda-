-- Check current resend config
SELECT id, name, email, resend_from_email, 
       CASE WHEN resend_api_key IS NOT NULL AND resend_api_key != '' THEN 'SET (' || LEFT(resend_api_key, 10) || '...)' ELSE 'NOT SET' END as resend_key_status
FROM studios;

-- Fix: change gmail from_email to verified Resend domain
UPDATE studios 
SET resend_from_email = 'noreply@my.trap.house.bxl'
WHERE resend_from_email LIKE '%gmail.com%' 
   OR resend_from_email LIKE '%hotmail%' 
   OR resend_from_email LIKE '%yahoo%';

-- Verify
SELECT id, name, resend_from_email FROM studios;
