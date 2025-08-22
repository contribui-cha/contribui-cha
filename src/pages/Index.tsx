import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, Gift, Users, CreditCard, BarChart3, MessageSquare, CheckCircle } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-baby-pink via-background to-baby-blue">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Heart className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold text-primary">Contribui&Chá</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button>Começar Grátis</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              Transforme seu Chá de Bebê em uma Experiência Única
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Crie cards personalizados para seu chá de bebê ou casa nova. Seus convidados escolhem cards 
              com valores surpresa e contribuem de forma divertida e organizada.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="text-lg px-8 py-6">
                  <Gift className="w-5 h-5 mr-2" />
                  Criar Meu Chá
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                Ver Demonstração
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-background/50">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">Como Funciona</h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Uma plataforma completa para organizar seu evento e receber contribuições de forma moderna
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>1. Crie seu Evento</CardTitle>
                <CardDescription>
                  Configure seu chá com nome, data, valores dos cards e personalize as cores
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>2. Convide os Participantes</CardTitle>
                <CardDescription>
                  Compartilhe o link do seu evento. Convidados escolhem cards e descobrem valores surpresa
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>3. Receba as Contribuições</CardTitle>
                <CardDescription>
                  Pagamentos seguros via Stripe. Acompanhe tudo em tempo real no seu dashboard
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-bold mb-6">Vantagens do Contribui&Chá</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-success-green mt-1" />
                  <div>
                    <h4 className="font-semibold">Cards Surpresa</h4>
                    <p className="text-muted-foreground">Valores aleatórios tornam a experiência mais divertida</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-success-green mt-1" />
                  <div>
                    <h4 className="font-semibold">Pagamentos Seguros</h4>
                    <p className="text-muted-foreground">Integração com Stripe para máxima segurança</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-success-green mt-1" />
                  <div>
                    <h4 className="font-semibold">Dashboard Completo</h4>
                    <p className="text-muted-foreground">Acompanhe arrecadação, mensagens e relatórios</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-success-green mt-1" />
                  <div>
                    <h4 className="font-semibold">Mensagens Carinhosas</h4>
                    <p className="text-muted-foreground">Convidados deixam mensagens especiais para você</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary/10 to-blue-50 p-8 rounded-2xl">
              <div className="grid grid-cols-4 gap-4">
                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i}
                    className="aspect-square bg-white rounded-lg shadow-sm flex items-center justify-center font-bold text-primary border-2 border-primary/20"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              <p className="text-center mt-4 text-sm text-muted-foreground">
                Exemplo de cards do seu evento
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-primary">
        <div className="container mx-auto text-center">
          <h3 className="text-3xl font-bold text-primary-foreground mb-4">
            Pronto para Criar seu Chá dos Sonhos?
          </h3>
          <p className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
            Junte-se a centenas de famílias que já organizaram seus eventos conosco
          </p>
          <Link to="/auth">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
              Começar Agora - É Grátis
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t bg-background">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Heart className="w-6 h-6 text-primary" />
            <span className="font-bold text-primary">Contribui&Chá</span>
          </div>
          <p className="text-muted-foreground">
            © 2024 Contribui&Chá. Feito com amor para suas celebrações especiais.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
