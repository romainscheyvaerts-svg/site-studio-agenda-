// =============================================================================
// FICHIER DE CONFIGURATION CENTRALISÉ
// =============================================================================
// Toutes les variables hardcodées du projet sont regroupées ici.
// Modifiez ces valeurs pour personnaliser le comportement de l'application.
// =============================================================================

// -----------------------------------------------------------------------------
// 🔐 SUPER ADMIN / RÔLES
// -----------------------------------------------------------------------------
export const SUPER_ADMIN_EMAIL = "romain.scheyvaerts@gmail.com";

export const SUPER_ADMIN_EMAILS = [
  "prod.makemusic@gmail.com",
  "romain.scheyvaerts@gmail.com",
];

/** Emails admin à exclure des listes utilisateur / activités */
export const ADMIN_EMAILS = [
  "prod.makemusic@gmail.com",
  "kazamzamka@gmail.com",
  "romain.scheyvaerts@gmail.com",
];

/** Emails studio à exclure des listes d'assignation de session */
export const STUDIO_EXCLUDED_EMAILS = ["prod.makemusic@gmail.com"];

/** Nom par défaut de l'ingénieur son responsable */
export const DEFAULT_ENGINEER_NAME = "LENNON";

// -----------------------------------------------------------------------------
// 📞 CONTACT / STUDIO
// -----------------------------------------------------------------------------
export const STUDIO_EMAIL = "prod.makemusic@gmail.com";
export const STUDIO_PHONE = "+32476094172";
export const STUDIO_PHONE_DISPLAY = "+32 476 09 41 72";
export const STUDIO_PHONE_INTERNATIONAL = "+32 456 123 789"; // Utilisé dans les templates
export const WHATSAPP_NUMBER = "+32476094172";
export const WHATSAPP_MIX_NUMBER = "33612345678"; // Pour demande de mix en présentiel

export const STUDIO_LOCATION = "Bruxelles";
export const STUDIO_LOCATION_FULL = "Bruxelles, Belgique";
export const STUDIO_ADDRESS = "Rue du Sceptre 22, 1050 Ixelles";
export const STUDIO_ADDRESS_TEMPLATE = "Rue de la Loi 42, 1000 Bruxelles"; // Utilisé dans email config

// -----------------------------------------------------------------------------
// 🏷️ BRANDING / PLATEFORME
// -----------------------------------------------------------------------------
export const PLATFORM_NAME = "StudioBooking";
export const DEFAULT_STUDIO_NAME = "Make Music";
export const STUDIO_FULL_NAME = "Make Music Studio";
export const STUDIO_TAGLINE = "Studio d'enregistrement professionnel à Bruxelles";

export const LOGO_URL = "https://www.studiomakemusic.com/favicon.png";
export const SOCIAL_LINKS_URL = "https://music-artist.art/lennon";
export const INSTAGRAM_URL = "https://instagram.com/makemusic.studio";

// -----------------------------------------------------------------------------
// 💰 TARIFS PAR DÉFAUT (fallbacks si la BDD ne répond pas)
// -----------------------------------------------------------------------------
export const DEFAULT_PRICING: Record<string, number> = {
  "with-engineer": 45,
  "without-engineer": 22,
  "mixing": 200,
  "mastering": 60,
  "analog-mastering": 100,
  "podcast": 40,
  "composition": 200,
};

/** Acompte fixe pour composition en présentiel */
export const COMPOSITION_ONSITE_DEPOSIT = 20;

/** Acompte fixe pour mastering analogique */
export const ANALOG_MASTERING_DEPOSIT = 80;

// -----------------------------------------------------------------------------
// 🎵 CLÉS DE SERVICES CONNUS
// -----------------------------------------------------------------------------
export const KNOWN_SERVICE_KEYS = [
  "with-engineer",
  "without-engineer",
  "mixing",
  "mastering",
  "analog-mastering",
  "podcast",
  "composition",
];

