import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function BookingAction() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const action = searchParams.get('action');

  useEffect(() => {
    // Redirect to edge function which will process and redirect back
    if (token && action) {
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-booking-action?token=${token}&action=${action}`;
      window.location.href = functionUrl;
    }
  }, [token, action]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Traitement de votre action...</p>
      </div>
    </div>
  );
}
