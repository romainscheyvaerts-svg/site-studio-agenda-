import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Clock,
  Euro,
  Calendar,
  TrendingUp,
  User,
  Users,
  Mic,
  Building2,
  Music,
  Headphones,
  Disc,
  Radio,
  Loader2,
  Receipt,
  Tag,
  CreditCard,
  Banknote,
  Plus,
  Search,
  Filter,
  Download,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp
} from "lucide-react";

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
  client_email: string;
  client_name: string | null;
  total_sessions: number;
  total_hours: number;
  total_base_price: number;
  total_discounts: number;
  total_spent: number;
  first_session: string | null;
  last_session: string | null;
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

const AdminClientAccounting = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [clientStats, setClientStats] = useState<ClientStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // New session form
  const [newSession, setNewSession] = useState({
    client_email: "",
    client_name: "",
    session_date: new Date().toISOString().split("T")[0],
    session_type: "with-engineer",
    duration_hours: 2,
    base_price: 0,
    discount_percent: 0,
    payment_method: "cash",
    payment_status: "paid",
    notes: ""
  });

  // Base prices for each session type
  const basePrices: Record<string, number> = {
    "with-engineer": 45,
    "without-engineer": 22,
    "mixing": 200,
    "mastering": 60,
    "analog-mastering": 100,
    "podcast": 40
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all sessions
      const { data: sessionsData, error: sessionsError } = await (supabase as any)
        .from("client_sessions")
        .select("*")
        .order("session_date", { ascending: false });

      if (sessionsError) {
        console.error("Error fetching sessions:", sessionsError);
      } else {
        setSessions(sessionsData || []);
        
        // Calculate stats per client
        const statsMap = new Map<string, ClientStats>();
        (sessionsData || []).forEach((session: ClientSession) => {
          const existing = statsMap.get(session.client_email);
          if (existing) {
            existing.total_sessions++;
            existing.total_hours += Number(session.duration_hours);
            existing.total_base_price += Number(session.base_price);
            existing.total_discounts += Number(session.discount_amount);
            existing.total_spent += Number(session.final_price);
            if (!existing.first_session || session.session_date < existing.first_session) {
              existing.first_session = session.session_date;
            }
            if (!existing.last_session || session.session_date > existing.last_session) {
              existing.last_session = session.session_date;
            }
            if (session.client_name && !existing.client_name) {
              existing.client_name = session.client_name;
            }
          } else {
            statsMap.set(session.client_email, {
              client_email: session.client_email,
              client_name: session.client_name,
              total_sessions: 1,
              total_hours: Number(session.duration_hours),
              total_base_price: Number(session.base_price),
              total_discounts: Number(session.discount_amount),
              total_spent: Number(session.final_price),
              first_session: session.session_date,
              last_session: session.session_date
            });
          }
        });
        
        setClientStats(Array.from(statsMap.values()).sort((a, b) => 
          (b.last_session || "").localeCompare(a.last_session || "")
        ));
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSession = async () => {
    if (!newSession.client_email || !newSession.session_date) {
      toast({
        title: t("common.error"),
        description: t("admin.fill_required_fields"),
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const basePrice = newSession.base_price || basePrices[newSession.session_type] * newSession.duration_hours;
      const discountAmount = basePrice * (newSession.discount_percent / 100);
      const finalPrice = basePrice - discountAmount;

      const { error } = await (supabase as any)
        .from("client_sessions")
        .insert({
          client_email: newSession.client_email.toLowerCase().trim(),
          client_name: newSession.client_name || null,
          session_date: newSession.session_date,
          session_type: newSession.session_type,
          duration_hours: newSession.duration_hours,
          base_price: basePrice,
          discount_percent: newSession.discount_percent,
          discount_amount: discountAmount,
          final_price: finalPrice,
          payment_method: newSession.payment_method,
          payment_status: newSession.payment_status,
          notes: newSession.notes || null
        });

      if (error) throw error;

      toast({
        title: t("admin.session_added"),
        description: t("admin.session_added_desc")
      });

      setShowAddModal(false);
      setNewSession({
        client_email: "",
        client_name: "",
        session_date: new Date().toISOString().split("T")[0],
        session_type: "with-engineer",
        duration_hours: 2,
        base_price: 0,
        discount_percent: 0,
        payment_method: "cash",
        payment_status: "paid",
        notes: ""
      });
      fetchData();
    } catch (err) {
      console.error("Error adding session:", err);
      toast({
        title: t("common.error"),
        description: t("admin.session_add_error"),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm(t("admin.confirm_delete_session"))) return;

    try {
      const { error } = await (supabase as any)
        .from("client_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: t("admin.session_deleted"),
        description: t("admin.session_deleted_desc")
      });

      fetchData();
    } catch (err) {
      console.error("Error deleting session:", err);
      toast({
        title: t("common.error"),
        description: t("admin.session_delete_error"),
        variant: "destructive"
      });
    }
  };

  const toggleClientExpand = (email: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(email)) {
      newExpanded.delete(email);
    } else {
      newExpanded.add(email);
    }
    setExpandedClients(newExpanded);
  };

  const filteredClients = clientStats.filter(client => 
    client.client_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.client_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getClientSessions = (email: string) => {
    return sessions.filter(s => s.client_email === email);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
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

  // Global stats
  const globalStats = {
    totalClients: clientStats.length,
    totalHours: clientStats.reduce((sum, c) => sum + c.total_hours, 0),
    totalRevenue: clientStats.reduce((sum, c) => sum + c.total_spent, 0),
    totalDiscounts: clientStats.reduce((sum, c) => sum + c.total_discounts, 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-display text-foreground">{globalStats.totalClients}</p>
                <p className="text-xs text-muted-foreground">{t("admin.total_clients")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-accent/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-display text-foreground">{globalStats.totalHours}h</p>
                <p className="text-xs text-muted-foreground">{t("admin.total_hours_all")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Euro className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-display text-foreground">{globalStats.totalRevenue}€</p>
                <p className="text-xs text-muted-foreground">{t("admin.total_revenue")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Tag className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-display text-foreground">-{globalStats.totalDiscounts}€</p>
                <p className="text-xs text-muted-foreground">{t("admin.total_discounts_given")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("admin.search_client")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogTrigger asChild>
            <Button variant="neon">
              <Plus className="w-4 h-4 mr-2" />
              {t("admin.add_session")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("admin.add_session")}</DialogTitle>
              <DialogDescription>
                {t("admin.add_session_desc")}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("admin.client_email")} *</Label>
                  <Input
                    type="email"
                    value={newSession.client_email}
                    onChange={(e) => setNewSession({ ...newSession, client_email: e.target.value })}
                    placeholder="client@email.com"
                  />
                </div>
                <div>
                  <Label>{t("admin.client_name")}</Label>
                  <Input
                    value={newSession.client_name}
                    onChange={(e) => setNewSession({ ...newSession, client_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("admin.session_date")} *</Label>
                  <Input
                    type="date"
                    value={newSession.session_date}
                    onChange={(e) => setNewSession({ ...newSession, session_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("admin.session_type")}</Label>
                  <Select
                    value={newSession.session_type}
                    onValueChange={(v) => setNewSession({ ...newSession, session_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="with-engineer">{t("booking.with_engineer")}</SelectItem>
                      <SelectItem value="without-engineer">{t("booking.without_engineer")}</SelectItem>
                      <SelectItem value="mixing">{t("booking.mixing")}</SelectItem>
                      <SelectItem value="mastering">{t("booking.mastering")}</SelectItem>
                      <SelectItem value="analog-mastering">{t("booking.analog_mastering")}</SelectItem>
                      <SelectItem value="podcast">{t("booking.podcast_mixing")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>{t("admin.duration_hours")}</Label>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={newSession.duration_hours}
                    onChange={(e) => setNewSession({ ...newSession, duration_hours: parseFloat(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label>{t("admin.base_price")} (€)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newSession.base_price || basePrices[newSession.session_type] * newSession.duration_hours}
                    onChange={(e) => setNewSession({ ...newSession, base_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>{t("admin.discount_percent")} (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={newSession.discount_percent}
                    onChange={(e) => setNewSession({ ...newSession, discount_percent: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("admin.payment_method")}</Label>
                  <Select
                    value={newSession.payment_method}
                    onValueChange={(v) => setNewSession({ ...newSession, payment_method: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t("account.payment_cash")}</SelectItem>
                      <SelectItem value="online">{t("account.payment_online")}</SelectItem>
                      <SelectItem value="free">{t("account.payment_free")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("admin.payment_status")}</Label>
                  <Select
                    value={newSession.payment_status}
                    onValueChange={(v) => setNewSession({ ...newSession, payment_status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">{t("admin.status_paid")}</SelectItem>
                      <SelectItem value="pending">{t("admin.status_pending")}</SelectItem>
                      <SelectItem value="partial">{t("admin.status_partial")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>{t("admin.notes")}</Label>
                <Textarea
                  value={newSession.notes}
                  onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })}
                  placeholder={t("admin.notes_placeholder")}
                  rows={2}
                />
              </div>

              {/* Preview */}
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <p className="text-sm text-muted-foreground mb-1">{t("admin.price_preview")}</p>
                <div className="flex items-center justify-between">
                  <span className="text-foreground">
                    {newSession.duration_hours}h × {basePrices[newSession.session_type]}€
                    {newSession.discount_percent > 0 && ` - ${newSession.discount_percent}%`}
                  </span>
                  <span className="text-xl font-display text-primary">
                    {(
                      (newSession.base_price || basePrices[newSession.session_type] * newSession.duration_hours) *
                      (1 - newSession.discount_percent / 100)
                    ).toFixed(0)}€
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleAddSession} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                {t("admin.add")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Client List */}
      <div className="space-y-3">
        {filteredClients.length === 0 ? (
          <Card className="bg-card">
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">{t("admin.no_clients_found")}</p>
            </CardContent>
          </Card>
        ) : (
          filteredClients.map((client) => (
            <Card key={client.client_email} className="bg-card">
              <CardContent className="p-0">
                {/* Client Header */}
                <div
                  onClick={() => toggleClientExpand(client.client_email)}
                  className="p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {client.client_name || client.client_email}
                        </p>
                        {client.client_name && (
                          <p className="text-xs text-muted-foreground">{client.client_email}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm text-muted-foreground">{t("account.total_hours")}</p>
                        <p className="font-display text-lg text-foreground">{client.total_hours}h</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-sm text-muted-foreground">{t("account.total_spent")}</p>
                        <p className="font-display text-lg text-primary">{client.total_spent}€</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">{t("account.total_sessions")}</p>
                        <p className="font-display text-lg text-foreground">{client.total_sessions}</p>
                      </div>
                      {expandedClients.has(client.client_email) ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Sessions */}
                {expandedClients.has(client.client_email) && (
                  <div className="border-t border-border p-4 bg-secondary/20">
                    <div className="space-y-3">
                      {getClientSessions(client.client_email).map((session) => (
                        <div
                          key={session.id}
                          className="p-3 rounded-lg border border-border/50 bg-card flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3">
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
                            <span className="text-sm text-muted-foreground">
                              {formatDate(session.session_date)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {session.duration_hours}h
                            </span>
                            {session.discount_amount > 0 && (
                              <Badge variant="outline" className="text-green-500 border-green-500/30">
                                -{session.discount_percent}%
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-display text-lg text-foreground">
                              {session.final_price}€
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteSession(session.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Client Summary */}
                    <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            {t("account.total_discounts")}: <span className="text-green-500">-{client.total_discounts}€</span>
                          </span>
                          <span className="text-muted-foreground">
                            {t("admin.first_session")}: {client.first_session && formatDate(client.first_session)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-muted-foreground">{t("admin.total_paid")}: </span>
                          <span className="font-display text-xl text-primary">{client.total_spent}€</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminClientAccounting;