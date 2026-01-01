import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ResetPasswordRequest {
  email: string;
  redirectTo: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { email, redirectTo }: ResetPasswordRequest = await req.json();

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Generating password reset link for ${email}`);

    // Generate password reset link using admin API
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectTo,
      }
    });

    if (linkError) {
      console.error("Error generating reset link:", linkError);
      // Don't reveal if user exists or not for security
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset email will be sent" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resetLink = data.properties?.action_link;
    if (!resetLink) {
      throw new Error("Failed to generate reset link");
    }

    console.log("Reset link generated, sending email...");

    // Send custom email via Resend
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #00d9ff 0%, #7c3aed 100%); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 30px; color: #e0e0e0; }
          .reset-box { background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #00d9ff 0%, #7c3aed 100%); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 20px 0; }
          .cta-button:hover { opacity: 0.9; }
          .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
          .warning { background: rgba(251, 191, 36, 0.2); border-left: 4px solid #fbbf24; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; color: #fbbf24; }
          .expire-note { color: #a0a0a0; font-size: 12px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p>We received a request to reset your ScrollKurai password. Click the button below to create a new password:</p>
            
            <div class="reset-box">
              <a href="${resetLink}" class="cta-button">Reset My Password</a>
              <p class="expire-note">This link will expire in 24 hours</p>
            </div>
            
            <div class="warning">
              <strong>⚠️ Didn't request this?</strong><br/>
              If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.
            </div>
            
            <p style="color: #888; font-size: 12px; margin-top: 20px;">
              If the button doesn't work, copy and paste this link into your browser:<br/>
              <span style="color: #00d9ff; word-break: break-all;">${resetLink}</span>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 ScrollKurai - Transform Brain Rot into True Potential</p>
            <p>This is an automated message. Please don't reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ScrollKurai <onboarding@resend.dev>",
        to: [email],
        subject: "🔐 Reset Your ScrollKurai Password",
        html: htmlContent,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Password reset email sent:", emailResult);

    if (!emailResponse.ok) {
      console.error("Resend error:", emailResult);
      throw new Error(emailResult.message || "Failed to send email");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Password reset email sent" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
