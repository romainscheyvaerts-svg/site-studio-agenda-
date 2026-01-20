// Configuration CORS centralisée
// Les domaines autorisés peuvent être configurés via la variable d'environnement ALLOWED_ORIGINS
// Format: "https://domain1.com,https://domain2.com"

const DEFAULT_ALLOWED_ORIGINS = [
  "https://studiomakemusic.com",
  "https://www.studiomakemusic.com",
  "https://makemusicstudio.be",
  "https://www.makemusicstudio.be",
  "https://make-music.lovable.app",
];

export function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (envOrigins) {
    return envOrigins.split(",").map((o) => o.trim());
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();

  // Si l'origine est dans la liste autorisée, on la renvoie
  // Sinon on renvoie la première origine par défaut (plus sécurisé que "*")
  const origin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

// Pour la rétrocompatibilité pendant la migration
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
