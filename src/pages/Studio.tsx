import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Play, Pause, Square, SkipBack, Volume2, 
  Plus, Trash2, Music, Mic, Upload, Save, FolderOpen, 
  Undo, Redo, Copy, Scissors, ZoomIn, ZoomOut,
  Magnet, Download, CopyPlus, Loader2, Headphones, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import ChatBot from "@/components/ChatBot";
import WaveformDisplay from "@/components/studio/WaveformDisplay";
import VintageKnob from "@/components/studio/VintageKnob";
import VUMeter from "@/components/studio/VUMeter";
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

interface HistoryState {
  tracks: Track[];
  currentTime: number;
}

const TRACK_HEIGHT = 80;
const DEFAULT_PIXELS_PER_SECOND = 50;
const MAX_TRACKS = 20;

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
  const metronomeGainRef = useRef<GainNode | null>(null);
  const metronomeIntervalRef = useRef<number | null>(null);
  
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
  const [trackLevels, setTrackLevels] = useState<Map<string, { level: number; peak: number }>>(new Map());
  const [masterLevel, setMasterLevel] = useState({ level: 0, peak: 0 });
  
  // History for undo/redo
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoingRef = useRef(false);
  
  // View state
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_PIXELS_PER_SECOND);
  const [snapResolution, setSnapResolution] = useState<"bar" | "beat" | "16th" | "off">("16th");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [savedProjects, setSavedProjects] = useState<{name: string, id: string, folderId?: string}[]>([]);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showHeadphoneTip, setShowHeadphoneTip] = useState(true);
  
  // Refs
  const playbackIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const recordStartTimeRef = useRef<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const activeSourcesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const analyserNodesRef = useRef<Map<string, AnalyserNode>>(new Map());
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  const peakHoldTimeoutsRef = useRef<Map<string, number>>(new Map());

  // Save history state
  const saveHistory = useCallback(() => {
    if (isUndoingRef.current) return;
    
    const state: HistoryState = {
      tracks: JSON.parse(JSON.stringify(tracks.map(t => ({
        ...t,
        clips: t.clips.map(c => ({ ...c, audioBuffer: undefined }))
      })))),
      currentTime,
    };
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(state);
      if (newHistory.length > 50) newHistory.shift(); // Limit history size
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [tracks, currentTime, historyIndex]);

  // Audio recorder
  const handleRecordingComplete = useCallback((audioBuffer: AudioBuffer) => {
    const armedTrack = tracks.find(t => t.armed);
    if (!armedTrack) return;

    const recordStartTime = recordStartTimeRef.current;
    
    const newClip: ClipData = {
      id: `clip-${Date.now()}`,
      startTime: recordStartTime,
      duration: audioBuffer.duration,
      audioBuffer,
      offset: 0,
      originalDuration: audioBuffer.duration,
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
    
    saveHistory();
  }, [tracks, toast, saveHistory]);

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
    
    // Create master analyser
    masterAnalyserRef.current = audioContextRef.current.createAnalyser();
    masterAnalyserRef.current.fftSize = 256;
    masterGainRef.current.connect(masterAnalyserRef.current);
    
    metronomeGainRef.current = audioContextRef.current.createGain();
    metronomeGainRef.current.gain.value = 0.3;
    metronomeGainRef.current.connect(audioContextRef.current.destination);
    
    const initialTracks: Track[] = [
      createTrack("inst-1", "Instrumental 1", "instrumental", TRACK_COLORS[0]),
      createTrack("inst-2", "Instrumental 2", "instrumental", TRACK_COLORS[1]),
      createTrack("vocal-1", "Voix Lead", "vocal", TRACK_COLORS[2]),
      createTrack("vocal-2", "Voix Backing 1", "vocal", TRACK_COLORS[3]),
      createTrack("vocal-3", "Voix Backing 2", "vocal", TRACK_COLORS[4]),
      createTrack("vocal-4", "Ad-libs", "vocal", TRACK_COLORS[5]),
      createTrack("master", "Master", "instrumental", "hsl(0 0% 60%)"),
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

  // Metronome
  const playMetronomeTick = useCallback((isAccent: boolean = false) => {
    if (!audioContextRef.current || !metronomeGainRef.current) return;
    
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.type = "sine";
    oscillator.frequency.value = isAccent ? 1000 : 800;
    
    gainNode.gain.setValueAtTime(0.5, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.05);
    
    oscillator.connect(gainNode);
    gainNode.connect(metronomeGainRef.current);
    
    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + 0.05);
  }, []);

  // Start metronome
  const startMetronome = useCallback(() => {
    if (!metronomeEnabled || metronomeIntervalRef.current) return;
    
    const beatDuration = 60000 / bpm;
    let beatCount = 0;
    
    const tick = () => {
      playMetronomeTick(beatCount % 4 === 0);
      beatCount++;
    };
    
    tick(); // First tick immediately
    metronomeIntervalRef.current = window.setInterval(tick, beatDuration);
  }, [bpm, metronomeEnabled, playMetronomeTick]);

  const stopMetronome = useCallback(() => {
    if (metronomeIntervalRef.current) {
      clearInterval(metronomeIntervalRef.current);
      metronomeIntervalRef.current = null;
    }
  }, []);

  // Playback controls
  const handlePlay = useCallback(() => {
    if (!audioContextRef.current || !masterGainRef.current) return;
    
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    setIsPlaying(true);
    startTimeRef.current = audioContextRef.current.currentTime - currentTime;

    // Create analysers for each track
    const trackAnalysers = new Map<string, AnalyserNode>();
    
    // Start all clips (skip master track)
    tracks.filter(t => t.id !== "master").forEach(track => {
      if (track.muted) return;
      
      // Create analyser for this track
      const analyser = audioContextRef.current!.createAnalyser();
      analyser.fftSize = 256;
      trackAnalysers.set(track.id, analyser);
      
      track.clips.forEach(clip => {
        if (clip.startTime + clip.duration <= currentTime) return;
        if (!clip.audioBuffer) return;
        
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = clip.audioBuffer;
        
        const gainNode = audioContextRef.current!.createGain();
        gainNode.gain.value = track.volume;
        
        source.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(masterGainRef.current!);
        
        const startOffset = Math.max(0, currentTime - clip.startTime) + clip.offset;
        const when = Math.max(0, clip.startTime - currentTime);
        
        source.start(audioContextRef.current!.currentTime + when, startOffset);
        activeSourcesRef.current.set(`${track.id}-${clip.id}`, source);
      });
    });
    
    analyserNodesRef.current = trackAnalysers;

    // Start metronome if enabled
    if (metronomeEnabled) {
      startMetronome();
    }

    // Level metering interval
    playbackIntervalRef.current = window.setInterval(() => {
      if (audioContextRef.current) {
        const newTime = audioContextRef.current.currentTime - startTimeRef.current;
        setCurrentTime(newTime);
        if (newTime >= duration) {
          handleStop();
          return;
        }
        
        // Update track levels
        const newLevels = new Map<string, { level: number; peak: number }>();
        analyserNodesRef.current.forEach((analyser, trackId) => {
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const normalized = avg / 255;
          
          const currentPeak = trackLevels.get(trackId)?.peak || 0;
          const newPeak = Math.max(normalized, currentPeak * 0.95);
          
          newLevels.set(trackId, { level: normalized, peak: newPeak });
        });
        setTrackLevels(newLevels);
        
        // Update master level
        if (masterAnalyserRef.current) {
          const dataArray = new Uint8Array(masterAnalyserRef.current.frequencyBinCount);
          masterAnalyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const normalized = avg / 255;
          setMasterLevel(prev => ({
            level: normalized,
            peak: Math.max(normalized, prev.peak * 0.95)
          }));
        }
      }
    }, 50);
  }, [currentTime, duration, tracks, metronomeEnabled, startMetronome, trackLevels]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    stopMetronome();
    
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch {}
    });
    activeSourcesRef.current.clear();
    analyserNodesRef.current.clear();

    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }
    
    // Reset levels
    setTrackLevels(new Map());
    setMasterLevel({ level: 0, peak: 0 });
  }, [stopMetronome]);

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
        description: "Cliquez sur le bouton rouge d'une piste vocale pour l'armer",
        variant: "destructive",
      });
      return;
    }

    if (!isRecording) {
      recordStartTimeRef.current = currentTime;
      await startRecording();
      if (!isPlaying) {
        handlePlay();
      }
    } else {
      stopRecording();
    }
  }, [tracks, isRecording, isPlaying, currentTime, startRecording, stopRecording, handlePlay, toast]);

  // Undo/Redo
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    
    isUndoingRef.current = true;
    const prevState = history[historyIndex - 1];
    
    // Restore tracks with audio buffers from current state
    const restoredTracks = prevState.tracks.map(track => {
      const currentTrack = tracks.find(t => t.id === track.id);
      return {
        ...track,
        clips: track.clips.map(clip => {
          const currentClip = currentTrack?.clips.find(c => c.id === clip.id);
          return { ...clip, audioBuffer: currentClip?.audioBuffer };
        })
      };
    });
    
    setTracks(restoredTracks as Track[]);
    setHistoryIndex(prev => prev - 1);
    
    toast({ title: "Annulé" });
    setTimeout(() => { isUndoingRef.current = false; }, 100);
  }, [history, historyIndex, tracks, toast]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    
    isUndoingRef.current = true;
    const nextState = history[historyIndex + 1];
    
    const restoredTracks = nextState.tracks.map(track => {
      const currentTrack = tracks.find(t => t.id === track.id);
      return {
        ...track,
        clips: track.clips.map(clip => {
          const currentClip = currentTrack?.clips.find(c => c.id === clip.id);
          return { ...clip, audioBuffer: currentClip?.audioBuffer };
        })
      };
    });
    
    setTracks(restoredTracks as Track[]);
    setHistoryIndex(prev => prev + 1);
    
    toast({ title: "Rétabli" });
    setTimeout(() => { isUndoingRef.current = false; }, 100);
  }, [history, historyIndex, tracks, toast]);

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

  const handleClipMoveToTrack = useCallback((clipId: string, newTrackId: string) => {
    let movedClip: ClipData | null = null;
    
    setTracks(prev => {
      // First find and remove the clip
      const newTracks = prev.map(track => {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip) {
          movedClip = clip;
          return { ...track, clips: track.clips.filter(c => c.id !== clipId) };
        }
        return track;
      });
      
      // Then add it to the new track
      if (movedClip) {
        return newTracks.map(track => 
          track.id === newTrackId 
            ? { ...track, clips: [...track.clips, { ...movedClip!, color: track.color }] }
            : track
        );
      }
      
      return newTracks;
    });
    
    saveHistory();
  }, [saveHistory]);

  const handleClipResize = useCallback((clipId: string, newDuration: number, newOffset: number) => {
    setTracks(prev => prev.map(track => ({
      ...track,
      clips: track.clips.map(clip => {
        if (clip.id !== clipId) return clip;
        
        // Allow extending back to original audio limits
        const originalDuration = clip.originalDuration || clip.audioBuffer?.duration || clip.duration;
        const maxOffset = Math.max(0, newOffset);
        const maxDuration = originalDuration - maxOffset;
        
        return { 
          ...clip, 
          duration: Math.min(newDuration, maxDuration), 
          offset: maxOffset 
        };
      })
    })));
  }, []);

  const handleClipDelete = useCallback((clipId: string) => {
    saveHistory();
    setTracks(prev => prev.map(track => ({
      ...track,
      clips: track.clips.filter(clip => clip.id !== clipId)
    })));
    setSelectedClipIds(prev => prev.filter(id => id !== clipId));
  }, [saveHistory]);

  const handleClipDuplicate = useCallback((clipId: string) => {
    saveHistory();
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
  }, [saveHistory]);

  const handleClipCut = useCallback((clipId: string, cutTime: number) => {
    saveHistory();
    setTracks(prev => prev.map(track => {
      const clipToCut = track.clips.find(c => c.id === clipId);
      if (!clipToCut) return track;
      
      const cutPosition = cutTime - clipToCut.startTime;
      if (cutPosition <= 0 || cutPosition >= clipToCut.duration) return track;
      
      const originalDuration = clipToCut.originalDuration || clipToCut.audioBuffer?.duration || clipToCut.duration;
      
      const leftClip: ClipData = {
        ...clipToCut,
        duration: cutPosition,
        originalDuration,
      };
      
      const rightClip: ClipData = {
        ...clipToCut,
        id: `clip-${Date.now()}`,
        startTime: cutTime,
        duration: clipToCut.duration - cutPosition,
        offset: clipToCut.offset + cutPosition,
        originalDuration,
      };
      
      return {
        ...track,
        clips: track.clips.filter(c => c.id !== clipId).concat([leftClip, rightClip])
      };
    }));
  }, [saveHistory]);

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
    
    saveHistory();
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
  }, [clipboard, selectedTrackId, currentTime, toast, saveHistory]);

  // File handling
  const handleFileUpload = async (trackId: string, file: File) => {
    if (!audioContextRef.current) return;

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

    saveHistory();
    
    const newClip: ClipData = {
      id: `clip-${Date.now()}`,
      startTime: currentTime,
      duration: audioBuffer.duration,
      audioBuffer,
      offset: 0,
      originalDuration: audioBuffer.duration,
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

      saveHistory();
      
      const newClip: ClipData = {
        id: `clip-${Date.now()}`,
        startTime: 0,
        duration: audioBuffer.duration,
        audioBuffer,
        offset: 0,
        originalDuration: audioBuffer.duration,
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
  const addTrack = useCallback((type: "instrumental" | "vocal") => {
    if (tracks.length >= MAX_TRACKS) {
      toast({ title: "Maximum atteint", description: `Maximum ${MAX_TRACKS} pistes`, variant: "destructive" });
      return;
    }
    
    saveHistory();
    const newTrack = createTrack(
      `track-${Date.now()}`,
      type === "instrumental" ? `Instrumental ${tracks.filter(t => t.type === "instrumental").length + 1}` : `Voix ${tracks.filter(t => t.type === "vocal").length + 1}`,
      type,
      TRACK_COLORS[tracks.length % TRACK_COLORS.length]
    );
    setTracks(prev => [...prev, newTrack]);
  }, [tracks, toast, saveHistory]);

  const duplicateTrack = useCallback((trackId: string) => {
    if (tracks.length >= MAX_TRACKS) {
      toast({ title: "Maximum atteint", description: `Maximum ${MAX_TRACKS} pistes`, variant: "destructive" });
      return;
    }
    
    const trackToDuplicate = tracks.find(t => t.id === trackId);
    if (!trackToDuplicate) return;
    
    saveHistory();
    const newTrack: Track = {
      ...trackToDuplicate,
      id: `track-${Date.now()}`,
      name: `${trackToDuplicate.name} (copie)`,
      clips: trackToDuplicate.clips.map(clip => ({
        ...clip,
        id: `clip-${Date.now()}-${Math.random()}`,
      })),
    };
    
    setTracks(prev => [...prev, newTrack]);
    toast({ title: "Piste dupliquée" });
  }, [tracks, toast, saveHistory]);

  const deleteTrack = useCallback((trackId: string) => {
    if (tracks.length <= 1) return;
    saveHistory();
    setTracks(prev => prev.filter(t => t.id !== trackId));
    if (selectedTrackId === trackId) setSelectedTrackId(null);
  }, [tracks, selectedTrackId, saveHistory]);

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
          originalDuration: c.originalDuration,
        }))
      })),
    };

    try {
      const { data, error } = await supabase.functions.invoke("save-studio-project", {
        body: {
          projectName,
          projectData,
          userEmail: user?.email,
          userName: user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0],
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

  // Load project list from Drive
  const loadProjectList = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("save-studio-project", {
        body: {
          action: "list",
          userEmail: user?.email,
          userName: user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0],
        }
      });
      
      if (!error && data?.projects) {
        setSavedProjects(data.projects);
        setShowLoadDialog(true);
      } else {
        // Load from localStorage as fallback
        const localProjects: {name: string, id: string}[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("studio_project_")) {
            localProjects.push({ name: key.replace("studio_project_", ""), id: key });
          }
        }
        setSavedProjects(localProjects);
        if (localProjects.length > 0) {
          setShowLoadDialog(true);
        } else {
          toast({ title: "Aucun projet", description: "Aucun projet sauvegardé trouvé" });
        }
      }
    } catch (err) {
      console.error("Load list error:", err);
      toast({ title: "Erreur", description: "Impossible de charger les projets", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Load a specific project
  const loadProject = async (project: {name: string, id: string, folderId?: string}) => {
    setIsLoading(true);
    setShowLoadDialog(false);
    
    try {
      // Check if it's a local project
      if (project.id.startsWith("studio_project_")) {
        const savedData = localStorage.getItem(project.id);
        if (savedData) {
          const projectData = JSON.parse(savedData);
          applyProjectData(projectData);
          toast({ title: "Projet chargé", description: project.name });
        }
      } else {
        // Load from Drive
        const { data, error } = await supabase.functions.invoke("save-studio-project", {
          body: {
            action: "load",
            projectFolderId: project.folderId || project.id,
            userEmail: user?.email,
            userName: user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0],
          }
        });
        
        if (!error && data?.projectData) {
          applyProjectData(data.projectData);
          toast({ title: "Projet chargé", description: project.name });
        } else {
          throw new Error("Projet non trouvé");
        }
      }
    } catch (err) {
      console.error("Load project error:", err);
      toast({ title: "Erreur", description: "Impossible de charger le projet", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Apply loaded project data
  const applyProjectData = (projectData: any) => {
    if (projectData.name) setProjectName(projectData.name);
    if (projectData.bpm) setBpm(projectData.bpm);
    if (projectData.duration) setDuration(projectData.duration);
    
    if (projectData.tracks) {
      const loadedTracks: Track[] = projectData.tracks.map((t: any, index: number) => ({
        ...createTrack(t.id || `track-${Date.now()}-${index}`, t.name, t.type, t.color || TRACK_COLORS[index % TRACK_COLORS.length]),
        volume: t.volume ?? 0.8,
        pan: t.pan ?? 0,
        muted: t.muted ?? false,
        compressor: t.compressor || { threshold: -20, ratio: 4, attack: 10, release: 100 },
        eq: t.eq || { low: 0, mid: 0, high: 0 },
        reverb: t.reverb || { wet: 0, enabled: false },
        clips: (t.clips || []).map((c: any) => ({
          ...c,
          audioBuffer: undefined, // Audio data can't be saved, needs to be reimported
        })),
      }));
      setTracks(loadedTracks);
    }
    
    setHistory([]);
    setHistoryIndex(-1);
  };

  // Export mix
  const exportMix = async () => {
    if (!audioContextRef.current) return;
    
    const hasClips = tracks.some(t => t.clips.length > 0);
    if (!hasClips) {
      toast({ title: "Rien à exporter", variant: "destructive" });
      return;
    }
    
    setIsExporting(true);
    toast({ title: "Export en cours...", description: "Veuillez patienter" });
    
    try {
      // Find the total duration needed
      let maxEndTime = 0;
      tracks.forEach(track => {
        track.clips.forEach(clip => {
          const endTime = clip.startTime + clip.duration;
          if (endTime > maxEndTime) maxEndTime = endTime;
        });
      });
      
      // Create offline context for rendering
      const offlineContext = new OfflineAudioContext(2, Math.ceil(maxEndTime * 44100), 44100);
      
      // Schedule all clips
      tracks.forEach(track => {
        if (track.muted) return;
        
        track.clips.forEach(clip => {
          if (!clip.audioBuffer) return;
          
          const source = offlineContext.createBufferSource();
          source.buffer = clip.audioBuffer;
          
          const gainNode = offlineContext.createGain();
          gainNode.gain.value = track.volume;
          
          source.connect(gainNode);
          gainNode.connect(offlineContext.destination);
          
          source.start(clip.startTime, clip.offset, clip.duration);
        });
      });
      
      // Render
      const renderedBuffer = await offlineContext.startRendering();
      
      // Convert to WAV
      const wavBlob = audioBufferToWav(renderedBuffer);
      
      // Download
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ title: "Export terminé!", description: `${projectName}.wav` });
    } catch (err) {
      console.error("Export error:", err);
      toast({ title: "Erreur d'export", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Helper: Convert AudioBuffer to WAV
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const dataLength = buffer.length * blockAlign;
    const headerLength = 44;
    const totalLength = headerLength + dataLength;
    
    const arrayBuffer = new ArrayBuffer(totalLength);
    const view = new DataView(arrayBuffer);
    
    // Write WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
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
      <ChatBot />
      
      <div className="pt-16 flex flex-col h-screen">
        {/* Headphone Tip Alert */}
        {showHeadphoneTip && (
          <Alert className="mx-4 mt-2 bg-amber-500/10 border-amber-500/30 text-amber-200">
            <Headphones className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                <strong>Conseil :</strong> Pour éviter la latence lors de l'enregistrement, utilisez des écouteurs filaires plutôt que Bluetooth.
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setShowHeadphoneTip(false)}>
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Header Bar */}
        <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-4 shrink-0">
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="text-lg font-bold bg-transparent border-none w-48 focus-visible:ring-0"
          />
          
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => addTrack("vocal")}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={saveProject} disabled={isSaving}>
              <Save className={`h-4 w-4 ${isSaving ? "animate-pulse" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadProjectList} disabled={isLoading}>
              <FolderOpen className={`h-4 w-4 ${isLoading ? "animate-pulse" : ""}`} />
            </Button>
            <div className="w-px h-6 bg-zinc-700 mx-2" />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={handleUndo}
              disabled={historyIndex <= 0}
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
            >
              <Redo className="h-4 w-4" />
            </Button>
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
            <div className={`h-5 w-5 rounded-full ${isRecording ? "bg-white animate-pulse" : "bg-destructive"}`} />
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
            <div className="h-8 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between px-2">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">Pistes ({tracks.length}/{MAX_TRACKS})</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => addTrack("vocal")}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {tracks.map((track) => {
                const isMaster = track.id === "master";
                const levels = trackLevels.get(track.id) || { level: 0, peak: 0 };
                
                return (
                  <div
                    key={track.id}
                    className={`border-b border-zinc-800 cursor-pointer transition-colors ${
                      selectedTrackId === track.id ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                    } ${isMaster ? "bg-zinc-800/70" : ""}`}
                    style={{ height: isMaster ? TRACK_HEIGHT + 20 : TRACK_HEIGHT }}
                    onClick={() => setSelectedTrackId(track.id)}
                  >
                    <div className="p-2 h-full flex gap-2">
                      {/* VU Meter */}
                      <VUMeter 
                        level={isMaster ? masterLevel.level : levels.level} 
                        peak={isMaster ? masterLevel.peak : levels.peak}
                        height={isMaster ? TRACK_HEIGHT : TRACK_HEIGHT - 16}
                        width={20}
                      />
                      
                      <div className="flex-1 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: track.color }} />
                            <span className={`text-sm font-medium truncate ${isMaster ? "text-primary" : ""}`}>
                              {track.name}
                            </span>
                          </div>
                          {!isMaster && (
                            <div className="flex items-center gap-1">
                              {track.type === "instrumental" ? (
                                <Music className="h-3 w-3 text-zinc-500" />
                              ) : (
                                <Mic className="h-3 w-3 text-zinc-500" />
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={(e) => { e.stopPropagation(); duplicateTrack(track.id); }}
                              >
                                <CopyPlus className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-destructive/70 hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); deleteTrack(track.id); }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {!isMaster && (
                            <>
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
                                <button
                                  className={`h-6 w-6 rounded-full flex items-center justify-center transition-colors ${
                                    track.armed ? "bg-destructive" : "bg-zinc-600 hover:bg-zinc-500"
                                  }`}
                                  onClick={(e) => { e.stopPropagation(); toggleArm(track.id); }}
                                >
                                  <div className={`h-3 w-3 rounded-full ${track.armed ? "bg-white animate-pulse" : "bg-destructive/50"}`} />
                                </button>
                              )}
                            </>
                          )}
                          
                          <Slider
                            value={[track.volume]}
                            max={1}
                            step={0.01}
                            className="flex-1 ml-2"
                            onValueChange={([v]) => updateTrackVolume(track.id, v)}
                          />
                        </div>

                        {!isMaster && track.type === "instrumental" && (
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
                  </div>
                );
              })}
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
                {tracks.map((track) => {
                  const isMaster = track.id === "master";
                  
                  return (
                    <div
                      key={track.id}
                      className={`relative border-b border-zinc-800 ${
                        selectedTrackId === track.id ? "bg-zinc-900/50" : ""
                      } ${isMaster ? "bg-zinc-800/30" : ""}`}
                      style={{ height: isMaster ? TRACK_HEIGHT + 20 : TRACK_HEIGHT }}
                      onClick={() => setSelectedTrackId(track.id)}
                      onDragOver={(e) => {
                        if (!isMaster) {
                          e.preventDefault();
                          e.currentTarget.classList.add("bg-primary/10");
                        }
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove("bg-primary/10");
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove("bg-primary/10");
                        if (isMaster) return;
                        
                        const clipId = e.dataTransfer.getData("clipId");
                        if (clipId) {
                          handleClipMoveToTrack(clipId, track.id);
                        }
                      }}
                    >
                      {/* Grid lines background */}
                      <BPMGrid
                        bpm={bpm}
                        duration={duration}
                        pixelsPerSecond={pixelsPerSecond}
                        height={isMaster ? TRACK_HEIGHT + 20 : TRACK_HEIGHT}
                        currentTime={currentTime}
                      />

                      {/* Master track label */}
                      {isMaster && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-zinc-600 text-sm font-medium">Sortie Master • Toutes les pistes</span>
                        </div>
                      )}

                      {/* Clips (not on master) */}
                      {!isMaster && track.clips.map((clip) => (
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
                            left: recordStartTimeRef.current * pixelsPerSecond,
                            width: recordingDuration * pixelsPerSecond 
                          }}
                        >
                          <span className="text-destructive text-xs font-bold">● REC</span>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                disabled={!tracks.some(t => t.clips.length > 0) || isExporting}
                onClick={exportMix}
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Export en cours..." : "Exporter le mix"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Load Project Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Charger un projet</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {savedProjects.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Aucun projet sauvegardé</p>
            ) : (
              savedProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => loadProject(project)}
                  disabled={isLoading}
                  className="w-full text-left p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium text-foreground">{project.name}</span>
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      {project.id.startsWith("studio_project_") ? "Local" : "Google Drive"}
                    </span>
                  </div>
                  {isLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Studio;
