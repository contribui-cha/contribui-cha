import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Heart, Calendar, Target, Gift, Lock, CheckCircle } from 'lucide-react';

interface Event {
  id: number;
  name: string;
  description: string;
  date: string;
  goal_amount: number;
  theme_color: string;
  min_value: number;
  max_value: number;
}

interface Card {
  id: number;
  card_number: number;
  status: string;
  value: number;
  guest_name: string;
}

const PublicEvent = () => {
  const { slug } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (slug) {
      fetchEventData();
    }
  }, [slug]);

  const fetchEventData = async () => {
    try {
      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      // Fetch cards
      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .eq('event_id', eventData.id)
        .order('card_number');

      if (cardsError) throw cardsError;
      setCards(cardsData);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Evento não encontrado",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (card: Card) => {
    if (card.status === 'available') {
      setSelectedCard(card);
    }
  };

  const handleContribute = async () => {
    if (!selectedCard || !event) return;

    try {
      // Call Stripe checkout edge function
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          card_id: selectedCard.id,
          event_id: event.id,
          amount: selectedCard.value || event.min_value
        }
      });

      if (error) throw error;

      // Redirect to Stripe checkout
      window.open(data.url, '_blank');
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao processar pagamento",
        variant: "destructive"
      });
    }
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

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Evento não encontrado</h1>
          <p className="text-muted-foreground">Este evento não existe ou foi removido</p>
        </div>
      </div>
    );
  }

  const totalRaised = cards
    .filter(card => card.status === 'revealed')
    .reduce((sum, card) => sum + (card.value || 0), 0);

  const progressPercentage = event.goal_amount > 0 
    ? Math.min((totalRaised / event.goal_amount) * 100, 100) 
    : 0;

  return (
    <div 
      className="min-h-screen p-4"
      style={{ 
        background: `linear-gradient(135deg, ${event.theme_color}20, ${event.theme_color}10)` 
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Event Header */}
        <div className="text-center mb-8">
          <div 
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: event.theme_color }}
          >
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2" style={{ color: event.theme_color }}>
            {event.name}
          </h1>
          {event.description && (
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {event.description}
            </p>
          )}
          {event.date && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Calendar className="w-5 h-5" style={{ color: event.theme_color }} />
              <span className="font-medium">
                {new Date(event.date).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
        </div>

        {/* Progress Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Progresso da Arrecadação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={progressPercentage} className="h-3" />
              <div className="flex justify-between text-sm">
                <span>R$ {(totalRaised / 100).toFixed(2)}</span>
                <span>Meta: R$ {(event.goal_amount / 100).toFixed(2)}</span>
              </div>
              <p className="text-center text-muted-foreground">
                {progressPercentage.toFixed(1)}% da meta alcançada
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cards Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Escolha seu Card de Contribuição
            </CardTitle>
            <CardDescription>
              Clique em um card disponível para contribuir
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 md:grid-cols-10 lg:grid-cols-15 gap-2">
              {cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card)}
                  className={`
                    aspect-square rounded-lg border-2 transition-all duration-200 flex items-center justify-center font-bold text-sm
                    ${card.status === 'available' 
                      ? 'border-primary bg-primary/10 hover:bg-primary/20 cursor-pointer hover:scale-105' 
                      : card.status === 'reserved'
                      ? 'border-yellow-500 bg-yellow-100 cursor-not-allowed'
                      : 'border-green-500 bg-green-100 cursor-not-allowed'
                    }
                  `}
                  disabled={card.status !== 'available'}
                >
                  {card.status === 'available' && card.card_number}
                  {card.status === 'reserved' && <Lock className="w-4 h-4" />}
                  {card.status === 'revealed' && <CheckCircle className="w-4 h-4" />}
                </button>
              ))}
            </div>
            
            <div className="flex justify-center gap-6 mt-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-primary/10 border-2 border-primary rounded"></div>
                <span className="text-sm">Disponível</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-500 rounded"></div>
                <span className="text-sm">Reservado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded"></div>
                <span className="text-sm">Revelado</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contribution Modal */}
        {selectedCard && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Contribuir - Card #{selectedCard.card_number}</CardTitle>
                <CardDescription>
                  Confirme sua contribuição para este evento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Valor sugerido</p>
                  <p className="text-2xl font-bold">
                    R$ {((selectedCard.value || event.min_value) / 100).toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedCard(null)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleContribute}
                    className="flex-1"
                    style={{ backgroundColor: event.theme_color }}
                  >
                    Contribuir
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicEvent;