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
  Undo, Redo, Copy, Scissors, Settings, ZoomIn, ZoomOut,
  Grid3X3, Magnet
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import WaveformDisplay from "@/components/studio/WaveformDisplay";
import VintageKnob from "@/components/studio/VintageKnob";
import AudioClip, { ClipData } from "@/components/studio/AudioClip";
import BPMGrid, { snapTimeToGrid } from "@/components/studio/BPMGrid";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

interface Track {
  id: string;
  name: string;
  type: "instrumental" | "vocal";
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  armed: boolean;
  clips: ClipData[];
  color: string;
  // Effects
  compressor: { threshold: number; ratio: number; attack: number; release: number };
  eq: { low: number; mid: number; high: number };
  reverb: { wet: number; enabled: boolean };
}

interface Instrumental {
  id: string;
  title: string;
  genre?: string;
  bpm?: number;
  drive_file_id: string;
}

const TRACK_HEIGHT = 80;
const DEFAULT_PIXELS_PER_SECOND = 50;

const TRACK_COLORS = [
  "hsl(var(--primary))",
  "hsl(200 70% 50%)",
  "hsl(280 70% 50%)",
  "hsl(340 70% 50%)",
  "hsl(160 70% 50%)",
  "hsl(40 70% 50%)",
  "hsl(100 70% 50%)",
  "hsl(220 70% 50%)",
];

const Studio = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  
  // Transport state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180);
  const [bpm, setBpm] = useState(120);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  
  // Project state
  const [projectName, setProjectName] = useState("Nouveau Projet");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [instrumentals, setInstrumentals] = useState<Instrumental[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<ClipData[]>([]);
  
  // View state
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_PIXELS_PER_SECOND);
  const [snapResolution, setSnapResolution] = useState<"bar" | "beat" | "16th" | "off">("16th");
  const [isSaving, setIsSaving] = useState(false);
  
  // Refs
  const playbackIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const activeSourcesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());

  // Audio recorder
  const handleRecordingComplete = useCallback((audioBuffer: AudioBuffer) => {
    const armedTrack = tracks.find(t => t.armed);
    if (!armedTrack) return;

    const newClip: ClipData = {
      id: `clip-${Date.now()}`,
      startTime: currentTime - audioBuffer.duration,
      duration: audioBuffer.duration,
      audioBuffer,
      offset: 0,
      name: `Recording ${new Date().toLocaleTimeString()}`,
      color: armedTrack.color,
    };

    setTracks(prev => prev.map(track => 
      track.id === armedTrack.id 
        ? { ...track, clips: [...track.clips, newClip] }
        : track
    ));

    toast({
      title: "Enregistrement terminé",
      description: `Clip ajouté à ${armedTrack.name}`,
    });
  }, [tracks, currentTime, toast]);

  const { 
    isRecording, 
    recordingDuration, 
    error: recordingError,
    startRecording, 
    stopRecording 
  } = useAudioRecorder(audioContextRef.current, {
    onRecordingComplete: handleRecordingComplete
  });

  // Initialize audio context and tracks
  useEffect(() => {
    audioContextRef.current = new AudioContext();
    masterGainRef.current = audioContextRef.current.createGain();
    masterGainRef.current.connect(audioContextRef.current.destination);
    
    const initialTracks: Track[] = [
      createTrack("inst-1", "Instrumental 1", "instrumental", TRACK_COLORS[0]),
      createTrack("inst-2", "Instrumental 2", "instrumental", TRACK_COLORS[1]),
      createTrack("vocal-1", "Voix Lead", "vocal", TRACK_COLORS[2]),
      createTrack("vocal-2", "Voix Backing 1", "vocal", TRACK_COLORS[3]),
      createTrack("vocal-3", "Voix Backing 2", "vocal", TRACK_COLORS[4]),
      createTrack("vocal-4", "Ad-libs", "vocal", TRACK_COLORS[5]),
    ];
    setTracks(initialTracks);
    fetchInstrumentals();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const createTrack = (id: string, name: string, type: "instrumental" | "vocal", color: string): Track => ({
    id,
    name,
    type,
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    armed: false,
    clips: [],
    color,
    compressor: { threshold: -20, ratio: 4, attack: 10, release: 100 },
    eq: { low: 0, mid: 0, high: 0 },
    reverb: { wet: 0, enabled: false },
  });

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
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  // Playback controls
  const handlePlay = useCallback(() => {
    if (!audioContextRef.current || !masterGainRef.current) return;
    
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    setIsPlaying(true);
    startTimeRef.current = audioContextRef.current.currentTime - currentTime;

    // Start all clips
    tracks.forEach(track => {
      if (track.muted) return;
      
      track.clips.forEach(clip => {
        if (clip.startTime + clip.duration <= currentTime) return;
        
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = clip.audioBuffer;
        
        const gainNode = audioContextRef.current!.createGain();
        gainNode.gain.value = track.volume;
        
        source.connect(gainNode);
        gainNode.connect(masterGainRef.current!);
        
        const startOffset = Math.max(0, currentTime - clip.startTime) + clip.offset;
        const when = Math.max(0, clip.startTime - currentTime);
        
        source.start(audioContextRef.current!.currentTime + when, startOffset);
        activeSourcesRef.current.set(`${track.id}-${clip.id}`, source);
      });
    });

    playbackIntervalRef.current = window.setInterval(() => {
      if (audioContextRef.current) {
        const newTime = audioContextRef.current.currentTime - startTimeRef.current;
        setCurrentTime(newTime);
        if (newTime >= duration) {
          handleStop();
        }
      }
    }, 50);
  }, [currentTime, duration, tracks]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch {}
    });
    activeSourcesRef.current.clear();

    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }
  }, []);

  const handleStop = useCallback(() => {
    handlePause();
    setCurrentTime(0);
    if (isRecording) {
      stopRecording();
    }
  }, [handlePause, isRecording, stopRecording]);

  const handleRecord = useCallback(async () => {
    const armedTrack = tracks.find(t => t.armed);
    if (!armedTrack) {
      toast({
        title: "Aucune piste armée",
        description: "Armez une piste vocale pour enregistrer (bouton REC)",
        variant: "destructive",
      });
      return;
    }

    if (!isRecording) {
      await startRecording();
      if (!isPlaying) {
        handlePlay();
      }
    } else {
      stopRecording();
    }
  }, [tracks, isRecording, isPlaying, startRecording, stopRecording, handlePlay, toast]);

  // Clip operations
  const snapToGrid = useCallback((time: number) => {
    return snapTimeToGrid(time, bpm, snapResolution);
  }, [bpm, snapResolution]);

  const handleClipSelect = useCallback((clipId: string, addToSelection: boolean) => {
    if (addToSelection) {
      setSelectedClipIds(prev => 
        prev.includes(clipId) ? prev.filter(id => id !== clipId) : [...prev, clipId]
      );
    } else {
      setSelectedClipIds([clipId]);
    }
  }, []);

  const handleClipMove = useCallback((clipId: string, newStartTime: number) => {
    setTracks(prev => prev.map(track => ({
      ...track,
      clips: track.clips.map(clip => 
        clip.id === clipId ? { ...clip, startTime: Math.max(0, newStartTime) } : clip
      )
    })));
  }, []);

  const handleClipResize = useCallback((clipId: string, newDuration: number, newOffset: number) => {
    setTracks(prev => prev.map(track => ({
      ...track,
      clips: track.clips.map(clip => 
        clip.id === clipId ? { ...clip, duration: newDuration, offset: newOffset } : clip
      )
    })));
  }, []);

  const handleClipDelete = useCallback((clipId: string) => {
    setTracks(prev => prev.map(track => ({
      ...track,
      clips: track.clips.filter(clip => clip.id !== clipId)
    })));
    setSelectedClipIds(prev => prev.filter(id => id !== clipId));
  }, []);

  const handleClipDuplicate = useCallback((clipId: string) => {
    setTracks(prev => prev.map(track => {
      const clipToDuplicate = track.clips.find(c => c.id === clipId);
      if (!clipToDuplicate) return track;
      
      const newClip: ClipData = {
        ...clipToDuplicate,
        id: `clip-${Date.now()}`,
        startTime: clipToDuplicate.startTime + clipToDuplicate.duration,
      };
      
      return { ...track, clips: [...track.clips, newClip] };
    }));
  }, []);

  const handleClipCut = useCallback((clipId: string, cutTime: number) => {
    setTracks(prev => prev.map(track => {
      const clipToCut = track.clips.find(c => c.id === clipId);
      if (!clipToCut) return track;
      
      const cutPosition = cutTime - clipToCut.startTime;
      if (cutPosition <= 0 || cutPosition >= clipToCut.duration) return track;
      
      const leftClip: ClipData = {
        ...clipToCut,
        duration: cutPosition,
      };
      
      const rightClip: ClipData = {
        ...clipToCut,
        id: `clip-${Date.now()}`,
        startTime: cutTime,
        duration: clipToCut.duration - cutPosition,
        offset: clipToCut.offset + cutPosition,
      };
      
      return {
        ...track,
        clips: track.clips.filter(c => c.id !== clipId).concat([leftClip, rightClip])
      };
    }));
  }, []);

  const handleCopyClips = useCallback(() => {
    const clipsToCopy: ClipData[] = [];
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (selectedClipIds.includes(clip.id)) {
          clipsToCopy.push(clip);
        }
      });
    });
    setClipboard(clipsToCopy);
    toast({ title: "Copié", description: `${clipsToCopy.length} clip(s)` });
  }, [tracks, selectedClipIds, toast]);

  const handlePasteClips = useCallback(() => {
    if (clipboard.length === 0 || !selectedTrackId) return;
    
    const newClips = clipboard.map(clip => ({
      ...clip,
      id: `clip-${Date.now()}-${Math.random()}`,
      startTime: currentTime,
    }));

    setTracks(prev => prev.map(track => 
      track.id === selectedTrackId 
        ? { ...track, clips: [...track.clips, ...newClips] }
        : track
    ));
    toast({ title: "Collé", description: `${newClips.length} clip(s)` });
  }, [clipboard, selectedTrackId, currentTime, toast]);

  // File handling
  const handleFileUpload = async (trackId: string, file: File) => {
    if (!audioContextRef.current) return;

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

    const newClip: ClipData = {
      id: `clip-${Date.now()}`,
      startTime: currentTime,
      duration: audioBuffer.duration,
      audioBuffer,
      offset: 0,
      name: file.name.replace(/\.[^/.]+$/, ""),
      color: tracks.find(t => t.id === trackId)?.color,
    };

    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, clips: [...track.clips, newClip] } : track
    ));

    setDuration(Math.max(duration, currentTime + audioBuffer.duration + 10));
    toast({ title: "Fichier importé", description: file.name });
  };

  const loadInstrumentalFromCatalog = async (trackId: string, instrumentalId: string) => {
    const instrumental = instrumentals.find(i => i.id === instrumentalId);
    if (!instrumental || !audioContextRef.current) return;

    toast({ title: "Chargement...", description: `"${instrumental.title}"` });

    try {
      const streamUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-instrumental?fileId=${instrumental.drive_file_id}`;
      const response = await fetch(streamUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      const newClip: ClipData = {
        id: `clip-${Date.now()}`,
        startTime: 0,
        duration: audioBuffer.duration,
        audioBuffer,
        offset: 0,
        name: instrumental.title,
        color: tracks.find(t => t.id === trackId)?.color,
      };

      setTracks(prev => prev.map(track => 
        track.id === trackId 
          ? { ...track, clips: [...track.clips, newClip], name: instrumental.title }
          : track
      ));

      if (instrumental.bpm) setBpm(instrumental.bpm);
      setDuration(Math.max(duration, audioBuffer.duration + 10));
      toast({ title: "Chargé", description: instrumental.title });
    } catch (err) {
      toast({ title: "Erreur", description: "Impossible de charger", variant: "destructive" });
    }
  };

  // Track operations
  const updateTrackVolume = (trackId: string, volume: number) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, volume } : track
    ));
  };

  const updateTrackPan = (trackId: string, pan: number) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, pan } : track
    ));
  };

  const toggleMute = (trackId: string) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, muted: !track.muted } : track
    ));
  };

  const toggleSolo = (trackId: string) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, solo: !track.solo } : track
    ));
  };

  const toggleArm = (trackId: string) => {
    setTracks(prev => prev.map(track => ({
      ...track,
      armed: track.id === trackId ? !track.armed : false // Only one track can be armed
    })));
  };

  const updateTrackEffect = (trackId: string, effectType: string, param: string, value: number) => {
    setTracks(prev => prev.map(track => {
      if (track.id !== trackId) return track;
      
      if (effectType === "compressor") {
        return { ...track, compressor: { ...track.compressor, [param]: value } };
      } else if (effectType === "eq") {
        return { ...track, eq: { ...track.eq, [param]: value } };
      } else if (effectType === "reverb") {
        return { ...track, reverb: { ...track.reverb, [param]: value } };
      }
      return track;
    }));
  };

  // Save project
  const saveProject = async () => {
    setIsSaving(true);
    
    // Prepare project data (without AudioBuffers - they can't be serialized)
    const projectData = {
      version: "1.0",
      name: projectName,
      bpm,
      duration,
      savedAt: new Date().toISOString(),
      tracks: tracks.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        volume: t.volume,
        pan: t.pan,
        muted: t.muted,
        color: t.color,
        compressor: t.compressor,
        eq: t.eq,
        reverb: t.reverb,
        clips: t.clips.map(c => ({
          id: c.id,
          startTime: c.startTime,
          duration: c.duration,
          offset: c.offset,
          name: c.name,
          // Note: audioBuffer data would need to be exported separately as audio files
        }))
      })),
    };

    try {
      const { data, error } = await supabase.functions.invoke("save-studio-project", {
        body: {
          projectName,
          projectData,
          userEmail: user?.email,
          userName: user?.user_metadata?.name || user?.email?.split("@")[0],
        }
      });

      if (error) throw error;

      toast({
        title: "Projet sauvegardé",
        description: data.message,
      });
    } catch (err) {
      console.error("Save error:", err);
      // Fallback to localStorage
      localStorage.setItem(`studio_project_${projectName}`, JSON.stringify(projectData));
      toast({
        title: "Sauvegardé localement",
        description: "Connexion Drive indisponible",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Zoom
  const handleZoomIn = () => setPixelsPerSecond(prev => Math.min(200, prev * 1.5));
  const handleZoomOut = () => setPixelsPerSecond(prev => Math.max(10, prev / 1.5));

  // Timeline click to seek
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || isPlaying) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
    const newTime = snapToGrid(clickX / pixelsPerSecond);
    setCurrentTime(Math.max(0, Math.min(duration, newTime)));
  };

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Navbar />
      
      <div className="pt-16 flex flex-col h-screen">
        {/* Header Bar */}
        <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-4 shrink-0">
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="text-lg font-bold bg-transparent border-none w-48 focus-visible:ring-0"
          />
          
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8"><Plus className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={saveProject} disabled={isSaving}>
              <Save className={`h-4 w-4 ${isSaving ? "animate-pulse" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><FolderOpen className="h-4 w-4" /></Button>
            <div className="w-px h-6 bg-zinc-700 mx-2" />
            <Button variant="ghost" size="icon" className="h-8 w-8"><Undo className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Redo className="h-4 w-4" /></Button>
          </div>

          <div className="flex-1" />

          {/* BPM & Metronome */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-zinc-800 rounded-md px-3 py-1">
              <span className="text-xs text-zinc-400">BPM</span>
              <Input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                className="w-16 h-6 text-center bg-transparent border-none p-0 font-mono"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Switch checked={metronomeEnabled} onCheckedChange={setMetronomeEnabled} />
              <span className="text-xs text-zinc-400">Metro</span>
            </div>

            {/* Snap */}
            <Select value={snapResolution} onValueChange={(v: any) => setSnapResolution(v)}>
              <SelectTrigger className="w-24 h-8 bg-zinc-800 border-zinc-700">
                <Magnet className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Mesure</SelectItem>
                <SelectItem value="beat">Temps</SelectItem>
                <SelectItem value="16th">1/16</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SelectContent>
            </Select>

            {/* Zoom */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Transport Bar */}
        <div className="h-16 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-center gap-6 shrink-0">
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setCurrentTime(0)}>
            <SkipBack className="h-5 w-5" />
          </Button>
          
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={handleStop}>
            <Square className="h-5 w-5" />
          </Button>
          
          {isPlaying ? (
            <Button 
              variant="default" 
              size="icon" 
              className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90"
              onClick={handlePause}
            >
              <Pause className="h-7 w-7" />
            </Button>
          ) : (
            <Button 
              variant="default" 
              size="icon" 
              className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90"
              onClick={handlePlay}
            >
              <Play className="h-7 w-7 ml-1" />
            </Button>
          )}
          
          <Button 
            variant={isRecording ? "destructive" : "outline"} 
            size="icon" 
            className="h-10 w-10"
            onClick={handleRecord}
          >
            <Circle className={`h-5 w-5 ${isRecording ? "fill-current animate-pulse" : ""}`} />
          </Button>
          
          {/* Time Display */}
          <div className="font-mono text-2xl text-primary tabular-nums min-w-40 text-center">
            {formatTime(currentTime)}
          </div>

          <div className="flex items-center gap-2 ml-8">
            <Volume2 className="h-4 w-4 text-zinc-400" />
            <Slider
              value={[masterGainRef.current?.gain.value ?? 0.8]}
              max={1}
              step={0.01}
              className="w-24"
              onValueChange={([v]) => {
                if (masterGainRef.current) masterGainRef.current.gain.value = v;
              }}
            />
          </div>

          {recordingError && (
            <span className="text-destructive text-sm">{recordingError}</span>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Track List (Left) */}
          <div className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
            <div className="h-8 bg-zinc-800 border-b border-zinc-700 flex items-center px-2">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">Pistes</span>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className={`border-b border-zinc-800 cursor-pointer transition-colors ${
                    selectedTrackId === track.id ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                  }`}
                  style={{ height: TRACK_HEIGHT }}
                  onClick={() => setSelectedTrackId(track.id)}
                >
                  <div className="p-2 h-full flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: track.color }} />
                        <span className="text-sm font-medium truncate">{track.name}</span>
                      </div>
                      {track.type === "instrumental" ? (
                        <Music className="h-3 w-3 text-zinc-500" />
                      ) : (
                        <Mic className="h-3 w-3 text-zinc-500" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 text-xs ${track.muted ? "bg-destructive/20 text-destructive" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggleMute(track.id); }}
                      >
                        M
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 text-xs ${track.solo ? "bg-amber-500/20 text-amber-500" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggleSolo(track.id); }}
                      >
                        S
                      </Button>
                      {track.type === "vocal" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-6 w-6 text-xs ${track.armed ? "bg-destructive text-white" : ""}`}
                          onClick={(e) => { e.stopPropagation(); toggleArm(track.id); }}
                        >
                          R
                        </Button>
                      )}
                      
                      <Slider
                        value={[track.volume]}
                        max={1}
                        step={0.01}
                        className="flex-1 ml-2"
                        onValueChange={([v]) => updateTrackVolume(track.id, v)}
                      />
                    </div>

                    {track.type === "instrumental" && (
                      <div className="flex gap-1 mt-1">
                        <Select onValueChange={(v) => loadInstrumentalFromCatalog(track.id, v)}>
                          <SelectTrigger className="h-5 text-[10px] flex-1 bg-zinc-700 border-0">
                            <SelectValue placeholder="Catalogue" />
                          </SelectTrigger>
                          <SelectContent>
                            {instrumentals.map((inst) => (
                              <SelectItem key={inst.id} value={inst.id} className="text-xs">
                                {inst.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Label className="h-5 px-2 bg-zinc-700 rounded text-[10px] flex items-center cursor-pointer hover:bg-zinc-600">
                          <Upload className="h-3 w-3" />
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
                </div>
              ))}
            </div>
          </div>

          {/* Timeline (Center) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Timeline Header with BPM Grid */}
            <div className="h-8 bg-zinc-800 border-b border-zinc-700 overflow-hidden">
              <div 
                ref={timelineRef}
                className="h-full overflow-x-auto"
                onClick={handleTimelineClick}
              >
                <BPMGrid
                  bpm={bpm}
                  duration={duration}
                  pixelsPerSecond={pixelsPerSecond}
                  height={32}
                  currentTime={currentTime}
                  className="min-w-full"
                />
              </div>
            </div>

            {/* Track Lanes */}
            <div className="flex-1 overflow-auto bg-zinc-950">
              <div style={{ width: duration * pixelsPerSecond, minWidth: "100%" }}>
                {tracks.map((track) => (
                  <div
                    key={track.id}
                    className={`relative border-b border-zinc-800 ${
                      selectedTrackId === track.id ? "bg-zinc-900/50" : ""
                    }`}
                    style={{ height: TRACK_HEIGHT }}
                    onClick={() => setSelectedTrackId(track.id)}
                  >
                    {/* Grid lines background */}
                    <BPMGrid
                      bpm={bpm}
                      duration={duration}
                      pixelsPerSecond={pixelsPerSecond}
                      height={TRACK_HEIGHT}
                      currentTime={currentTime}
                    />

                    {/* Clips */}
                    {track.clips.map((clip) => (
                      <AudioClip
                        key={clip.id}
                        clip={{ ...clip, color: track.color }}
                        pixelsPerSecond={pixelsPerSecond}
                        trackHeight={TRACK_HEIGHT}
                        isSelected={selectedClipIds.includes(clip.id)}
                        onSelect={handleClipSelect}
                        onMove={handleClipMove}
                        onResize={handleClipResize}
                        onDelete={handleClipDelete}
                        onDuplicate={handleClipDuplicate}
                        onCut={handleClipCut}
                        snapToGrid={snapToGrid}
                      />
                    ))}

                    {/* Recording indicator */}
                    {isRecording && track.armed && (
                      <div 
                        className="absolute top-1 bottom-1 bg-destructive/30 border border-destructive rounded animate-pulse flex items-center justify-center"
                        style={{ 
                          left: currentTime * pixelsPerSecond - recordingDuration * pixelsPerSecond,
                          width: recordingDuration * pixelsPerSecond 
                        }}
                      >
                        <span className="text-destructive text-xs font-bold">● REC</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mixer Panel (Right) */}
          <div className="w-64 bg-zinc-900 border-l border-zinc-800 flex flex-col shrink-0">
            <div className="h-8 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between px-3">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">Mixeur</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyClips}>
                  <Copy className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handlePasteClips}>
                  <Scissors className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {selectedTrack ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ backgroundColor: selectedTrack.color }} />
                    <h3 className="font-medium">{selectedTrack.name}</h3>
                  </div>

                  {/* Volume & Pan Knobs */}
                  <div className="flex justify-center gap-6">
                    <VintageKnob
                      value={selectedTrack.volume * 100}
                      min={0}
                      max={100}
                      onChange={(v) => updateTrackVolume(selectedTrack.id, v / 100)}
                      label="Volume"
                      unit="%"
                      size={56}
                    />
                    <VintageKnob
                      value={selectedTrack.pan}
                      min={-100}
                      max={100}
                      onChange={(v) => updateTrackPan(selectedTrack.id, v)}
                      label="Pan"
                      size={56}
                      color="hsl(200 70% 50%)"
                    />
                  </div>

                  {selectedTrack.type === "vocal" && (
                    <>
                      {/* Compressor */}
                      <div className="space-y-3">
                        <h4 className="text-xs text-zinc-400 uppercase tracking-wider border-b border-zinc-700 pb-1">
                          Compresseur
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <VintageKnob
                            value={selectedTrack.compressor.threshold}
                            min={-60}
                            max={0}
                            onChange={(v) => updateTrackEffect(selectedTrack.id, "compressor", "threshold", v)}
                            label="Seuil"
                            unit="dB"
                            size={44}
                            color="hsl(280 70% 50%)"
                          />
                          <VintageKnob
                            value={selectedTrack.compressor.ratio}
                            min={1}
                            max={20}
                            onChange={(v) => updateTrackEffect(selectedTrack.id, "compressor", "ratio", v)}
                            label="Ratio"
                            unit=":1"
                            size={44}
                            color="hsl(280 70% 50%)"
                          />
                        </div>
                      </div>

                      {/* EQ */}
                      <div className="space-y-3">
                        <h4 className="text-xs text-zinc-400 uppercase tracking-wider border-b border-zinc-700 pb-1">
                          Égaliseur
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                          <VintageKnob
                            value={selectedTrack.eq.low}
                            min={-12}
                            max={12}
                            onChange={(v) => updateTrackEffect(selectedTrack.id, "eq", "low", v)}
                            label="Low"
                            unit="dB"
                            size={40}
                            color="hsl(340 70% 50%)"
                          />
                          <VintageKnob
                            value={selectedTrack.eq.mid}
                            min={-12}
                            max={12}
                            onChange={(v) => updateTrackEffect(selectedTrack.id, "eq", "mid", v)}
                            label="Mid"
                            unit="dB"
                            size={40}
                            color="hsl(40 70% 50%)"
                          />
                          <VintageKnob
                            value={selectedTrack.eq.high}
                            min={-12}
                            max={12}
                            onChange={(v) => updateTrackEffect(selectedTrack.id, "eq", "high", v)}
                            label="High"
                            unit="dB"
                            size={40}
                            color="hsl(160 70% 50%)"
                          />
                        </div>
                      </div>

                      {/* Reverb */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-zinc-700 pb-1">
                          <h4 className="text-xs text-zinc-400 uppercase tracking-wider">Réverb</h4>
                          <Switch
                            checked={selectedTrack.reverb.enabled}
                            onCheckedChange={(v) => updateTrackEffect(selectedTrack.id, "reverb", "enabled", v ? 1 : 0)}
                          />
                        </div>
                        <div className="flex justify-center">
                          <VintageKnob
                            value={selectedTrack.reverb.wet}
                            min={0}
                            max={100}
                            onChange={(v) => updateTrackEffect(selectedTrack.id, "reverb", "wet", v)}
                            label="Mix"
                            unit="%"
                            size={48}
                            color="hsl(200 70% 50%)"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center text-zinc-500 text-sm mt-8">
                  Sélectionnez une piste
                </div>
              )}
            </div>

            {/* Export */}
            <div className="p-4 border-t border-zinc-800">
              <Button 
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!tracks.some(t => t.clips.length > 0)}
              >
                Exporter le mix
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Studio;
