import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  CreditCard, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  ExternalLink,
  RefreshCw,
  Building2,
  Shield,
  Zap
} from 'lucide-react';

interface StripeConnectOnboardingProps {
  onOnboardingComplete?: () => void;
  showTitle?: boolean;
}

interface StripeAccountStatus {
  has_account: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_completed: boolean;
  account_id?: string;
  requirements_due_date?: string;
  pending_requirements?: string[];
  message?: string;
}

const StripeConnectOnboarding: React.FC<StripeConnectOnboardingProps> = ({ 
  onOnboardingComplete,
  showTitle = true 
}) => {
  const [accountStatus, setAccountStatus] = useState<StripeAccountStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const { toast } = useToast();

  // Check current status on component mount
  useEffect(() => {
    checkAccountStatus();
  }, []);

  const checkAccountStatus = async () => {
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-status');
      
      if (error) throw error;
      
      setAccountStatus(data);
      
      // If onboarding is completed, notify parent
      if (data.onboarding_completed && onOnboardingComplete) {
        onOnboardingComplete();
      }
    } catch (error: any) {
      console.error('Error checking Stripe account status:', error);
      toast({
        title: "Erro ao verificar conta",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setCheckingStatus(false);
    }
  };

  const startOnboarding = async () => {
    setLoading(true);
    try {
      const origin = window.location.origin;
      const returnUrl = `${origin}/dashboard?stripe_onboarding=success`;
      const refreshUrl = `${origin}/dashboard?stripe_onboarding=refresh`;

      const { data, error } = await supabase.functions.invoke('stripe-connect-onboarding', {
        body: {
          return_url: returnUrl,
          refresh_url: refreshUrl
        }
      });

      if (error) throw error;

      if (data.onboarding_url) {
        // Open Stripe onboarding in new window
        window.open(data.onboarding_url, '_blank');
        
        toast({
          title: "Redirecionamento iniciado",
          description: "Complete seu cadastro na nova janela que foi aberta"
        });
      }
    } catch (error: any) {
      console.error('Error starting Stripe onboarding:', error);
      toast({
        title: "Erro ao iniciar cadastro",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!accountStatus?.has_account) {
      return <Badge variant="outline">Não configurado</Badge>;
    }
    
    if (accountStatus.onboarding_completed) {
      return <Badge className="bg-green-500 text-white">✓ Ativo</Badge>;
    }
    
    if (accountStatus.details_submitted) {
      return <Badge variant="secondary">⏳ Em análise</Badge>;
    }
    
    return <Badge variant="destructive">⚠️ Pendente</Badge>;
  };

  const getStatusIcon = () => {
    if (!accountStatus?.has_account) {
      return <CreditCard className="w-6 h-6 text-gray-400" />;
    }
    
    if (accountStatus.onboarding_completed) {
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    }
    
    if (accountStatus.details_submitted) {
      return <Clock className="w-6 h-6 text-yellow-500" />;
    }
    
    return <AlertTriangle className="w-6 h-6 text-red-500" />;
  };

  const benefits = [
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Recebimento Direto",
      description: "O dinheiro dos cards vai direto para sua conta bancária"
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Segurança Total",
      description: "Processamento seguro certificado pelo Stripe"
    },
    {
      icon: <Building2 className="w-5 h-5" />,
      title: "Sem Intermediação",
      description: "Você gerencia seus próprios recebimentos"
    }
  ];

  if (checkingStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Verificando status da conta...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {showTitle && (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Configuração de Pagamentos</h2>
          <p className="text-muted-foreground">
            Configure sua conta Stripe para receber pagamentos dos seus eventos
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getStatusIcon()}
              <div>
                <CardTitle className="text-lg">Status da Conta Stripe</CardTitle>
                <CardDescription>
                  {accountStatus?.message || "Configure sua conta para receber pagamentos"}
                </CardDescription>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {!accountStatus?.has_account ? (
            <div className="space-y-4">
              <Alert>
                <CreditCard className="w-4 h-4" />
                <AlertDescription>
                  Para criar eventos, você precisa configurar sua conta Stripe Connect. 
                  Isso permite que você receba os pagamentos dos cards diretamente na sua conta bancária.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-3 p-4 rounded-lg bg-muted/50">
                    <div className="text-primary">{benefit.icon}</div>
                    <div>
                      <div className="font-medium text-sm">{benefit.title}</div>
                      <div className="text-xs text-muted-foreground">{benefit.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Button 
                onClick={startOnboarding} 
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Configurar Conta Stripe
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Informações enviadas:</span>
                    <Badge variant={accountStatus.details_submitted ? "default" : "secondary"}>
                      {accountStatus.details_submitted ? "✓ Sim" : "⏳ Não"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Pagamentos habilitados:</span>
                    <Badge variant={accountStatus.charges_enabled ? "default" : "secondary"}>
                      {accountStatus.charges_enabled ? "✓ Sim" : "⏳ Não"}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Saques habilitados:</span>
                    <Badge variant={accountStatus.payouts_enabled ? "default" : "secondary"}>
                      {accountStatus.payouts_enabled ? "✓ Sim" : "⏳ Não"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status geral:</span>
                    <Badge variant={accountStatus.onboarding_completed ? "default" : "secondary"}>
                      {accountStatus.onboarding_completed ? "✓ Ativo" : "⏳ Pendente"}
                    </Badge>
                  </div>
                </div>
              </div>

              {accountStatus.pending_requirements && accountStatus.pending_requirements.length > 0 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <AlertDescription>
                    <strong>Pendências:</strong> {accountStatus.pending_requirements.join(', ')}
                    {accountStatus.requirements_due_date && (
                      <div className="mt-1 text-sm">
                        Prazo: {new Date(accountStatus.requirements_due_date).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={checkAccountStatus} disabled={checkingStatus}>
                  {checkingStatus ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Atualizar Status
                </Button>
                
                {!accountStatus.onboarding_completed && (
                  <Button onClick={startOnboarding} disabled={loading}>
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        Completar Cadastro
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StripeConnectOnboarding;