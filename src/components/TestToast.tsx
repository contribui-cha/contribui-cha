import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export const TestToast = () => {
  const { toast } = useToast();

  const testSuccess = () => {
    console.log('🧪 Testando toast de sucesso...');
    toast({
      title: "✅ Sucesso!",
      description: "Este é um toast de sucesso para teste.",
    });
  };

  const testError = () => {
    console.log('🧪 Testando toast de erro...');
    toast({
      title: "❌ Erro!",
      description: "Este é um toast de erro para teste.",
      variant: "destructive"
    });
  };

  return (
    <div className="p-4 space-y-2">
      <h3 className="font-bold">Teste do Sistema de Toast</h3>
      <div className="flex gap-2">
        <Button onClick={testSuccess}>Teste Sucesso</Button>
        <Button onClick={testError} variant="destructive">Teste Erro</Button>
      </div>
    </div>
  );
};