import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-CONNECT-STATUS] ${step}${detailsStr}`);
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

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get user's Stripe Connect account from database
    const { data: stripeAccount, error: accountError } = await supabaseClient
      .from('host_stripe_accounts')
      .select('*')
      .eq('host_id', user.id)
      .maybeSingle();

    if (accountError) {
      throw new Error(`Database error: ${accountError.message}`);
    }

    if (!stripeAccount) {
      logStep("No Stripe account found for user");
      return new Response(JSON.stringify({
        has_account: false,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        onboarding_completed: false,
        message: "No Stripe Connect account found. Please complete onboarding first."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Found Stripe account in database", { 
      accountId: stripeAccount.stripe_account_id,
      currentStatus: {
        charges_enabled: stripeAccount.charges_enabled,
        payouts_enabled: stripeAccount.payouts_enabled,
        details_submitted: stripeAccount.details_submitted,
        onboarding_completed: stripeAccount.onboarding_completed
      }
    });

    // Get current account status from Stripe
    const account = await stripe.accounts.retrieve(stripeAccount.stripe_account_id);
    
    logStep("Retrieved account from Stripe", {
      accountId: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements: account.requirements
    });

    // Determine if onboarding is completed
    const onboardingCompleted = account.details_submitted && 
                                account.charges_enabled && 
                                (!account.requirements?.currently_due?.length || account.requirements.currently_due.length === 0);

    // Calculate requirements due date if there are pending requirements
    let requirementsDueDate = null;
    if (account.requirements?.current_deadline) {
      requirementsDueDate = new Date(account.requirements.current_deadline * 1000).toISOString();
    }

    // Update database with current status
    const { error: updateError } = await supabaseClient
      .from('host_stripe_accounts')
      .update({
        charges_enabled: account.charges_enabled,
        details_submitted: account.details_submitted,
        payouts_enabled: account.payouts_enabled,
        onboarding_completed: onboardingCompleted,
        requirements_due_date: requirementsDueDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', stripeAccount.id);

    if (updateError) {
      logStep("Error updating account status", { error: updateError.message });
      // Don't throw error, just log it as this is not critical
    } else {
      logStep("Account status updated in database", {
        accountId: stripeAccount.stripe_account_id,
        onboarding_completed: onboardingCompleted
      });
    }

    // Prepare response data
    const responseData = {
      has_account: true,
      account_id: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      onboarding_completed: onboardingCompleted,
      requirements_due_date: requirementsDueDate,
      pending_requirements: account.requirements?.currently_due || [],
      past_due_requirements: account.requirements?.past_due || [],
      disabled_reason: account.requirements?.disabled_reason || null,
    };

    // Add appropriate message based on status
    if (onboardingCompleted) {
      responseData.message = "Account is fully active and ready to receive payments.";
    } else if (!account.details_submitted) {
      responseData.message = "Please complete your account setup to start receiving payments.";
    } else if (!account.charges_enabled) {
      responseData.message = "Account setup is in review. You'll be notified when it's approved.";
    } else if (account.requirements?.currently_due?.length > 0) {
      responseData.message = `Please provide additional information: ${account.requirements.currently_due.join(', ')}`;
    }

    logStep("Returning account status", responseData);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-connect-status", { message: errorMessage });
    return new Response(JSON.stringify({ 
      error: errorMessage,
      has_account: false,
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      onboarding_completed: false
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});