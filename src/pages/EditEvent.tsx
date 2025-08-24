import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrencyMask } from '@/hooks/useCurrencyMask';
import { Calendar, ArrowLeft, AlertTriangle } from 'lucide-react';

interface Event {
  id: number;
  name: string;
  description: string;
  date: string;
  num_cards: number;
  min_value: number;
  max_value: number;
  goal_amount: number;
  theme_color: string;
  slug: string;
}

const EditEvent = () => {
  const { slug } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    date: '',
    theme_color: '#3B82F6'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const goalAmount = useCurrencyMask(0);
  const minValue = useCurrencyMask(0);
  const maxValue = useCurrencyMask(0);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    fetchEvent();
  }, [user, navigate, slug]);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .eq('host_id', user?.id)
        .single();

      if (error) throw error;
      
      setEvent(data);
      setFormData({
        name: data.name,
        description: data.description || '',
        date: data.date || '',
        theme_color: data.theme_color || '#3B82F6'
      });
      
      goalAmount.setValue(data.goal_amount / 100);
      minValue.setValue(data.min_value / 100);
      maxValue.setValue(data.max_value / 100);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar evento",
        description: error.message,
        variant: "destructive"
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({
          name: formData.name,
          description: formData.description,
          date: formData.date || null,
          theme_color: formData.theme_color
        })
        .eq('id', event.id);

      if (error) throw error;

      toast({
        title: "Evento atualizado!",
        description: "As alterações foram salvas com sucesso."
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar evento",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando evento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-primary)' }}>
      <div className="max-w-2xl mx-auto p-4">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            className="mb-4 text-white hover:bg-white/10"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          
          <div className="text-center text-white">
            <h1 className="text-3xl font-bold mb-2">Editar Evento</h1>
            <p className="opacity-90">Atualize as informações do seu evento</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {event?.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              A quantidade de cards não pode ser alterada após a criação
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
                  <Label>Número de Cards (Não editável)</Label>
                  <Input
                    value={event?.num_cards || 0}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal_amount">Meta Total (Não editável)</Label>
                  <Input
                    id="goal_amount"
                    value={goalAmount.maskedValue}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Valores financeiros não podem ser alterados após a criação</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_value">Valor Mínimo (Não editável)</Label>
                  <Input
                    id="min_value"
                    value={minValue.maskedValue}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_value">Valor Máximo (Não editável)</Label>
                  <Input
                    id="max_value"
                    value={maxValue.maskedValue}
                    disabled
                    className="bg-muted"
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

              <div className="flex gap-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate('/dashboard')}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1" 
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditEvent;
