import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/useAdmin";
import { 
  Play, 
  Pause, 
  Download, 
  Music, 
  Loader2, 
  ShoppingCart,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Edit2,
  Check,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Beat {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  size: number;
  previewUrl: string;
  downloadUrl: string;
  webViewLink: string;
  createdTime: string;
  price: number;
}

interface PurchasedBeat {
  beatId: string;
  purchasedAt: string;
}

const BeatStore = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [purchasedBeats, setPurchasedBeats] = useState<string[]>([]);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState("");

  // Load beats from Google Drive
  useEffect(() => {
    const fetchBeats = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("list-beats");
        
        if (error) throw error;
        
        // Load custom prices from localStorage (admin)
        const savedPrices = localStorage.getItem("beatstore_prices");
        if (savedPrices) {
          const prices = JSON.parse(savedPrices);
          setCustomPrices(prices);
          
          // Apply custom prices to beats
          const beatsWithPrices = (data.beats || []).map((beat: Beat) => ({
            ...beat,
            price: prices[beat.id] || beat.price,
          }));
          setBeats(beatsWithPrices);
        } else {
          setBeats(data.beats || []);
        }

        // Load purchased beats from localStorage
        const savedPurchases = localStorage.getItem("beatstore_purchases");
        if (savedPurchases) {
          setPurchasedBeats(JSON.parse(savedPurchases));
        }
      } catch (err) {
        console.error("Failed to fetch beats:", err);
        toast({
          title: "Erreur",
          description: "Impossible de charger les instrumentales",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBeats();
  }, [toast]);

  // Audio progress tracking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Volume control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handlePlay = (beatId: string, audioUrl: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentlyPlaying === beatId && isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (currentlyPlaying !== beatId) {
        audio.src = audioUrl;
        setCurrentlyPlaying(beatId);
        setProgress(0);
      }
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
  };

  const handlePurchase = (beat: Beat) => {
    // Revolut personnal link uses amount in cents, so multiply by 100
    const revolutAmount = beat.price * 100;
    const paypalUrl = `https://www.paypal.com/paypalme/makemusic/${beat.price}EUR`;
    const revolutUrl = `https://revolut.me/makemusic/${revolutAmount}`;
    
    const markAsPurchased = () => {
      const newPurchases = [...purchasedBeats, beat.id];
      setPurchasedBeats(newPurchases);
      localStorage.setItem("beatstore_purchases", JSON.stringify(newPurchases));
    };
    
    // Show payment options
    toast({
      title: `Acheter "${beat.name}"`,
      description: (
        <div className="flex flex-col gap-2 mt-2">
          <p className="text-sm">Prix: {beat.price}€</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => window.open(paypalUrl, "_blank")}>
              PayPal
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(revolutUrl, "_blank")}>
              Revolut
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="mt-1 self-start"
            onClick={markAsPurchased}
          >
            J'ai payé, débloquer le téléchargement
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            Après paiement, cliquez sur "J'ai payé" pour activer le bouton de téléchargement.
          </p>
        </div>
      ) as unknown as string,
    });
  };

  const handleDownload = (beat: Beat) => {
    window.open(beat.downloadUrl, "_blank");
  };

  const handleAdminUnlock = (beatId: string) => {
    const newPurchases = [...purchasedBeats, beatId];
    setPurchasedBeats(newPurchases);
    localStorage.setItem("beatstore_purchases", JSON.stringify(newPurchases));
    toast({
      title: "Téléchargement débloqué",
      description: "L'utilisateur peut maintenant télécharger cette instru",
    });
  };

  const handlePriceEdit = (beatId: string, currentPrice: number) => {
    setEditingPrice(beatId);
    setTempPrice(currentPrice.toString());
  };

  const handlePriceSave = (beatId: string) => {
    const newPrice = parseFloat(tempPrice) || 50;
    const newPrices = { ...customPrices, [beatId]: newPrice };
    setCustomPrices(newPrices);
    localStorage.setItem("beatstore_prices", JSON.stringify(newPrices));
    
    setBeats(beats.map(b => b.id === beatId ? { ...b, price: newPrice } : b));
    setEditingPrice(null);
    
    toast({
      title: "Prix mis à jour",
      description: `Nouveau prix: ${newPrice}€`,
    });
  };

  const handlePriceCancel = () => {
    setEditingPrice(null);
    setTempPrice("");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isPurchased = (beatId: string) => purchasedBeats.includes(beatId);

  return (
    <section id="beats" className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1 rounded-full border border-accent/30 bg-accent/5 text-accent text-sm font-medium mb-4">
            BEAT STORE
          </span>
          <h2 className="font-display text-5xl md:text-7xl text-foreground mb-4">
            Nos <span className="text-primary text-glow-cyan">Instrumentales</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Découvrez notre catalogue d'instrumentales exclusives prêtes à l'emploi
          </p>
        </div>

        {/* Hidden audio element */}
        <audio ref={audioRef} preload="metadata" />

        {/* Player bar (visible when playing) */}
        {currentlyPlaying && (
          <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-primary/30 p-4 z-50">
            <div className="container mx-auto flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    const beat = beats.find(b => b.id === currentlyPlaying);
                    if (beat) handlePlay(beat.id, beat.previewUrl);
                  }}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </Button>
              </div>

              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-1">
                  {beats.find(b => b.id === currentlyPlaying)?.name}
                </p>
                <div 
                  className="h-1 bg-secondary rounded-full cursor-pointer"
                  onClick={handleSeek}
                >
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 accent-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Beats grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Chargement des instrumentales...</span>
          </div>
        ) : beats.length === 0 ? (
          <div className="text-center py-16">
            <Music className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune instrumentale disponible pour le moment</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {beats.map((beat) => (
              <div
                key={beat.id}
                className={cn(
                  "group relative p-6 rounded-2xl transition-all duration-300",
                  "bg-card border border-border hover:border-primary/50 hover:box-glow-cyan",
                  currentlyPlaying === beat.id && "border-primary/50 box-glow-cyan"
                )}
              >
                {/* Play overlay */}
                <div 
                  className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl cursor-pointer"
                  onClick={() => handlePlay(beat.id, beat.previewUrl)}
                >
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                    {currentlyPlaying === beat.id && isPlaying ? (
                      <Pause className="w-8 h-8 text-primary-foreground" />
                    ) : (
                      <Play className="w-8 h-8 text-primary-foreground ml-1" />
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-display text-xl text-foreground mb-1 truncate">
                        {beat.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(beat.size)}
                      </p>
                    </div>
                    
                    {/* Price */}
                    <div className="text-right">
                      {isAdmin && editingPrice === beat.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={tempPrice}
                            onChange={(e) => setTempPrice(e.target.value)}
                            className="w-16 h-8 text-sm"
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handlePriceSave(beat.id)}>
                            <Check className="w-4 h-4 text-green-500" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handlePriceCancel}>
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-display text-2xl text-accent text-glow-gold">
                            {beat.price}€
                          </span>
                          {isAdmin && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6"
                              onClick={() => handlePriceEdit(beat.id, beat.price)}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar if playing */}
                  {currentlyPlaying === beat.id && (
                    <div className="h-1 bg-secondary rounded-full mb-4">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {isPurchased(beat.id) || isAdmin ? (
                      <Button 
                        className="flex-1" 
                        variant="hero"
                        onClick={() => handleDownload(beat)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Télécharger
                      </Button>
                    ) : (
                      <Button 
                        className="flex-1" 
                        variant="neon"
                        onClick={() => handlePurchase(beat)}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Acheter
                      </Button>
                    )}

                    {isAdmin && !isPurchased(beat.id) && (
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleAdminUnlock(beat.id)}
                        title="Débloquer le téléchargement"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Spacer for fixed player */}
        {currentlyPlaying && <div className="h-24" />}
      </div>
    </section>
  );
};

export default BeatStore;
