import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrencyMask } from '@/hooks/useCurrencyMask';
import { Calendar, Gift, Users, DollarSign, CreditCard, ArrowLeft } from 'lucide-react';
import StripeConnectOnboarding from '@/components/StripeConnectOnboarding';

const CreateEvent = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    date: '',
    num_cards: 30,
    theme_color: '#3B82F6'
  });
  const [loading, setLoading] = useState(false);
  const [stripeAccountStatus, setStripeAccountStatus] = useState(null);
  const [checkingStripeStatus, setCheckingStripeStatus] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check Stripe Connect status on component mount
  useEffect(() => {
    if (user) {
      checkStripeConnectStatus();
    }
  }, [user]);

  const checkStripeConnectStatus = async () => {
    setCheckingStripeStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-status');
      
      if (error) {
        console.error('Error checking Stripe status:', error);
        // Don't block the user, just proceed without Stripe Connect
        setStripeAccountStatus(null);
      } else {
        setStripeAccountStatus(data);
      }
    } catch (error: any) {
      console.error('Error checking Stripe status:', error);
      setStripeAccountStatus(null);
    } finally {
      setCheckingStripeStatus(false);
    }
  };

  const handleStripeOnboardingComplete = () => {
    // Refresh Stripe status after onboarding
    checkStripeConnectStatus();
  };

  // Currency masks
  const goalAmount = useCurrencyMask(1500);
  const minValue = useCurrencyMask(20);
  const maxValue = useCurrencyMask(100);

  // Validação matemática em tempo real
  const getValidationMessage = () => {
    const minTotal = minValue.value * formData.num_cards;
    const maxTotal = maxValue.value * formData.num_cards;
    
    if (minTotal > goalAmount.value) {
      return {
        isValid: false,
        message: `Impossível: Valor mínimo (R$ ${minValue.value.toFixed(2)}) × ${formData.num_cards} cards = R$ ${minTotal.toFixed(2)} é maior que a meta (R$ ${goalAmount.value.toFixed(2)})`
      };
    }
    
    if (maxTotal < goalAmount.value) {
      return {
        isValid: false,
        message: `Impossível: Valor máximo (R$ ${maxValue.value.toFixed(2)}) × ${formData.num_cards} cards = R$ ${maxTotal.toFixed(2)} é menor que a meta (R$ ${goalAmount.value.toFixed(2)})`
      };
    }
    
    return { isValid: true, message: '' };
  };

  const validation = getValidationMessage();

  // Pricing plans
  const plans = [
    { cards: 30, price: 1290, name: 'Básico' },
    { cards: 50, price: 1690, name: 'Popular' },
    { cards: 80, price: 2190, name: 'Premium' }
  ];

  const generateSlug = (name: string) => {
    const baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Add timestamp to make slug unique
    const timestamp = Date.now();
    return `${baseSlug}-${timestamp}`;
  };

  const getCurrentPlan = () => {
    return plans.find(plan => plan.cards === formData.num_cards) || plans[0];
  };

  const createCheckoutSession = async (eventId: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          price: getCurrentPlan().price,
          event_id: eventId,
          type: 'event_creation'
        }
      });

      if (error) throw error;
      
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({
        title: "Erro ao processar pagamento",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validação antes de submeter
    if (!validation.isValid) {
      toast({
        title: "Configuração inválida",
        description: validation.message,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const slug = generateSlug(formData.name);
      
      // Create event with values
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          name: formData.name,
          description: formData.description,
          date: formData.date || null,
          slug,
          host_id: user.id,
          num_cards: formData.num_cards,
          min_value: Math.round(minValue.value * 100),
          max_value: Math.round(maxValue.value * 100),
          goal_amount: Math.round(goalAmount.value * 100),
          theme_color: formData.theme_color
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Generate cards with random values using the new function
      const { error: cardsError } = await supabase.rpc('generate_event_cards_with_values', {
        event_id_param: event.id,
        num_cards_param: formData.num_cards,
        min_value_param: Math.round(minValue.value * 100),
        max_value_param: Math.round(maxValue.value * 100),
        goal_amount_param: Math.round(goalAmount.value * 100)
      });

      if (cardsError) throw cardsError;

      // Proceed to payment
      await createCheckoutSession(event.id);
    } catch (error: any) {
      toast({
        title: "Erro ao criar evento",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-primary)' }}>
      <div className="max-w-2xl mx-auto p-4">
        {/* Back Button */}
        <div className="mb-4">
          <Button 
            variant="ghost" 
            className="text-white hover:bg-white/10"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
        
        <div className="text-center mb-8 text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
            <Gift className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Criar Novo Evento</h1>
          <p className="opacity-90">Configure seu chá de bebê ou casa nova</p>
        </div>

        {/* Check if Stripe Connect onboarding is required */}
        {checkingStripeStatus ? (
          <Card>
            <CardContent className="flex items-center justify-center p-8">
              <div className="text-center space-y-2">
                <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p>Verificando configuração de pagamentos...</p>
              </div>
            </CardContent>
          </Card>
        ) : stripeAccountStatus && !stripeAccountStatus.onboarding_completed ? (
          <div className="space-y-6">
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <CreditCard className="w-12 h-12 text-yellow-600 mx-auto" />
                  <h2 className="text-lg font-semibold text-yellow-800">
                    Configuração de Pagamentos Necessária
                  </h2>
                  <p className="text-yellow-700">
                    Para criar eventos e receber pagamentos dos cards diretamente na sua conta bancária,
                    você precisa completar o cadastro da sua conta Stripe Connect primeiro.
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <StripeConnectOnboarding 
              onOnboardingComplete={handleStripeOnboardingComplete}
              showTitle={false}
            />
          </div>
        ) : (
          <>
            {/* Plans Selection */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Escolha seu Plano
                </CardTitle>
                <CardDescription>
                  Cada plano inclui pagamento único para criação do evento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {plans.map((plan) => (
                    <Card 
                      key={plan.cards}
                      className={`cursor-pointer transition-all ${
                        formData.num_cards === plan.cards 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => handleChange('num_cards', plan.cards)}
                    >
                      <CardContent className="p-4 text-center">
                        <h3 className="font-bold text-lg">{plan.name}</h3>
                        <p className="text-2xl font-bold text-primary">
                          R$ {(plan.price / 100).toFixed(2).replace('.', ',')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {plan.cards} cards
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Detalhes do Evento
                </CardTitle>
                <CardDescription>
                  Preencha as informações do seu evento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Evento</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        placeholder="Chá de bebê da Maria"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Data do Evento</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleChange('date', e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      placeholder="Descreva seu evento especial..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="goal_amount" className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Meta Total
                      </Label>
                      <Input
                        id="goal_amount"
                        value={goalAmount.maskedValue}
                        onChange={(e) => goalAmount.handleChange(e.target.value)}
                        placeholder="R$ 1.000,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Número de Cards</Label>
                      <Input
                        value={`${formData.num_cards} cards`}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min_value">Valor Mínimo</Label>
                      <Input
                        id="min_value"
                        value={minValue.maskedValue}
                        onChange={(e) => minValue.handleChange(e.target.value)}
                        placeholder="R$ 10,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_value">Valor Máximo</Label>
                      <Input
                        id="max_value"
                        value={maxValue.maskedValue}
                        onChange={(e) => maxValue.handleChange(e.target.value)}
                        placeholder="R$ 100,00"
                      />
                    </div>
                  </div>

                  {/* Validação matemática visual */}
                  {!validation.isValid && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">!</div>
                        <div>
                          <h4 className="font-semibold text-red-800">Configuração Impossível</h4>
                          <p className="text-red-700 text-sm mt-1">{validation.message}</p>
                          <p className="text-red-600 text-xs mt-2">
                            Ajuste os valores para que seja matematicamente possível atingir a meta.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {validation.isValid && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">✓</div>
                        <div>
                          <h4 className="font-semibold text-green-800">Configuração Válida</h4>
                          <p className="text-green-700 text-sm mt-1">
                            Meta de R$ {goalAmount.value.toFixed(2)} será distribuída entre {formData.num_cards} cards 
                            com valores entre R$ {minValue.value.toFixed(2)} e R$ {maxValue.value.toFixed(2)}.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="theme_color">Cor do Tema</Label>
                    <Input
                      id="theme_color"
                      type="color"
                      value={formData.theme_color}
                      onChange={(e) => handleChange('theme_color', e.target.value)}
                      className="h-12 w-full"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || !validation.isValid}
                  >
                    {loading ? 'Processando...' : `Criar Evento - ${(getCurrentPlan().price / 100).toFixed(2).replace('.', ',')} R$`}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateEvent;
