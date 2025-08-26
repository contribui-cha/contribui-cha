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

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[${timestamp}] [VERIFY-UNLOCK-CODE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    logStep("CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started", { method: req.method });

    if (req.method !== "POST") {
      throw new Error(`Method ${req.method} not allowed`);
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      logStep("Request body parsed", {
        hasEmail: !!requestBody.email,
        hasEventId: !!requestBody.eventId,
        hasCardNumber: !!requestBody.cardNumber,
        hasUnlockCode: !!requestBody.unlockCode
      });
    } catch (parseError) {
      logStep("Failed to parse request body", { error: parseError.message });
      throw new Error("Invalid JSON in request body");
    }

    const { email, eventId, cardNumber, unlockCode }: VerifyCodeRequest = requestBody;

    // Validate required fields
    if (!email || !eventId || !cardNumber || !unlockCode) {
      const missingFields = [];
      if (!email) missingFields.push('email');
      if (!eventId) missingFields.push('eventId');
      if (!cardNumber) missingFields.push('cardNumber');
      if (!unlockCode) missingFields.push('unlockCode');
      
      logStep("Missing required fields", { missingFields });
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate unlock code format (6 digits)
    if (!/^\d{6}$/.test(unlockCode)) {
      logStep("Invalid unlock code format", { code: unlockCode });
      throw new Error("Invalid unlock code format");
    }

    logStep("Request data validated", { email, eventId, cardNumber });

    // Get Supabase credentials
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      logStep("Missing Supabase credentials");
      throw new Error("Supabase configuration missing");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, { 
      auth: { persistSession: false } 
    });

    // Call the database function to verify code and reserve card
    logStep("Calling verify_unlock_code_and_reveal function", { email, eventId, cardNumber });
    
    const { data, error } = await supabaseClient.rpc('verify_unlock_code_and_reveal', {
      _email: email,
      _event_id: eventId,
      _card_number: cardNumber,
      _unlock_code: unlockCode
    });

    if (error) {
      logStep("Database function error", { error: error.message });
      throw new Error(`Database error: ${error.message}`);
    }

    logStep("Database function result", { data });

    if (!data || data.length === 0) {
      throw new Error("No result from verification function");
    }

    const result = data[0];
    
    if (!result.success) {
      logStep("Verification failed", { message: result.message });
      throw new Error(result.message);
    }

    logStep("Code verification and card reservation successful", { 
      email, 
      cardNumber, 
      cardValue: result.card_value 
    });

    // Return success response
    const successResponse = {
      success: true,
      message: result.message,
      email,
      cardNumber,
      cardValue: result.card_value
    };

    logStep("Returning success response");

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    logStep("ERROR in verify-unlock-code", { 
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    
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
