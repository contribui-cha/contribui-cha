import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[DELETE-ACCOUNT] Function started', { method: req.method });

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('[DELETE-ACCOUNT] No authorization header found');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create Supabase client with service role key for admin operations
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

    // Create client for user operations
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            authorization: authHeader
          }
        }
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    
    if (userError || !user) {
      console.log('[DELETE-ACCOUNT] Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[DELETE-ACCOUNT] User found:', user.id);

    // Start cleanup process - Delete user's data in order
    try {
      // 1. Delete user's messages
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .in('event_id', 
          supabase
            .from('events')
            .select('id')
            .eq('host_id', user.id)
        );

      if (messagesError) {
        console.log('[DELETE-ACCOUNT] Error deleting messages:', messagesError);
      } else {
        console.log('[DELETE-ACCOUNT] Messages deleted successfully');
      }

      // 2. Delete user's payments
      const { error: paymentsError } = await supabase
        .from('payments')
        .delete()
        .in('event_id',
          supabase
            .from('events')
            .select('id')
            .eq('host_id', user.id)
        );

      if (paymentsError) {
        console.log('[DELETE-ACCOUNT] Error deleting payments:', paymentsError);
      } else {
        console.log('[DELETE-ACCOUNT] Payments deleted successfully');
      }

      // 3. Delete user's cards
      const { error: cardsError } = await supabase
        .from('cards')
        .delete()
        .in('event_id',
          supabase
            .from('events')
            .select('id')
            .eq('host_id', user.id)
        );

      if (cardsError) {
        console.log('[DELETE-ACCOUNT] Error deleting cards:', cardsError);
      } else {
        console.log('[DELETE-ACCOUNT] Cards deleted successfully');
      }

      // 4. Delete user's events
      const { error: eventsError } = await supabase
        .from('events')
        .delete()
        .eq('host_id', user.id);

      if (eventsError) {
        console.log('[DELETE-ACCOUNT] Error deleting events:', eventsError);
      } else {
        console.log('[DELETE-ACCOUNT] Events deleted successfully');
      }

      // 5. Delete user's guests
      const { error: guestsError } = await supabase
        .from('guests')
        .delete()
        .eq('user_id', user.id);

      if (guestsError) {
        console.log('[DELETE-ACCOUNT] Error deleting guests:', guestsError);
      } else {
        console.log('[DELETE-ACCOUNT] Guests deleted successfully');
      }

      // 6. Delete user's profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', user.id);

      if (profileError) {
        console.log('[DELETE-ACCOUNT] Error deleting profile:', profileError);
      } else {
        console.log('[DELETE-ACCOUNT] Profile deleted successfully');
      }

      // 7. Finally, delete the user account
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);

      if (deleteUserError) {
        console.log('[DELETE-ACCOUNT] Error deleting user account:', deleteUserError);
        return new Response(
          JSON.stringify({ error: 'Failed to delete user account', details: deleteUserError.message }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('[DELETE-ACCOUNT] User account deleted successfully');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Account deleted successfully' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );

    } catch (cleanupError) {
      console.log('[DELETE-ACCOUNT] Error during cleanup:', cleanupError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete account data', details: cleanupError.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.log('[DELETE-ACCOUNT] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});