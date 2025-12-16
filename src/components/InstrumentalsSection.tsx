import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Music, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import InstrumentalCard from "./InstrumentalCard";
import LicenseSelector from "./LicenseSelector";
import AudioPlayer from "./AudioPlayer";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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
}

// Helper to get audio URL from Google Drive file ID via streaming proxy
const getDriveAudioUrl = (fileId: string) => {
  return `https://aafjeezfrmxssehnpwct.supabase.co/functions/v1/stream-instrumental?fileId=${fileId}`;
};

const InstrumentalsSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [instrumentals, setInstrumentals] = useState<Instrumental[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlaying, setCurrentPlaying] = useState<Instrumental | null>(null);
  const [selectedInstrumental, setSelectedInstrumental] = useState<Instrumental | null>(null);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);

  useEffect(() => {
    const fetchInstrumentals = async () => {
      const { data, error } = await supabase
        .from("instrumentals")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(4);

      if (!error && data) {
        setInstrumentals(data);
      }
      setLoading(false);
    };

    fetchInstrumentals();
  }, []);

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

  if (loading) {
    return (
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </div>
      </section>
    );
  }

  if (instrumentals.length === 0) {
    return null; // Don't show section if no instrumentals
  }

  return (
    <section id="instrumentals" className="py-20 px-4 bg-gradient-to-b from-background to-background/50">
      <div className="container mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <Music className="h-4 w-4" />
            <span className="text-sm font-medium">Beats & Instrumentaux</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Trouvez Votre Son
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Des productions originales prêtes à l'emploi. Écoutez, choisissez et créez votre prochain hit.
          </p>
        </div>

        {/* Current Playing Player */}
        {currentPlaying && getAudioSrc(currentPlaying) && (
          <div className="mb-8 max-w-2xl mx-auto">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {instrumentals.map((instrumental) => (
            <InstrumentalCard
              key={instrumental.id}
              instrumental={instrumental}
              onPlay={handlePlay}
              onBuy={handleBuy}
              isPlaying={currentPlaying?.id === instrumental.id}
            />
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/instrumentals")}
            className="group"
          >
            Voir tous les instrumentaux
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
      </div>
    </section>
  );
};

export default InstrumentalsSection;
