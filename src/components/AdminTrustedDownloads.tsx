import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Download, Music, User, Calendar, RefreshCw, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface TrustedDownload {
  id: string;
  created_at: string;
  buyer_email: string;
  buyer_name: string | null;
  instrumental_id: string;
  license_id: string;
  instrumental?: {
    title: string;
    cover_image_url: string | null;
  };
  license?: {
    name: string;
  };
}

const AdminTrustedDownloads = () => {
  const { session } = useAuth();
  const [downloads, setDownloads] = useState<TrustedDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDownloads = async () => {
    if (!session?.access_token) return;

    try {
      // Fetch purchases where payment_method is "trusted_user_free"
      const { data, error } = await supabase
        .from("instrumental_purchases")
        .select(`
          id,
          created_at,
          buyer_email,
          buyer_name,
          instrumental_id,
          license_id,
          instrumental:instrumentals(title, cover_image_url),
          license:instrumental_licenses(name)
        `)
        .eq("payment_method", "trusted_user_free")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching trusted downloads:", error);
        return;
      }

      // Transform data to handle the nested objects
      const transformedData = (data || []).map((item: any) => ({
        ...item,
        instrumental: item.instrumental || { title: "Instrumental supprimée", cover_image_url: null },
        license: item.license || { name: "Licence inconnue" }
      }));

      setDownloads(transformedData);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDownloads();
  }, [session?.access_token]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDownloads();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold">Téléchargements Gratuits</h3>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
            {downloads.length} total
          </Badge>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* Info box */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
        <p className="text-sm text-emerald-300">
          Historique des instrumentales téléchargées gratuitement par les utilisateurs de confiance.
        </p>
      </div>

      {downloads.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Download className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Aucun téléchargement gratuit pour l'instant</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {downloads.map((download) => (
              <div
                key={download.id}
                className="bg-card/50 border border-border rounded-lg p-4 hover:border-emerald-500/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Cover image */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {download.instrumental?.cover_image_url ? (
                      <img
                        src={download.instrumental.cover_image_url}
                        alt={download.instrumental?.title || "Cover"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground truncate">
                      {download.instrumental?.title || "Instrumentale supprimée"}
                    </h4>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {download.license?.name || "Basic"}
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        <Gift className="w-3 h-3 mr-1" />
                        Gratuit
                      </Badge>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span className="truncate">
                          {download.buyer_name || download.buyer_email || "Utilisateur inconnu"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {format(new Date(download.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                        </span>
                      </div>
                    </div>

                    {download.buyer_name && download.buyer_email && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {download.buyer_email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default AdminTrustedDownloads;
