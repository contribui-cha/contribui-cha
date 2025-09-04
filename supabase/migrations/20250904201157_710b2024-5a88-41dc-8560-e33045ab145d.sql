
-- Adicionar campos para Stripe Connect na tabela events
ALTER TABLE public.events 
ADD COLUMN stripe_account_id TEXT,
ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;

-- Criar índice para performance nas consultas por stripe_account_id
CREATE INDEX idx_events_stripe_account_id ON public.events(stripe_account_id);

-- Criar tabela para gerenciar contas Stripe Connect dos anfitriões
CREATE TABLE public.host_stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  account_type TEXT DEFAULT 'express',
  charges_enabled BOOLEAN DEFAULT false,
  details_submitted BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_url TEXT,
  requirements_due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint para garantir que cada usuário tenha apenas uma conta Stripe
  CONSTRAINT unique_host_stripe_account UNIQUE (host_id)
);

-- Habilitar RLS na tabela host_stripe_accounts
ALTER TABLE public.host_stripe_accounts ENABLE ROW LEVEL SECURITY;

-- Policy para usuários verem apenas suas próprias contas Stripe
CREATE POLICY "Users can view their own stripe account" 
ON public.host_stripe_accounts 
FOR SELECT 
USING (host_id = auth.uid());

-- Policy para usuários atualizarem apenas suas próprias contas
CREATE POLICY "Users can update their own stripe account" 
ON public.host_stripe_accounts 
FOR UPDATE 
USING (host_id = auth.uid());

-- Policy para Edge Functions inserisrem/atualizarem contas (usando service role)
CREATE POLICY "Service can manage stripe accounts" 
ON public.host_stripe_accounts 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_host_stripe_accounts_updated_at
  BEFORE UPDATE ON public.host_stripe_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para sincronizar stripe_account_id entre events e host_stripe_accounts
CREATE OR REPLACE FUNCTION public.sync_event_stripe_account()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando uma conta Stripe é criada/atualizada, sincronizar com eventos do host
  UPDATE public.events 
  SET 
    stripe_account_id = NEW.stripe_account_id,
    onboarding_completed = NEW.onboarding_completed
  WHERE host_id = NEW.host_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para sincronizar automaticamente
CREATE TRIGGER sync_stripe_account_with_events
  AFTER INSERT OR UPDATE ON public.host_stripe_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_stripe_account();
