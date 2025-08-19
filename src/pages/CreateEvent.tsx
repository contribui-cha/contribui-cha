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
import { Calendar, Gift, Users, DollarSign } from 'lucide-react';

const CreateEvent = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    date: '',
    num_cards: 50,
    min_value: 10,
    max_value: 100,
    goal_amount: 5000,
    theme_color: '#3B82F6'
  });
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const slug = generateSlug(formData.name);
      
      // Create event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          ...formData,
          slug,
          host_id: user.id,
          min_value: formData.min_value * 100, // Convert to cents
          max_value: formData.max_value * 100,
          goal_amount: formData.goal_amount * 100
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Generate cards for the event
      const { error: cardsError } = await supabase.rpc('generate_event_cards', {
        event_id_param: event.id,
        num_cards_param: formData.num_cards
      });

      if (cardsError) throw cardsError;

      toast({
        title: "Evento criado!",
        description: "Seu evento foi criado com sucesso."
      });

      navigate(`/events/${slug}`);
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
    <div className="min-h-screen bg-gradient-to-br from-baby-pink to-baby-blue p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <Gift className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">Criar Novo Evento</h1>
          <p className="text-muted-foreground">Configure seu chá de bebê ou casa nova</p>
        </div>

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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="num_cards" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Número de Cards
                  </Label>
                  <Input
                    id="num_cards"
                    type="number"
                    min="10"
                    max="200"
                    value={formData.num_cards}
                    onChange={(e) => handleChange('num_cards', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal_amount" className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Meta (R$)
                  </Label>
                  <Input
                    id="goal_amount"
                    type="number"
                    min="100"
                    value={formData.goal_amount}
                    onChange={(e) => handleChange('goal_amount', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_value">Valor Mínimo (R$)</Label>
                  <Input
                    id="min_value"
                    type="number"
                    min="1"
                    value={formData.min_value}
                    onChange={(e) => handleChange('min_value', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_value">Valor Máximo (R$)</Label>
                  <Input
                    id="max_value"
                    type="number"
                    min="1"
                    value={formData.max_value}
                    onChange={(e) => handleChange('max_value', parseInt(e.target.value))}
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
                {loading ? 'Criando Evento...' : 'Criar Evento'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateEvent;