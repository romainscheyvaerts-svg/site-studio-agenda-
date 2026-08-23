# Déploiement — Inscription auto Make Music → Social Artist

Cette fonctionnalité crée **automatiquement un compte sur le réseau social Music Artist**
quand quelqu'un s'inscrit (ou se connecte pour la 1ʳᵉ fois) sur Make Music, et lui
envoie un **email de bienvenue** expliquant le réseau (page artiste, dossier de presse,
échange entre artistes).

## Ce qui est déjà fait (code, poussé sur GitHub + Vercel)
- Edge function `supabase/functions/sync-user-to-social-artist/index.ts`
- Appel automatique dans `src/hooks/useAuth.tsx` (au `SIGNED_IN`)
- Entrée `config.toml` (`verify_jwt = true`)

> Le frontend est déjà en ligne : tant que la fonction n'est pas déployée, l'appel
> échoue silencieusement (aucun bug). Rien ne casse.

## Ce qu'il RESTE à faire (2 étapes, dans un terminal)

Prérequis : être connecté au CLI (`npx supabase login` une fois).

### 1) Définir les secrets sur le projet Make Music (`bbdylrwiwnwjpeblxriq`)

La clé `service_role` de Social Artist se trouve dans
`code social artist/.../social-artist/.env.local` → variable `SUPABASE_SERVICE_ROLE_KEY`.
**Ne jamais la coller dans un chat / un commit.**

```bash
cd "D:/1 WORK/CODE/SITE MAKE MUSIC/site-agenda-studio"

npx supabase secrets set \
  SOCIAL_ARTIST_SUPABASE_URL="https://ivneqyuchqjgsmfrutfn.supabase.co" \
  SOCIAL_ARTIST_SERVICE_ROLE_KEY="<COLLE_ICI_LA_CLE_SERVICE_ROLE_DE_SOCIAL_ARTIST>" \
  --project-ref bbdylrwiwnwjpeblxriq
```

(`RESEND_API_KEY` est déjà configurée sur ce projet — rien à faire.)

### 2) Déployer la fonction

```bash
npx supabase functions deploy sync-user-to-social-artist --project-ref bbdylrwiwnwjpeblxriq
```

## Vérifier

Inscris-toi sur Make Music avec une **adresse email de test jamais utilisée** sur
Music Artist → tu dois :
1. recevoir l'email « 🎵 Bienvenue sur Music Artist » ;
2. voir un nouveau compte/profil dans le projet Supabase Social Artist (`ivneqyuchqjgsmfrutfn`).

Se réinscrire/reconnecter avec la même adresse **ne renvoie pas** l'email (idempotent).

## Notes
- Sens implémenté : **Make Music → Social Artist**. Le sens inverse (Social Artist →
  Make Music) se fait de façon symétrique (une fonction dans le projet Social Artist
  appelant l'API admin de Make Music) — à ajouter plus tard si besoin.
- Connexion : le mail contient un **lien magique** (les mots de passe ne peuvent pas
  traverser deux projets Supabase séparés). S'il expire, l'utilisateur se connecte
  sur music-artist.art avec son email.
