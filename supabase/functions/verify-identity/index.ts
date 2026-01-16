import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema - limit image size and name length
const verifyIdentitySchema = z.object({
  imageBase64: z.string()
    .min(100, "Image data is too short")
    .max(15 * 1024 * 1024, "Image data exceeds 15MB limit"), // ~11MB actual image after base64
  formName: z.string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  userEmail: z.string().email().optional(),
  userName: z.string().optional(),
});

// Parent folder for all client folders
const PARENT_FOLDER_ID = "1AXGpSHUP0OyY2tWvCk573xb--Dj2jvLh";

// Escape single quotes in Drive API query values to prevent injection
function escapeDriveQueryValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

// Validate folder name matches expected safe pattern
function isValidFolderName(name: string): boolean {
  const SAFE_FOLDER_NAME = /^[a-zA-Z0-9\s\-_@.àâäéèêëïîôùûüç]+$/i;
  return SAFE_FOLDER_NAME.test(name) && name.length <= 200;
}

// Get Google OAuth2 access token using service account
async function getAccessToken(serviceAccountKey: string, scopes: string[]): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: key.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const base64url = (data: Uint8Array) => btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const claimSetB64 = base64url(encoder.encode(JSON.stringify(claimSet)));
  const signatureInput = `${headerB64}.${claimSetB64}`;

  const pemContent = key.private_key.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const jwt = `${signatureInput}.${base64url(new Uint8Array(signature))}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Token exchange failed:", errorText);
    throw new Error("Failed to get access token");
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Find or create a folder in Google Drive
async function findOrCreateFolder(
  accessToken: string,
  name: string,
  parentId: string
): Promise<string> {
  // Validate folder name
  if (!isValidFolderName(name)) {
    console.error(`[SECURITY] Invalid folder name rejected: ${name.substring(0, 50)}`);
    throw new Error("Invalid folder name format");
  }

  // Search for existing folder with escaped values
  const escapedName = escapeDriveQueryValue(name);
  const query = `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchResponse.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create new folder
  const metadata = {
    name,
    mimeType: "application/vnd.google-apps.folder",
    parents: [parentId],
  };

  const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  const createData = await createResponse.json();
  console.log(`Created folder "${name}":`, createData.id);
  return createData.id;
}

// Check if ID folder has any files
async function checkIdFolderHasFiles(accessToken: string, idFolderId: string): Promise<boolean> {
  const query = `'${idFolderId}' in parents and trashed=false`;
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await response.json();
  
  return data.files && data.files.length > 0;
}

