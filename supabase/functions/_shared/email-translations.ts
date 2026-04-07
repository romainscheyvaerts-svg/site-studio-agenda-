// Multilingual email translations for fr, en, nl, es
// Used by send-admin-email and send-booking-notification Edge Functions

export type EmailLang = "fr" | "en" | "nl" | "es";

export interface EmailTranslations {
  // Common
  greeting: (name: string) => string;
  sessionDetails: string;
  service: string;
  date: string;
  time: string;
  duration: string;
  hours: string;
  amount: string;
  totalAmount: string;
  depositPaid: string;
  payAtStudio: string;
  payment: string;
  refundNote: string;
  noReplyWarning: string;
  studioTeam: (studioName: string) => string;
  seeYouSoon: string;
  
  // Booking confirmation
  bookingConfirmedTitle: string;
  bookingConfirmedSubject: (studioName: string) => string;
  bookingConfirmedBody: string;
  
  // Booking pending (< 24h)
  bookingPendingTitle: string;
  bookingPendingSubject: string;
  bookingPendingBody: string;
  pendingExplanation: string;
  
  // Admin notification
  adminNewBooking: string;
  adminActionRequired: string;
  adminActionExplanation: string;
  adminConfirm: string;
  adminReject: string;
  adminTimeRemaining: (hours: number) => string;
  adminClientInfo: string;
  adminBookedBy: (by: string) => string;
  adminReceivedAt: string;
  
  // Admin email (send-admin-email)
  adminEmailSubject: (studioName: string, service: string) => string;
  
  // Drive
  driveTitle: string;
  driveDescription: string;
  driveOpenFolder: string;
  driveAllFolders: string;
  
  // Calendar
  addToCalendar: string;
  prepareCalendar: string;
  
  // Stripe
  payNow: (amount: number) => string;
  
  // Contact
  contactTitle: string;
  contactPhone: string;
  contactEmail: string;
  
  // Service labels
  serviceLabels: Record<string, string>;
  
  // Address
  studioAddress: string;
  viewOnMaps: string;
  
  // Date formatting locale
  dateLocale: string;
}

const fr: EmailTranslations = {
  greeting: (name) => `Bonjour ${name},`,
  sessionDetails: "Détails de la session",
  service: "Service",
  date: "Date",
  time: "Heure",
  duration: "Durée",
  hours: "heure(s)",
  amount: "Montant",
  totalAmount: "Montant total",
  depositPaid: "Acompte payé",
  payAtStudio: "À payer au studio",
  payment: "Paiement",
  refundNote: "En cas de refus, vous serez intégralement remboursé.",
  noReplyWarning: "⚠️ Ceci est un email automatique, merci de ne pas y répondre.",
  studioTeam: (name) => `L'équipe ${name}`,
  seeYouSoon: "À très bientôt au studio ! 🎵",
  
  bookingConfirmedTitle: "Merci pour votre réservation !",
  bookingConfirmedSubject: (name) => `✅ Confirmation de réservation - ${name}`,
  bookingConfirmedBody: "Votre demande a bien été reçue. Voici les détails :",
  
  bookingPendingTitle: "⏳ En attente de confirmation",
  bookingPendingSubject: "⏳ Réservation en attente de confirmation",
  bookingPendingBody: "Merci pour votre demande de réservation. Voici les détails :",
  pendingExplanation: "Votre réservation étant à moins de 24h, elle doit être confirmée par notre équipe. Vous recevrez un email de confirmation ou d'annulation très prochainement.",
  
  adminNewBooking: "Nouvelle réservation",
  adminActionRequired: "⚠️ RÉSERVATION À MOINS DE 24H - ACTION REQUISE",
  adminActionExplanation: "Cette réservation est à moins de 24 heures. Veuillez confirmer ou refuser :",
  adminConfirm: "✅ CONFIRMER",
  adminReject: "❌ REFUSER",
  adminTimeRemaining: (h) => `⏰ Temps restant avant la session : ${h} heures`,
  adminClientInfo: "Informations client",
  adminBookedBy: (by) => `Réservé par : ${by}`,
  adminReceivedAt: "Réservation reçue le",
  
  adminEmailSubject: (studio, service) => `🎵 ${studio} - ${service}`,
  
  driveTitle: "📁 Votre dossier Google Drive",
  driveDescription: "Déposez vos fichiers audio (instrus, références, voix, etc.) dans ce dossier partagé :",
  driveOpenFolder: "📂 Dossier de cette session",
  driveAllFolders: "📁 Tous mes dossiers",
  
  addToCalendar: "📅 Ajouter à mon calendrier",
  prepareCalendar: "En attendant la confirmation, vous pouvez déjà préparer votre agenda :",
  
  payNow: (amount) => `💳 Payer maintenant (${amount}€)`,
  
  contactTitle: "📞 Une question ?",
  contactPhone: "Téléphone",
  contactEmail: "Email",
  
  serviceLabels: {
    "with-engineer": "Session avec ingénieur son",
    "without-engineer": "Location sèche (sans ingénieur)",
    "mixing": "Mixage",
    "mastering": "Mastering numérique",
    "analog-mastering": "Mastering analogique",
    "podcast": "Mixage podcast",
    "admin-event": "Réservation (créée par admin)",
  },
  
  studioAddress: "Adresse du studio",
  viewOnMaps: "Voir sur Google Maps",
  dateLocale: "fr-BE",
};

