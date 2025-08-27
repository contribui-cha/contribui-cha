import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Use service role for database operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const requestBody = await req.json();
    logStep("Request data received", requestBody);

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Handle different types of checkout
    if (requestBody.type === 'event_creation') {
      // Event creation payment
      const { price, event_id } = requestBody;
      
      // Create checkout session for event creation
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: { 
                name: "Criação de Evento",
                description: "Pagamento único para criação do evento"
              },
              unit_amount: price,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.headers.get("origin")}/dashboard?payment=success`,
        cancel_url: `${req.headers.get("origin")}/dashboard?payment=cancelled`,
        metadata: {
          type: 'event_creation',
          event_id: event_id.toString()
        }
      });

      logStep("Event creation checkout session created", { sessionId: session.id });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      // Card contribution payment
      const { card_id, event_id, amount, guest_name, guest_email } = requestBody;
      
      // Validate amount is positive
      if (amount <= 0) {
        throw new Error("Invalid amount: must be positive");
      }

      // Get event details
      const { data: event, error: eventError } = await supabaseClient
        .from('events')
        .select('*')
        .eq('id', event_id)
        .single();

      if (eventError) throw new Error(`Event not found: ${eventError.message}`);
      logStep("Event found", { eventId: event.id, eventName: event.name });

      // Get card details with improved error handling
      let card, cardError;
      
      // First try to get card by ID
      const cardResult = await supabaseClient
        .from('cards')
        .select('*')
        .eq('id', card_id)
        .single();

      card = cardResult.data;
      cardError = cardResult.error;

      // If card not found, provide more detailed error
      if (cardError || !card) {
        logStep('Card lookup failed', { card_id, error: cardError?.message });
        throw new Error(`Card not found or may have been deleted. Card ID: ${card_id}`);
      }

      // Check if card is available for reservation or reserved for the same email
      if (card.status !== 'available' && !(card.status === 'reserved' && card.guest_email === guest_email)) {
        logStep('Card not available', { cardId: card_id, status: card.status, guest_email: card.guest_email });
        throw new Error(`Card is not available for contribution. Current status: ${card.status}`);
      }

      logStep("Card found and available", { cardId: card_id, cardValue: card.value, status: card.status });

      // Update card status to reserved (only if it's available or already reserved for same email)
      const { error: updateError } = await supabaseClient
        .from('cards')
        .update({ 
          status: 'reserved',
          guest_name: guest_name || 'Anônimo',
          guest_email: guest_email || 'guest@example.com'
        })
        .eq('id', card_id)
        .or(`status.eq.available,and(status.eq.reserved,guest_email.eq.${guest_email})`);

      if (updateError) throw new Error(`Failed to reserve card: ${updateError.message}`);
      logStep("Card reserved", { cardId: card_id });

      // Create checkout session using the card's value
      const session = await stripe.checkout.sessions.create({
        customer_email: guest_email || 'guest@example.com',
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: { 
                name: `Contribuição - ${event.name}`,
                description: `Card #${card.card_number}` 
              },
              unit_amount: card.value || event.min_value,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.headers.get("origin")}/events/${event.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.get("origin")}/events/${event.slug}`,
        metadata: {
          type: 'card_contribution',
          card_id: card_id.toString(),
          event_id: event_id.toString(),
          amount: (card.value || event.min_value).toString()
        }
      });

      logStep("Checkout session created", { sessionId: session.id });

      // Create payment record
      const { error: paymentError } = await supabaseClient
        .from('payments')
        .insert({
          card_id,
          event_id,
          amount: card.value || event.min_value,
          guest_email: guest_email || 'guest@example.com',
          stripe_session_id: session.id,
          status: 'pending'
        });

      if (paymentError) {
        logStep("Payment record creation failed", { error: paymentError.message });
        // Don't throw here, just log - the checkout can still proceed
      } else {
        logStep("Payment record created");
      }

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
