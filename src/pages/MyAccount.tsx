import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  Euro,
  Calendar,
  TrendingUp,
  User,
  Mic,
  Building2,
  Music,
  Headphones,
  Disc,
  Radio,
  ArrowLeft,
  Loader2,
  Receipt,
  Tag,
  CreditCard,
  Banknote,
  CalendarClock,
  XCircle,
  AlertTriangle,
  History
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface ClientSession {
  id: string;
  client_email: string;
  client_name: string | null;
  session_date: string;
  session_type: string;
  duration_hours: number;
  base_price: number;
  discount_percent: number;
  discount_amount: number;
  final_price: number;
  payment_method: string;
  payment_status: string;
  notes: string | null;
  created_at: string;
}

interface ClientStats {
  total_sessions: number;
  total_hours: number;
  total_base_price: number;
  total_discounts: number;
  total_spent: number;
  first_session: string | null;
  last_session: string | null;
}

interface Booking {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  session_type: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  amount_paid: number;
  status: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
}

const sessionTypeIcons: Record<string, React.ReactNode> = {
  "with-engineer": <Mic className="w-4 h-4" />,
  "without-engineer": <Building2 className="w-4 h-4" />,
  "mixing": <Music className="w-4 h-4" />,
  "mastering": <Headphones className="w-4 h-4" />,
  "analog-mastering": <Disc className="w-4 h-4" />,
  "podcast": <Radio className="w-4 h-4" />
};

const sessionTypeColors: Record<string, string> = {
  "with-engineer": "bg-primary/20 text-primary border-primary/30",
  "without-engineer": "bg-accent/20 text-accent border-accent/30",
  "mixing": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "mastering": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "analog-mastering": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "podcast": "bg-green-500/20 text-green-400 border-green-500/30"
};

const paymentMethodIcons: Record<string, React.ReactNode> = {
  "online": <CreditCard className="w-3 h-3" />,
  "cash": <Banknote className="w-3 h-3" />,
  "free": <Tag className="w-3 h-3" />
};

