import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Play, Pause, Square, Circle, SkipBack, Volume2, VolumeX, 
  Plus, Trash2, Music, Mic, Upload, Save, FolderOpen, 
  Undo, Redo, Copy, Scissors, Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";

interface Track {
  id: string;
  name: string;
  type: "instrumental" | "vocal";
  volume: number;
  muted: boolean;
  armed: boolean;
  audioBuffer: AudioBuffer | null;
  audioSource: AudioBufferSourceNode | null;
  gainNode: GainNode | null;
  clips: Clip[];
  instrumentalId?: string;
  isExternal: boolean;
}

interface Clip {
  id: string;
  startTime: number;
  duration: number;
  audioBuffer: AudioBuffer;
  offset: number;
}

interface Instrumental {
  id: string;
  title: string;
  genre?: string;
  bpm?: number;
  drive_file_id: string;
}

const Studio = () => {
  const { toast } = useToast();
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(300); // 5 minutes default
  const [bpm, setBpm] = useState(120);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [projectName, setProjectName] = useState("Nouveau Projet");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [instrumentals, setInstrumentals] = useState<Instrumental[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const playbackIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new AudioContext();
    masterGainRef.current = audioContextRef.current.createGain();
    masterGainRef.current.connect(audioContextRef.current.destination);
    
    // Initialize with 2 instrumental tracks and 6 vocal tracks
    const initialTracks: Track[] = [
      { id: "inst-1", name: "Instrumental 1", type: "instrumental", volume: 0.8, muted: false, armed: false, audioBuffer: null, audioSource: null, gainNode: null, clips: [], isExternal: false },
      { id: "inst-2", name: "Instrumental 2", type: "instrumental", volume: 0.8, muted: false, armed: false, audioBuffer: null, audioSource: null, gainNode: null, clips: [], isExternal: false },
      { id: "vocal-1", name: "Voix 1", type: "vocal", volume: 0.8, muted: false, armed: false, audioBuffer: null, audioSource: null, gainNode: null, clips: [], isExternal: true },
      { id: "vocal-2", name: "Voix 2", type: "vocal", volume: 0.8, muted: false, armed: false, audioBuffer: null, audioSource: null, gainNode: null, clips: [], isExternal: true },
      { id: "vocal-3", name: "Voix 3", type: "vocal", volume: 0.8, muted: false, armed: false, audioBuffer: null, audioSource: null, gainNode: null, clips: [], isExternal: true },
      { id: "vocal-4", name: "Voix 4", type: "vocal", volume: 0.8, muted: false, armed: false, audioBuffer: null, audioSource: null, gainNode: null, clips: [], isExternal: true },
      { id: "vocal-5", name: "Voix 5", type: "vocal", volume: 0.8, muted: false, armed: false, audioBuffer: null, audioSource: null, gainNode: null, clips: [], isExternal: true },
      { id: "vocal-6", name: "Voix 6", type: "vocal", volume: 0.8, muted: false, armed: false, audioBuffer: null, audioSource: null, gainNode: null, clips: [], isExternal: true },
    ];
    setTracks(initialTracks);

    // Fetch instrumentals
    fetchInstrumentals();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const fetchInstrumentals = async () => {
    const { data, error } = await supabase
      .from("instrumentals")
      .select("id, title, genre, bpm, drive_file_id")
      .eq("is_active", true);

    if (!error && data) {
      setInstrumentals(data);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlay = () => {
    if (!audioContextRef.current) return;
    
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    setIsPlaying(true);
    startTimeRef.current = audioContextRef.current.currentTime - currentTime;

    // Start all tracks
    tracks.forEach(track => {
      if (!track.muted && track.audioBuffer) {
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = track.audioBuffer;
        
        const gainNode = audioContextRef.current!.createGain();
        gainNode.gain.value = track.volume;
        
        source.connect(gainNode);
        gainNode.connect(masterGainRef.current!);
        
        source.start(0, currentTime);
        
        setTracks(prev => prev.map(t => 
          t.id === track.id ? { ...t, audioSource: source, gainNode } : t
        ));
      }
    });

    // Update playback time
    playbackIntervalRef.current = window.setInterval(() => {
      if (audioContextRef.current) {
        const newTime = audioContextRef.current.currentTime - startTimeRef.current;
        setCurrentTime(newTime);
        if (newTime >= duration) {
          handleStop();
        }
      }
    }, 100);
  };

  const handlePause = () => {
    setIsPlaying(false);
    
    tracks.forEach(track => {
      if (track.audioSource) {
        track.audioSource.stop();
      }
    });

    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }
  };

  const handleStop = () => {
    handlePause();
    setCurrentTime(0);
    setIsRecording(false);
  };

  const handleRewind = () => {
    setCurrentTime(0);
  };

  const handleRecord = () => {
    if (!isRecording) {
      setIsRecording(true);
      if (!isPlaying) {
        handlePlay();
      }
      toast({
        title: "Enregistrement démarré",
        description: "Parlez dans votre microphone...",
      });
    } else {
      setIsRecording(false);
      toast({
        title: "Enregistrement arrêté",
      });
    }
  };

  const updateTrackVolume = (trackId: string, volume: number) => {
    setTracks(prev => prev.map(track => {
      if (track.id === trackId) {
        if (track.gainNode) {
          track.gainNode.gain.value = volume;
        }
        return { ...track, volume };
      }
      return track;
    }));
  };

  const toggleMute = (trackId: string) => {
    setTracks(prev => prev.map(track => {
      if (track.id === trackId) {
        const newMuted = !track.muted;
        if (track.gainNode) {
          track.gainNode.gain.value = newMuted ? 0 : track.volume;
        }
        return { ...track, muted: newMuted };
      }
      return track;
    }));
  };

  const toggleArm = (trackId: string) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, armed: !track.armed } : track
    ));
  };

  const handleFileUpload = async (trackId: string, file: File) => {
    if (!audioContextRef.current) return;

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, audioBuffer, isExternal: true } : track
    ));

    setDuration(Math.max(duration, audioBuffer.duration));

    toast({
      title: "Fichier importé",
      description: `${file.name} ajouté à la piste.`,
    });
  };

  const loadInstrumentalFromCatalog = async (trackId: string, instrumentalId: string) => {
    const instrumental = instrumentals.find(i => i.id === instrumentalId);
    if (!instrumental || !audioContextRef.current) return;

    toast({
      title: "Chargement...",
      description: `Chargement de "${instrumental.title}"...`,
    });

    try {
      const streamUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-instrumental?fileId=${instrumental.drive_file_id}`;
      const response = await fetch(streamUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      setTracks(prev => prev.map(track => 
        track.id === trackId ? { 
          ...track, 
          audioBuffer, 
          instrumentalId, 
          isExternal: false,
          name: instrumental.title 
        } : track
      ));

      if (instrumental.bpm) {
        setBpm(instrumental.bpm);
      }

      setDuration(Math.max(duration, audioBuffer.duration));

      toast({
        title: "Instrumental chargé",
        description: `"${instrumental.title}" prêt à jouer.`,
      });
    } catch (err) {
      console.error("Error loading instrumental:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'instrumental.",
        variant: "destructive",
      });
    }
  };

  const saveProject = () => {
    const projectData = {
      name: projectName,
      bpm,
      tracks: tracks.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        volume: t.volume,
        muted: t.muted,
        instrumentalId: t.instrumentalId,
        isExternal: t.isExternal,
      })),
    };
    localStorage.setItem(`studio_project_${projectName}`, JSON.stringify(projectData));
    toast({
      title: "Projet sauvegardé",
      description: `"${projectName}" sauvegardé localement.`,
    });
  };

  const hasExternalInstrumental = tracks.some(t => t.type === "instrumental" && t.isExternal && t.audioBuffer);
  const hasCatalogInstrumental = tracks.some(t => t.type === "instrumental" && !t.isExternal && t.audioBuffer);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 pt-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="text-xl font-bold bg-transparent border-none focus:ring-0 w-64"
            />
            <Button variant="ghost" size="icon" title="Nouveau projet">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={saveProject} title="Sauvegarder">
              <Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Charger">
              <FolderOpen className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Annuler">
              <Undo className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Refaire">
              <Redo className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">BPM:</Label>
              <Input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                className="w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={metronomeEnabled}
                onCheckedChange={setMetronomeEnabled}
              />
              <Label className="text-sm">Métronome</Label>
            </div>
          </div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center justify-center gap-4 mb-6 p-4 bg-card rounded-xl border border-border">
          <Button variant="ghost" size="icon" onClick={handleRewind}>
            <SkipBack className="h-5 w-5" />
          </Button>
          
          <Button variant="ghost" size="icon" onClick={handleStop}>
            <Square className="h-5 w-5" />
          </Button>
          
          {isPlaying ? (
            <Button variant="hero" size="icon" onClick={handlePause}>
              <Pause className="h-6 w-6" />
            </Button>
          ) : (
            <Button variant="hero" size="icon" onClick={handlePlay}>
              <Play className="h-6 w-6" />
            </Button>
          )}
          
          <Button 
            variant={isRecording ? "destructive" : "outline"} 
            size="icon" 
            onClick={handleRecord}
          >
            <Circle className={`h-5 w-5 ${isRecording ? "fill-current animate-pulse" : ""}`} />
          </Button>
          
          <div className="ml-4 font-mono text-2xl text-primary">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
          
          <div className="ml-auto flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[masterGainRef.current?.gain.value || 0.8]}
              max={1}
              step={0.01}
              className="w-32"
              onValueChange={([v]) => {
                if (masterGainRef.current) {
                  masterGainRef.current.gain.value = v;
                }
              }}
            />
          </div>
        </div>

        {/* Main Content - Timeline & Mixer */}
        <div className="flex gap-4">
          {/* Timeline (75%) */}
          <div className="flex-1 space-y-2">
            {/* Timeline Header/Grid */}
            <div className="h-8 bg-card rounded-t-xl border border-border flex items-center px-4">
              <div className="w-48 shrink-0 text-sm font-medium text-muted-foreground">Pistes</div>
              <div className="flex-1 relative">
                {/* Time markers */}
                {Array.from({ length: Math.ceil(duration / 30) + 1 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full border-l border-border/50 text-xs text-muted-foreground"
                    style={{ left: `${(i * 30 / duration) * 100}%` }}
                  >
                    <span className="ml-1">{formatTime(i * 30)}</span>
                  </div>
                ))}
                {/* Playhead */}
                <div
                  className="absolute top-0 w-0.5 h-full bg-primary z-10"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                />
              </div>
            </div>

            {/* Tracks */}
            {tracks.map((track) => (
              <div
                key={track.id}
                className={`flex items-stretch bg-card rounded-lg border ${
                  selectedTrackId === track.id ? "border-primary" : "border-border"
                } ${track.type === "instrumental" ? "bg-primary/5" : "bg-secondary/5"}`}
                onClick={() => setSelectedTrackId(track.id)}
              >
                {/* Track Controls */}
                <div className="w-48 shrink-0 p-3 border-r border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">{track.name}</span>
                    {track.type === "instrumental" ? (
                      <Music className="h-4 w-4 text-primary" />
                    ) : (
                      <Mic className="h-4 w-4 text-accent" />
                    )}
                  </div>
                  
                  {/* Volume & Mute */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); toggleMute(track.id); }}
                    >
                      {track.muted ? (
                        <VolumeX className="h-3 w-3 text-destructive" />
                      ) : (
                        <Volume2 className="h-3 w-3" />
                      )}
                    </Button>
                    <Slider
                      value={[track.volume]}
                      max={1}
                      step={0.01}
                      className="flex-1"
                      onValueChange={([v]) => updateTrackVolume(track.id, v)}
                    />
                  </div>

                  {/* Arm for Recording (Vocal tracks only) */}
                  {track.type === "vocal" && (
                    <Button
                      variant={track.armed ? "destructive" : "outline"}
                      size="sm"
                      className="w-full text-xs"
                      onClick={(e) => { e.stopPropagation(); toggleArm(track.id); }}
                    >
                      <Circle className={`h-3 w-3 mr-1 ${track.armed ? "fill-current" : ""}`} />
                      REC
                    </Button>
                  )}

                  {/* Import / Catalog Select (Instrumental tracks) */}
                  {track.type === "instrumental" && (
                    <div className="space-y-2">
                      <Select
                        value={track.instrumentalId || ""}
                        onValueChange={(value) => loadInstrumentalFromCatalog(track.id, value)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Catalogue..." />
                        </SelectTrigger>
                        <SelectContent>
                          {instrumentals.map((inst) => (
                            <SelectItem key={inst.id} value={inst.id}>
                              {inst.title} {inst.bpm && `(${inst.bpm} BPM)`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Label className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary">
                        <Upload className="h-3 w-3" />
                        Importer
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(track.id, file);
                          }}
                        />
                      </Label>
                    </div>
                  )}
                </div>

                {/* Track Timeline */}
                <div className="flex-1 h-20 relative bg-background/50">
                  {/* Waveform placeholder */}
                  {track.audioBuffer && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-12 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 rounded mx-2" />
                    </div>
                  )}
                  
                  {/* Recording indicator */}
                  {isRecording && track.armed && (
                    <div className="absolute inset-0 bg-destructive/10 animate-pulse flex items-center justify-center">
                      <span className="text-destructive text-sm font-medium">● REC</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Mixer Panel (25%) */}
          <div className="w-72 bg-card rounded-xl border border-border p-4 space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Mixeur
            </h3>

            {selectedTrackId && tracks.find(t => t.id === selectedTrackId)?.type === "vocal" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Compresseur</Label>
                  <div className="space-y-2 mt-2">
                    <div>
                      <Label className="text-xs">Seuil</Label>
                      <Slider defaultValue={[-20]} min={-60} max={0} step={1} />
                    </div>
                    <div>
                      <Label className="text-xs">Ratio</Label>
                      <Slider defaultValue={[4]} min={1} max={20} step={0.1} />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Égaliseur</Label>
                  <div className="space-y-2 mt-2">
                    <div>
                      <Label className="text-xs">Basses</Label>
                      <Slider defaultValue={[0]} min={-12} max={12} step={0.5} />
                    </div>
                    <div>
                      <Label className="text-xs">Médiums</Label>
                      <Slider defaultValue={[0]} min={-12} max={12} step={0.5} />
                    </div>
                    <div>
                      <Label className="text-xs">Aigus</Label>
                      <Slider defaultValue={[0]} min={-12} max={12} step={0.5} />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-muted-foreground">Réverbération</Label>
                    <Switch />
                  </div>
                  <div>
                    <Label className="text-xs">Mix</Label>
                    <Slider defaultValue={[30]} min={0} max={100} step={1} />
                  </div>
                </div>
              </div>
            )}

            {!selectedTrackId && (
              <p className="text-sm text-muted-foreground">
                Sélectionnez une piste vocale pour accéder aux effets.
              </p>
            )}

            {/* Export Section */}
            <div className="pt-4 border-t border-border">
              <Button 
                className="w-full" 
                variant="hero"
                disabled={!tracks.some(t => t.audioBuffer)}
              >
                Exporter le mix
              </Button>
              
              {hasCatalogInstrumental && (
                <p className="text-xs text-amber-500 mt-2">
                  ⚠️ Instrumental du catalogue détecté. L'achat de la licence sera requis pour l'export final.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Studio;
