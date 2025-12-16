import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Download as DownloadIcon, Music, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface DownloadData {
  instrumental: {
    title: string;
    genre?: string;
    bpm?: number;
    key?: string;
    cover_image_url?: string;
  };
  license: {
    name: string;
    features: string[];
  };
  downloadUrl: string;
  expiresAt: string;
  downloadCount: number;
}

const Download = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<DownloadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const fetchDownload = async () => {
      if (!token) {
        setError("Lien invalide");
        setLoading(false);
        return;
      }

      try {
        const { data: result, error: fetchError } = await supabase.functions.invoke("get-download", {
          body: { token }
        });

        if (fetchError) throw fetchError;

        if (result.error) {
          if (result.expired) {
            setExpired(true);
          }
          setError(result.error);
        } else {
          setData(result);
        }
      } catch (err: any) {
        setError(err.message || "Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchDownload();
  }, [token]);

  const handleDownload = () => {
    if (data?.downloadUrl) {
      window.open(data.downloadUrl, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Vérification du lien...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-card rounded-2xl border border-border p-8">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {expired ? "Lien expiré" : "Lien invalide"}
            </h1>
            <p className="text-muted-foreground mb-6">
              {expired 
                ? "Ce lien de téléchargement a expiré. Veuillez contacter le support si vous avez besoin d'un nouveau lien."
                : error}
            </p>
            <Button onClick={() => navigate("/")} variant="outline">
              Retour à l'accueil
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const expirationDate = new Date(data.expiresAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-purple-600 p-6 text-center">
            <CheckCircle className="h-12 w-12 text-white mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-white">Téléchargement prêt !</h1>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Instrumental Info */}
            <div className="flex gap-4 mb-6">
              {data.instrumental.cover_image_url ? (
                <img 
                  src={data.instrumental.cover_image_url} 
                  alt={data.instrumental.title}
                  className="w-20 h-20 rounded-xl object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Music className="h-8 w-8 text-primary/40" />
                </div>
              )}
              <div>
                <h2 className="font-bold text-xl text-foreground">{data.instrumental.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {data.instrumental.bpm && `${data.instrumental.bpm} BPM`}
                  {data.instrumental.key && ` • ${data.instrumental.key}`}
                </p>
                <p className="text-sm text-primary mt-1">Licence {data.license.name}</p>
              </div>
            </div>

            {/* Download Button */}
            <Button
              onClick={handleDownload}
              className="w-full h-14 text-lg bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 mb-6"
            >
              <DownloadIcon className="h-5 w-5 mr-2" />
              Télécharger l'instrumental
            </Button>

            {/* Info Box */}
            <div className="bg-muted/50 rounded-xl p-4 text-sm">
              <p className="text-muted-foreground mb-2">
                <strong className="text-foreground">Téléchargements :</strong> {data.downloadCount}
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Expire le :</strong> {expirationDate}
              </p>
            </div>

            {/* License Features */}
            <div className="mt-6">
              <h3 className="font-semibold text-foreground mb-3">Votre licence inclut :</h3>
              <ul className="space-y-2">
                {data.license.features?.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-muted/30 p-4 text-center border-t border-border">
            <p className="text-xs text-muted-foreground">
              En cas de problème, contactez-nous à{" "}
              <a href="mailto:prod.makemusic@gmail.com" className="text-primary hover:underline">
                prod.makemusic@gmail.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Download;
