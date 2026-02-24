import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Check, X, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PendingBooking {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  session_type: string;
  session_date: string;
  session_time: string;
  duration_hours: number;
  estimated_price: number;
  message: string | null;
  status: string;
  approval_token: string;
  created_at: string;
  reminder_count: number;
}

export function AdminPendingBookings() {
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingBookings();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('pending-bookings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_free_bookings',
          filter: 'status=eq.pending'
        },
        () => {
          fetchPendingBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPendingBookings = async () => {
    try {
      // Direct REST API call since table may not be in generated types yet
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/pending_free_bookings?status=eq.pending&order=created_at.desc`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session.data.session?.access_token}`,
          }
        }
      );
      if (response.ok) {
        const jsonData = await response.json();
        setPendingBookings(jsonData || []);
      }
    } catch (error) {
      console.error('Error fetching pending bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (booking: PendingBooking, approved: boolean) => {
    setProcessingId(booking.id);
    
    try {
      const response = await supabase.functions.invoke('handle-free-booking-approval', {
        body: {
          token: booking.approval_token,
          action: approved ? 'approve' : 'reject'
        }
      });

      if (response.error) throw response.error;

      toast({
        title: approved ? "✅ Session confirmée" : "❌ Session refusée",
        description: approved 
          ? `La session de ${booking.client_name} a été confirmée. Un email a été envoyé.`
          : `La demande de ${booking.client_name} a été refusée.`,
      });

      // Refresh list
      fetchPendingBookings();
    } catch (error: unknown) {
      console.error('Error processing approval:', error);
      toast({
        title: "Erreur",
        description: "Impossible de traiter la demande",
        variant: "destructive"
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getSessionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'with-engineer': 'Avec ingénieur',
      'without-engineer': 'Location sèche',
      'mixing': 'Mixage',
      'mastering': 'Mastering',
      'analog-mastering': 'Mastering analogique',
      'podcast': 'Podcast',
      'composition': 'Composition'
    };
    return labels[type] || type;
  };

  if (loading) return null;
  
  if (pendingBookings.length === 0) return null;

  return (
    <Card className="border-yellow-500/50 bg-yellow-500/5 mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-yellow-500">
          <Bell className="h-5 w-5 animate-pulse" />
          Sessions FREE en attente de confirmation
          <Badge variant="destructive" className="ml-2">
            {pendingBookings.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingBookings.map((booking) => (
          <div 
            key={booking.id} 
            className="p-4 rounded-lg border border-zinc-700 bg-zinc-800/50"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-white">{booking.client_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {getSessionTypeLabel(booking.session_type)}
                  </Badge>
                  {booking.reminder_count > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {booking.reminder_count} rappel{booking.reminder_count > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                
                <div className="text-sm text-zinc-400 space-y-1">
                  <div className="flex items-center gap-4">
                    <span>
                      📅 {format(new Date(booking.session_date), "EEEE d MMMM yyyy", { locale: fr })}
                    </span>
                    <span>🕐 {booking.session_time}</span>
                    <span>⏱️ {booking.duration_hours}h</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>📧 {booking.client_email}</span>
                    {booking.client_phone && <span>📞 {booking.client_phone}</span>}
                  </div>
                  {booking.message && (
                    <div className="text-zinc-500 italic mt-1">
                      "{booking.message}"
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                  <Clock className="h-3 w-3" />
                  Demande reçue {format(new Date(booking.created_at), "dd/MM à HH:mm")}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                  onClick={() => handleApproval(booking, false)}
                  disabled={processingId === booking.id}
                >
                  <X className="h-4 w-4 mr-1" />
                  Refuser
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleApproval(booking, true)}
                  disabled={processingId === booking.id}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Confirmer
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default AdminPendingBookings;
