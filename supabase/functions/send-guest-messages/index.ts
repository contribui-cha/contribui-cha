import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import twilio from "npm:twilio@4.19.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-GUEST-MESSAGES] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { guests, event_id, subject, message, send_email, send_whatsapp } = await req.json();

    // Get event details
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError) throw eventError;

    let emailsSent = 0;
    let whatsappSent = 0;

    // Send emails if requested
    if (send_email && Deno.env.get("RESEND_API_KEY")) {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      
      for (const guest of guests) {
        try {
          const personalizedMessage = message
            .replace('{NOME}', guest.name)
            .replace('{EVENTO}', event.name)
            .replace('{LINK}', `${req.headers.get("origin")}/events/${event.slug}`);

          await resend.emails.send({
            from: "Contribui&Chá <onboarding@resend.dev>",
            to: [guest.email],
            subject: subject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #5865f2;">🎉 ${event.name}</h2>
                <p>Olá, ${guest.name}!</p>
                <p>${personalizedMessage}</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${req.headers.get("origin")}/events/${event.slug}" 
                     style="background-color: #5865f2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Contribuir Agora
                  </a>
                </div>
                <p style="color: #666; font-size: 14px;">
                  Sua contribuição é muito importante para tornar este momento ainda mais especial! ❤️
                </p>
              </div>
            `,
          });
          
          emailsSent++;
          logStep("Email sent", { to: guest.email });
        } catch (emailError) {
          logStep("Email error", { to: guest.email, error: emailError.message });
        }
      }
    }

    // Send WhatsApp messages if requested via Twilio
    if (send_whatsapp && Deno.env.get("TWILIO_ACCOUNT_SID") && Deno.env.get("TWILIO_AUTH_TOKEN") && Deno.env.get("TWILIO_WHATSAPP_NUMBER")) {
      const twilioClient = twilio(
        Deno.env.get("TWILIO_ACCOUNT_SID"), 
        Deno.env.get("TWILIO_AUTH_TOKEN")
      );
      
      for (const guest of guests) {
        if (guest.phone) {
          try {
            const personalizedMessage = message
              .replace('{NOME}', guest.name)
              .replace('{EVENTO}', event.name)
              .replace('{LINK}', `${req.headers.get("origin")}/events/${event.slug}`);

            await twilioClient.messages.create({
              from: `whatsapp:${Deno.env.get("TWILIO_WHATSAPP_NUMBER")}`,
              to: `whatsapp:${guest.phone}`,
              body: `🎉 ${event.name}\n\nOlá, ${guest.name}!\n\n${personalizedMessage}\n\nAcesse: ${req.headers.get("origin")}/events/${event.slug}\n\nSua contribuição é muito importante! ❤️`
            });
            
            whatsappSent++;
            logStep("WhatsApp sent", { to: guest.phone });
          } catch (whatsappError) {
            logStep("WhatsApp error", { to: guest.phone, error: whatsappError.message });
          }
        } else {
          logStep("WhatsApp skipped - no phone number", { guest: guest.name });
        }
      }
    } else if (send_whatsapp) {
      logStep("WhatsApp requested but not configured", { 
        hasSid: !!Deno.env.get("TWILIO_ACCOUNT_SID"),
        hasToken: !!Deno.env.get("TWILIO_AUTH_TOKEN"),
        hasNumber: !!Deno.env.get("TWILIO_WHATSAPP_NUMBER")
      });
    }

    logStep("Messages sent", { emailsSent, whatsappSent });

    return new Response(JSON.stringify({ 
      success: true,
      emailsSent,
      whatsappSent,
      totalGuests: guests.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in send-guest-messages", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
