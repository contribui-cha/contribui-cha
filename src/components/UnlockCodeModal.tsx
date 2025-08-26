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

    // Para cards reservados, se o email coincide, verificar diretamente
    if (isReservedCard && reservedEmail && email.toLowerCase().trim() === reservedEmail.toLowerCase().trim()) {
      // Usar o email como "código" para verificação automática
      handleVerifyCode(email);
      return;
    }

    // Check if the email already has any card (revealed or reserved) for this event
    try {
      const { data: existingCards, error: checkError } = await supabase
        .from('cards')
        .select('id, guest_email, card_number, status, reserved_until')
        .eq('event_id', eventId)
        .eq('guest_email', email)
        .in('status', ['revealed', 'reserved']);

      if (existingCards && existingCards.length > 0) {
        const existingCard = existingCards[0];
        
        if (existingCard.status === 'revealed') {
          toast({
            title: "Card já revelado",
            description: `Você já revelou o card n°${existingCard.card_number} para este evento.`,
            variant: "destructive"
          });
          return;
        }
        
        if (existingCard.status === 'reserved') {
          // Check if reservation is still valid
          const reservedUntil = new Date(existingCard.reserved_until);
          const now = new Date();
          
          if (reservedUntil > now) {
            const hoursRemaining = Math.ceil((reservedUntil.getTime() - now.getTime()) / (1000 * 60 * 60));
            toast({
              title: "Card já reservado",
              description: `Você já reservou o card n°${existingCard.card_number} para este evento. Sua reserva expira em ${hoursRemaining} hora(s).`,
              variant: "destructive"
            });
            return;
          }
        }
      }
    } catch (error) {
      // Silencioso - não mostrar erro de checagem
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

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-unlock-code', {
        body: { 
          email, 
          eventName, 
          cardNumber,
          eventId: eventId
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
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
        throw new Error(data?.error || 'Falha ao enviar código');
      }
    } catch (error: any) {
      toast({
        title: "Erro ao enviar código",
        description: error.message || 'Erro desconhecido ao enviar código',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (codeOrEmail?: string) => {
    const codeToVerify = codeOrEmail || code;
    
    // Para cards reservados com email correspondente, usar código placeholder
    const isEmailAsCode = isReservedCard && reservedEmail && email.toLowerCase().trim() === reservedEmail.toLowerCase().trim();
    
    // Validar código apenas se não for caso especial de email
    if (!isEmailAsCode && codeToVerify.length !== 6) {
      toast({
        title: "Código inválido",
        description: "O código deve ter 6 dígitos",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      // Para cards reservados com mesmo email, usar código placeholder
      // A função de banco detectará automaticamente e dará sucesso
      const codeToSend = isEmailAsCode ? "000000" : codeToVerify;
      
      // Debug log para verificar dados sendo enviados
      console.log('UnlockCodeModal - Dados enviados:', {
        email,
        eventId: eventId,
        cardNumber,
        unlockCode: codeToSend
      });

      const { data, error } = await supabase.functions.invoke('verify-unlock-code', {
        body: {
          email,
          eventId: eventId,
          cardNumber,
          unlockCode: codeToSend
        }
      });

      if (error) {
        toast({
          title: "Erro na verificação",
          description: error.message || "Erro interno do servidor",
          variant: "destructive"
        });
        return;
      }

      if (data?.success) {
        toast({
          title: "Card desbloqueado!",
          description: data.message || "Agora você pode prosseguir com a contribuição",
        });

        onSuccess();
        handleClose();
      } else {
        toast({
          title: "Erro na verificação",
          description: data?.message || "Código incorreto",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao desbloquear card",
        description: error.message || "Erro desconhecido na verificação",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
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


        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={step === 'email' ? handleSendCode : () => handleVerifyCode()}
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
