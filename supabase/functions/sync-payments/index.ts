import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-PAYMENTS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Use service role for database operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get all pending payments
    const { data: pendingPayments, error: paymentsError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('status', 'pending');

    if (paymentsError) throw paymentsError;

    let updatedPayments = 0;
    let updatedCards = 0;

    for (const payment of pendingPayments || []) {
      if (payment.stripe_session_id) {
        try {
          // Check payment status in Stripe
          const session = await stripe.checkout.sessions.retrieve(payment.stripe_session_id);
          
          if (session.payment_status === 'paid') {
            // Update payment status
            const { error: paymentUpdateError } = await supabaseClient
              .from('payments')
              .update({ 
                status: 'paid',
                paid_at: new Date().toISOString()
              })
              .eq('id', payment.id);

            if (!paymentUpdateError) {
              updatedPayments++;
              
              // Update card status to revealed
              const { error: cardUpdateError } = await supabaseClient
                .from('cards')
                .update({ 
                  status: 'revealed',
                  revealed_at: new Date().toISOString()
                })
                .eq('id', payment.card_id);

              if (!cardUpdateError) {
                updatedCards++;
              }
            }
          }
        } catch (stripeError) {
          logStep("Error checking Stripe session", { 
            sessionId: payment.stripe_session_id,
            error: stripeError.message 
          });
        }
      }
    }

    logStep("Sync completed", { 
      updatedPayments, 
      updatedCards,
      totalPending: pendingPayments?.length || 0 
    });

    return new Response(JSON.stringify({ 
      success: true,
      updatedPayments,
      updatedCards,
      totalPending: pendingPayments?.length || 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in sync-payments", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});