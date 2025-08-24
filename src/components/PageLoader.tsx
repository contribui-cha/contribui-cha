import { LoadingSpinner } from "./LoadingSpinner";

interface PageLoaderProps {
  message?: string;
}

export const PageLoader = ({ message = "Carregando..." }: PageLoaderProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-muted-foreground text-lg">{message}</p>
      </div>
    </div>
  );
};

export default PageLoader;
