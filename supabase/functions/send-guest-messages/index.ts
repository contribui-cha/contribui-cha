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
    logStep("Function started", { method: req.method });

    // Parse request body
    let requestData;
    try {
      requestData = await req.json();
      logStep("Request parsed", { hasGuests: !!requestData.guests, guestCount: requestData.guests?.length });
    } catch (parseError) {
      logStep("Parse error", { error: parseError.message });
      return new Response(JSON.stringify({ 
        error: "Invalid JSON in request body",
        details: parseError.message 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { guests, event_id, subject, message, send_email, send_whatsapp } = requestData;

    // Validate required fields
    if (!guests || !Array.isArray(guests) || guests.length === 0) {
      return new Response(JSON.stringify({ 
        error: "Guests array is required and cannot be empty" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!event_id || !subject || !message) {
      return new Response(JSON.stringify({ 
        error: "Missing required fields: event_id, subject, or message" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get event details
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      logStep("Missing Supabase credentials");
      return new Response(JSON.stringify({ 
        error: "Supabase configuration missing" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, { 
      auth: { persistSession: false } 
    });

    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError) {
      logStep("Event fetch error", { error: eventError.message });
      return new Response(JSON.stringify({ 
        error: "Failed to fetch event details",
        details: eventError.message 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    let emailsSent = 0;
    let whatsappSent = 0;
    const errors = [];

    // Send emails if requested
    if (send_email) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      
      if (!resendApiKey) {
        logStep("RESEND_API_KEY not configured");
        errors.push("Email service not configured - RESEND_API_KEY missing");
      } else {
        const resend = new Resend(resendApiKey);
        
        for (const guest of guests) {
          try {
            if (!guest.email) {
              logStep("Guest missing email", { guest: guest.name });
              continue;
            }

            const personalizedMessage = message
              .replace(/{NOME}/g, guest.name || 'Convidado')
              .replace(/{EVENTO}/g, event.name)
              .replace(/{LINK}/g, `${req.headers.get("origin") || 'https://contribuicha.com'}/events/${event.slug}`);

            const emailResult = await resend.emails.send({
              from: "Contribui&Chá <onboarding@resend.dev>",
              to: [guest.email],
              subject: subject,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #9E7FFF; margin: 0;">Contribui&Chá</h1>
                  </div>
                  
                  <div style="background: linear-gradient(135deg, #9E7FFF, #38bdf8); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
                    <h2 style="margin: 0 0 10px 0;">🎉 ${event.name}</h2>
                    <p style="margin: 0; opacity: 0.9;">Você foi convidado para contribuir!</p>
                  </div>

                  <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                    <p style="margin: 0 0 15px 0; color: #333;">Olá, ${guest.name || 'Convidado'}!</p>
                    <p style="margin: 0; color: #555; line-height: 1.6;">${personalizedMessage}</p>
                  </div>

                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${req.headers.get("origin") || 'https://contribuicha.com'}/events/${event.slug}" 
                       style="background: linear-gradient(135deg, #9E7FFF, #38bdf8); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                      Contribuir Agora
                    </a>
                  </div>

                  <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">
                      Sua contribuição é muito importante para tornar este momento ainda mais especial! ❤️
                    </p>
                  </div>
                </div>
              `,
            });
            
            if (emailResult.error) {
              logStep("Email send error", { to: guest.email, error: emailResult.error });
              errors.push(`Email para ${guest.email}: ${emailResult.error.message}`);
            } else {
              emailsSent++;
              logStep("Email sent successfully", { to: guest.email, id: emailResult.data?.id });
            }
          } catch (emailError) {
            logStep("Email exception", { to: guest.email, error: emailError.message });
            errors.push(`Email para ${guest.email}: ${emailError.message}`);
          }
        }
      }
    }

    // Send WhatsApp messages if requested
    if (send_whatsapp) {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
      
      if (!twilioSid || !twilioToken || !twilioNumber) {
        logStep("WhatsApp service not configured", { 
          hasSid: !!twilioSid,
          hasToken: !!twilioToken,
          hasNumber: !!twilioNumber
        });
        errors.push("WhatsApp service not configured - missing Twilio credentials");
      } else {
        const twilioClient = twilio(twilioSid, twilioToken);
        
        for (const guest of guests) {
          if (guest.phone) {
            try {
              const personalizedMessage = message
                .replace(/{NOME}/g, guest.name || 'Convidado')
                .replace(/{EVENTO}/g, event.name)
                .replace(/{LINK}/g, `${req.headers.get("origin") || 'https://contribuicha.com'}/events/${event.slug}`);

              await twilioClient.messages.create({
                from: `whatsapp:${twilioNumber}`,
                to: `whatsapp:${guest.phone}`,
                body: `🎉 ${event.name}\n\nOlá, ${guest.name || 'Convidado'}!\n\n${personalizedMessage}\n\nAcesse: ${req.headers.get("origin") || 'https://contribuicha.com'}/events/${event.slug}\n\nSua contribuição é muito importante! ❤️`
              });
              
              whatsappSent++;
              logStep("WhatsApp sent successfully", { to: guest.phone });
            } catch (whatsappError) {
              logStep("WhatsApp send error", { to: guest.phone, error: whatsappError.message });
              errors.push(`WhatsApp para ${guest.phone}: ${whatsappError.message}`);
            }
          } else {
            logStep("Guest missing phone", { guest: guest.name });
          }
        }
      }
    }

    const result = {
      success: true,
      emailsSent,
      whatsappSent,
      totalGuests: guests.length,
      errors: errors.length > 0 ? errors : undefined
    };

    logStep("Function completed", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("CRITICAL ERROR", { message: errorMessage, stack: error.stack });
    
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
