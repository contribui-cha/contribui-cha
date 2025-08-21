import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UnlockCodeRequest {
  email: string;
  eventName: string;
  cardNumber: number;
}

// Helper function for logging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-UNLOCK-CODE] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { email, eventName, cardNumber }: UnlockCodeRequest = await req.json();
    
    if (!email || !eventName || !cardNumber) {
      throw new Error("Email, event name, and card number are required");
    }

    logStep("Request data validated", { email, eventName, cardNumber });

    // Generate 6-digit unlock code
    const unlockCode = Math.floor(100000 + Math.random() * 900000).toString();
    logStep("Generated unlock code", { code: unlockCode });

    const emailResponse = await resend.emails.send({
      from: "ContribuiChá <onboarding@resend.dev>",
      to: [email],
      subject: `Código de desbloqueio - ${eventName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3B82F6; margin: 0;">ContribuiChá</h1>
          </div>
          
          <div style="background: linear-gradient(135deg, #3B82F6, #1D4ED8); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h2 style="margin: 0 0 10px 0;">Código de Desbloqueio</h2>
            <p style="margin: 0; opacity: 0.9;">Card #${cardNumber} - ${eventName}</p>
          </div>

          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; display: inline-block;">
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1F2937; font-family: monospace;">
                ${unlockCode}
              </div>
            </div>
          </div>

          <div style="background: #FEF3C7; border: 1px solid #F59E0B; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #92400E; font-size: 14px;">
              <strong>⚠️ Importante:</strong> Este código é válido apenas para você. Não compartilhe com outras pessoas.
            </p>
          </div>

          <div style="text-align: center; margin-bottom: 30px;">
            <p style="color: #6B7280; margin: 0;">Digite este código para desbloquear seu card e fazer a contribuição.</p>
          </div>

          <div style="border-top: 1px solid #E5E7EB; padding-top: 20px; text-align: center;">
            <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
              Se você não solicitou este código, pode ignorar este email.
            </p>
          </div>
        </div>
      `,
    });

    logStep("Email sent successfully", { messageId: emailResponse.data?.id });

    return new Response(JSON.stringify({ 
      success: true, 
      unlockCode: unlockCode,
      message: "Código enviado com sucesso!" 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    logStep("ERROR in send-unlock-code", { message: error.message });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});