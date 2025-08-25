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
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[${timestamp}] [SEND-UNLOCK-CODE] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    logStep("CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started", { method: req.method, url: req.url });

    // Validate request method
    if (req.method !== "POST") {
      logStep("Invalid method", { method: req.method });
      throw new Error(`Method ${req.method} not allowed`);
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      logStep("Request body parsed", { 
        hasEmail: !!requestBody.email,
        hasEventName: !!requestBody.eventName,
        hasCardNumber: !!requestBody.cardNumber
      });
    } catch (parseError) {
      logStep("Failed to parse request body", { error: parseError.message });
      throw new Error("Invalid JSON in request body");
    }

    const { email, eventName, cardNumber }: UnlockCodeRequest = requestBody;
    
    // Validate required fields
    if (!email || !eventName || !cardNumber) {
      const missingFields = [];
      if (!email) missingFields.push('email');
      if (!eventName) missingFields.push('eventName');
      if (!cardNumber) missingFields.push('cardNumber');
      
      logStep("Missing required fields", { missingFields });
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      logStep("Invalid email format", { email });
      throw new Error("Invalid email format");
    }

    logStep("Request data validated", { email, eventName, cardNumber });

    // Check if Resend API key is configured
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      logStep("RESEND_API_KEY not configured");
      throw new Error("Email service not configured - RESEND_API_KEY missing");
    }

    logStep("Resend API key found", { keyLength: resendApiKey.length });

    // Generate 6-digit unlock code
    const unlockCode = Math.floor(100000 + Math.random() * 900000).toString();
    logStep("Generated unlock code", { codeLength: unlockCode.length });

    // Prepare email content
    const emailContent = {
      from: "Contribui&Chá <noreply@contribuicha.com.br>",
      to: [email],
      subject: `Código de desbloqueio - ${eventName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #9E7FFF; margin: 0;">Contribui&Chá</h1>
          </div>
          
          <div style="background: linear-gradient(135deg, #9E7FFF, #38bdf8); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
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
    };

    logStep("Email content prepared", { 
      to: email, 
      subject: emailContent.subject,
      htmlLength: emailContent.html.length
    });

    // Send email using Resend
    let emailResponse;
    try {
      logStep("Attempting to send email via Resend API");
      emailResponse = await resend.emails.send(emailContent);
      logStep("Resend API response received", { 
        hasData: !!emailResponse.data,
        hasError: !!emailResponse.error,
        dataId: emailResponse.data?.id,
        errorMessage: emailResponse.error?.message
      });
      
    } catch (emailError) {
      logStep("Resend API call failed with exception", { 
        error: emailError.message,
        name: emailError.name,
        stack: emailError.stack?.split('\n').slice(0, 3).join('\n')
      });
      throw new Error(`Failed to call email API: ${emailError.message}`);
    }

    // Check if email was sent successfully
    if (emailResponse.error) {
      logStep("Email service returned error", { 
        error: emailResponse.error,
        message: emailResponse.error.message,
        name: emailResponse.error.name
      });
      throw new Error(`Email service error: ${emailResponse.error.message || 'Unknown email service error'}`);
    }

    if (!emailResponse.data) {
      logStep("No data returned from email service", { response: emailResponse });
      throw new Error("Email service did not return confirmation data");
    }

    logStep("Email sent successfully", { 
      messageId: emailResponse.data.id,
      to: email 
    });

    // Return success response
    const successResponse = { 
      success: true, 
      unlockCode: unlockCode,
      message: "Código enviado com sucesso!",
      messageId: emailResponse.data.id
    };

    logStep("Returning success response", { messageId: emailResponse.data.id });

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    logStep("ERROR in send-unlock-code", { 
      message: error.message, 
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    
    // Return error response
    const errorResponse = { 
      success: false, 
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
});
