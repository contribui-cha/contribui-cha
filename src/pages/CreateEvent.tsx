import React, { useState } from 'react';
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
import { Calendar, Gift, Users, DollarSign, CreditCard } from 'lucide-react';

const CreateEvent = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    date: '',
    num_cards: 30,
    theme_color: '#3B82F6'
  });
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Currency masks
  const goalAmount = useCurrencyMask(1000);
  const minValue = useCurrencyMask(10);
  const maxValue = useCurrencyMask(100);

  // Pricing plans
  const plans = [
    { cards: 30, price: 1290, name: 'Básico' },
    { cards: 50, price: 1690, name: 'Popular' },
    { cards: 80, price: 2190, name: 'Premium' }
  ];

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const getCurrentPlan = () => {
    return plans.find(plan => plan.cards === formData.num_cards) || plans[0];
  };

  const createCheckoutSession = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId: getCurrentPlan().price,
          eventData: {
            ...formData,
            min_value: Math.round(minValue.value * 100),
            max_value: Math.round(maxValue.value * 100),
            goal_amount: Math.round(goalAmount.value * 100)
          }
        }
      });

      if (error) throw error;
      
      // Redirect to Stripe Checkout
      if (data.url) {
        window.open(data.url, '_blank');
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
      await createCheckoutSession();
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
        <div className="text-center mb-8 text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
            <Gift className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Criar Novo Evento</h1>
          <p className="opacity-90">Configure seu chá de bebê ou casa nova</p>
        </div>

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

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Processando...' : `Criar Evento - ${(getCurrentPlan().price / 100).toFixed(2).replace('.', ',')} R$`}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateEvent;