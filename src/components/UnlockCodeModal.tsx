import { useState } from "react";
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
  cardId: number;
}

export const UnlockCodeModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  cardNumber, 
  eventName,
  cardId 
}: UnlockCodeModalProps) => {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [canResend, setCanResend] = useState(true);
  const { toast } = useToast();

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      toast({
        title: "Email inválido",
        description: "Por favor, digite um email válido",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-unlock-code', {
        body: { email, eventName, cardNumber }
      });

      if (error) throw error;

      if (data.success) {
        setSentCode(data.unlockCode);
        setStep('code');
        setCanResend(false);
        
        // Reabilitar reenvio após 60 segundos
        setTimeout(() => setCanResend(true), 60000);
        
        toast({
          title: "Código enviado!",
          description: `Um código de 6 dígitos foi enviado para ${email}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao enviar código",
        description: error.message,
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

    if (code !== sentCode) {
      toast({
        title: "Código incorreto",
        description: "Verifique o código enviado no seu email",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Update card with unlock code and email
      const { error } = await supabase
        .from('cards')
        .update({ 
          status: 'reserved',
          unlock_code: code,
          guest_email: email
        })
        .eq('id', cardId);

      if (error) throw error;

      toast({
        title: "Card desbloqueado!",
        description: "Agora você pode prosseguir com a contribuição",
      });

      onSuccess();
      onClose();
      
      // Reset modal state
      setStep('email');
      setEmail('');
      setCode('');
      setSentCode('');
    } catch (error: any) {
      toast({
        title: "Erro ao desbloquear card",
        description: error.message,
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
              ? `Para desbloquear o Card #${cardNumber}, precisamos enviar um código de confirmação para seu email.`
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