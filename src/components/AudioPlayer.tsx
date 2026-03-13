import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Lock, UserPlus } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const PREVIEW_DURATION = 30; // 30 seconds preview for non-authenticated users

interface AudioPlayerProps {
  src: string;
  title: string;
  artist?: string;
  coverImage?: string;
  className?: string;
  compact?: boolean;
  autoPlay?: boolean;
  onEnded?: () => void;
  isAuthenticated?: boolean;
  onPreviewEnded?: () => void;
}

const AudioPlayer = ({ 
  src, 
  title, 
  artist, 
  coverImage, 
  className, 
  compact = false, 
  autoPlay = false, 
  onEnded,
  isAuthenticated = true,
  onPreviewEnded
}: AudioPlayerProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [showPreviewMessage, setShowPreviewMessage] = useState(false);

  // Calculate effective max duration based on authentication
  const maxPlayDuration = isAuthenticated ? duration : Math.min(PREVIEW_DURATION, duration);

  // Auto-start playback when autoPlay is true (triggered on mount)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // If autoPlay is enabled, try to start playback immediately
    if (autoPlay) {
      const startPlayback = () => {
        audio.play()
          .then(() => setIsPlaying(true))
          .catch((e) => {
            console.log("[AudioPlayer] Autoplay blocked:", e);
            // On mobile, autoplay might be blocked, but we set isPlaying false
            setIsPlaying(false);
          });
      };
      
      // Try immediately if ready, otherwise wait for canplaythrough
      if (audio.readyState >= 3) {
        startPlayback();
      } else {
        audio.addEventListener("canplaythrough", startPlayback, { once: true });
      }
    }
    
    return () => {
      audio.removeEventListener("canplaythrough", () => {});
    };
  }, [autoPlay, src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      
      // Check if non-authenticated user reached preview limit
      if (!isAuthenticated && time >= PREVIEW_DURATION) {
        audio.pause();
        audio.currentTime = PREVIEW_DURATION;
        setCurrentTime(PREVIEW_DURATION);
        setIsPlaying(false);
        setShowPreviewMessage(true);
        onPreviewEnded?.();
      }
    };
    
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [onEnded, isAuthenticated, onPreviewEnded]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <audio ref={audioRef} src={src} preload="auto" />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePlay}
          className="h-10 w-10 rounded-full bg-primary/20 hover:bg-primary/30 text-primary"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50", className)}>
      <audio ref={audioRef} src={src} preload="auto" />
      
      {/* Preview ended message for non-authenticated users */}
      {showPreviewMessage && !isAuthenticated && (
        <div className="mb-3 p-3 bg-gradient-to-r from-primary/20 to-purple-600/20 rounded-lg border border-primary/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <span className="text-sm text-foreground">
                {t("instrumentals.preview_ended", "Aperçu de 30 secondes terminé")}
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => navigate("/auth")}
              className="bg-primary hover:bg-primary/90"
            >
              <UserPlus className="h-3 w-3 mr-1" />
              {t("instrumentals.create_account", "Créer un compte")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t("instrumentals.preview_info", "Créez un compte gratuit pour écouter les instrumentaux en entier")}
          </p>
        </div>
      )}

      {/* Preview indicator for non-authenticated users */}
      {!isAuthenticated && !showPreviewMessage && (
        <div className="mb-2 flex items-center gap-2 text-xs text-amber-500">
          <Lock className="h-3 w-3" />
          <span>{t("instrumentals.preview_mode", "Mode aperçu : 30 secondes")}</span>
        </div>
      )}
      
      <div className="flex items-center gap-4">
        {/* Cover Image */}
        {coverImage && (
          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
            <img src={coverImage} alt={title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Play Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePlay}
          className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0"
        >
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
        </Button>

        {/* Track Info & Progress */}
        <div className="flex-1 min-w-0">
          <div className="mb-2">
            <h4 className="font-semibold text-foreground truncate">{title}</h4>
            {artist && <p className="text-sm text-muted-foreground truncate">{artist}</p>}
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-10">{formatTime(currentTime)}</span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume Control */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8">
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
