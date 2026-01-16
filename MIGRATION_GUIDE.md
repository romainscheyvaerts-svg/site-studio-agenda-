# Guide de Migration - De Lovable vers votre propre Supabase

Ce guide vous explique comment migrer complètement le projet vers votre propre instance Supabase.

## Prérequis

- Un compte Supabase (gratuit sur [supabase.com](https://supabase.com))
- Node.js 18+ installé
- Supabase CLI installé: `npm install -g supabase`

---

## Étape 1: Créer votre projet Supabase

1. Allez sur [supabase.com/dashboard](https://supabase.com/dashboard)
2. Cliquez "New Project"
3. Choisissez un nom et un mot de passe pour la base de données
4. Attendez que le projet soit créé (~2 minutes)

---

## Étape 2: Récupérer vos credentials

Dans **Supabase Dashboard** > **Settings** > **API**:

| Credential | Description |
|------------|-------------|
| **Project URL** | `https://XXXXX.supabase.co` |
| **anon public** | Clé publique `eyJhbGci...` |
| **service_role** | Clé secrète `eyJhbGci...` (ne jamais exposer!) |
| **Project ID** | Les XXXXX dans l'URL |

---

## Étape 3: Créer la base de données (tables)

### Option A: Via SQL Editor (recommandé)

1. Dans Supabase Dashboard, allez dans **SQL Editor**
2. Cliquez "New Query"
3. Copiez-collez le contenu de `supabase/schema.sql`
4. Cliquez "Run"

### Option B: Via CLI

```bash
# Lier votre projet
supabase link --project-ref VOTRE_PROJECT_ID

# Appliquer les migrations
supabase db push
```

---

## Étape 4: Déployer les Edge Functions

```bash
# Lier votre projet (si pas déjà fait)
supabase link --project-ref VOTRE_PROJECT_ID

# Déployer TOUTES les fonctions
supabase functions deploy

# OU déployer une par une
supabase functions deploy get-paypal-client-id
supabase functions deploy paypal-webhook
supabase functions deploy studio-chat
# ... etc
```

---

## Étape 5: Configurer les Secrets

Les Edge Functions ont besoin de secrets pour fonctionner. Exécutez ces commandes:

### Paiements Stripe
```bash
supabase secrets set STRIPE_SECRET_KEY="sk_live_..."
supabase secrets set STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

### Paiements PayPal
```bash
supabase secrets set PAYPAL_CLIENT_ID="votre-client-id"
supabase secrets set PAYPAL_CLIENT_SECRET="votre-client-secret"
```

### Emails (Resend)
```bash
supabase secrets set RESEND_API_KEY="re_..."
supabase secrets set RESEND_FROM_EMAIL="noreply@votredomaine.com"
supabase secrets set ADMIN_EMAIL="votre-email@gmail.com"
```

### Google (Calendar + Drive)
```bash
# Le JSON doit être sur UNE SEULE LIGNE
supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@....iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}'

supabase secrets set GOOGLE_STUDIO_CALENDAR_ID="votre-calendrier@group.calendar.google.com"
supabase secrets set GOOGLE_PATRON_CALENDAR_ID="votre-email@gmail.com"
supabase secrets set GOOGLE_DRIVE_PARENT_FOLDER_ID="1ABC...xyz"
```

### Calendriers secondaires (optionnel)
```bash
supabase secrets set GOOGLE_SECONDARY_CALENDAR_ID=""
supabase secrets set GOOGLE_TERTIARY_CALENDAR_ID=""
supabase secrets set CLARIDGE_ICAL_URL=""
```

### Chatbot IA (Google Gemini)
```bash
supabase secrets set GEMINI_API_KEY="AIza..."
```

### Vérifier les secrets
```bash
supabase secrets list
```

---

## Étape 6: Mettre à jour les fichiers du projet

### 6.1 Fichier `.env`

```env
VITE_SUPABASE_PROJECT_ID="VOTRE_PROJECT_ID"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGci...votre-anon-key"
VITE_SUPABASE_URL="https://VOTRE_PROJECT_ID.supabase.co"
```

### 6.2 Fichier `supabase/config.toml`

```toml
project_id = "VOTRE_PROJECT_ID"
```

---

## Étape 7: Configurer Vercel

1. Connectez votre repo GitHub à [Vercel](https://vercel.com)
2. Dans **Settings** > **Environment Variables**, ajoutez:

| Variable | Valeur |
|----------|--------|
| `VITE_SUPABASE_URL` | `https://VOTRE_PROJECT_ID.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Votre anon key |
| `VITE_SUPABASE_PROJECT_ID` | Votre Project ID |

3. Redéployez le projet

---

## Étape 8: Créer un admin

Pour avoir accès à l'admin panel, vous devez ajouter un rôle admin:

1. Créez un compte utilisateur sur votre site
2. Dans Supabase Dashboard > **SQL Editor**, exécutez:

```sql
-- Récupérer l'ID de l'utilisateur
SELECT id, email FROM auth.users WHERE email = 'votre-email@gmail.com';

-- Ajouter le rôle admin (remplacez USER_ID par l'ID récupéré)
INSERT INTO public.user_roles (user_id, role) 
VALUES ('USER_ID', 'admin');

-- Pour un super admin
INSERT INTO public.user_roles (user_id, role) 
VALUES ('USER_ID', 'superadmin');
```

---

## Résumé des secrets nécessaires

| Secret | Requis | Description |
|--------|--------|-------------|
| `STRIPE_SECRET_KEY` | ✅ Oui | Paiements Stripe |
| `STRIPE_PUBLISHABLE_KEY` | ✅ Oui | Paiements Stripe |
| `PAYPAL_CLIENT_ID` | ✅ Oui | Paiements PayPal |
| `PAYPAL_CLIENT_SECRET` | ✅ Oui | Paiements PayPal |
| `RESEND_API_KEY` | ✅ Oui | Envoi emails |
| `RESEND_FROM_EMAIL` | ✅ Oui | Email expéditeur |
| `ADMIN_EMAIL` | ✅ Oui | Notifications admin |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | ✅ Oui | Calendar + Drive |
| `GOOGLE_STUDIO_CALENDAR_ID` | ✅ Oui | Calendrier studio |
| `GOOGLE_PATRON_CALENDAR_ID` | ⚠️ Recommandé | Calendrier perso |
| `GOOGLE_DRIVE_PARENT_FOLDER_ID` | ✅ Oui | Dossier Drive clients |
| `GEMINI_API_KEY` | ⚠️ Recommandé | Chatbot IA (gratuit) |
| `CLARIDGE_ICAL_URL` | ❌ Optionnel | Calendrier externe |

---

## Dépannage

### Les Edge Functions ne marchent pas
- Vérifiez que tous les secrets sont configurés: `supabase secrets list`
- Vérifiez les logs: `supabase functions logs <nom-fonction>`

### Erreur d'authentification Supabase
- Vérifiez que `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` sont corrects
- Vérifiez que vous utilisez bien la clé "anon" (pas service_role)

### Erreur Google Calendar/Drive
- Vérifiez que le JSON du service account est sur UNE seule ligne
- Vérifiez que le calendrier est partagé avec l'email du service account
- Vérifiez que le dossier Drive est partagé avec l'email du service account

### Le chatbot ne fonctionne pas
- Vérifiez que `GEMINI_API_KEY` est configuré
- Obtenez une clé gratuite sur [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- Vérifiez les logs: `supabase functions logs studio-chat`
