// Bloc HTML « Crée gratuitement ta page artiste » injecté dans les emails
// destinés au client (livraison d'instru, confirmation de réservation).
// Invite l'artiste à rejoindre le réseau social Music Artist.

export const SOCIAL_ARTIST_URL = "https://www.music-artist.art";

export function artistCtaEmailBlock(): string {
  return `
  <div style="background: linear-gradient(135deg, rgba(124,58,237,0.15), rgba(0,212,255,0.10)); border: 1px solid rgba(124,58,237,0.35); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
    <p style="display:inline-block; background: rgba(124,58,237,0.25); color:#c4b5fd; font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:4px 12px; border-radius:20px; margin:0 0 12px 0;">100% gratuit</p>
    <h3 style="color:#ffffff; margin:0 0 8px 0; font-size:20px;">🎤 Crée gratuitement ta page artiste</h3>
    <p style="color:#a0a0a0; margin:0 0 18px 0; font-size:14px; line-height:1.6;">
      Rejoins <strong style="color:#e0e0e0;">Music Artist</strong>, le réseau social des artistes :
      crée ta page artiste, monte ton dossier de presse et échange avec d'autres artistes.
    </p>
    <a href="${SOCIAL_ARTIST_URL}" style="display:inline-block; background: linear-gradient(90deg,#7c3aed 0%,#00d4ff 100%); color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:50px; font-size:15px; font-weight:bold;">
      Créer ma page gratuitement &rarr;
    </a>
  </div>`;
}
