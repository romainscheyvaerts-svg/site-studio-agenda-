-- ============================================================================
-- Script pour vérifier la structure de session_assignments
-- L'envoi d'email est géré par la fonction Edge "update-admin-event"
-- qui doit être déployée manuellement via le Dashboard Supabase
-- ============================================================================

-- 1. Vérifier que la table session_assignments existe avec les bonnes colonnes
DO $$
BEGIN
    -- Vérifier si la colonne assigned_to existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'session_assignments' 
        AND column_name = 'assigned_to'
    ) THEN
        RAISE NOTICE 'La table session_assignments ou la colonne assigned_to est manquante!';
    ELSE
        RAISE NOTICE 'La table session_assignments est correctement configurée.';
    END IF;
END $$;

-- 2. Vérifier les admins et leurs emails (depuis auth.users)
SELECT 
    ur.user_id,
    ur.role,
    ap.display_name,
    ap.color,
    'Email visible via auth.users (service_role uniquement)' as email_note
FROM user_roles ur
LEFT JOIN admin_profiles ap ON ur.user_id = ap.user_id
WHERE ur.role IN ('admin', 'superadmin')
ORDER BY ap.display_name;

-- 3. Voir les assignments récents (pour vérifier que ça fonctionne)
SELECT 
    sa.event_id,
    sa.assigned_to,
    sa.service_type,
    sa.total_price,
    sa.client_name,
    sa.created_at,
    sa.updated_at,
    ap.display_name as admin_name
FROM session_assignments sa
LEFT JOIN admin_profiles ap ON sa.assigned_to = ap.user_id
ORDER BY sa.updated_at DESC
LIMIT 10;

-- ============================================================================
-- INSTRUCTIONS POUR DÉPLOYER LA FONCTION "update-admin-event"
-- ============================================================================
-- 
-- 1. Allez sur https://supabase.com/dashboard
-- 2. Sélectionnez votre projet
-- 3. Allez dans "Edge Functions" (menu de gauche)
-- 4. Cliquez sur "update-admin-event" 
-- 5. Cliquez sur "Deploy" ou "Redeploy"
--
-- La fonction enverra automatiquement un email au responsable quand:
-- - Un nouvel admin est assigné à une session
-- - L'admin assigné change (différent de l'ancien)
--
-- L'email est envoyé à l'adresse utilisée pour créer le compte Supabase.
-- ============================================================================