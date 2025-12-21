import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Music, GripVertical, Play, Pause, Loader2, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";

interface Instrumental {
  id: string;
  title: string;
  drive_file_id: string;
  bpm: number | null;
  key: string | null;
  genre: string | null;
  cover_image_url: string | null;
}

interface PreloadedAudio {
  id: string;
  audioBuffer: ArrayBuffer | null;
  audioUrl: string | null;
  loading: boolean;
  error: string | null;
}

const InstrumentalsSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [instrumentals, setInstrumentals] = useState<Instrumental[]>([]);
  const [loading, setLoading] = useState(true);
  const [preloadedAudios, setPreloadedAudios] = useState<Record<string, PreloadedAudio>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchInstrumentals();
  }, []);

  useEffect(() => {
    // Cleanup audio URLs on unmount
    return () => {
      Object.values(preloadedAudios).forEach((audio) => {
        if (audio.audioUrl) {
          URL.revokeObjectURL(audio.audioUrl);
        }
      });
    };
  }, []);

  const fetchInstrumentals = async () => {
    try {
      const { data, error } = await supabase
        .from("instrumentals")
        .select("id, title, drive_file_id, bpm, key, genre, cover_image_url")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Filter out instrumentals with "ppp" in the title
      const filteredData = (data || []).filter(
        (inst) => !inst.title.toLowerCase().includes("ppp")
      );
      
      setInstrumentals(filteredData);
    } catch (error) {
      console.error("Error fetching instrumentals:", error);
    } finally {
      setLoading(false);
    }
  };

  const preloadAudio = async (instrumental: Instrumental) => {
    if (preloadedAudios[instrumental.id]?.audioUrl || preloadedAudios[instrumental.id]?.loading) {
      return;
    }

    setPreloadedAudios((prev) => ({
      ...prev,
      [instrumental.id]: { id: instrumental.id, audioBuffer: null, audioUrl: null, loading: true, error: null },
    }));

    try {
      const { data: { publicUrl } } = supabase.functions.invoke
        ? { data: { publicUrl: '' } }
        : { data: { publicUrl: '' } };

      const streamUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-instrumental?fileId=${instrumental.drive_file_id}`;
      
      const response = await fetch(streamUrl, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch audio");
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(blob);

      setPreloadedAudios((prev) => ({
        ...prev,
        [instrumental.id]: { id: instrumental.id, audioBuffer: arrayBuffer, audioUrl, loading: false, error: null },
      }));
    } catch (error) {
      console.error("Error preloading audio:", error);
      setPreloadedAudios((prev) => ({
        ...prev,
        [instrumental.id]: { 
          id: instrumental.id, 
          audioBuffer: null, 
          audioUrl: null, 
          loading: false, 
          error: error instanceof Error ? error.message : "Error" 
        },
      }));
    }
  };

  const togglePlay = (instrumental: Instrumental) => {
    const preloaded = preloadedAudios[instrumental.id];
    
    if (!preloaded?.audioUrl) {
      preloadAudio(instrumental);
      return;
    }

    if (playingId === instrumental.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(preloaded.audioUrl);
      audioRef.current.volume = volume;
      audioRef.current.play();
      audioRef.current.onended = () => setPlayingId(null);
      setPlayingId(instrumental.id);
    }
  };

  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, instrumental: Instrumental) => {
    const preloaded = preloadedAudios[instrumental.id];
    const audioUrl = preloaded?.audioUrl || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-instrumental?fileId=${instrumental.drive_file_id}`;
    
    // Format pour le DAW
    const audioData = { 
      url: audioUrl, 
      name: instrumental.title 
    };
    
    // Type MIME personnalisé pour le DAW + texte brut pour compatibilité
    e.dataTransfer.setData("application/daw-audio", JSON.stringify(audioData));
    e.dataTransfer.setData("text/plain", audioUrl);
    e.dataTransfer.effectAllowed = "copy";
    
    setDraggingId(instrumental.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed top-1/2 -translate-y-1/2 z-50 bg-primary text-primary-foreground p-2 rounded-r-lg shadow-lg transition-all duration-300 hover:bg-primary/90",
          isOpen ? "left-80" : "left-0"
        )}
      >
        {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>

      {/* Sidebar Panel */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-80 bg-card/95 backdrop-blur-md border-r border-border shadow-2xl z-40 transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2">
              <Music className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">Instrumentaux</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Glissez-déposez dans le DAW
            </p>
          </div>

          {/* Volume Control */}
          <div className="p-4 border-b border-border flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={1}
              step={0.01}
              className="flex-1"
            />
          </div>

          {/* Instrumentals List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : instrumentals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Aucun instrumental disponible</p>
                </div>
              ) : (
                instrumentals.map((instrumental) => {
                  const preloaded = preloadedAudios[instrumental.id];
                  const isPlaying = playingId === instrumental.id;
                  const isLoaded = preloaded?.audioUrl !== null && preloaded?.audioUrl !== undefined;
                  const isLoading = preloaded?.loading;

                    return (
                    <div
                      key={instrumental.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, instrumental)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "group relative bg-background/80 rounded-lg border border-border p-3 transition-all hover:border-primary/50 hover:shadow-md cursor-grab active:cursor-grabbing",
                        draggingId === instrumental.id && "opacity-50 scale-95"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Drag Handle */}
                        {isLoaded && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}

                        {/* Play/Load Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => togglePlay(instrumental)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : isPlaying ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{instrumental.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            {instrumental.bpm && <span>{instrumental.bpm} BPM</span>}
                            {instrumental.key && <span>• {instrumental.key}</span>}
                            {instrumental.genre && <span>• {instrumental.genre}</span>}
                          </div>
                          
                          {/* Status */}
                          <div className="mt-2">
                            {isLoading && (
                              <span className="text-xs text-amber-500">Chargement...</span>
                            )}
                            {preloaded?.error && (
                              <span className="text-xs text-destructive">{preloaded.error}</span>
                            )}
                            {isLoaded && !isLoading && (
                              <span className="text-xs text-green-500">Prêt</span>
                            )}
                            {!isLoaded && !isLoading && !preloaded?.error && (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs"
                                onClick={() => preloadAudio(instrumental)}
                              >
                                Cliquez pour charger
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Footer Info */}
          <div className="p-3 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground text-center">
              {instrumentals.length} instrumental{instrumentals.length !== 1 ? "s" : ""} disponible{instrumentals.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default InstrumentalsSidebar;
