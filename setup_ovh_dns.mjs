// Step 1: Create OVH API application
const formData = new URLSearchParams();
formData.append('nic', 'prod.makemusic@gmail.com');
formData.append('password', 'ovhmake2323');
formData.append('applicationName', 'dns-setup-resend');
formData.append('applicationDescription', 'Add DNS records for Resend email');

console.log("Step 1: Creating OVH API application...");
const createAppRes = await fetch('https://eu.api.ovh.com/createApp/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: formData.toString(),
});

const html = await createAppRes.text();
console.log("Status:", createAppRes.status);

// Extract application key and secret from HTML response
const keyMatch = html.match(/application key[^<]*<[^>]*>([^<]+)/i) || html.match(/applicationKey[^<]*<[^>]*>([^<]+)/i);
const secretMatch = html.match(/application secret[^<]*<[^>]*>([^<]+)/i) || html.match(/applicationSecret[^<]*<[^>]*>([^<]+)/i);

if (keyMatch) console.log("App Key:", keyMatch[1].trim());
if (secretMatch) console.log("App Secret:", secretMatch[1].trim());

if (!keyMatch && !secretMatch) {
  // Check for error or already exists
  const errorMatch = html.match(/<div[^>]*class="[^"]*error[^"]*"[^>]*>(.*?)<\/div>/is);
  if (errorMatch) console.log("Error:", errorMatch[1].trim());
  
  // Check if it's a nic-handle login page
  if (html.includes('nic-handle') || html.includes('identifiant')) {
    console.log("OVH requires nic-handle (not email) for API auth");
  }
  
  // Print first 2000 chars to debug
  console.log("\nResponse HTML (first 2000 chars):");
  console.log(html.substring(0, 2000));
}
