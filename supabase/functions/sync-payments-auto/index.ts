import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-PAYMENTS-AUTO] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Auto sync function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Use service role for database operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get all pending payments from the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    
    const { data: pendingPayments, error: paymentsError } = await supabaseClient
      .from('payments')
      .select('*')
      .eq('status', 'pending')
      .gte('created_at', oneDayAgo.toISOString());

    if (paymentsError) throw paymentsError;

    logStep("Found pending payments", { count: pendingPayments?.length || 0 });

    let updatedPayments = 0;
    let updatedCards = 0;

    for (const payment of pendingPayments || []) {
      if (payment.stripe_session_id) {
        try {
          // Check payment status in Stripe
          const session = await stripe.checkout.sessions.retrieve(payment.stripe_session_id);
          
          logStep("Checking session", { 
            sessionId: payment.stripe_session_id,
            paymentStatus: session.payment_status 
          });
          
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
              logStep("Payment updated to paid", { paymentId: payment.id });
              
              // Update card status to revealed
              const { error: cardUpdateError } = await supabaseClient
                .from('cards')
                .update({ 
                  status: 'revealed',
                  revealed_at: new Date().toISOString(),
                  guest_name: payment.guest_name || null,
                  guest_email: payment.guest_email
                })
                .eq('id', payment.card_id);

              if (!cardUpdateError) {
                updatedCards++;
                logStep("Card updated to revealed", { cardId: payment.card_id });
              } else {
                logStep("Error updating card", { error: cardUpdateError.message });
              }
            } else {
              logStep("Error updating payment", { error: paymentUpdateError.message });
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

    logStep("Auto sync completed", { 
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
    logStep("ERROR in sync-payments-auto", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});