import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Music, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import InstrumentalCard from "./InstrumentalCard";
import LicenseSelector from "./LicenseSelector";
import AudioPlayer from "./AudioPlayer";
import AdminDownloadModal from "./AdminDownloadModal";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";

interface Instrumental {
  id: string;
  title: string;
  description?: string;
  genre?: string;
  bpm?: number;
  key?: string;
  preview_url?: string;
  cover_image_url?: string;
  drive_file_id?: string;
  has_stems?: boolean;
  stems_folder_id?: string;
}

// Helper to get audio URL from Google Drive file ID via streaming proxy
const getDriveAudioUrl = (fileId: string) => {
  return `https://aafjeezfrmxssehnpwct.supabase.co/functions/v1/stream-instrumental?fileId=${fileId}`;
};

const InstrumentalsSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const { isMobileView } = useViewMode();

  const [instrumentals, setInstrumentals] = useState<Instrumental[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlaying, setCurrentPlaying] = useState<Instrumental | null>(null);
  const [selectedInstrumental, setSelectedInstrumental] = useState<Instrumental | null>(null);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [adminDownloadInstrumental, setAdminDownloadInstrumental] = useState<Instrumental | null>(null);
  const [isAdminDownloadModalOpen, setIsAdminDownloadModalOpen] = useState(false);

  useEffect(() => {
    const fetchInstrumentals = async () => {
      const { data, error } = await supabase
        .from("instrumentals")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(isMobileView ? 2 : 4);

      if (!error && data) {
        setInstrumentals(data);
      }
      setLoading(false);
    };

    fetchInstrumentals();
  }, [isMobileView]);

  // Get the audio source URL for an instrumental
  const getAudioSrc = (instrumental: Instrumental): string | null => {
    if (instrumental.preview_url) return instrumental.preview_url;
    if (instrumental.drive_file_id) return getDriveAudioUrl(instrumental.drive_file_id);
    return null;
  };

  const handlePlay = (instrumental: Instrumental) => {
    if (currentPlaying?.id === instrumental.id) {
      setCurrentPlaying(null);
    } else {
      setCurrentPlaying(instrumental);
    }
  };

  const handleBuy = (instrumental: Instrumental) => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Veuillez vous connecter pour acheter un instrumental.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    setSelectedInstrumental(instrumental);
    setIsLicenseModalOpen(true);
  };

  const handleSelectLicense = (license: any) => {
    setIsLicenseModalOpen(false);
    navigate(`/checkout/instrumental/${selectedInstrumental?.id}/${license.id}`);
  };

  const handleAdminDownload = (instrumental: Instrumental) => {
    setAdminDownloadInstrumental(instrumental);
    setIsAdminDownloadModalOpen(true);
  };

  if (loading) {
    return (
      <section className={cn("px-4", isMobileView ? "py-10" : "py-20")}>
        <div className="container mx-auto">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </div>
      </section>
    );
  }

  if (instrumentals.length === 0) {
    return null;
  }

  return (
    <section id="instrumentals" className={cn(
      "px-4 bg-gradient-to-b from-background to-background/50",
      isMobileView ? "py-10" : "py-20"
    )}>
      <div className="container mx-auto">
        {/* Header */}
        <div className={cn("text-center", isMobileView ? "mb-6" : "mb-12")}>
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary mb-3",
            isMobileView && "text-xs"
          )}>
            <Music className={cn(isMobileView ? "h-3 w-3" : "h-4 w-4")} />
            <span className="font-medium">Beats & Instrumentaux</span>
          </div>
          <h2 className={cn(
            "font-bold text-foreground mb-2",
            isMobileView ? "text-2xl" : "text-4xl md:text-5xl mb-4"
          )}>
            Trouvez Votre Son
          </h2>
          <p className={cn(
            "text-muted-foreground max-w-2xl mx-auto",
            isMobileView ? "text-sm" : "text-base"
          )}>
            {isMobileView 
              ? "Productions originales prêtes à l'emploi."
              : "Des productions originales prêtes à l'emploi. Écoutez, choisissez et créez votre prochain hit."
            }
          </p>
        </div>

        {/* Current Playing Player */}
        {currentPlaying && getAudioSrc(currentPlaying) && (
          <div className={cn("mx-auto", isMobileView ? "mb-4" : "mb-8 max-w-2xl")}>
            <AudioPlayer
              src={getAudioSrc(currentPlaying)!}
              title={currentPlaying.title}
              artist="Make Music"
              coverImage={currentPlaying.cover_image_url}
              autoPlay
              onEnded={() => setCurrentPlaying(null)}
            />
          </div>
        )}

        {/* Grid */}
        <div className={cn(
          "grid gap-4",
          isMobileView ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10"
        )}>
          {instrumentals.map((instrumental) => (
            <InstrumentalCard
              key={instrumental.id}
              instrumental={instrumental}
              onPlay={handlePlay}
              onBuy={handleBuy}
              onAdminDownload={isAdmin ? handleAdminDownload : undefined}
              isPlaying={currentPlaying?.id === instrumental.id}
              isAdmin={isAdmin}
            />
          ))}
        </div>

        {/* View All Button */}
        <div className={cn("text-center", isMobileView ? "mt-4" : "mt-10")}>
          <Button
            variant="outline"
            size={isMobileView ? "default" : "lg"}
            onClick={() => navigate("/instrumentals")}
            className="group"
          >
            {isMobileView ? "Voir tout" : "Voir tous les instrumentaux"}
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>

        {/* License Selector Modal */}
        <LicenseSelector
          instrumental={selectedInstrumental}
          isOpen={isLicenseModalOpen}
          onClose={() => setIsLicenseModalOpen(false)}
          onSelectLicense={handleSelectLicense}
        />

        {/* Admin Download Modal */}
        <AdminDownloadModal
          instrumental={adminDownloadInstrumental}
          isOpen={isAdminDownloadModalOpen}
          onClose={() => setIsAdminDownloadModalOpen(false)}
        />
      </div>
    </section>
  );
};

export default InstrumentalsSection;
