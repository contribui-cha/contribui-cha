import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyCodeRequest {
  email: string;
  eventId: number;
  cardNumber: number;
  unlockCode: string;
}

// Apenas logs de erro críticos serão mantidos

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { email, eventId, cardNumber, unlockCode }: VerifyCodeRequest = requestBody;

    // Validate required fields
    if (!email || !eventId || !cardNumber || !unlockCode) {
      const missingFields = [];
      if (!email) missingFields.push('email');
      if (!eventId) missingFields.push('eventId');
      if (!cardNumber) missingFields.push('cardNumber');
      if (!unlockCode) missingFields.push('unlockCode');
      
      throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
    }

    // Para cards reservados, permite envio do email ao invés do código
    // A validação do formato será feita pela função do banco
    
    // Get Supabase credentials
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuração do Supabase ausente");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, { 
      auth: { persistSession: false } 
    });

    // Call the database function to verify code and reserve card
    const { data, error } = await supabaseClient.rpc('verify_unlock_code_and_reveal', {
      _email: email,
      _event_id: eventId,
      _card_number: cardNumber,
      _unlock_code: unlockCode
    });

    if (error) {
      console.error("Erro na função do banco:", error.message);
      throw new Error(`Erro no banco de dados: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error("Nenhum resultado da função de verificação");
    }

    const result = data[0];
    
    if (!result.success) {
      throw new Error(result.message);
    }

    // Return success response
    const successResponse = {
      success: true,
      message: result.message,
      email,
      cardNumber,
      cardValue: result.card_value
    };

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("ERRO in verify-unlock-code:", error.message);
    
    const errorResponse = { 
      success: false, 
      message: error.message || 'Erro na verificação do código',
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
