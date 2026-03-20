import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin or superadmin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'superadmin'])
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body
    const { instrumentalId, downloadType } = await req.json();

    if (!instrumentalId) {
      return new Response(
        JSON.stringify({ error: 'Instrumental ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get instrumental details
    const { data: instrumental, error: instError } = await supabase
      .from('instrumentals')
      .select('*')
      .eq('id', instrumentalId)
      .single();

    if (instError || !instrumental) {
      return new Response(
        JSON.stringify({ error: 'Instrumental not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Google service account credentials
    const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountKey) {
      console.error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Google credentials missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = JSON.parse(serviceAccountKey);
    const accessToken = await getGoogleAccessToken(credentials);

    console.log(`Admin download requested by ${user.email} for instrumental: ${instrumental.title}, type: ${downloadType}`);

    // Handle stems folder - return folder link
    if (downloadType === 'stems' && instrumental.has_stems && instrumental.stems_folder_id) {
      const downloadUrl = `https://drive.google.com/drive/folders/${instrumental.stems_folder_id}`;
      return new Response(
        JSON.stringify({ 
          downloadUrl,
          fileName: `${instrumental.title} - Stems`,
          title: instrumental.title,
          type: downloadType,
          isFolderLink: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For instrumental file: proxy the download through the edge function
    const fileId = instrumental.drive_file_id;
    
    if (!fileId) {
      return new Response(
        JSON.stringify({ error: 'No drive file ID found for this instrumental' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get file metadata first
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!metadataResponse.ok) {
      const metaError = await metadataResponse.text();
      console.error('Failed to get file metadata:', metaError);
      return new Response(
        JSON.stringify({ error: 'Failed to get file metadata from Google Drive' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metadata = await metadataResponse.json();
    const fileName = metadata.name || `${instrumental.title}.mp3`;
    const mimeType = metadata.mimeType || 'audio/mpeg';

    console.log(`Downloading file: ${fileName}, mimeType: ${mimeType}, size: ${metadata.size}`);

    // Download the actual file content from Google Drive
    const fileResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!fileResponse.ok) {
      const fileError = await fileResponse.text();
      console.error('Failed to download file from Drive:', fileError);
      return new Response(
        JSON.stringify({ error: 'Failed to download file from Google Drive' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Stream the file content back to the client
    const fileContent = await fileResponse.arrayBuffer();

    return new Response(fileContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': fileContent.byteLength.toString(),
      },
    });

  } catch (error: unknown) {
    console.error('Admin download error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getGoogleAccessToken(credentials: { client_email: string; private_key: string; token_uri: string }): Promise<string> {
  const jwt = await createGoogleJWT(credentials);
  
  const response = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to get Google access token:', errorText);
    throw new Error('Failed to get Google access token');
  }

  const data = await response.json();
  return data.access_token;
}

async function createGoogleJWT(credentials: { client_email: string; private_key: string; token_uri: string }): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: credentials.token_uri,
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaim = base64UrlEncode(JSON.stringify(claim));
  const signatureInput = `${encodedHeader}.${encodedClaim}`;
  const signature = await signWithRSA(signatureInput, credentials.private_key);
  
  return `${signatureInput}.${signature}`;
}

async function signWithRSA(data: string, privateKey: string): Promise<string> {
  const pemContent = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(data)
  );
  
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