// -----------------------------------------------------------------------------
// 🎚️ STUDIO / DAW (page Studio.tsx)
// -----------------------------------------------------------------------------
export const TRACK_HEIGHT = 80;
export const DEFAULT_PIXELS_PER_SECOND = 50;
export const MAX_TRACKS = 20;

export const TRACK_COLORS = [
  "hsl(var(--primary))",
  "hsl(200 70% 50%)",
  "hsl(280 70% 50%)",
  "hsl(340 70% 50%)",
  "hsl(160 70% 50%)",
  "hsl(40 70% 50%)",
  "hsl(100 70% 50%)",
  "hsl(220 70% 50%)",
];

// -----------------------------------------------------------------------------
// 🤖 CHATBOT
// -----------------------------------------------------------------------------
export const DEFAULT_CHATBOT_GREETING = `Salut ! 👋 Je suis l'assistant de ${DEFAULT_STUDIO_NAME}, studio d'enregistrement à ${STUDIO_LOCATION}. Je connais tout notre équipement (le Neumann U87, la chaîne SSL, les Genelec...) et nos tarifs. Comment puis-je t'aider pour ton projet ?`;

export const DEFAULT_CHATBOT_PROMPT = `Tu es l'assistant virtuel de ${STUDIO_FULL_NAME}, un studio d'enregistrement haut de gamme situé à ${STUDIO_LOCATION} (${STUDIO_ADDRESS}). 

## Équipement du studio:
- Microphone: Neumann U87
- Préampli SSL
- Interface SSL
- Monitoring: Genelec avec subwoofer
- DAW: ProTools
- Plugins: UAD, Waves, Soundtoys, Antares (Auto-Tune), SSL, Slate Digital

## Services et tarifs:
- Session avec ingénieur son: ${DEFAULT_PRICING["with-engineer"]}€/h (acompte 50%)
- Location sèche (sans ingénieur): ${DEFAULT_PRICING["without-engineer"]}€/h (paiement complet)
- Mixage: ${DEFAULT_PRICING["mixing"]}€/projet (acompte 50%)
- Mastering numérique: ${DEFAULT_PRICING["mastering"]}€ (acompte 50%)
- Mastering analogique: ${DEFAULT_PRICING["analog-mastering"]}€/piste (paiement complet)
- Mixage podcast: ${DEFAULT_PRICING["podcast"]}€/minute audio

## Ta mission:
- Répondre aux questions sur le studio et ses services
- Qualifier les projets des clients
- Conseiller sur le choix de prestation adapté
- Rediriger vers la réservation quand approprié

Sois professionnel, chaleureux et expert. Tu représentes un studio haut de gamme.`;

export const QUOTE_CHATBOT_GREETING = `Bonjour ! Je suis l'assistant ${DEFAULT_STUDIO_NAME}. Je vais vous aider à établir un devis personnalisé pour votre projet. 🎵\n\nPour commencer, pouvez-vous me décrire votre projet ? (Type de session, nombre de morceaux, style musical, etc.)`;

// -----------------------------------------------------------------------------
// ✉️ EMAIL CONFIG PAR DÉFAUT
// -----------------------------------------------------------------------------
export const DEFAULT_EMAIL_CONFIG = {
  primary_color: "#22d3ee",
  secondary_color: "#7c3aed",
  background_color: "#0a0a0a",
  card_color: "#1a1a1a",
  text_color: "#ffffff",
  muted_text_color: "#a1a1aa",
  border_color: "#262626",
  success_color: "#10b981",
  logo_url: LOGO_URL,
  studio_name: STUDIO_FULL_NAME,
  footer_text: `${STUDIO_FULL_NAME} - ${STUDIO_TAGLINE}`,
  footer_address: STUDIO_ADDRESS_TEMPLATE,
  footer_phone: STUDIO_PHONE_INTERNATIONAL,
  footer_email: STUDIO_EMAIL,
  social_instagram: INSTAGRAM_URL,
  social_facebook: "",
  social_youtube: "",
  social_tiktok: "",
  show_calendar_button: true,
  show_social_links: true,
  show_logo: true,
  font_family: "Arial, Helvetica, sans-serif",
};

