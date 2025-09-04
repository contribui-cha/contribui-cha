import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-CONNECT-ONBOARDING] ${step}${detailsStr}`);
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

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const requestBody = await req.json();
    const { return_url, refresh_url } = requestBody;
    
    if (!return_url) throw new Error("return_url is required");
    if (!refresh_url) throw new Error("refresh_url is required");
    
    logStep("Request data received", { return_url, refresh_url, userId: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Check if user already has a Stripe Connect account
    const { data: existingAccount } = await supabaseClient
      .from('host_stripe_accounts')
      .select('*')
      .eq('host_id', user.id)
      .maybeSingle();

    if (existingAccount) {
      logStep("User already has Stripe account", { 
        accountId: existingAccount.stripe_account_id,
        onboardingCompleted: existingAccount.onboarding_completed 
      });

      // If onboarding already completed, return success
      if (existingAccount.onboarding_completed) {
        return new Response(JSON.stringify({
          account_id: existingAccount.stripe_account_id,
          onboarding_completed: true,
          message: "Onboarding already completed"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // If account exists but onboarding not completed, create new onboarding link
      const accountLink = await stripe.accountLinks.create({
        account: existingAccount.stripe_account_id,
        refresh_url: refresh_url,
        return_url: return_url,
        type: 'account_onboarding',
      });

      logStep("New onboarding link created for existing account", {
        accountId: existingAccount.stripe_account_id,
        onboardingUrl: accountLink.url
      });

      // Update onboarding URL
      await supabaseClient
        .from('host_stripe_accounts')
        .update({ 
          onboarding_url: accountLink.url,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAccount.id);

      return new Response(JSON.stringify({
        account_id: existingAccount.stripe_account_id,
        onboarding_url: accountLink.url,
        onboarding_completed: false
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create new Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'BR',
      email: user.email || undefined,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_type: 'individual',
      settings: {
        payouts: {
          schedule: {
            interval: 'daily',
          },
        },
      },
    });

    logStep("Stripe Connect account created", { accountId: account.id });

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: refresh_url,
      return_url: return_url,
      type: 'account_onboarding',
    });

    logStep("Onboarding link created", { onboardingUrl: accountLink.url });

    // Save to Supabase
    const { data: savedAccount, error: saveError } = await supabaseClient
      .from('host_stripe_accounts')
      .insert({
        host_id: user.id,
        stripe_account_id: account.id,
        account_type: 'express',
        charges_enabled: false,
        details_submitted: false,
        payouts_enabled: false,
        onboarding_completed: false,
        onboarding_url: accountLink.url,
      })
      .select()
      .single();

    if (saveError) {
      logStep("Error saving account to database", { error: saveError.message });
      throw new Error(`Failed to save account: ${saveError.message}`);
    }

    logStep("Account saved to database", { accountId: savedAccount.id });

    return new Response(JSON.stringify({
      account_id: account.id,
      onboarding_url: accountLink.url,
      onboarding_completed: false
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-connect-onboarding", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});