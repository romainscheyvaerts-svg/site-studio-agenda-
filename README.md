# Studio Make Music

Site de réservation de studio d'enregistrement avec système de paiement intégré.

## Technologies

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Paiements**: Stripe + PayPal
- **Emails**: Resend
- **Calendrier**: Google Calendar API
- **AI Chatbot**: Google Gemini

## Configuration

### Variables d'environnement (Vercel)

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=votre_clé_anon
```

### Secrets Supabase (Edge Functions)

Les secrets suivants doivent être configurés sur Supabase :

| Secret | Description |
|--------|-------------|
| `GEMINI_API_KEY` | Clé API Google Gemini |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe |
| `PAYPAL_CLIENT_ID` | Client ID PayPal |
| `PAYPAL_CLIENT_SECRET` | Secret PayPal |
| `RESEND_API_KEY` | Clé API Resend |
| `RESEND_FROM_EMAIL` | Email expéditeur |
| `ADMIN_EMAIL` | Email admin pour notifications |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON du Service Account Google |
| `GOOGLE_DRIVE_API_KEY` | Clé API Google Drive |
| `GOOGLE_STUDIO_CALENDAR_ID` | ID calendrier principal |
| `GOOGLE_PATRON_CALENDAR_ID` | ID calendrier patron |
| `GOOGLE_TERTIARY_CALENDAR_ID` | ID calendrier tertiaire |

## Développement

```bash
# Installer les dépendances
npm install

# Lancer en développement
npm run dev

# Build pour production
npm run build
```

## Déploiement

Le site est déployé automatiquement sur Vercel à chaque push sur la branche main.

## Domaine

- Production: https://studiomakemusic.com
