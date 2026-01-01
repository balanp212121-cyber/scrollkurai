import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PaymentNotificationRequest {
  userId: string;
  userName: string;
  itemName: string;
  amount: number;
  currency: string;
  status: "approved" | "rejected";
  adminNote?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
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

    const { userId, userName, itemName, amount, currency, status, adminNote }: PaymentNotificationRequest = await req.json();

    // Get user email from auth.users using service role
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (userError || !userData?.user?.email) {
      console.error("Could not find user email:", userError);
      return new Response(JSON.stringify({ success: false, error: "User email not found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userEmail = userData.user.email;
    console.log(`Sending payment ${status} notification to ${userEmail} for ${itemName}`);

    const isApproved = status === "approved";
    const subject = isApproved 
      ? `🎉 Payment Approved - ${itemName}` 
      : `❌ Payment Needs Attention - ${itemName}`;

    const htmlContent = isApproved
      ? `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #00d9ff 0%, #7c3aed 100%); padding: 30px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 28px; }
            .content { padding: 30px; color: #e0e0e0; }
            .success-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; margin-bottom: 20px; }
            .details { background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 20px 0; }
            .details-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
            .details-row:last-child { border-bottom: none; }
            .label { color: #a0a0a0; }
            .value { color: #00d9ff; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #00d9ff 0%, #7c3aed 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Payment Approved!</h1>
            </div>
            <div class="content">
              <p>Hi ${userName || 'there'},</p>
              <span class="success-badge">✓ APPROVED</span>
              <p>Great news! Your payment has been verified and approved. Your premium features are now active!</p>
              <div class="details">
                <div class="details-row">
                  <span class="label">Item</span>
                  <span class="value">${itemName}</span>
                </div>
                <div class="details-row">
                  <span class="label">Amount</span>
                  <span class="value">${currency} ${amount}</span>
                </div>
                <div class="details-row">
                  <span class="label">Status</span>
                  <span class="value">✓ Active</span>
                </div>
              </div>
              <p>Start exploring your new features now. Thank you for upgrading to ScrollKurai Pro!</p>
              <center>
                <a href="https://scrollkurai.lovable.app" class="cta-button">Open ScrollKurai</a>
              </center>
            </div>
            <div class="footer">
              <p>© 2024 ScrollKurai - Transform Brain Rot into True Potential</p>
            </div>
          </div>
        </body>
        </html>
      `
      : `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 28px; }
            .content { padding: 30px; color: #e0e0e0; }
            .rejected-badge { background: #ef4444; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; margin-bottom: 20px; }
            .details { background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 20px 0; }
            .details-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
            .details-row:last-child { border-bottom: none; }
            .label { color: #a0a0a0; }
            .value { color: #fbbf24; font-weight: bold; }
            .admin-note { background: rgba(239, 68, 68, 0.2); border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #1a1a2e; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Needs Attention</h1>
            </div>
            <div class="content">
              <p>Hi ${userName || 'there'},</p>
              <span class="rejected-badge">✗ REJECTED</span>
              <p>Unfortunately, we couldn't verify your payment proof. Please upload a clearer proof of payment.</p>
              <div class="details">
                <div class="details-row">
                  <span class="label">Item</span>
                  <span class="value">${itemName}</span>
                </div>
                <div class="details-row">
                  <span class="label">Amount</span>
                  <span class="value">${currency} ${amount}</span>
                </div>
              </div>
              ${adminNote ? `
              <div class="admin-note">
                <strong>Admin Note:</strong><br/>
                ${adminNote}
              </div>
              ` : ''}
              <p>Please re-upload a clearer payment screenshot showing the transaction details.</p>
              <center>
                <a href="https://scrollkurai.lovable.app/subscription" class="cta-button">Re-upload Payment Proof</a>
              </center>
            </div>
            <div class="footer">
              <p>© 2024 ScrollKurai - Transform Brain Rot into True Potential</p>
            </div>
          </div>
        </body>
        </html>
      `;

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ScrollKurai <onboarding@resend.dev>",
        to: [userEmail],
        subject: subject,
        html: htmlContent,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Email sent:", emailResult);

    if (!emailResponse.ok) {
      throw new Error(emailResult.message || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true, data: emailResult, email: userEmail }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending payment notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
