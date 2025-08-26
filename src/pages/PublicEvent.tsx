import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Heart, Gift, Star, Users, Calendar, Target, Lock, CheckCircle, User, Mail, MessageSquare } from 'lucide-react';
import { PageLoader } from '@/components/PageLoader';
import { UnlockCodeModal } from '@/components/UnlockCodeModal';
import { Label } from '@/components/ui/label';

interface Event {
  id: number;
  name: string;
  description: string;
  date: string;
  goal_amount: number;
  theme_color: string;
  num_cards: number;
}

interface Card {
  id: number;
  card_number: number;
  status: string;
  value?: number;
  guest_name: string;
  revealed_at?: string;
  unlock_code?: string;
  guest_email?: string;
}

const PublicEvent = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [pendingCard, setPendingCard] = useState<Card | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [revealedCard, setRevealedCard] = useState<Card | null>(null);
  const [guestInfo, setGuestInfo] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [totalRaised, setTotalRaised] = useState(0);

  useEffect(() => {
    if (slug) {
      fetchEventData();
      // Check for existing revealed card in localStorage
      const storageKey = `revealed_card_${slug}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const cardData = JSON.parse(stored);
        setRevealedCard(cardData);
      }
    }
  }, [slug]);

  useEffect(() => {
    // Calculate total raised when event data is loaded
    if (event) {
      fetchTotalRaised();
    }
  }, [event]);

  const fetchTotalRaised = async () => {
    if (!event) return;
    
    try {
      const { data: completedPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('event_id', event.id)
        .eq('status', 'completed');

      const total = completedPayments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
      setTotalRaised(total);
    } catch (error) {
      // Silently fail - not critical
    }
  };

  const fetchEventData = async () => {
    try {
      // Fetch event details using secure function
      const { data: eventData, error: eventError } = await supabase
        .rpc('get_public_event_by_slug', { _slug: slug });

      if (eventError) throw eventError;
      
      if (!eventData || eventData.length === 0) {
        throw new Error('Event not found');
      }

      const event = eventData[0];
      setEvent(event);

      // Fetch cards using secure function
      const { data: cardsData, error: cardsError } = await supabase
        .rpc('get_public_cards_by_event', { _event_id: event.id });

      if (cardsError) throw cardsError;
      setCards(cardsData || []);
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
    // For authenticated users (event hosts), allow direct contribution without guest flow
    if (user && card.status === 'available') {
      setSelectedCard(card);
      setGuestInfo({
        name: user.email?.split('@')[0] || '',
        email: user.email || '',
        message: ''
      });
      setShowContributeModal(true);
      return;
    }

    // If user is not event host and already has a revealed card, prevent clicking
    if (!isEventHost && revealedCard) {
      toast({
        title: "Card já revelado",
        description: "Você já revelou um card para este evento.",
        variant: "destructive"
      });
      return;
    }

    // Always open unlock modal for reserved cards - they need to enter email to proceed
    if (card.status === 'reserved') {
      setPendingCard(card);
      setShowUnlockModal(true);
      return;
    }

    // If card is available and user hasn't revealed any card yet
    if (card.status === 'available' && (!revealedCard || isEventHost)) {
      setPendingCard(card);
      setShowUnlockModal(true);
    }
  };

  const handleUnlockSuccess = () => {
    setShowUnlockModal(false);
    
    // Immediately open contribute modal with the pending card
    if (pendingCard) {
      setSelectedCard(pendingCard);
      setGuestInfo(prev => ({ 
        ...prev, 
        email: '' // User will enter their email in the contribute modal
      }));
      setShowContributeModal(true);
      setPendingCard(null);
    }
    
    // Refetch cards to get updated status in background
    fetchEventData();
  };

  const handleConfirmReveal = () => {
    if (pendingCard) {
      setSelectedCard(pendingCard);
      setRevealedCard(pendingCard);
      
      // Store in localStorage (only for non-hosts)
      if (!isEventHost && slug) {
        const storageKey = `revealed_card_${slug}`;
        localStorage.setItem(storageKey, JSON.stringify(pendingCard));
      }
      
      setShowContributeModal(true);
      setShowConfirmation(false);
      setPendingCard(null);
    }
  };

  const handleCancelReveal = () => {
    setShowConfirmation(false);
    setPendingCard(null);
  };

  // For public events, assume user is not the host since we don't expose host_id
  const isEventHost = false;

  const handleContribute = async () => {
    if (!selectedCard || !event || !guestInfo.name || !guestInfo.email) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha nome e email",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      // Save message if provided
      if (guestInfo.message) {
        await supabase.from('messages').insert({
          event_id: event.id,
          guest_name: guestInfo.name,
          guest_email: guestInfo.email,
          message: guestInfo.message
        });
      }

      // Call Stripe checkout edge function
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          card_id: selectedCard.id,
          event_id: event.id,
          amount: selectedCard.value || 1000, // Default minimum value
          guest_name: guestInfo.name,
          guest_email: guestInfo.email
        }
      });

      if (error) throw error;

      // Redirect to Stripe checkout
      if (data.url) {
        window.open(data.url, '_blank');
      }
      
      setSelectedCard(null);
      setShowContributeModal(false);
      setGuestInfo({ name: '', email: '', message: '' });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao processar pagamento",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PageLoader message="Carregando evento..." />;
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
        {/* Back Button for Event Host */}
        {isEventHost && (
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
        )}
        
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
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Progresso da Arrecadação</h3>
            </div>
            <div className="space-y-4">
              <Progress value={progressPercentage} className="h-3" />
              <div className="flex justify-between text-base font-semibold">
                <span>R$ {(totalRaised / 100).toFixed(2)}</span>
                <span>Meta: R$ {(event.goal_amount / 100).toFixed(2)}</span>
              </div>
              <p className="text-center text-muted-foreground font-medium text-base">
                {progressPercentage.toFixed(1)}% da meta alcançada
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cards Grid */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Escolha seu Card de Contribuição</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              Clique em um card disponível para contribuir
            </p>
            
            <div className="grid grid-cols-5 md:grid-cols-10 lg:grid-cols-15 gap-2 mb-6">
              {cards.map((card) => (
                 <button
                  key={card.id}
                  onClick={() => handleCardClick(card)}
                     className={`
                     aspect-square rounded-lg border-2 transition-all duration-200 flex items-center justify-center font-bold text-sm
                      ${card.status === 'available' && (!revealedCard || isEventHost || user)
                        ? 'border-primary bg-primary/10 hover:bg-primary/20 cursor-pointer hover:scale-105' 
                        : card.status === 'reserved'
                        ? 'border-yellow-500 bg-yellow-100 cursor-pointer hover:bg-yellow-200'
                        : card.status === 'revealed'
                        ? 'border-green-500 bg-green-50 cursor-not-allowed'
                        : 'border-muted bg-muted/20 cursor-not-allowed opacity-50'
                      }
                   `}
                  disabled={card.status === 'revealed' || (!isEventHost && revealedCard && revealedCard.id !== card.id && card.status !== 'reserved')}
                >
                   {card.status === 'available' && (
                     <div className="text-center">
                       <div>{card.card_number}</div>
                       {card.value && (
                         <div className="text-xs">R$ {(card.value / 100).toFixed(2)}</div>
                       )}
                     </div>
                   )}
                  {card.status === 'reserved' && <Lock className="w-4 h-4" />}
                  {card.status === 'revealed' && <CheckCircle className="w-4 h-4" />}
                </button>
              ))}
            </div>
            
            <div className="flex justify-center gap-6">
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
                <span className="text-sm">Pago</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Debug Info - Remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <Card className="mt-4 border-yellow-500">
            <CardContent className="p-4">
              <h4 className="font-bold text-yellow-600 mb-2">Debug Info</h4>
              <div className="text-sm space-y-1">
                <p>Event ID: {event?.id}</p>
                <p>Event Slug: {slug}</p>
                <p>Cards Count: {cards.length}</p>
                <p>Revealed Card: {revealedCard ? `#${revealedCard.card_number}` : 'None'}</p>
                <p>Show Unlock Modal: {showUnlockModal ? 'Yes' : 'No'}</p>
                <p>Pending Card: {pendingCard ? `#${pendingCard.card_number}` : 'None'}</p>
                <p>EventID sendo passado para modal: {pendingCard ? event.id : 'N/A'}</p>
              </div>
              
              {/* Teste de Toast */}
              <div className="mt-4 pt-2 border-t border-yellow-300">
                <p className="text-xs font-semibold mb-2">Teste do Sistema de Toast:</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      console.log('🧪 Testando toast de sucesso...');
                      import('@/hooks/use-toast').then(({ toast }) => {
                        toast({
                          title: "✅ Sucesso!",
                          description: "Sistema de toast funcionando!",
                        });
                      });
                    }}
                    className="text-xs px-2 py-1 bg-green-500 text-white rounded"
                  >
                    Teste Sucesso
                  </button>
                  <button 
                    onClick={() => {
                      console.log('🧪 Testando toast de erro...');
                      import('@/hooks/use-toast').then(({ toast }) => {
                        toast({
                          title: "❌ Erro!",
                          description: "Sistema de toast funcionando!",
                          variant: "destructive"
                        });
                      });
                    }}
                    className="text-xs px-2 py-1 bg-red-500 text-white rounded"
                  >
                    Teste Erro
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unlock Code Modal */}
        {pendingCard && (
          <UnlockCodeModal
            isOpen={showUnlockModal}
            onClose={() => {
              setShowUnlockModal(false);
              setPendingCard(null);
            }}
            onSuccess={handleUnlockSuccess}
            cardNumber={pendingCard.card_number}
            eventName={event.name}
            eventId={event.id}
            cardStatus={pendingCard.status}
            reservedEmail={pendingCard.guest_email}
          />
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar revelação do card</AlertDialogTitle>
              <AlertDialogDescription>
                Você deseja revelar o card #{pendingCard?.card_number}? Uma vez revelado, você não poderá escolher outro card para este evento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelReveal}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmReveal}>Sim, revelar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Contribution Modal */}
        <Dialog open={showContributeModal} onOpenChange={setShowContributeModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Contribuir - Card #{selectedCard?.card_number}</DialogTitle>
              <DialogDescription>
                Preencha seus dados para contribuir
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Valor da contribuição</p>
                 <p className="text-2xl font-bold">
                   R$ {((selectedCard?.value || 1000) / 100).toFixed(2)}
                 </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="guest-name" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Nome completo *
                  </Label>
                  <Input
                    id="guest-name"
                    value={guestInfo.name}
                    onChange={(e) => setGuestInfo(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Seu nome completo"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guest-email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email *
                  </Label>
                  <Input
                    id="guest-email"
                    type="email"
                    value={guestInfo.email}
                    onChange={(e) => setGuestInfo(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guest-message" className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Mensagem carinhosa (opcional)
                  </Label>
                  <Textarea
                    id="guest-message"
                    value={guestInfo.message}
                    onChange={(e) => setGuestInfo(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Deixe uma mensagem especial..."
                    className="min-h-[80px]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedCard(null);
                    setShowContributeModal(false);
                    setGuestInfo({ name: '', email: '', message: '' });
                  }}
                  className="flex-1"
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleContribute}
                  className="flex-1"
                  style={{ backgroundColor: event.theme_color }}
                  disabled={submitting || !guestInfo.name || !guestInfo.email}
                >
                  {submitting ? 'Processando...' : 'Contribuir'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PublicEvent;