const en: EmailTranslations = {
  greeting: (name) => `Hello ${name},`,
  sessionDetails: "Session Details",
  service: "Service",
  date: "Date",
  time: "Time",
  duration: "Duration",
  hours: "hour(s)",
  amount: "Amount",
  totalAmount: "Total amount",
  depositPaid: "Deposit paid",
  payAtStudio: "Pay at studio",
  payment: "Payment",
  refundNote: "In case of rejection, you will receive a full refund.",
  noReplyWarning: "⚠️ This is an automated email, please do not reply.",
  studioTeam: (name) => `The ${name} team`,
  seeYouSoon: "See you soon at the studio! 🎵",
  
  bookingConfirmedTitle: "Thank you for your booking!",
  bookingConfirmedSubject: (name) => `✅ Booking Confirmation - ${name}`,
  bookingConfirmedBody: "Your request has been received. Here are the details:",
  
  bookingPendingTitle: "⏳ Awaiting confirmation",
  bookingPendingSubject: "⏳ Booking pending confirmation",
  bookingPendingBody: "Thank you for your booking request. Here are the details:",
  pendingExplanation: "Since your booking is less than 24 hours away, it must be confirmed by our team. You will receive a confirmation or cancellation email shortly.",
  
  adminNewBooking: "New booking",
  adminActionRequired: "⚠️ BOOKING LESS THAN 24H - ACTION REQUIRED",
  adminActionExplanation: "This booking is less than 24 hours away. Please confirm or reject:",
  adminConfirm: "✅ CONFIRM",
  adminReject: "❌ REJECT",
  adminTimeRemaining: (h) => `⏰ Time remaining before session: ${h} hours`,
  adminClientInfo: "Client information",
  adminBookedBy: (by) => `Booked by: ${by}`,
  adminReceivedAt: "Booking received on",
  
  adminEmailSubject: (studio, service) => `🎵 ${studio} - ${service}`,
  
  driveTitle: "📁 Your Google Drive Folder",
  driveDescription: "Upload your audio files (instrumentals, references, vocals, etc.) to this shared folder:",
  driveOpenFolder: "📂 Session folder",
  driveAllFolders: "📁 All my folders",
  
  addToCalendar: "📅 Add to my calendar",
  prepareCalendar: "While waiting for confirmation, you can already prepare your schedule:",
  
  payNow: (amount) => `💳 Pay now (€${amount})`,
  
  contactTitle: "📞 Any questions?",
  contactPhone: "Phone",
  contactEmail: "Email",
  
  serviceLabels: {
    "with-engineer": "Session with sound engineer",
    "without-engineer": "Dry rental (no engineer)",
    "mixing": "Mixing",
    "mastering": "Digital mastering",
    "analog-mastering": "Analog mastering",
    "podcast": "Podcast mixing",
    "admin-event": "Booking (created by admin)",
  },
  
  studioAddress: "Studio address",
  viewOnMaps: "View on Google Maps",
  dateLocale: "en-GB",
};