// Upload image to Google Drive
async function uploadToDrive(
  accessToken: string,
  imageBase64: string,
  fileName: string,
  parentFolderId: string
): Promise<{ id: string; webViewLink: string } | null> {
  try {
    // Extract base64 data (remove data URL prefix if present)
    const base64Data = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64;

    // Create multipart request
    const boundary = "-------314159265358979323846";
    const metadata = {
      name: fileName,
      parents: [parentFolderId],
    };

    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: image/jpeg',
      'Content-Transfer-Encoding: base64',
      '',
      base64Data,
      `--${boundary}--`,
    ].join('\r\n');

    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Drive upload failed:", errorText);
      return null;
    }

    const fileData = await uploadResponse.json();
    console.log("Document uploaded to Drive:", fileData.id);
    return fileData;
  } catch (error) {
    console.error("Error uploading to Drive:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();

    // Validate input
    const parseResult = verifyIdentitySchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.error("[VALIDATION] Invalid input:", parseResult.error.errors);
      return new Response(
        JSON.stringify({
          verified: false,
          error: parseResult.error.errors.map(e => e.message).join(", "),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { imageBase64, formName, userEmail, userName } = parseResult.data;

    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKey) {
      throw new Error("Google service account key not configured");
    }

    const accessToken = await getAccessToken(serviceAccountKey, [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive",
    ]);

    // Determine client folder name
    const clientFolderName = userName || userEmail?.split("@")[0] || formName.replace(/[^a-zA-Z0-9\s]/g, "").substring(0, 30);
    
    // Find or create client folder
    const clientFolderId = await findOrCreateFolder(accessToken, clientFolderName, PARENT_FOLDER_ID);
    
    // Find or create ID subfolder
    const idFolderId = await findOrCreateFolder(accessToken, "ID", clientFolderId);
    
    // Check if ID folder already has documents - skip verification if so
    const hasExistingId = await checkIdFolderHasFiles(accessToken, idFolderId);
    
    if (hasExistingId) {
      console.log(`[SKIP-VERIFICATION] User ${clientFolderName} already has ID document, skipping verification`);
      return new Response(
        JSON.stringify({
          verified: true,
          skipped: true,
          message: "Document d'identité déjà vérifié précédemment",
          documentLink: `https://drive.google.com/drive/folders/${idFolderId}`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Proceed with AI verification using Gemini
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    console.log("Starting identity verification for:", formName.substring(0, 20) + "...");

    // Extract base64 data (remove data URL prefix if present)
    const base64ImageData = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64;

    // Use Gemini Vision to extract name from ID card
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Tu es un système de vérification d'identité. Analyse cette image de carte d'identité (CNI, passeport, permis de conduire) et extrais UNIQUEMENT le nom et prénom de la personne.

INSTRUCTIONS IMPORTANTES:
- Extrais le NOM DE FAMILLE et le PRÉNOM visibles sur le document
- Ignore les autres informations (date de naissance, adresse, etc.)
- Si tu ne peux pas lire le document clairement, réponds avec "ILLISIBLE"
- Si ce n'est pas un document d'identité valide, réponds avec "INVALIDE"

Réponds UNIQUEMENT avec un JSON dans ce format exact:
{"status": "success", "firstName": "Prénom", "lastName": "Nom"}
ou
{"status": "error", "reason": "ILLISIBLE" ou "INVALIDE"}

Ne rajoute aucun texte avant ou après le JSON.`,
                },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: base64ImageData,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 200,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      throw new Error("Failed to analyze ID document");
    }

    const aiResult = await response.json();
    const aiMessage = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    console.log("AI response:", aiMessage);

    // Parse the AI response
    let extractedData;
    try {
      // Clean the response in case there's extra text
      const jsonMatch = aiMessage.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return new Response(
        JSON.stringify({
          verified: false,
          error: "Impossible d'analyser le document. Veuillez réessayer avec une photo plus nette.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if document was readable
    if (extractedData.status === "error") {
      return new Response(
        JSON.stringify({
          verified: false,
          error: extractedData.reason === "ILLISIBLE" 
            ? "Le document n'est pas lisible. Veuillez prendre une photo plus nette."
            : "Ce document ne semble pas être une pièce d'identité valide.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Compare names
    const extractedFullName = `${extractedData.firstName} ${extractedData.lastName}`.toLowerCase().trim();
    const formNameNormalized = formName.toLowerCase().trim();
    
    // Normalize names for comparison (remove accents, extra spaces)
    const normalize = (str: string) => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    };

    const normalizedExtracted = normalize(extractedFullName);
    const normalizedForm = normalize(formNameNormalized);

    // Check for match (both orders: firstName lastName OR lastName firstName)
    const extractedParts = normalizedExtracted.split(" ");
    const formParts = normalizedForm.split(" ");

    let isMatch = false;

    // Check if all parts match (regardless of order)
    if (extractedParts.length >= 2 && formParts.length >= 2) {
      const extractedSet = new Set(extractedParts);
      const formSet = new Set(formParts);
      
      // Check if at least the first and last parts match
      const matchCount = formParts.filter(part => extractedSet.has(part)).length;
      isMatch = matchCount >= 2;
    }

    // Also check direct comparison
    if (!isMatch) {
      isMatch = normalizedExtracted === normalizedForm || 
                normalizedExtracted.includes(normalizedForm) || 
                normalizedForm.includes(normalizedExtracted);
    }

    console.log(`Name comparison: "${normalizedExtracted}" vs "${normalizedForm}" = ${isMatch}`);

    // If verification successful, upload document to client's ID folder
    let documentLink = null;
    if (isMatch) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const sanitizedName = formName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
        const fileName = `ID_${sanitizedName}_${timestamp}.jpg`;
        
        const uploadResult = await uploadToDrive(accessToken, imageBase64, fileName, idFolderId);
        if (uploadResult) {
          documentLink = uploadResult.webViewLink || `https://drive.google.com/file/d/${uploadResult.id}/view`;
          console.log("Document stored in client's ID folder:", documentLink);
        }
      } catch (driveError) {
        console.error("Failed to upload to Drive (non-blocking):", driveError);
        // Don't fail verification if Drive upload fails
      }
    }

    return new Response(
      JSON.stringify({
        verified: isMatch,
        extractedName: `${extractedData.firstName} ${extractedData.lastName}`,
        formName: formName,
        documentLink,
        idFolderLink: `https://drive.google.com/drive/folders/${idFolderId}`,
        error: isMatch ? null : "Le nom sur le document ne correspond pas au nom du formulaire.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error verifying identity:", errorMessage);
    
    return new Response(
      JSON.stringify({ verified: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