const MyAccount = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const fetchBookings = async () => {
    if (!user?.email) return;
    
    try {
      // Fetch future bookings from the bookings table
      const today = new Date().toISOString().split("T")[0];
      const { data: bookingsData, error: bookingsError } = await (supabase as any)
        .from("bookings")
        .select("*")
        .eq("client_email", user.email)
        .gte("session_date", today)
        .neq("status", "cancelled")
        .order("session_date", { ascending: true });

      if (bookingsError) {
        console.error("Error fetching bookings:", bookingsError);
      } else {
        setBookings(bookingsData || []);
      }
    } catch (err) {
      console.error("Error fetching bookings:", err);
    }
  };

  useEffect(() => {
    const fetchClientData = async () => {
      if (!user?.email) return;

      setLoading(true);
      try {
        // Fetch sessions - cast to any to bypass type checking for new table
        const { data: sessionsData, error: sessionsError } = await (supabase as any)
          .from("client_sessions")
          .select("*")
          .eq("client_email", user.email)
          .order("session_date", { ascending: false });

        if (sessionsError) {
          console.error("Error fetching sessions:", sessionsError);
        } else {
          setSessions(sessionsData || []);
        }

        // Fetch future bookings
        await fetchBookings();

        // Calculate stats
        const dataToUse = sessionsData || [];
        if (dataToUse.length > 0) {
          const totalSessions = dataToUse.length;
          const totalHours = dataToUse.reduce((sum: number, s: any) => sum + Number(s.duration_hours), 0);
          const totalBasePrice = dataToUse.reduce((sum: number, s: any) => sum + Number(s.base_price), 0);
          const totalDiscounts = dataToUse.reduce((sum: number, s: any) => sum + Number(s.discount_amount), 0);
          const totalSpent = dataToUse.reduce((sum: number, s: any) => sum + Number(s.final_price), 0);
          const dates = dataToUse.map((s: any) => s.session_date).sort();
          
          setStats({
            total_sessions: totalSessions,
            total_hours: totalHours,
            total_base_price: totalBasePrice,
            total_discounts: totalDiscounts,
            total_spent: totalSpent,
            first_session: dates[dates.length - 1] || null,
            last_session: dates[0] || null
          });
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchClientData();
    }
  }, [user]);

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-booking", {
        body: {
          bookingId: selectedBooking.id,
          reason: cancellationReason || "Annulation par le client"
        }
      });

      if (error) throw error;

      toast({
        title: t("account.booking_cancelled"),
        description: t("account.booking_cancelled_desc"),
      });

      // Refresh bookings
      await fetchBookings();
      setCancelDialogOpen(false);
      setSelectedBooking(null);
      setCancellationReason("");
    } catch (err) {
      console.error("Error cancelling booking:", err);
      toast({
        title: t("account.cancel_error"),
        description: t("account.cancel_error_desc"),
        variant: "destructive"
      });
    } finally {
      setCancelling(false);
    }
  };

  const openCancelDialog = (booking: Booking) => {
    setSelectedBooking(booking);
    setCancellationReason("");
    setCancelDialogOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  const getSessionTypeName = (type: string) => {
    const names: Record<string, string> = {
      "with-engineer": t("booking.with_engineer"),
      "without-engineer": t("booking.without_engineer"),
      "mixing": t("booking.mixing"),
      "mastering": t("booking.mastering"),
      "analog-mastering": t("booking.analog_mastering"),
      "podcast": t("booking.podcast_mixing")
    };
    return names[type] || type;
  };

  const getPaymentMethodName = (method: string) => {
    const names: Record<string, string> = {
      "online": t("account.payment_online"),
      "cash": t("account.payment_cash"),
      "free": t("account.payment_free")
    };
    return names[method] || method;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="mb-2 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("common.back")}
            </Button>
            <h1 className="font-display text-4xl text-foreground">
              {t("account.my_account")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("account.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="w-5 h-5" />
            <span>{user?.email}</span>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-card border-primary/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-display text-foreground">{stats.total_hours}h</p>
                    <p className="text-xs text-muted-foreground">{t("account.total_hours")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-accent/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <Euro className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-display text-foreground">{stats.total_spent}€</p>
                    <p className="text-xs text-muted-foreground">{t("account.total_spent")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-green-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-display text-foreground">-{stats.total_discounts}€</p>
                    <p className="text-xs text-muted-foreground">{t("account.total_discounts")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-purple-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-display text-foreground">{stats.total_sessions}</p>
                    <p className="text-xs text-muted-foreground">{t("account.total_sessions")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Upcoming Sessions */}
        <Card className="bg-card mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" />
              {t("account.upcoming_sessions", "Sessions à venir")}
            </CardTitle>
            <CardDescription>
              {t("account.upcoming_sessions_desc", "Vos réservations confirmées à venir. Vous pouvez les annuler si nécessaire.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">{t("account.no_upcoming_sessions", "Aucune session à venir")}</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => navigate("/reservation")}
                >
                  {t("account.book_session", "Réserver une session")}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "flex items-center gap-1",
                              sessionTypeColors[booking.session_type] || "bg-primary/20 text-primary border-primary/30"
                            )}
                          >
                            {sessionTypeIcons[booking.session_type] || <Calendar className="w-4 h-4" />}
                            {getSessionTypeName(booking.session_type)}
                          </Badge>
                          <Badge variant="outline" className="flex items-center gap-1 bg-green-500/20 text-green-400 border-green-500/30">
                            <Clock className="w-3 h-3" />
                            {t("account.confirmed", "Confirmée")}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-foreground font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-primary" />
                            {formatDate(booking.session_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-primary" />
                            {booking.start_time} - {booking.end_time}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {booking.duration_hours}h
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <p className="text-lg font-display text-foreground">
                          {booking.amount_paid}€ {t("account.paid", "payé")}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCancelDialog(booking)}
                          className="text-destructive border-destructive/50 hover:bg-destructive/10"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          {t("account.cancel_booking", "Annuler")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sessions History */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-muted-foreground" />
              {t("account.session_history")}
            </CardTitle>
            <CardDescription>
              {t("account.session_history_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{t("account.no_sessions")}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate("/reservation")}
                >
                  {t("account.book_first_session")}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "flex items-center gap-1",
                              sessionTypeColors[session.session_type]
                            )}
                          >
                            {sessionTypeIcons[session.session_type]}
                            {getSessionTypeName(session.session_type)}
                          </Badge>
                          <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
                            {paymentMethodIcons[session.payment_method]}
                            {getPaymentMethodName(session.payment_method)}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(session.session_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {session.duration_hours}h
                          </span>
                        </div>
                        
                        {session.notes && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            {session.notes}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        {session.discount_amount > 0 && (
                          <div className="text-xs text-green-500 flex items-center justify-end gap-1">
                            <Tag className="w-3 h-3" />
                            -{session.discount_amount}€ ({session.discount_percent}%)
                          </div>
                        )}
                        <p className="text-xl font-display text-foreground">
                          {session.final_price}€
                        </p>
                        {session.discount_amount > 0 && (
                          <p className="text-xs text-muted-foreground line-through">
                            {session.base_price}€
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Card */}
        {stats && stats.total_sessions > 0 && (
          <Card className="mt-6 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-primary/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-xl text-foreground mb-1">
                    {t("account.summary")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("account.member_since")} {stats.first_session && formatDate(stats.first_session)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{t("account.average_per_session")}</p>
                  <p className="text-2xl font-display text-primary">
                    {Math.round(stats.total_spent / stats.total_sessions)}€
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Cancel Booking Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {t("account.cancel_booking_title", "Annuler cette réservation ?")}
            </DialogTitle>
            <DialogDescription>
              {t("account.cancel_booking_warning", "Cette action est irréversible. Votre réservation sera annulée et le créneau sera libéré.")}
            </DialogDescription>
          </DialogHeader>
          
          {selectedBooking && (
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "flex items-center gap-1",
                    sessionTypeColors[selectedBooking.session_type] || "bg-primary/20 text-primary border-primary/30"
                  )}
                >
                  {sessionTypeIcons[selectedBooking.session_type] || <Calendar className="w-4 h-4" />}
                  {getSessionTypeName(selectedBooking.session_type)}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-primary" />
                  {formatDate(selectedBooking.session_date)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-primary" />
                  {selectedBooking.start_time} - {selectedBooking.end_time}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              {t("account.cancel_reason", "Raison de l'annulation (optionnel)")}
            </label>
            <Textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder={t("account.cancel_reason_placeholder", "Ex: Changement de planning, imprévu...")}
              className="min-h-[80px]"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelling}
            >
              {t("common.cancel", "Annuler")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelBooking}
              disabled={cancelling}
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("account.cancelling", "Annulation...")}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  {t("account.confirm_cancel", "Confirmer l'annulation")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default MyAccount;
