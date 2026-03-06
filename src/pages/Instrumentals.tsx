import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Music, Search, AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import InstrumentalCard from "@/components/InstrumentalCard";
import LicenseSelector from "@/components/LicenseSelector";
import AudioPlayer from "@/components/AudioPlayer";
import QuickNavigation from "@/components/QuickNavigation";
import AdminDownloadModal from "@/components/AdminDownloadModal";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

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
  price_base?: number;
  price_stems?: number;
  price_exclusive?: number;
  has_stems?: boolean;
  stems_folder_id?: string;
}

// Helper to get audio URL from Google Drive file ID via streaming proxy
const getDriveAudioUrl = (fileId: string) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/stream-instrumental?fileId=${fileId}`;
};

const Instrumentals = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [instrumentals, setInstrumentals] = useState<Instrumental[]>([]);
  const [filteredInstrumentals, setFilteredInstrumentals] = useState<Instrumental[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [currentPlaying, setCurrentPlaying] = useState<Instrumental | null>(null);
  const [selectedInstrumental, setSelectedInstrumental] = useState<Instrumental | null>(null);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [adminDownloadInstrumental, setAdminDownloadInstrumental] = useState<Instrumental | null>(null);
  const [isAdminDownloadModalOpen, setIsAdminDownloadModalOpen] = useState(false);

  useEffect(() => {
    const fetchInstrumentals = async () => {
      // Essayer avec sort_order d'abord, sinon fallback sur created_at
      let { data, error } = await supabase
        .from("instrumentals")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false });

      // Si erreur (colonne sort_order n'existe pas), fallback sur created_at
      if (error) {
        const fallback = await supabase
          .from("instrumentals")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (!error && data) {
        setInstrumentals(data);
        setFilteredInstrumentals(data);
        
        // Extract unique genres
        const uniqueGenres = [...new Set(data.map(i => i.genre).filter(Boolean))] as string[];
        setGenres(uniqueGenres);
      }
      setLoading(false);
    };

    fetchInstrumentals();
  }, []);

  useEffect(() => {
    let filtered = instrumentals;

    if (searchQuery) {
      filtered = filtered.filter(i => 
        i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.genre?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedGenre) {
      filtered = filtered.filter(i => i.genre === selectedGenre);
    }

    setFilteredInstrumentals(filtered);
  }, [searchQuery, selectedGenre, instrumentals]);

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
        title: t("instrumentals.login_required"),
        description: t("instrumentals.login_required_desc"),
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-24 pb-20 px-4">
        <div className="container mx-auto">
          {/* Quick Navigation */}
          <QuickNavigation />

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <Music className="h-4 w-4" />
              <span className="text-sm font-medium">{t("instrumentals.badge")}</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
              {t("instrumentals.title")}
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg mb-6">
              {t("instrumentals.description")}
            </p>
            
            {/* DAW Button */}
            <Button 
              onClick={() => navigate('/daw')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 max-w-full"
              size="lg"
            >
              <AudioLines className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">{t("instrumentals.daw_button")}</span>
              <span className="sm:hidden">{t("instrumentals.daw_button_mobile")}</span>
            </Button>
          </div>

          {/* Search & Filters */}
          <div className="max-w-3xl mx-auto mb-10">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("instrumentals.search_placeholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Genre Filters */}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge
                  variant={selectedGenre === null ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedGenre(null)}
                >
                  {t("instrumentals.all")}
                </Badge>
                {genres.map((genre) => (
                  <Badge
                    key={genre}
                    variant={selectedGenre === genre ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedGenre(genre)}
                  >
                    {genre}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Current Playing Player */}
          {currentPlaying && getAudioSrc(currentPlaying) && (
            <div className="mb-8 max-w-2xl mx-auto sticky top-20 z-40">
              <AudioPlayer
                src={getAudioSrc(currentPlaying)!}
                title={currentPlaying.title}
                artist="Make Music"
                coverImage={currentPlaying.cover_image_url}
                autoPlay
                onEnded={() => setCurrentPlaying(null)}
                isAuthenticated={!!user}
                onPreviewEnded={() => {
                  toast({
                    title: t("instrumentals.preview_limit_title", "Aperçu limité"),
                    description: t("instrumentals.preview_limit_desc", "Créez un compte gratuit pour écouter en entier"),
                  });
                }}
              />
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredInstrumentals.length === 0 ? (
            <div className="text-center py-20">
              <Music className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {t("instrumentals.no_results_title")}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery || selectedGenre 
                  ? t("instrumentals.no_results_filter")
                  : t("instrumentals.no_results_empty")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredInstrumentals.map((instrumental) => (
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
          )}
        </div>
      </main>

      <Footer />

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
  );
};

export default Instrumentals;