// -----------------------------------------------------------------------------
// 📋 FACTURES - EXEMPLES PAR DÉFAUT
// -----------------------------------------------------------------------------
export const DEFAULT_INVOICE_CLIENT = {
  name: "Jean Dupont",
  email: "jean.dupont@email.com",
  address: "123 Rue de la Musique\n1000 Bruxelles",
};

// -----------------------------------------------------------------------------
// 📅 CALENDRIER
// -----------------------------------------------------------------------------
export const CALENDAR_COLORS = [
  { id: "1", name: "Lavande", color: "bg-purple-400", hex: "#7986cb" },
  { id: "2", name: "Sauge", color: "bg-green-400", hex: "#33b679" },
  { id: "3", name: "Raisin", color: "bg-violet-500", hex: "#8e24aa" },
  { id: "4", name: "Flamingo", color: "bg-pink-400", hex: "#e67c73" },
  { id: "5", name: "Banane", color: "bg-yellow-400", hex: "#f6bf26" },
  { id: "6", name: "Mandarine", color: "bg-orange-500", hex: "#f4511e" },
  { id: "7", name: "Paon", color: "bg-cyan-500", hex: "#039be5" },
  { id: "8", name: "Graphite", color: "bg-gray-500", hex: "#616161" },
  { id: "9", name: "Myrtille", color: "bg-blue-600", hex: "#3f51b5" },
  { id: "10", name: "Basilic", color: "bg-emerald-600", hex: "#0b8043" },
  { id: "11", name: "Tomate", color: "bg-red-500", hex: "#d50000" },
];

// -----------------------------------------------------------------------------
// ⏱️ INTERVALLES / DÉLAIS
// -----------------------------------------------------------------------------
/** Intervalle de rafraîchissement Drive (en ms) */
export const DRIVE_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/** Délai avant création du dossier Drive après auth (en ms) */
export const DRIVE_CREATION_DELAY_NEW = 1000;
export const DRIVE_CREATION_DELAY_EXISTING = 2000;

/** Délai debounce pour la vérification de disponibilité (en ms) */
export const AVAILABILITY_CHECK_DEBOUNCE = 500;

/** Scroll delay after service selection (en ms) */
export const SCROLL_DELAY = 150;

/** Seuil de scroll pour la navbar (en px) */
export const NAVBAR_SCROLL_THRESHOLD = 50;

/** Taille max de l'historique undo/redo du Studio DAW */
export const MAX_HISTORY_SIZE = 50;

// -----------------------------------------------------------------------------
// 🔑 CODES PROMO SPÉCIAUX (noms de référence)
// -----------------------------------------------------------------------------
export const PROMO_CODE_CASHONLY = "cashonly777";

// -----------------------------------------------------------------------------
// 🔒 VALIDATION
// -----------------------------------------------------------------------------
/** Longueur minimale du mot de passe */
export const MIN_PASSWORD_LENGTH = 12;

/** Longueur minimale du nom */
export const MIN_NAME_LENGTH = 2;

/** Regex email */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// -----------------------------------------------------------------------------
// 🎨 COULEURS / PRICING DISPLAY
// -----------------------------------------------------------------------------
export const HERO_PRICE_COLORS = [
  "text-primary text-glow-cyan",
  "text-accent",
  "text-foreground",
];

/** Nombre maximum de services affichés dans le Hero */
export const HERO_MAX_SERVICES = 3;

/** Seuil de prix réduit pour les sessions longues (dès 5h) */
export const VOLUME_DISCOUNT_HOURS = 5;
export const VOLUME_DISCOUNT_RATIO = 0.9;

// Map price_unit to display string
export const UNIT_DISPLAY_MAP: Record<string, string> = {
  "/h": "/heure",
  "/projet": "/projet",
  "/track": "/track",
  "/min": "/min",
};
