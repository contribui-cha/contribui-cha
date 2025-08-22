import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyUnlockRequest {
  email: string;
  eventId: number;
  cardNumber: number;
  unlockCode: string;
  guestName?: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-UNLOCK-CODE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { email, eventId, cardNumber, unlockCode, guestName }: VerifyUnlockRequest = await req.json();
    
    if (!email || !eventId || !cardNumber || !unlockCode) {
      throw new Error("Email, event ID, card number, and unlock code are required");
    }

    logStep("Request validated", { email, eventId, cardNumber });

    // Use the secure function to verify unlock code and reveal card
    const { data, error } = await supabase
      .rpc('verify_unlock_code_and_reveal', {
        _email: email,
        _event_id: eventId,
        _card_number: cardNumber,
        _unlock_code: unlockCode,
        _guest_name: guestName || null
      });

    if (error) {
      logStep("Database error", { error: error.message });
      throw error;
    }

    const result = data[0];
    logStep("Verification result", result);

    if (!result.success) {
      return new Response(JSON.stringify({
        success: false,
        message: result.message
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: result.message,
      cardValue: result.card_value
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    logStep("ERROR in verify-unlock-code", { message: error.message });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});