import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, MessageSquare, Send, Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Guest {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

interface GuestMessagingProps {
  eventId: number;
  eventName: string;
  guests: Guest[];
}

const GuestMessaging: React.FC<GuestMessagingProps> = ({ eventId, eventName, guests }) => {
  const [selectedGuests, setSelectedGuests] = useState<number[]>([]);
  const [subject, setSubject] = useState(`Convite para ${eventName}`);
  const [message, setMessage] = useState(`Olá {NOME}!\n\nVocê foi convidado para contribuir com o evento "{EVENTO}".\n\nClique no link abaixo para fazer sua contribuição:\n{LINK}\n\nObrigado!`);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSelectAll = () => {
    if (selectedGuests.length === guests.length) {
      setSelectedGuests([]);
    } else {
      setSelectedGuests(guests.map(g => g.id));
    }
  };

  const handleGuestToggle = (guestId: number) => {
    setSelectedGuests(prev => 
      prev.includes(guestId) 
        ? prev.filter(id => id !== guestId)
        : [...prev, guestId]
    );
  };

  const handleSendMessages = async () => {
    if (selectedGuests.length === 0) {
      alert('Selecione pelo menos um convidado');
      return;
    }

    if (!sendEmail && !sendWhatsapp) {
      alert('Selecione pelo menos um método de envio');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const selectedGuestData = guests.filter(g => selectedGuests.includes(g.id));
      
      console.log('Sending messages to:', selectedGuestData);
      console.log('Request payload:', {
        guests: selectedGuestData,
        event_id: eventId,
        subject,
        message,
        send_email: sendEmail,
        send_whatsapp: sendWhatsapp
      });

      const { data, error } = await supabase.functions.invoke('send-guest-messages', {
        body: {
          guests: selectedGuestData,
          event_id: eventId,
          subject,
          message,
          send_email: sendEmail,
          send_whatsapp: sendWhatsapp
        }
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Erro ao enviar mensagens');
      }

      setResult(data);
      
      // Clear selection after successful send
      setSelectedGuests([]);
      
    } catch (error) {
      console.error('Error sending messages:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedGuestData = guests.filter(g => selectedGuests.includes(g.id));

  return (
    <div className="space-y-6">
      {/* Guest Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Selecionar Convidados
          </CardTitle>
          <CardDescription>
            Escolha os convidados que receberão a mensagem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedGuests.length === guests.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Button>
              <Badge variant="secondary">
                {selectedGuests.length} de {guests.length} selecionados
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
              {guests.map((guest) => (
                <div
                  key={guest.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedGuests.includes(guest.id)
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleGuestToggle(guest.id)}
                >
                  <Checkbox
                    checked={selectedGuests.includes(guest.id)}
                    onCheckedChange={() => handleGuestToggle(guest.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{guest.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{guest.email}</p>
                    {guest.phone && (
                      <p className="text-xs text-muted-foreground">{guest.phone}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message Composition */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Compor Mensagem
          </CardTitle>
          <CardDescription>
            Use {'{NOME}'} para o nome do convidado, {'{EVENTO}'} para o nome do evento e {'{LINK}'} para o link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Assunto (Email)</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Assunto do email"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Mensagem</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite sua mensagem aqui..."
              rows={6}
            />
          </div>

          {/* Send Options */}
          <div className="space-y-3">
            <h4 className="font-medium">Métodos de Envio</h4>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-email"
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked === true)}
              />
              <label htmlFor="send-email" className="flex items-center gap-2 cursor-pointer">
                <Mail className="w-4 h-4" />
                Enviar por Email
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-whatsapp"
                checked={sendWhatsapp}
                onCheckedChange={(checked) => setSendWhatsapp(checked === true)}
              />
              <label htmlFor="send-whatsapp" className="flex items-center gap-2 cursor-pointer">
                <MessageSquare className="w-4 h-4" />
                Enviar por WhatsApp
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {selectedGuestData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview da Mensagem</CardTitle>
            <CardDescription>
              Exemplo de como a mensagem aparecerá para {selectedGuestData[0].name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="font-medium mb-2">Assunto: {subject}</p>
              <div className="whitespace-pre-wrap text-sm">
                {message
                  .replace(/{NOME}/g, selectedGuestData[0].name)
                  .replace(/{EVENTO}/g, eventName)
                  .replace(/{LINK}/g, `[Link do Evento]`)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Send Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSendMessages}
          disabled={loading || selectedGuests.length === 0}
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Enviar Mensagens ({selectedGuests.length})
            </>
          )}
        </Button>
      </div>

      {/* Result */}
      {result && (
        <Alert className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
          {result.success ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription>
            {result.success ? (
              <div>
                <p className="font-medium text-green-800">Mensagens enviadas com sucesso!</p>
                <div className="mt-2 text-sm text-green-700">
                  {result.emailsSent > 0 && <p>📧 {result.emailsSent} emails enviados</p>}
                  {result.whatsappSent > 0 && <p>📱 {result.whatsappSent} mensagens WhatsApp enviadas</p>}
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">Alguns erros ocorreram:</p>
                      <ul className="list-disc list-inside">
                        {result.errors.map((error: string, index: number) => (
                          <li key={index} className="text-xs">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="font-medium text-red-800">Erro ao enviar mensagens</p>
                <p className="text-sm text-red-700 mt-1">{result.error}</p>
                {result.details && (
                  <p className="text-xs text-red-600 mt-1">Detalhes: {result.details}</p>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default GuestMessaging;
