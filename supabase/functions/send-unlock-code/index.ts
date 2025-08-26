import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface UnlockCodeRequest {
  email: string;
  eventName: string;
  cardNumber: number;
  eventId: number;
}

// Apenas logs de erro críticos serão mantidos

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== "POST") {
      throw new Error("Método não permitido");
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      throw new Error("JSON inválido no corpo da requisição");
    }

    const { email, eventName, cardNumber, eventId }: UnlockCodeRequest = requestBody;
    
    // Validate required fields
    if (!email || !eventName || !cardNumber || !eventId) {
      const missingFields = [];
      if (!email) missingFields.push('email');
      if (!eventName) missingFields.push('eventName');
      if (!cardNumber) missingFields.push('cardNumber');
      if (!eventId) missingFields.push('eventId');
      
      throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Formato de email inválido");
    }

    // Check if Resend API key is configured
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      throw new Error("Serviço de email não configurado");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Configuração do Supabase ausente");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify card exists and is available
    const { data: cardData, error: cardError } = await supabase
      .from('cards')
      .select('id, status, event_id')
      .eq('event_id', eventId)
      .eq('card_number', cardNumber)
      .single();

    if (cardError) {
      throw new Error("Card não encontrado");
    }

    if (!cardData) {
      throw new Error("Card não encontrado");
    }

    if (cardData.status !== 'available') {
      throw new Error("Card não está disponível para desbloqueio");
    }

    // Generate 6-digit unlock code
    const unlockCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Save unlock code to database
    const { error: updateError } = await supabase
      .from('cards')
      .update({ unlock_code: unlockCode })
      .eq('id', cardData.id);

    if (updateError) {
      throw new Error("Falha ao salvar código de desbloqueio");
    }

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

    // Initialize Resend client
    let resend;
    try {
      resend = new Resend(resendApiKey);
    } catch (initError) {
      throw new Error(`Falha ao inicializar serviço de email: ${initError.message}`);
    }

    // Send email using Resend
    let emailResponse;
    try {
      emailResponse = await resend.emails.send(emailContent);
      
    } catch (emailError) {
      console.error("Falha na API do Resend:", emailError.message);
      throw new Error(`Falha ao chamar API de email: ${emailError.message}`);
    }

    // Check if email was sent successfully
    if (emailResponse.error) {
      console.error("Erro do serviço de email:", emailResponse.error.message);
      throw new Error(`Erro no serviço de email: ${emailResponse.error.message || 'Erro desconhecido do serviço de email'}`);
    }

    if (!emailResponse.data) {
      throw new Error("Serviço de email não retornou dados de confirmação");
    }

    // Return success response
    const successResponse = { 
      success: true, 
      unlockCode: unlockCode,
      message: "Código enviado com sucesso!",
      messageId: emailResponse.data.id
    };

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("ERRO in send-unlock-code:", error.message);
    
    // Return error response
    const errorResponse = { 
      success: false, 
      error: error.message || 'Erro desconhecido',
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
