import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[cleanup-event-data] ${step}`, details || '');
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting event cleanup process");

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Create Supabase clients
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get authenticated user
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not authenticated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Get event ID from request body
    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(
        JSON.stringify({ error: "Event ID is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    logStep("Verifying event ownership", { event_id, user_id: user.id });

    // Verify that the user owns this event
    const { data: event, error: eventError } = await supabaseClient
      .from("events")
      .select("id, host_id")
      .eq("id", event_id)
      .single();

    if (eventError || !event || event.host_id !== user.id) {
      logStep("Event verification failed", { eventError, event });
      return new Response(
        JSON.stringify({ error: "Event not found or access denied" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    logStep("Starting cleanup of related data");

    // Clean up related data using service role (bypass RLS)
    // Note: Foreign keys with CASCADE DELETE will handle most of this automatically now
    
    // Check for pending payments before cleanup
    const { data: pendingPayments } = await supabaseService
      .from("payments")
      .select("id, status")
      .eq("event_id", event_id)
      .eq("status", "pending");

    if (pendingPayments && pendingPayments.length > 0) {
      logStep("Found pending payments, will clean them up", { count: pendingPayments.length });
    }

    // Manual cleanup of unlock code attempts (no foreign key)
    const { error: unlockError } = await supabaseService
      .from("unlock_code_attempts")
      .delete()
      .eq("event_id", event_id);

    if (unlockError) {
      logStep("Error cleaning unlock attempts", unlockError);
    } else {
      logStep("Cleaned unlock code attempts");
    }

    // Delete the event (CASCADE will handle related data)
    const { error: deleteError } = await supabaseClient
      .from("events")
      .delete()
      .eq("id", event_id);

    if (deleteError) {
      logStep("Error deleting event", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete event", details: deleteError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    logStep("Event and related data cleaned successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Event and all related data cleaned successfully",
        cleaned_data: {
          event_id,
          unlock_attempts_cleaned: true,
          cascade_cleanup: ["cards", "payments", "messages", "guests"]
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    logStep("Unexpected error during cleanup", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});