const nl: EmailTranslations = {
  greeting: (name) => `Hallo ${name},`,
  sessionDetails: "Sessiegegevens",
  service: "Dienst",
  date: "Datum",
  time: "Tijd",
  duration: "Duur",
  hours: "uur",
  amount: "Bedrag",
  totalAmount: "Totaalbedrag",
  depositPaid: "Voorschot betaald",
  payAtStudio: "Betalen in de studio",
  payment: "Betaling",
  refundNote: "Bij afwijzing wordt u volledig terugbetaald.",
  noReplyWarning: "⚠️ Dit is een automatisch e-mailbericht, gelieve niet te antwoorden.",
  studioTeam: (name) => `Het ${name} team`,
  seeYouSoon: "Tot binnenkort in de studio! 🎵",
  
  bookingConfirmedTitle: "Bedankt voor uw reservatie!",
  bookingConfirmedSubject: (name) => `✅ Bevestiging reservatie - ${name}`,
  bookingConfirmedBody: "Uw aanvraag is goed ontvangen. Hier zijn de details:",
  
  bookingPendingTitle: "⏳ In afwachting van bevestiging",
  bookingPendingSubject: "⏳ Reservatie in afwachting van bevestiging",
  bookingPendingBody: "Bedankt voor uw reservatie-aanvraag. Hier zijn de details:",
  pendingExplanation: "Aangezien uw reservatie minder dan 24 uur van tevoren is, moet deze door ons team worden bevestigd. U ontvangt binnenkort een bevestigings- of annulerings-e-mail.",
  
  adminNewBooking: "Nieuwe reservatie",
  adminActionRequired: "⚠️ RESERVATIE MINDER DAN 24U - ACTIE VEREIST",
  adminActionExplanation: "Deze reservatie is minder dan 24 uur van tevoren. Bevestig of weiger alstublieft:",
  adminConfirm: "✅ BEVESTIGEN",
  adminReject: "❌ WEIGEREN",
  adminTimeRemaining: (h) => `⏰ Resterende tijd voor de sessie: ${h} uur`,
  adminClientInfo: "Klantgegevens",
  adminBookedBy: (by) => `Geboekt door: ${by}`,
  adminReceivedAt: "Reservatie ontvangen op",
  
  adminEmailSubject: (studio, service) => `🎵 ${studio} - ${service}`,
  
  driveTitle: "📁 Uw Google Drive map",
  driveDescription: "Upload uw audiobestanden (instrumentalen, referenties, vocalen, enz.) naar deze gedeelde map:",
  driveOpenFolder: "📂 Sessiemap",
  driveAllFolders: "📁 Al mijn mappen",
  
  addToCalendar: "📅 Toevoegen aan mijn agenda",
  prepareCalendar: "Terwijl u wacht op bevestiging, kunt u alvast uw agenda voorbereiden:",
  
  payNow: (amount) => `💳 Nu betalen (€${amount})`,
  
  contactTitle: "📞 Vragen?",
  contactPhone: "Telefoon",
  contactEmail: "E-mail",
  
  serviceLabels: {
    "with-engineer": "Sessie met geluidstechnicus",
    "without-engineer": "Droge verhuur (zonder technicus)",
    "mixing": "Mixing",
    "mastering": "Digitale mastering",
    "analog-mastering": "Analoge mastering",
    "podcast": "Podcast mixing",
    "admin-event": "Reservatie (aangemaakt door admin)",
  },
  
  studioAddress: "Studio adres",
  viewOnMaps: "Bekijk op Google Maps",
  dateLocale: "nl-BE",
};

const es: EmailTranslations = {
  greeting: (name) => `Hola ${name},`,
  sessionDetails: "Detalles de la sesión",
  service: "Servicio",
  date: "Fecha",
  time: "Hora",
  duration: "Duración",
  hours: "hora(s)",
  amount: "Importe",
  totalAmount: "Importe total",
  depositPaid: "Depósito pagado",
  payAtStudio: "Pagar en el estudio",
  payment: "Pago",
  refundNote: "En caso de rechazo, recibirá un reembolso completo.",
  noReplyWarning: "⚠️ Este es un correo automático, por favor no responda.",
  studioTeam: (name) => `El equipo de ${name}`,
  seeYouSoon: "¡Nos vemos pronto en el estudio! 🎵",
  
  bookingConfirmedTitle: "¡Gracias por su reserva!",
  bookingConfirmedSubject: (name) => `✅ Confirmación de reserva - ${name}`,
  bookingConfirmedBody: "Su solicitud ha sido recibida. Aquí están los detalles:",
  
  bookingPendingTitle: "⏳ En espera de confirmación",
  bookingPendingSubject: "⏳ Reserva pendiente de confirmación",
  bookingPendingBody: "Gracias por su solicitud de reserva. Aquí están los detalles:",
  pendingExplanation: "Como su reserva es con menos de 24 horas de antelación, debe ser confirmada por nuestro equipo. Recibirá un email de confirmación o cancelación en breve.",
  
  adminNewBooking: "Nueva reserva",
  adminActionRequired: "⚠️ RESERVA CON MENOS DE 24H - ACCIÓN REQUERIDA",
  adminActionExplanation: "Esta reserva es con menos de 24 horas de antelación. Por favor confirme o rechace:",
  adminConfirm: "✅ CONFIRMAR",
  adminReject: "❌ RECHAZAR",
  adminTimeRemaining: (h) => `⏰ Tiempo restante antes de la sesión: ${h} horas`,
  adminClientInfo: "Información del cliente",
  adminBookedBy: (by) => `Reservado por: ${by}`,
  adminReceivedAt: "Reserva recibida el",
  
  adminEmailSubject: (studio, service) => `🎵 ${studio} - ${service}`,
  
  driveTitle: "📁 Tu carpeta de Google Drive",
  driveDescription: "Sube tus archivos de audio (instrumentales, referencias, voces, etc.) a esta carpeta compartida:",
  driveOpenFolder: "📂 Carpeta de la sesión",
  driveAllFolders: "📁 Todas mis carpetas",
  
  addToCalendar: "📅 Añadir a mi calendario",
  prepareCalendar: "Mientras espera la confirmación, ya puede preparar su agenda:",
  
  payNow: (amount) => `💳 Pagar ahora (${amount}€)`,
  
  contactTitle: "📞 ¿Alguna pregunta?",
  contactPhone: "Teléfono",
  contactEmail: "Correo",
  
  serviceLabels: {
    "with-engineer": "Sesión con ingeniero de sonido",
    "without-engineer": "Alquiler sin ingeniero",
    "mixing": "Mezcla",
    "mastering": "Masterización digital",
    "analog-mastering": "Masterización analógica",
    "podcast": "Mezcla de podcast",
    "admin-event": "Reserva (creada por admin)",
  },
  
  studioAddress: "Dirección del estudio",
  viewOnMaps: "Ver en Google Maps",
  dateLocale: "es-ES",
};

const translations: Record<EmailLang, EmailTranslations> = { fr, en, nl, es };

export function getEmailTranslations(lang?: string): EmailTranslations {
  const validLang = (lang && lang in translations) ? lang as EmailLang : "fr";
  return translations[validLang];
}

// Format date according to language
export function formatDateForLang(dateStr: string, lang?: string): string {
  const t = getEmailTranslations(lang);
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(t.dateLocale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// Get service label in the right language
export function getServiceLabel(type: string, lang?: string): string {
  const t = getEmailTranslations(lang);
  return t.serviceLabels[type] || type;
}
