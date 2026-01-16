# Make Music Studio

Application web pour le studio d'enregistrement Make Music à Bruxelles. Gestion des réservations, paiements, et services audio professionnels.

## Technologies

- **Frontend**: Vite + React + TypeScript
- **UI**: shadcn-ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Paiements**: Stripe + PayPal
- **Emails**: Resend
- **Calendrier/Drive**: Google APIs
- **Hébergement**: Vercel (frontend) + Supabase (backend)

## Développement local

### Prérequis

- Node.js 18+ ([installer avec nvm](https://github.com/nvm-sh/nvm))
- npm ou bun
- [Supabase CLI](https://supabase.com/docs/guides/cli) (pour les Edge Functions)

### Installation

```bash
# Cloner le repo
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env.local

# Configurer vos variables dans .env.local
# (voir section Configuration ci-dessous)

# Lancer le serveur de développement
npm run dev
```

L'application sera disponible sur `http://localhost:8080`

## Déploiement sur Vercel

### 1. Préparer le projet

Le projet est déjà configuré pour Vercel avec le fichier `vercel.json`.

### 2. Déployer sur Vercel

```bash
# Installer Vercel CLI (optionnel)
npm i -g vercel

# Déployer
vercel

# Ou simplement connecter le repo GitHub à Vercel Dashboard
```

### 3. Configurer les variables d'environnement Vercel

Dans Vercel Dashboard > Settings > Environment Variables, ajoutez:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL de votre projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé anon/publique Supabase |
| `VITE_SUPABASE_PROJECT_ID` | ID du projet Supabase |

> **Note**: Les autres variables (Stripe, PayPal, Google, etc.) sont utilisées par les Edge Functions Supabase, pas par le frontend Vercel.

## Configuration Supabase Edge Functions

Les Edge Functions de Supabase nécessitent des secrets pour fonctionner. Ces secrets sont **différents** des variables Vercel.

### Liste des secrets requis

#### Paiements
- `STRIPE_SECRET_KEY` - Clé secrète Stripe (sk_live_... ou sk_test_...)
- `STRIPE_PUBLISHABLE_KEY` - Clé publique Stripe
- `PAYPAL_CLIENT_ID` - Client ID PayPal
- `PAYPAL_CLIENT_SECRET` - Secret PayPal

#### Emails
- `RESEND_API_KEY` - Clé API Resend
- `RESEND_FROM_EMAIL` - Email d'expédition (ex: noreply@studiomakemusic.com)
- `ADMIN_EMAIL` - Email admin pour notifications

#### Google Services
- `GOOGLE_SERVICE_ACCOUNT_KEY` - JSON du compte de service (sur une ligne)
- `GOOGLE_STUDIO_CALENDAR_ID` - ID calendrier du studio
- `GOOGLE_PATRON_CALENDAR_ID` - ID calendrier personnel
- `GOOGLE_SECONDARY_CALENDAR_ID` - Calendrier secondaire (optionnel)
- `GOOGLE_TERTIARY_CALENDAR_ID` - Calendrier tertiaire (optionnel)
- `CLARIDGE_ICAL_URL` - URL iCal externe
- `GOOGLE_DRIVE_PARENT_FOLDER_ID` - Dossier Drive parent

#### IA/Chatbot
- `LOVABLE_API_KEY` - Clé API Lovable pour le chatbot

### Configurer les secrets via CLI

```bash
# Lier votre projet Supabase
supabase link --project-ref <votre-project-ref>

# Configurer chaque secret
supabase secrets set STRIPE_SECRET_KEY="sk_live_..."
supabase secrets set STRIPE_PUBLISHABLE_KEY="pk_live_..."
supabase secrets set PAYPAL_CLIENT_ID="..."
supabase secrets set PAYPAL_CLIENT_SECRET="..."
supabase secrets set RESEND_API_KEY="re_..."
supabase secrets set RESEND_FROM_EMAIL="noreply@studiomakemusic.com"
supabase secrets set ADMIN_EMAIL="prod.makemusic@gmail.com"
supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
supabase secrets set GOOGLE_STUDIO_CALENDAR_ID="..."
supabase secrets set GOOGLE_PATRON_CALENDAR_ID="..."
supabase secrets set GOOGLE_DRIVE_PARENT_FOLDER_ID="..."
supabase secrets set LOVABLE_API_KEY="..."

# Vérifier les secrets configurés
supabase secrets list
```

### Configurer les secrets via Dashboard

1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Naviguez vers **Edge Functions** > **Secrets**
4. Ajoutez chaque secret avec son nom et sa valeur

## Edge Functions

Le projet contient de nombreuses Edge Functions pour gérer:

| Fonction | Description |
|----------|-------------|
| `check-availability` | Vérifie disponibilité calendrier |
| `create-stripe-payment` | Crée session Stripe Checkout |
| `create-stripe-payment-intent` | Crée PaymentIntent Stripe |
| `verify-stripe-payment` | Vérifie paiement Stripe |
| `get-stripe-publishable-key` | Retourne clé publique Stripe |
| `get-paypal-client-id` | Retourne Client ID PayPal |
| `paypal-webhook` | Webhook paiements PayPal |
| `create-instrumental-payment` | Paiement instrumentales |
| `send-booking-notification` | Email confirmation réservation |
| `send-quote-request` | Demande de devis |
| `generate-invoice` | Génération factures PDF |
| `create-admin-event` | Créer événement admin |
| `update-admin-event` | Modifier événement |
| `delete-admin-event` | Supprimer événement |
| `get-weekly-availability` | Disponibilités semaine |
| `scan-drive-instrumentals` | Scanner Drive pour instrumentales |
| `stream-instrumental` | Stream audio instrumentales |
| `deliver-instrumental` | Livraison après achat |
| `studio-chat` | Chatbot studio |
| `quote-assistant` | Assistant devis IA |
| `verify-identity` | Vérification pièce d'identité |
| `process-booking-payment` | Traitement paiement booking |
| `handle-booking-action` | Actions sur réservations |
| `create-client-subfolder` | Créer dossier client Drive |
| `list-users` | Liste utilisateurs (admin) |
| `manage-admin-role` | Gestion rôles admin |
| `save-studio-project` | Sauvegarde projet studio |
| `validate-promo-code` | Validation codes promo |
| `send-admin-email` | Emails admin |

## Configuration Google Service Account

1. Créez un projet sur [Google Cloud Console](https://console.cloud.google.com)
2. Activez les APIs: Calendar API, Drive API
3. Créez un compte de service: IAM & Admin > Service Accounts
4. Créez une clé JSON pour ce compte
5. Partagez votre calendrier Google avec l'email du compte de service
6. Partagez le dossier Drive avec l'email du compte de service

Le contenu JSON doit être minifié sur une seule ligne pour `GOOGLE_SERVICE_ACCOUNT_KEY`.

## Structure du projet

```
├── src/
│   ├── components/     # Composants React
│   ├── pages/          # Pages de l'application
│   ├── hooks/          # Custom hooks
│   ├── integrations/   # Client Supabase
│   ├── i18n/           # Traductions (FR, EN, NL, ES)
│   └── lib/            # Utilitaires
├── supabase/
│   ├── functions/      # Edge Functions Deno
│   └── migrations/     # Migrations SQL
├── public/             # Assets statiques
├── vercel.json         # Config Vercel
└── .env.example        # Template variables
```

## Scripts disponibles

```bash
npm run dev       # Serveur développement
npm run build     # Build production
npm run preview   # Preview build local
npm run lint      # Linter ESLint
```

## Support

- Email: prod.makemusic@gmail.com
- WhatsApp: +32 476 09 41 72
- Adresse: Rue du Sceptre 22, 1050 Ixelles, Bruxelles
