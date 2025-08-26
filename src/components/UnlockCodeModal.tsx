import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Mail, Lock, RefreshCw } from "lucide-react";

interface UnlockCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  cardNumber: number;
  eventName: string;
  eventId: number;
  cardStatus?: string;
  reservedEmail?: string;
}

export const UnlockCodeModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  cardNumber, 
  eventName,
  eventId,
  cardStatus = 'available',
  reservedEmail: initialReservedEmail = ''
}: UnlockCodeModalProps) => {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [canResend, setCanResend] = useState(true);
  const [isReservedCard, setIsReservedCard] = useState(cardStatus === 'reserved');
  const [reservedEmail, setReservedEmail] = useState(initialReservedEmail);
  const { toast } = useToast();

  useEffect(() => {
    setIsReservedCard(cardStatus === 'reserved');
    setReservedEmail(initialReservedEmail);
  }, [cardStatus, initialReservedEmail]);

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      toast({
        title: "Email inválido",
        description: "Por favor, digite um email válido",
        variant: "destructive"
      });
      return;
    }

    // Check if the email already has a revealed card
    try {
      const { data: existingCard, error: checkError } = await supabase
        .from('cards')
        .select('id, guest_email')
        .eq('event_id', eventId)
        .eq('guest_email', email)
        .eq('status', 'revealed')
        .maybeSingle();

      if (checkError) {
        console.error('[DEBUG] Error checking existing cards:', checkError);
      }

      if (existingCard) {
        toast({
          title: "Card já revelado",
          description: "Este email já revelou um card para este evento.",
          variant: "destructive"
        });
        return;
      }
    } catch (error) {
      console.error('[DEBUG] Error checking existing cards:', error);
    }

    // Check if card is reserved and email doesn't match
    if (isReservedCard && reservedEmail && email !== reservedEmail) {
      toast({
        title: "Card reservado",
        description: "Este card está reservado para outro email. Apenas o email que o reservou pode prosseguir.",
        variant: "destructive"
      });
      return;
    }

    console.log('[DEBUG] Sending unlock code:', { email, eventName, cardNumber });
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-unlock-code', {
        body: { 
          email, 
          eventName, 
          cardNumber,
          event_id: eventId
        }
      });

      console.log('[DEBUG] Send unlock code response:', { data, error });

      if (error) {
        console.error('[DEBUG] Error from send-unlock-code function:', error);
        throw error;
      }

      if (data?.success) {
        console.log('[DEBUG] Code sent successfully');
        setSentCode(data.unlockCode);
        setStep('code');
        setCanResend(false);
        
        // Reabilitar reenvio após 60 segundos
        setTimeout(() => setCanResend(true), 60000);
        
        toast({
          title: "Código enviado!",
          description: `Um código de 6 dígitos foi enviado para ${email}`,
        });
      } else {
        console.error('[DEBUG] Send code failed:', data);
        throw new Error(data?.error || 'Falha ao enviar código');
      }
    } catch (error: any) {
      console.error('[DEBUG] Error in handleSendCode:', error);
      toast({
        title: "Erro ao enviar código",
        description: error.message || 'Erro desconhecido ao enviar código',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      toast({
        title: "Código inválido",
        description: "O código deve ter 6 dígitos",
        variant: "destructive"
      });
      return;
    }

    console.log('[DEBUG] Verifying unlock code:', { email, eventId, cardNumber, code });
    setLoading(true);
    
    try {
      // Use secure verification function
      const { data, error } = await supabase.functions.invoke('verify-unlock-code', {
        body: {
          email,
          eventId: eventId,
          cardNumber,
          unlockCode: code
        }
      });

      console.log('[DEBUG] Verify unlock code response:', { data, error });

      if (error) {
        console.error('[DEBUG] Error from verify-unlock-code function:', error);
        throw error;
      }

      if (data?.success) {
        console.log('[DEBUG] Code verified successfully');
        toast({
          title: "Card desbloqueado!",
          description: "Agora você pode prosseguir com a contribuição",
        });

        onSuccess();
        handleClose();
      } else {
        console.error('[DEBUG] Verification failed:', data);
        toast({
          title: "Erro",
          description: data?.message || "Código incorreto",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('[DEBUG] Error in handleVerifyCode:', error);
      toast({
        title: "Erro ao desbloquear card",
        description: error.message || 'Erro desconhecido na verificação',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    console.log('[DEBUG] Closing unlock modal and resetting state');
    setStep('email');
    setEmail('');
    setCode('');
    setSentCode('');
    setCanResend(true);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'email' ? <Mail className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            {step === 'email' ? 'Digite seu email' : 'Confirme o código'}
          </DialogTitle>
          <DialogDescription>
            {step === 'email' 
              ? isReservedCard 
                ? `Este Card #${cardNumber} está reservado${reservedEmail ? ` para ${reservedEmail}` : ''}. Digite o email correto para continuar.`
                : `Para desbloquear o Card #${cardNumber}, precisamos enviar um código de confirmação para seu email.`
              : `Digite o código de 6 dígitos que enviamos para ${email}.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'email' ? (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                disabled={loading}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && email && !loading) {
                    handleSendCode();
                  }
                }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="code">Código de 6 dígitos</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                disabled={loading}
                maxLength={6}
                className="text-center text-lg tracking-widest font-mono"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && code.length === 6 && !loading) {
                    handleVerifyCode();
                  }
                }}
              />
              {step === 'code' && (
                <div className="text-center">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={handleSendCode}
                    disabled={!canResend || loading}
                    className="text-sm"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    {canResend ? 'Reenviar código' : 'Aguarde para reenviar'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Debug Info - Remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
            <p><strong>Debug:</strong></p>
            <p>Step: {step}</p>
            <p>Email: {email}</p>
            <p>Code: {code}</p>
            <p>Loading: {loading ? 'Yes' : 'No'}</p>
            <p>Can Resend: {canResend ? 'Yes' : 'No'}</p>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={step === 'email' ? handleSendCode : handleVerifyCode}
            disabled={loading || (step === 'email' && !email) || (step === 'code' && code.length !== 6)}
          >
            {loading && <LoadingSpinner size="sm" className="mr-2" />}
            {step === 'email' ? 'Enviar Código' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
