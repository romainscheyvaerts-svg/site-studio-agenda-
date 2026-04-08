import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Headphones, Check, X, Clock, Building2, MapPin, Phone, Mail, Shield, Pause, Play, Trash2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { SUPER_ADMIN_EMAIL, PLATFORM_NAME } from "@/config/constants";

interface StudioRequest {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  subscription_status: string;
  created_at: string;
  owner_email?: string;
}

const SuperAdmin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [studios, setStudios] = useState<StudioRequest[]>([]);
  const [filter, setFilter] = useState<"pending_approval" | "all">("pending_approval");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Check super admin access
  useEffect(() => {
    if (user && user.email !== SUPER_ADMIN_EMAIL) {
      navigate("/");
    }
  }, [user, navigate]);

  // Fetch studios
  useEffect(() => {
    if (!user || user.email !== SUPER_ADMIN_EMAIL) return;
    fetchStudios();
  }, [user, filter]);

  const fetchStudios = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("studios")
        .select("*")
        .order("created_at", { ascending: false });

      if (filter === "pending_approval") {
        query = query.eq("subscription_status", "pending_approval");
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get owner emails for each studio
      const studiosWithOwners = await Promise.all(
        (data || []).map(async (studio) => {
          const { data: members } = await supabase
            .from("studio_members")
            .select("user_id")
            .eq("studio_id", studio.id)
            .eq("role", "owner")
            .limit(1);

          let ownerEmail = studio.email;
          if (members && members.length > 0) {
            // Use studio email as fallback (we can't read auth.users directly)
            ownerEmail = studio.email || "N/A";
          }

          return { ...studio, owner_email: ownerEmail } as StudioRequest;
        })
      );

      setStudios(studiosWithOwners);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (studio: StudioRequest) => {
    setProcessingId(studio.id);
    try {
      const { error } = await supabase
        .from("studios")
        .update({ subscription_status: "trialing" })
        .eq("id", studio.id);

      if (error) throw error;

      toast({ 
        title: "✅ Studio approuvé !", 
        description: `"${studio.name}" est maintenant actif. Le propriétaire peut commencer à configurer son studio.` 
      });
      
      // Remove from list or refresh
      setStudios(prev => prev.map(s => 
        s.id === studio.id ? { ...s, subscription_status: "trialing" } : s
      ));
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (studio: StudioRequest) => {
    setProcessingId(studio.id);
    try {
      const { error } = await supabase
        .from("studios")
        .update({ subscription_status: "rejected" })
        .eq("id", studio.id);

      if (error) throw error;

      toast({ 
        title: "❌ Studio refusé", 
        description: `"${studio.name}" a été refusé.` 
      });
      
      setStudios(prev => prev.map(s => 
        s.id === studio.id ? { ...s, subscription_status: "rejected" } : s
      ));
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSuspend = async (studio: StudioRequest) => {
    if (!confirm(`⚠️ Suspendre "${studio.name}" ?\n\nLa page du studio sera temporairement inaccessible aux clients.`)) return;
    setProcessingId(studio.id);
    try {
      const { error } = await supabase
        .from("studios")
        .update({ subscription_status: "suspended" })
        .eq("id", studio.id);
      if (error) throw error;
      toast({ title: "⏸️ Studio suspendu", description: `"${studio.name}" est temporairement désactivé.` });
      setStudios(prev => prev.map(s => s.id === studio.id ? { ...s, subscription_status: "suspended" } : s));
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReactivate = async (studio: StudioRequest) => {
    setProcessingId(studio.id);
    try {
      const { error } = await supabase
        .from("studios")
        .update({ subscription_status: "trialing" })
        .eq("id", studio.id);
      if (error) throw error;
      toast({ title: "✅ Studio réactivé", description: `"${studio.name}" est de nouveau accessible.` });
      setStudios(prev => prev.map(s => s.id === studio.id ? { ...s, subscription_status: "trialing" } : s));
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (studio: StudioRequest) => {
    if (!confirm(`🗑️ SUPPRIMER DÉFINITIVEMENT "${studio.name}" ?\n\n⚠️ Cette action est IRRÉVERSIBLE !\nToutes les données du studio (événements, réservations, services...) seront supprimées.`)) return;
    if (!confirm(`Confirmez-vous la suppression définitive de "${studio.name}" ?\n\nTapez OK pour confirmer.`)) return;
    
    setProcessingId(studio.id);
    try {
      // Delete related data first (use any to bypass missing types)
      await (supabase as any).from("studio_events").delete().eq("studio_id", studio.id);
      await supabase.from("studio_members").delete().eq("studio_id", studio.id);
      await (supabase as any).from("services").delete().eq("studio_id", studio.id);
      
      // Delete the studio
      const { error } = await supabase.from("studios").delete().eq("id", studio.id);
      if (error) throw error;
      
      toast({ title: "🗑️ Studio supprimé", description: `"${studio.name}" a été définitivement supprimé.` });
      setStudios(prev => prev.filter(s => s.id !== studio.id));
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 text-red-400 mx-auto" />
          <h1 className="text-2xl font-bold">Accès interdit</h1>
          <p className="text-gray-400">Cette page est réservée au super administrateur.</p>
          <Link to="/" className="text-cyan-400 hover:underline">← Retour à l'accueil</Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_approval":
        return <span className="px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400 flex items-center gap-1"><Clock className="w-3 h-3" /> En attente</span>;
      case "trialing":
        return <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Approuvé</span>;
      case "active":
        return <span className="px-2 py-1 rounded-full text-xs bg-cyan-500/20 text-cyan-400 flex items-center gap-1"><Check className="w-3 h-3" /> Actif</span>;
      case "suspended":
        return <span className="px-2 py-1 rounded-full text-xs bg-orange-500/20 text-orange-400 flex items-center gap-1"><Pause className="w-3 h-3" /> Suspendu</span>;
      case "rejected":
        return <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400 flex items-center gap-1"><X className="w-3 h-3" /> Refusé</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-400">{status}</span>;
    }
  };

  const pendingCount = studios.filter(s => s.subscription_status === "pending_approval").length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      {/* Header */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2">
          <Headphones className="w-8 h-8 text-cyan-400" />
          <span className="text-xl font-bold">{PLATFORM_NAME}</span>
        </Link>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-400" />
          <span className="text-sm text-amber-400 font-medium">Super Admin</span>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Gestion des studios</h1>
            <p className="text-gray-400 mt-1">
              {pendingCount > 0 
                ? `${pendingCount} demande${pendingCount > 1 ? "s" : ""} en attente de validation`
                : "Aucune demande en attente"
              }
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("pending_approval")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === "pending_approval" 
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                  : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-white"
              }`}
            >
              En attente
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === "all" 
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" 
                  : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-white"
              }`}
            >
              Tous
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Chargement...</div>
        ) : studios.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">
              {filter === "pending_approval" 
                ? "Aucune demande en attente 🎉" 
                : "Aucun studio inscrit"
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {studios.map((studio) => (
              <div 
                key={studio.id} 
                className={`bg-gray-800/50 border rounded-xl p-6 transition ${
                  studio.subscription_status === "pending_approval" 
                    ? "border-amber-500/30" 
                    : "border-gray-700"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold">{studio.name}</h3>
                      {getStatusBadge(studio.subscription_status)}
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" /> /{studio.slug}
                      </span>
                      {studio.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" /> {studio.city}
                        </span>
                      )}
                      {studio.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" /> {studio.phone}
                        </span>
                      )}
                      {studio.owner_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" /> {studio.owner_email}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-gray-500">
                      Inscrit le {new Date(studio.created_at).toLocaleDateString("fr-BE", { 
                        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" 
                      })}
                    </p>
                  </div>

                  {studio.subscription_status === "pending_approval" && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApprove(studio)}
                        disabled={processingId === studio.id}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" /> Approuver
                      </button>
                      <button
                        onClick={() => handleReject(studio)}
                        disabled={processingId === studio.id}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
                      >
                        <X className="w-4 h-4" /> Refuser
                      </button>
                    </div>
                  )}

                  {/* Actions for active/trialing studios */}
                  {["trialing", "active"].includes(studio.subscription_status) && (
                    <div className="flex flex-col gap-2 ml-4 items-end">
                      <Link 
                        to={`/${studio.slug}`}
                        className="text-cyan-400 hover:underline text-sm"
                      >
                        Voir le studio →
                      </Link>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSuspend(studio)}
                          disabled={processingId === studio.id}
                          className="bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 border border-orange-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
                        >
                          <Pause className="w-3 h-3" /> Suspendre
                        </button>
                        <button
                          onClick={() => handleDelete(studio)}
                          disabled={processingId === studio.id}
                          className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Supprimer
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions for suspended studios */}
                  {studio.subscription_status === "suspended" && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleReactivate(studio)}
                        disabled={processingId === studio.id}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" /> Réactiver
                      </button>
                      <button
                        onClick={() => handleDelete(studio)}
                        disabled={processingId === studio.id}
                        className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Supprimer
                      </button>
                    </div>
                  )}

                  {/* Actions for rejected studios */}
                  {studio.subscription_status === "rejected" && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApprove(studio)}
                        disabled={processingId === studio.id}
                        className="bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Approuver
                      </button>
                      <button
                        onClick={() => handleDelete(studio)}
                        disabled={processingId === studio.id}
                        className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Supprimer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdmin;
