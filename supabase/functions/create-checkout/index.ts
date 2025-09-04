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
      const { card_id, event_id, amount, guest_name, guest_email, message } = requestBody;
      
      // Validate amount is positive
      if (amount <= 0) {
        throw new Error("Invalid amount: must be positive");
      }

      // Transaction fee of R$ 1.99 (199 cents) - this stays with the platform
      const transactionFee = 199;
      const cardValue = amount;
      const totalCharged = cardValue + transactionFee;
      
      logStep("Payment calculation", { cardValue, transactionFee, totalCharged });

      // Get event details including Stripe Connect info
      const { data: event, error: eventError } = await supabaseClient
        .from('events')
        .select('*')
        .eq('id', event_id)
        .single();

      if (eventError) throw new Error(`Event not found: ${eventError.message}`);
      logStep("Event found", { eventId: event.id, eventName: event.name });

      // Check if host has active Stripe Connect account
      let hostStripeAccount = null;
      if (event.stripe_account_id) {
        const { data: stripeAccount } = await supabaseClient
          .from('host_stripe_accounts')
          .select('*')
          .eq('stripe_account_id', event.stripe_account_id)
          .eq('host_id', event.host_id)
          .maybeSingle();

        if (stripeAccount && stripeAccount.charges_enabled && stripeAccount.onboarding_completed) {
          hostStripeAccount = stripeAccount;
          logStep("Host has active Stripe Connect account", { 
            accountId: stripeAccount.stripe_account_id,
            charges_enabled: stripeAccount.charges_enabled 
          });
        } else {
          logStep("Host Stripe account not ready for charges", { 
            stripeAccount: stripeAccount || "not found" 
          });
        }
      } else {
        logStep("Event has no Stripe Connect account configured");
      }

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

      // Create checkout session with Stripe Connect transfer if host account is active
      const cardValueForPayment = card.value || event.min_value;
      const totalAmountForPayment = cardValueForPayment + transactionFee;
      
      // Prepare checkout session configuration
      const checkoutConfig = {
        customer_email: guest_email || 'guest@example.com',
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: { 
                name: `Contribuição - ${event.name}`,
                description: `Card #${card.card_number} (R$ ${(cardValueForPayment/100).toFixed(2)}) + Taxa de processamento (R$ 1,99)` 
              },
              unit_amount: totalAmountForPayment,
            },
            quantity: 1,
          },
        ],
        mode: "payment" as const,
        success_url: `${req.headers.get("origin")}/events/${event.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.get("origin")}/events/${event.slug}`,
        metadata: {
          type: 'card_contribution',
          card_id: card_id.toString(),
          event_id: event_id.toString(),
          amount: cardValueForPayment.toString(),
          transaction_fee: transactionFee.toString(),
          total_charged: totalAmountForPayment.toString()
        }
      };

      // Add Stripe Connect transfer data if host has active account
      if (hostStripeAccount) {
        // Use transfer_data to send card value to host account
        // Platform keeps the transaction fee (R$ 1.99) automatically
        checkoutConfig.payment_intent_data = {
          application_fee_amount: transactionFee, // R$ 1.99 stays with platform
          transfer_data: {
            destination: hostStripeAccount.stripe_account_id, // Card value goes to host
            amount: cardValueForPayment // Only the card value, not the fee
          }
        };

        logStep("Stripe Connect transfer configured", {
          hostAccount: hostStripeAccount.stripe_account_id,
          cardValue: cardValueForPayment,
          platformFee: transactionFee,
          totalCharged: totalAmountForPayment
        });
      } else {
        // If no Stripe Connect account, entire amount stays with platform
        logStep("No Stripe Connect - payment stays with platform", {
          totalAmount: totalAmountForPayment,
          reason: "Host has no active Stripe Connect account"
        });
      }

      const session = await stripe.checkout.sessions.create(checkoutConfig);

      logStep("Checkout session created", { sessionId: session.id });

      // Create payment record with transaction fee breakdown
      const { error: paymentError } = await supabaseClient
        .from('payments')
        .insert({
          card_id,
          event_id,
          amount: cardValueForPayment, // Original card value (for goal calculation)
          transaction_fee: transactionFee, // R$ 1.99 processing fee
          total_charged: totalAmountForPayment, // Total amount charged to customer
          guest_email: guest_email || 'guest@example.com',
          stripe_session_id: session.id,
          status: 'pending',
          guest_message: message || null,
          guest_name: guest_name || 'Anônimo'
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
