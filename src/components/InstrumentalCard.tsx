import { useState } from "react";
import { Play, Pause, ShoppingCart, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/hooks/useViewMode";
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
  const { isMobileView } = useViewMode();
  const { t } = useTranslation();

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
      <div className={cn(
        "relative bg-gradient-to-br from-primary/20 to-secondary/20",
        isMobileView ? "aspect-[4/3]" : "aspect-square"
      )}>
        {instrumental.cover_image_url ? (
          <img 
            src={instrumental.cover_image_url} 
            alt={instrumental.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className={cn("text-primary/40", isMobileView ? "w-10 h-10" : "w-16 h-16")} />
          </div>
        )}
        
        {/* Play Overlay */}
        <div className={cn(
          "absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300",
          isHovered || isPlaying ? "opacity-100" : isMobileView ? "opacity-100" : "opacity-0"
        )}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onPlay(instrumental)}
            className={cn(
              "rounded-full bg-primary hover:bg-primary/90 text-primary-foreground",
              isMobileView ? "h-12 w-12" : "h-16 w-16"
            )}
          >
            {isPlaying ? (
              <Pause className={cn(isMobileView ? "h-5 w-5" : "h-8 w-8")} />
            ) : (
              <Play className={cn("ml-0.5", isMobileView ? "h-5 w-5" : "h-8 w-8")} />
            )}
          </Button>
        </div>

        {/* Genre Badge */}
        {instrumental.genre && (
          <Badge 
            variant="secondary" 
            className={cn(
              "absolute top-2 left-2 bg-black/70 text-white border-none",
              isMobileView && "text-[10px] px-1.5 py-0.5"
            )}
          >
            {instrumental.genre}
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className={cn(isMobileView ? "p-3" : "p-4")}>
        <h3 className={cn(
          "font-bold text-foreground truncate mb-1",
          isMobileView ? "text-sm" : "text-lg"
        )}>
          {instrumental.title}
        </h3>
        
        {/* BPM & Key */}
        <div className={cn(
          "flex items-center gap-2 text-muted-foreground",
          isMobileView ? "text-[10px] mb-2" : "text-sm mb-3"
        )}>
          {instrumental.bpm && (
            <span className="flex items-center gap-0.5">
              <span className="font-semibold text-primary">{instrumental.bpm}</span> BPM
            </span>
          )}
          {instrumental.key && (
            <span className="flex items-center gap-0.5">
              <span className="font-semibold text-primary">{instrumental.key}</span>
            </span>
          )}
        </div>

        {/* Buy Button */}
        <Button 
          onClick={() => onBuy(instrumental)}
          className={cn(
            "w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90",
            isMobileView && "h-9 text-xs"
          )}
          size={isMobileView ? "sm" : "default"}
        >
          <ShoppingCart className={cn(isMobileView ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2")} />
          {isMobileView ? t("instrumentals.buy") : t("instrumentals.buy_license")}
        </Button>
      </div>
    </div>
  );
};

export default InstrumentalCard;
