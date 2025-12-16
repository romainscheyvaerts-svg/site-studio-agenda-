import { useState } from "react";
import { Play, Pause, ShoppingCart, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
}

interface InstrumentalCardProps {
  instrumental: Instrumental;
  onPlay: (instrumental: Instrumental) => void;
  onBuy: (instrumental: Instrumental) => void;
  isPlaying?: boolean;
  className?: string;
}

const InstrumentalCard = ({ 
  instrumental, 
  onPlay, 
  onBuy, 
  isPlaying = false,
  className 
}: InstrumentalCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={cn(
        "group relative bg-card rounded-xl overflow-hidden border border-border/50 transition-all duration-300",
        "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Cover Image */}
      <div className="relative aspect-square bg-gradient-to-br from-primary/20 to-secondary/20">
        {instrumental.cover_image_url ? (
          <img 
            src={instrumental.cover_image_url} 
            alt={instrumental.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-16 h-16 text-primary/40" />
          </div>
        )}
        
        {/* Play Overlay */}
        <div className={cn(
          "absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300",
          isHovered || isPlaying ? "opacity-100" : "opacity-0"
        )}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onPlay(instrumental)}
            className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isPlaying ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="h-8 w-8 ml-1" />
            )}
          </Button>
        </div>

        {/* Genre Badge */}
        {instrumental.genre && (
          <Badge 
            variant="secondary" 
            className="absolute top-3 left-3 bg-black/70 text-white border-none"
          >
            {instrumental.genre}
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-bold text-lg text-foreground truncate mb-1">
          {instrumental.title}
        </h3>
        
        {/* BPM & Key */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
          {instrumental.bpm && (
            <span className="flex items-center gap-1">
              <span className="font-semibold text-primary">{instrumental.bpm}</span> BPM
            </span>
          )}
          {instrumental.key && (
            <span className="flex items-center gap-1">
              Tonalité: <span className="font-semibold text-primary">{instrumental.key}</span>
            </span>
          )}
        </div>

        {/* Buy Button */}
        <Button 
          onClick={() => onBuy(instrumental)}
          className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Acheter une licence
        </Button>
      </div>
    </div>
  );
};

export default InstrumentalCard;
