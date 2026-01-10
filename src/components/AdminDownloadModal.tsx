import { useState } from "react";
import { Download, Music, Folder, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Instrumental {
  id: string;
  title: string;
  cover_image_url?: string;
  has_stems?: boolean;
  drive_file_id?: string;
  stems_folder_id?: string;
}

interface AdminDownloadModalProps {
  instrumental: Instrumental | null;
  isOpen: boolean;
  onClose: () => void;
}

const AdminDownloadModal = ({ instrumental, isOpen, onClose }: AdminDownloadModalProps) => {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<'instrumental' | 'stems' | null>(null);

  const handleDownload = async (type: 'instrumental' | 'stems') => {
    if (!instrumental) return;
    
    setDownloading(type);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erreur",
          description: "Session expirée, veuillez vous reconnecter.",
          variant: "destructive",
        });
        return;
      }

      const response = await supabase.functions.invoke('admin-download-instrumental', {
        body: { 
          instrumentalId: instrumental.id,
          downloadType: type
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { downloadUrl, fileName, accessToken, isFolderLink } = response.data;

      if (isFolderLink) {
        // For stems folder, open in new tab
        window.open(downloadUrl, '_blank');
        toast({
          title: "Dossier Stems ouvert",
          description: "Le dossier des stems s'est ouvert dans un nouvel onglet.",
        });
      } else {
        // For direct file download, fetch with access token
        const fileResponse = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!fileResponse.ok) {
          throw new Error('Failed to download file');
        }

        const blob = await fileResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Téléchargement réussi",
          description: `${fileName} a été téléchargé.`,
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Erreur de téléchargement",
        description: "Impossible de télécharger le fichier.",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  if (!instrumental) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Téléchargement Admin
          </DialogTitle>
          <DialogDescription>
            Téléchargez gratuitement l'instrumental et/ou les stems.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Instrumental Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            {instrumental.cover_image_url ? (
              <img 
                src={instrumental.cover_image_url} 
                alt={instrumental.title}
                className="w-12 h-12 rounded-md object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-md bg-primary/20 flex items-center justify-center">
                <Music className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <h4 className="font-semibold text-foreground">{instrumental.title}</h4>
              <p className="text-sm text-muted-foreground">
                {instrumental.has_stems ? "Instrumental + Stems disponibles" : "Instrumental uniquement"}
              </p>
            </div>
          </div>

          {/* Download Options */}
          <div className="space-y-3">
            {/* Download Instrumental */}
            <Button
              onClick={() => handleDownload('instrumental')}
              disabled={downloading !== null}
              className="w-full justify-start gap-3 h-14 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
            >
              {downloading === 'instrumental' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              <div className="text-left">
                <div className="font-semibold">Télécharger l'Instrumental</div>
                <div className="text-xs opacity-80">Fichier audio complet (MP3/WAV)</div>
              </div>
            </Button>

            {/* Download Stems */}
            {instrumental.has_stems && (
              <Button
                onClick={() => handleDownload('stems')}
                disabled={downloading !== null}
                variant="outline"
                className="w-full justify-start gap-3 h-14 border-purple-500/50 hover:bg-purple-500/10"
              >
                {downloading === 'stems' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Folder className="h-5 w-5 text-purple-500" />
                )}
                <div className="text-left flex-1">
                  <div className="font-semibold">Télécharger les Stems</div>
                  <div className="text-xs text-muted-foreground">Pistes séparées (dossier Google Drive)</div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>

          {/* Info */}
          <p className="text-xs text-muted-foreground text-center mt-4">
            ⚡ Téléchargement gratuit réservé aux administrateurs
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminDownloadModal;
