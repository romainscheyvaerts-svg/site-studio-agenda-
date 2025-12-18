import { memo, useEffect, useRef, useState } from "react";

interface VUMeterProps {
  level: number; // 0-1 normalized level
  peak?: number; // 0-1 peak hold
  height?: number;
  width?: number;
  className?: string;
}

const VUMeter = memo(({ level, peak, height = 120, width = 24, className = "" }: VUMeterProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Clear
    ctx.fillStyle = "hsl(240 10% 8%)";
    ctx.fillRect(0, 0, width, height);
    
    // Draw meter background segments
    const segmentHeight = 3;
    const segmentGap = 1;
    const totalSegments = Math.floor(height / (segmentHeight + segmentGap));
    const levelSegments = Math.floor(level * totalSegments);
    const peakSegment = peak ? Math.floor(peak * totalSegments) : 0;
    
    for (let i = 0; i < totalSegments; i++) {
      const y = height - (i + 1) * (segmentHeight + segmentGap);
      const segmentRatio = i / totalSegments;
      
      // Determine color based on level
      let color;
      if (segmentRatio > 0.85) {
        color = i <= levelSegments ? "hsl(0 70% 50%)" : "hsl(0 30% 20%)"; // Red zone
      } else if (segmentRatio > 0.7) {
        color = i <= levelSegments ? "hsl(45 80% 50%)" : "hsl(45 30% 20%)"; // Yellow zone
      } else {
        color = i <= levelSegments ? "hsl(160 70% 50%)" : "hsl(160 20% 15%)"; // Green zone
      }
      
      ctx.fillStyle = color;
      ctx.fillRect(2, y, width - 4, segmentHeight);
    }
    
    // Draw peak hold
    if (peak && peakSegment > 0) {
      const peakY = height - peakSegment * (segmentHeight + segmentGap);
      const peakRatio = peakSegment / totalSegments;
      
      let peakColor = "hsl(160 70% 60%)";
      if (peakRatio > 0.85) peakColor = "hsl(0 70% 60%)";
      else if (peakRatio > 0.7) peakColor = "hsl(45 80% 60%)";
      
      ctx.fillStyle = peakColor;
      ctx.fillRect(2, peakY, width - 4, segmentHeight);
    }
    
    // Draw scale markers
    ctx.fillStyle = "hsl(0 0% 40%)";
    ctx.font = "8px monospace";
    ctx.textAlign = "right";
    
    const markers = [0, -6, -12, -24, -48];
    markers.forEach((db) => {
      const ratio = db === 0 ? 1 : Math.pow(10, db / 20);
      const y = height - ratio * height;
      ctx.fillText(`${db}`, width - 1, Math.max(8, Math.min(height - 2, y + 3)));
    });
    
  }, [level, peak, height, width]);
  
  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded border border-zinc-700"
      />
      <span className="text-[8px] text-zinc-500 font-mono">dB</span>
    </div>
  );
});

VUMeter.displayName = "VUMeter";

export default VUMeter;
