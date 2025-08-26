import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const sessionId = searchParams.get('session_id');
    
    if (sessionId) {
      processPaymentSuccess(sessionId);
    } else {
      setProcessing(false);
    }
  }, [location]);

  const processPaymentSuccess = async (sessionId: string) => {
    try {
      // Update payment status to paid
      const { error: paymentError } = await supabase
        .from('payments')
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('stripe_session_id', sessionId);

      if (paymentError) {
        // Payment update failed - not critical
      }

      // Get payment details to update card
      const { data: payment, error: fetchError } = await supabase
        .from('payments')
        .select('card_id')
        .eq('stripe_session_id', sessionId)
        .single();

      if (!fetchError && payment) {
        // Update card status to revealed
        const { error: cardError } = await supabase
          .from('cards')
          .update({ 
            status: 'revealed',
            revealed_at: new Date().toISOString()
          })
          .eq('id', payment.card_id);

        if (cardError) {
          // Card update failed - not critical
        }
      }

      toast({
        title: "Pagamento confirmado!",
        description: "Sua contribuição foi processada com sucesso.",
      });
    } catch (error) {
      console.error('Error processing payment success:', error);
      toast({
        title: "Aviso",
        description: "Pagamento recebido, mas pode haver um delay na atualização.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
      <div className="max-w-md mx-auto p-4">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              {processing ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              ) : (
                <CheckCircle className="w-8 h-8 text-green-600" />
              )}
            </div>
            <CardTitle className="text-2xl text-green-600">
              {processing ? 'Processando...' : 'Pagamento Confirmado!'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {processing 
                ? 'Estamos confirmando seu pagamento...'
                : 'Sua contribuição foi processada com sucesso. Obrigado por participar!'
              }
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => navigate(-1)}
                className="flex-1"
                disabled={processing}
              >
                Voltar ao Evento
              </Button>
              {user && (
                <Button 
                  onClick={() => navigate('/dashboard')}
                  className="flex-1"
                  disabled={processing}
                >
                  Ir ao Dashboard
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentSuccess;
