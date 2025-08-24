import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  TrendingUp, 
  Users, 
  DollarSign,
  Calendar,
  MessageSquare,
  Target,
  Clock,
  Award,
  RefreshCw
} from 'lucide-react';

interface Event {
  id: number;
  name: string;
  slug: string;
  date: string;
  goal_amount: number;
  created_at: string;
}

interface Payment {
  id: number;
  amount: number;
  guest_email: string;
  guest_name?: string;
  created_at: string;
  paid_at?: string;
  status: string;
}

interface Card {
  id: number;
  status: string;
  value: number;
  guest_name?: string;
  revealed_at?: string;
}

interface Message {
  id: number;
  guest_name: string;
  message: string;
  created_at: string;
}

const Reports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    fetchEvents();
  }, [user, navigate]);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventData();
    }
  }, [selectedEvent]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('host_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
      
      if (data && data.length > 0) {
        setSelectedEvent(data[0].id.toString());
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar eventos",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEventData = async () => {
    if (!selectedEvent) return;

    try {
      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('event_id', parseInt(selectedEvent))
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);

      // Fetch cards
      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .eq('event_id', parseInt(selectedEvent))
        .order('card_number');

      if (cardsError) throw cardsError;
      setCards(cardsData || []);

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('event_id', parseInt(selectedEvent))
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;
      setMessages(messagesData || []);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados do evento",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const syncPayments = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-payments');
      
      if (error) throw error;

      toast({
        title: "Pagamentos sincronizados!",
        description: "Os dados foram atualizados com sucesso."
      });

      // Refresh data
      await fetchEventData();
    } catch (error: any) {
      toast({
        title: "Erro ao sincronizar pagamentos",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  const currentEvent = events.find(e => e.id.toString() === selectedEvent);
  
  // Calculations
  const completedPayments = payments.filter(p => p.status === 'completed');
  const totalRaised = completedPayments.reduce((sum, p) => sum + p.amount, 0);

  const progressPercentage = currentEvent?.goal_amount 
    ? Math.min((totalRaised / currentEvent.goal_amount) * 100, 100) 
    : 0;

  const availableCards = cards.filter(c => c.status === 'available').length;
  const reservedCards = cards.filter(c => c.status === 'reserved').length;
  const revealedCards = cards.filter(c => c.status === 'revealed').length;

  const conversionRate = cards.filter(c => c.status !== 'available').length > 0
    ? (revealedCards / cards.filter(c => c.status !== 'available').length) * 100
    : 0;

  // Time series data for progress chart
  const progressData = completedPayments
    .filter(p => p.paid_at)
    .sort((a, b) => new Date(a.paid_at!).getTime() - new Date(b.paid_at!).getTime())
    .reduce((acc, payment, index) => {
      const runningTotal = completedPayments
        .slice(0, index + 1)
        .filter(p => p.paid_at && new Date(p.paid_at) <= new Date(payment.paid_at!))
        .reduce((sum, p) => sum + p.amount, 0);
      
      acc.push({
        date: new Date(payment.paid_at!).toLocaleDateString('pt-BR'),
        amount: runningTotal
      });
      return acc;
    }, [] as Array<{ date: string; amount: number }>);

  // Top donors
  const topDonors = completedPayments
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100);
  };

  const getDaysUntilEvent = (eventDate: string) => {
    const today = new Date();
    const event = new Date(eventDate);
    const diffTime = event.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-primary)' }}>
      <div className="max-w-6xl mx-auto p-4">
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
            <h1 className="text-3xl font-bold mb-2">Relatórios Gerais</h1>
            <p className="opacity-90">Análises detalhadas dos seus eventos</p>
          </div>
        </div>

        {/* Event Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Selecionar Evento</span>
              <Button 
                onClick={syncPayments}
                disabled={syncing}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar Pagamentos'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um evento" />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id.toString()}>
                    {event.name} - {new Date(event.date).toLocaleDateString('pt-BR')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {currentEvent && (
          <>
            {/* Report 1: Progress Timeline */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  1️⃣ Relatório de Evolução da Arrecadação x Tempo
                </CardTitle>
                <CardDescription>
                  Progresso das doações até a data do evento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(totalRaised)}
                    </div>
                    <p className="text-sm text-muted-foreground">Arrecadado</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {progressPercentage.toFixed(1)}%
                    </div>
                    <p className="text-sm text-muted-foreground">da Meta</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold flex items-center justify-center gap-2">
                      <Clock className="w-5 h-5" />
                      {getDaysUntilEvent(currentEvent.date)}
                    </div>
                    <p className="text-sm text-muted-foreground">Dias restantes</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Progress value={progressPercentage} className="h-4" />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Meta: {formatCurrency(currentEvent.goal_amount)}</span>
                    <span>Restam: {formatCurrency(currentEvent.goal_amount - totalRaised)}</span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">💡 Insights:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Faltam {getDaysUntilEvent(currentEvent.date)} dias e já foi arrecadado {progressPercentage.toFixed(1)}% da meta</li>
                    {progressPercentage < 50 && getDaysUntilEvent(currentEvent.date) < 14 && (
                      <li>• A taxa de contribuição precisa acelerar, considere reforçar os convites</li>
                    )}
                    {progressPercentage > 80 && (
                      <li>• Excelente progresso! Você está muito próximo da meta</li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Report 2: Card Performance */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  2️⃣ Relatório de Desempenho dos Cards
                </CardTitle>
                <CardDescription>
                  Engajamento dos convidados com os cards
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{availableCards}</div>
                    <p className="text-sm text-green-700">Disponíveis</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{reservedCards}</div>
                    <p className="text-sm text-yellow-700">Reservados</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{revealedCards}</div>
                    <p className="text-sm text-blue-700">Revelados/Pagos</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{conversionRate.toFixed(1)}%</div>
                    <p className="text-sm text-purple-700">Taxa Conversão</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Cards escolhidos vs disponíveis</span>
                      <span>{((cards.length - availableCards) / cards.length * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={(cards.length - availableCards) / cards.length * 100} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Cards revelados vs não revelados</span>
                      <span>{(revealedCards / cards.length * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={revealedCards / cards.length * 100} className="h-2" />
                  </div>
                </div>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">💡 Insights:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• {conversionRate.toFixed(1)}% dos convidados que escolheram cards completaram o pagamento</li>
                    {conversionRate > 70 && (
                      <li>• Excelente taxa de conversão! Seus convidados estão muito engajados</li>
                    )}
                    {conversionRate < 50 && reservedCards > 0 && (
                      <li>• Há cards reservados há tempo, considere enviar lembretes</li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Report 3: Contributors Analysis */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  3️⃣ Relatório de Contribuições por Convidado
                </CardTitle>
                <CardDescription>
                  Top donors e engajamento social
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Top Donors */}
                  <div>
                    <h4 className="font-medium mb-4">🏆 Ranking dos Maiores Doadores</h4>
                    <div className="space-y-3">
                      {topDonors.length > 0 ? topDonors.map((donor, index) => (
                        <div key={donor.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{donor.guest_name || 'Anônimo'}</p>
                            <p className="text-sm text-muted-foreground">{donor.guest_email}</p>
                          </div>
                          <Badge variant="secondary">
                            {formatCurrency(donor.amount)}
                          </Badge>
                        </div>
                      )) : (
                        <p className="text-muted-foreground text-center py-4">
                          Nenhuma contribuição confirmada ainda
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div>
                    <h4 className="font-medium mb-4 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Mensagens Carinhosas ({messages.length})
                    </h4>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {messages.length > 0 ? messages.slice(0, 5).map((message) => (
                        <div key={message.id} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-medium text-sm">{message.guest_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(message.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <p className="text-sm">{message.message}</p>
                        </div>
                      )) : (
                        <p className="text-muted-foreground text-center py-4">
                          Nenhuma mensagem deixada ainda
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">💡 Insights:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {topDonors.length > 0 && (
                      <>
                        <li>• O maior doador contribuiu com {formatCurrency(topDonors[0].amount)}</li>
                        <li>• {messages.length} mensagens carinhosas foram deixadas</li>
                      </>
                    )}
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{completedPayments.length} pessoas concluíram até agora</p>
                    {completedPayments.length > 0 && (
                      <li>• Valor médio por contribuição: {formatCurrency(totalRaised / completedPayments.length)}</li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
