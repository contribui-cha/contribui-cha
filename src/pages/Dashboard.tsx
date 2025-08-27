import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Users, 
  DollarSign, 
  MessageSquare, 
  Settings, 
  Plus,
  Heart,
  BarChart3,
  LogOut,
  Trash2
} from 'lucide-react';
import logoWhite from '@/assets/logo-white.png';
import { supabase } from '@/integrations/supabase/client';
import { PageLoader } from '@/components/PageLoader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  name: string;
  plan: string;
}

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

const Dashboard = () => {
  const { user, signOut, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingEvent, setDeletingEvent] = useState<number | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [stats, setStats] = useState({
    totalRaised: 0,
    totalContributions: 0,
    totalMessages: 0
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    fetchProfile();
    fetchEvents();
    fetchStats();
  }, [user, navigate]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, plan')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      // Silently fail - not critical
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('host_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      // Silently fail - will show empty state
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Trigger auto sync before fetching stats
      await supabase.functions.invoke('sync-payments-auto');
      
      // Get all user's events
      const { data: userEvents, error: eventsError } = await supabase
        .from('events')
        .select('id')
        .eq('host_id', user?.id);

      if (eventsError) throw eventsError;
      
      const eventIds = userEvents?.map(e => e.id) || [];
      
      if (eventIds.length === 0) {
        setStats({ totalRaised: 0, totalContributions: 0, totalMessages: 0 });
        return;
      }

      // Get total raised from payments
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('amount')
        .in('event_id', eventIds)
        .eq('status', 'completed');

      if (paymentsError) throw paymentsError;

      const totalRaised = payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;

      // Get total contributions (completed payments, not revealed cards)
      const { data: completedPaymentsCount, error: paymentsCountError } = await supabase
        .from('payments')
        .select('id')
        .in('event_id', eventIds)
        .eq('status', 'completed');

      if (paymentsCountError) throw paymentsCountError;

      const totalContributions = completedPaymentsCount?.length || 0;

      // Get total messages
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id')
        .in('event_id', eventIds);

      if (messagesError) throw messagesError;

      const totalMessages = messages?.length || 0;

      setStats({
        totalRaised,
        totalContributions,
        totalMessages
      });

    } catch (error) {
      // Silently fail - stats will show 0
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100);
  };

  const handleDeleteEvent = async (eventId: number) => {
    setDeletingEvent(eventId);
    try {
      // Use the cleanup edge function for proper data cleanup
      const { error: cleanupError } = await supabase.functions.invoke('cleanup-event-data', {
        body: { event_id: eventId }
      });

      if (cleanupError) {
        console.error('Cleanup function error:', cleanupError);
        // Fallback to direct deletion if cleanup function fails
        const { error: directError } = await supabase
          .from('events')
          .delete()
          .eq('id', eventId);
          
        if (directError) throw directError;
      }

      // Clean localStorage for this event
      const cleanEventFromLocalStorage = (eventId: string | number) => {
        const keys = Object.keys(localStorage);
        const eventCacheKeys = ['event_', 'cards_', 'unlock_modal_', 'guest_form_', 'payment_session_'];
        
        keys.forEach(key => {
          eventCacheKeys.forEach(prefix => {
            if (key.startsWith(prefix) && key.includes(eventId.toString())) {
              localStorage.removeItem(key);
            }
          });
        });
      };
      
      cleanEventFromLocalStorage(eventId);

      toast({
        title: "Evento excluído",
        description: "O evento foi excluído com sucesso junto com todos os dados relacionados.",
      });

      // Refresh events list
      fetchEvents();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir evento",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeletingEvent(null);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const { error } = await deleteAccount();
      if (!error) {
        navigate('/');
      }
    } catch (error) {
      // Error handled by auth context
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return <PageLoader message="Carregando dashboard..." />;
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-primary)' }}>
      {/* Header */}
      <header className="bg-background/80 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <img src={logoWhite} alt="Contribui&Chá" className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-primary">Contribui&Chá</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-medium">{profile?.name}</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deletar Conta</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja deletar sua conta? Esta ação não pode ser desfeita e todos os seus dados serão perdidos permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingAccount ? 'Deletando...' : 'Deletar Conta'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Olá, {profile?.name}! 👋</h2>
          <p className="text-muted-foreground">
            Gerencie seus eventos e acompanhe as contribuições
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Eventos</p>
                  <p className="text-2xl font-bold">{events.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-success-green/10 rounded-full">
                  <DollarSign className="w-6 h-6 text-success-green" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Arrecadado</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalRaised)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-baby-blue/50 rounded-full">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contribuições</p>
                  <p className="text-2xl font-bold">{stats.totalContributions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-baby-pink/50 rounded-full">
                  <MessageSquare className="w-6 h-6 text-pink-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mensagens</p>
                  <p className="text-2xl font-bold">{stats.totalMessages}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Events Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Meus Eventos</h3>
              <Button onClick={() => navigate('/create-event')}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Evento
              </Button>
            </div>

            <div className="space-y-4">
              {events.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h4 className="text-lg font-medium mb-2">Nenhum evento criado</h4>
                    <p className="text-muted-foreground mb-4">
                      Crie seu primeiro evento para começar a receber contribuições
                    </p>
                    <Button onClick={() => navigate('/create-event')}>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Primeiro Evento
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                events.map((event) => (
                  <Card key={event.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{event.name}</CardTitle>
                          <CardDescription>{event.description}</CardDescription>
                        </div>
                        <Badge style={{ backgroundColor: event.theme_color }} className="text-white">
                          {event.num_cards} cards
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Data do evento</p>
                          <p className="font-medium">
                            {new Date(event.date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Valor por card</p>
                          <p className="font-medium">
                            {formatCurrency(event.min_value)} - {formatCurrency(event.max_value)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Meta</p>
                          <p className="font-medium">
                            {event.goal_amount ? formatCurrency(event.goal_amount) : 'Não definida'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Link do evento</p>
                          <p 
                            className="font-medium text-primary truncate cursor-pointer hover:underline"
                            onClick={() => navigate(`/events/${event.slug}`)}
                          >
                            /{event.slug}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/events/${event.slug}`)}>
                          Ver Evento
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/edit-event/${event.slug}`)}>
                          Editar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate('/messages')}>
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Mensagens
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4 mr-1" />
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Evento</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o evento "{event.name}"? 
                                <br /><br />
                                <strong>Atenção:</strong> Esta ação não pode ser desfeita e os valores já pagos por participantes <strong>NÃO serão devolvidos</strong>. Todos os dados relacionados ao evento serão perdidos permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteEvent(event.id)}
                                disabled={deletingEvent === event.id}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {deletingEvent === event.id ? 'Excluindo...' : 'Excluir Evento'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Links Úteis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start"
                  onClick={() => navigate('/messages')}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Todas as Mensagens
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start"
                  onClick={() => navigate('/reports')}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Relatórios Gerais
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start"
                  onClick={() => navigate('/guests')}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Gerenciar Convidados
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
