// Shared email template utilities for Edge Functions
// This module fetches templates from the database and renders them with variables

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  template_description: string | null;
  subject_template: string;
  heading_text: string | null;
  subheading_text: string | null;
  body_template: string | null;
  cta_button_text: string | null;
  cta_button_url_template: string | null;
  footer_text: string | null;
  show_logo: boolean;
  show_session_details: boolean;
  show_price: boolean;
  show_calendar_button: boolean;
  show_drive_link: boolean;
  show_social_links: boolean;
  is_active: boolean;
}

export interface EmailConfig {
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  accent_color: string;
  logo_url: string | null;
  studio_name: string;
  studio_address: string | null;
  studio_phone: string | null;
  studio_email: string | null;
  footer_text: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  show_social_links: boolean;
}

export interface TemplateVariables {
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  session_date?: string;
  start_time?: string;
  end_time?: string;
  service_type?: string;
  amount_paid?: string;
  remaining_amount?: string;
  total_amount?: string;
  drive_link?: string;
  client_root_drive_link?: string; // Lien vers le dossier racine du client (tous ses dossiers)
  message?: string;
  invoice_number?: string;
  instrumental_title?: string;
  bpm?: string;
  key?: string;
  license_type?: string;
  download_link?: string;
  calendar_link?: string;
  confirm_url?: string;
  reject_url?: string;
  [key: string]: string | undefined;
}

// Replace template variables with actual values
export function replaceVariables(text: string | null, variables: TemplateVariables): string {
  if (!text) return "";
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}

// Get Supabase client for template fetching
function getSupabaseClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
}

// Fetch email template by key
export async function getEmailTemplate(templateKey: string): Promise<EmailTemplate | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("template_key", templateKey)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    console.log(`[EMAIL-TEMPLATE] Template not found or inactive: ${templateKey}`);
    return null;
  }

  return data as EmailTemplate;
}

// Fetch global email config
export async function getEmailConfig(): Promise<EmailConfig | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("email_config")
    .select("*")
    .limit(1)
    .single();

  if (error || !data) {
    console.log("[EMAIL-TEMPLATE] Email config not found, using defaults");
    return null;
  }

  return data as EmailConfig;
}

// Default config if none exists in database
const DEFAULT_CONFIG: EmailConfig = {
  primary_color: "#22d3ee",
  secondary_color: "#0ea5e9",
  background_color: "#0a0a0a",
  text_color: "#fafafa",
  accent_color: "#10b981",
  logo_url: "https://www.studiomakemusic.com/favicon.png",
  studio_name: "Make Music Studio",
  studio_address: "Rue du Sceptre 22, 1050 Ixelles, Bruxelles",
  studio_phone: "+32 476 09 41 72",
  studio_email: "prod.makemusic@gmail.com",
  footer_text: "Make Music Studio - Studio d'enregistrement à Bruxelles",
  instagram_url: "https://instagram.com/makemusicstudio",
  facebook_url: "https://facebook.com/makemusicstudio",
  show_social_links: true,
};

// Render full email HTML from template
export async function renderEmailHtml(
  templateKey: string,
  variables: TemplateVariables,
  customSections?: {
    sessionDetailsHtml?: string;
    driveSection?: string;
    calendarButton?: string;
    extraContent?: string;
    confirmationButtons?: string;
  }
): Promise<{ subject: string; html: string } | null> {
  const template = await getEmailTemplate(templateKey);

  if (!template) {
    console.log(`[EMAIL-TEMPLATE] Cannot render, template not found: ${templateKey}`);
    return null;
  }

  const config = (await getEmailConfig()) || DEFAULT_CONFIG;

  // Replace variables in all template fields
  const subject = replaceVariables(template.subject_template, variables);
  const heading = replaceVariables(template.heading_text, variables);
  const subheading = replaceVariables(template.subheading_text, variables);
  const body = replaceVariables(template.body_template, variables);
  const ctaText = replaceVariables(template.cta_button_text, variables);
  const ctaUrl = replaceVariables(template.cta_button_url_template, variables);
  const footerText = template.footer_text || config.footer_text || DEFAULT_CONFIG.footer_text;

  // Build session details section
  let sessionDetailsHtml = "";
  if (template.show_session_details && customSections?.sessionDetailsHtml) {
    sessionDetailsHtml = customSections.sessionDetailsHtml;
  } else if (template.show_session_details && variables.session_date) {
    sessionDetailsHtml = `
      <div style="background-color: #1a1a1a; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #262626;">
        <p style="color: #a1a1aa; font-size: 12px; margin: 0 0 8px;">Détails de la session</p>
        <p style="color: #ffffff; font-size: 14px; margin: 0;">
          <strong>${variables.service_type || "Session"}</strong>
        </p>
        <p style="color: #a1a1aa; font-size: 13px; margin: 4px 0 0;">
          ${variables.session_date}${variables.start_time ? ` • ${variables.start_time}` : ""}${variables.end_time ? ` - ${variables.end_time}` : ""}
        </p>
        ${template.show_price && variables.amount_paid ? `
          <p style="color: ${config.accent_color || "#10b981"}; font-size: 18px; font-weight: bold; margin: 8px 0 0;">
            ${variables.amount_paid}€
          </p>
        ` : ""}
      </div>
    `;
  }

  // Build Drive link section
  let driveHtml = "";
  if (template.show_drive_link && (variables.drive_link || variables.client_root_drive_link || customSections?.driveSection)) {
    driveHtml = customSections?.driveSection || `
      <div style="background: linear-gradient(135deg, #4285F4 0%, #34A853 100%); border-radius: 8px; padding: 16px; margin: 16px 0; color: white;">
        <p style="margin: 0 0 8px; font-weight: bold;">📁 Vos dossiers Google Drive</p>
        <p style="margin: 0 0 12px; opacity: 0.9; font-size: 13px;">
          ${variables.drive_link ? "Déposez vos fichiers (instrumentales, références, etc.) avant la session." : "Accédez à tous vos dossiers de sessions."}
        </p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${variables.drive_link ? `
            <a href="${variables.drive_link}"
               target="_blank"
               style="display: inline-block; background-color: white; color: #4285F4; padding: 10px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px;">
              📂 Dossier de cette session
            </a>
          ` : ""}
          ${variables.client_root_drive_link ? `
            <a href="${variables.client_root_drive_link}"
               target="_blank"
               style="display: inline-block; background-color: rgba(255,255,255,0.15); color: white; padding: 10px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; border: 1px solid rgba(255,255,255,0.3);">
              📁 Tous mes dossiers
            </a>
          ` : ""}
        </div>
      </div>
    `;
  }

  // Build calendar button
  let calendarHtml = "";
  if (template.show_calendar_button && (variables.calendar_link || customSections?.calendarButton)) {
    calendarHtml = customSections?.calendarButton || `
      <div style="text-align: center; margin: 20px 0;">
        <a href="${variables.calendar_link}"
           target="_blank"
           style="display: inline-block; background: linear-gradient(135deg, ${config.primary_color} 0%, ${config.secondary_color} 100%); color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(34, 211, 238, 0.3);">
          📅 Ajouter à mon calendrier
        </a>
      </div>
    `;
  }

  // Build CTA button (if different from calendar)
  let ctaHtml = "";
  if (ctaText && ctaUrl && !template.show_calendar_button) {
    ctaHtml = `
      <div style="text-align: center; margin: 20px 0;">
        <a href="${ctaUrl}"
           target="_blank"
           style="display: inline-block; background-color: ${config.primary_color}; color: #0a0a0a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
          ${ctaText}
        </a>
      </div>
    `;
  }

  // Build social links
  let socialLinksHtml = "";
  if (template.show_social_links && config.show_social_links) {
    const links = [];
    if (config.instagram_url) {
      links.push(`<a href="${config.instagram_url}" style="color: ${config.primary_color}; text-decoration: none; margin: 0 8px;">Instagram</a>`);
    }
    if (config.facebook_url) {
      links.push(`<a href="${config.facebook_url}" style="color: ${config.primary_color}; text-decoration: none; margin: 0 8px;">Facebook</a>`);
    }
    if (links.length > 0) {
      socialLinksHtml = `<div style="margin-top: 12px; font-size: 12px;">${links.join(" • ")}</div>`;
    }
  }

  // Confirmation buttons for admin (if provided)
  const confirmationButtonsHtml = customSections?.confirmationButtons || "";

  // Extra content (custom sections)
  const extraContentHtml = customSections?.extraContent || "";

  // Build full HTML
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: ${config.background_color}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, rgba(34,211,238,0.2), rgba(124,58,237,0.2)); padding: 24px; border-radius: 12px 12px 0 0; text-align: center; border-bottom: 1px solid #262626;">
          ${template.show_logo && config.logo_url ? `
            <img src="${config.logo_url}" alt="${config.studio_name}" style="width: 60px; height: 60px; border-radius: 10px; margin-bottom: 12px;" />
          ` : ""}
          <h1 style="color: ${config.text_color}; font-size: 22px; font-weight: bold; margin: 0;">
            ${config.studio_name}
          </h1>
        </div>

        <!-- Main Content -->
        <div style="background-color: #1a1a1a; padding: 24px; border: 1px solid #262626; border-top: none;">

          ${confirmationButtonsHtml}

          ${heading ? `
            <h2 style="color: ${config.text_color}; font-size: 20px; margin: 0 0 8px;">
              ${heading}
            </h2>
          ` : ""}

          ${subheading ? `
            <p style="color: #a1a1aa; font-size: 14px; margin: 0 0 20px;">
              ${subheading}
            </p>
          ` : ""}

          ${body ? `
            <div style="color: #d4d4d8; font-size: 14px; line-height: 1.6;">
              ${body.split("\n").map(line => `<p style="margin: 8px 0;">${line}</p>`).join("")}
            </div>
          ` : ""}

          ${sessionDetailsHtml}

          ${driveHtml}

          ${calendarHtml}

          ${ctaHtml}

          ${extraContentHtml}

        </div>

        <!-- Footer -->
        <div style="background-color: #0a0a0a; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #262626; border-top: none;">
          <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
            ${footerText}
          </p>
          ${config.studio_phone ? `
            <p style="color: #a1a1aa; font-size: 11px; margin: 8px 0 0;">
              📞 <a href="tel:${config.studio_phone}" style="color: ${config.primary_color}; text-decoration: none;">${config.studio_phone}</a>
            </p>
          ` : ""}
          ${socialLinksHtml}
        </div>

      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

// Fallback: Generate email HTML with default template (for backward compatibility)
export function generateFallbackEmailHtml(
  title: string,
  content: string,
  ctaText?: string,
  ctaUrl?: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a; color: #fafafa;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #ffffff; margin: 0;">Make Music Studio</h1>
      </div>
      <h2 style="color: #22d3ee;">${title}</h2>
      <div style="color: #d4d4d8; line-height: 1.6;">
        ${content}
      </div>
      ${ctaText && ctaUrl ? `
        <div style="text-align: center; margin: 20px 0;">
          <a href="${ctaUrl}" style="display: inline-block; background: #22d3ee; color: #1a1a1a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            ${ctaText}
          </a>
        </div>
      ` : ""}
      <p style="color: #a1a1aa; font-size: 12px; text-align: center; margin-top: 30px;">
        Make Music Studio - Bruxelles
      </p>
    </body>
    </html>
  `;
}
