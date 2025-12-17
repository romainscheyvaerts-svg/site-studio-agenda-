import { memo, useMemo } from "react";

interface BPMGridProps {
  bpm: number;
  duration: number;
  pixelsPerSecond: number;
  height: number;
  currentTime: number;
  beatsPerBar?: number;
  className?: string;
}

const BPMGrid = memo(({
  bpm,
  duration,
  pixelsPerSecond,
  height,
  currentTime,
  beatsPerBar = 4,
  className = ""
}: BPMGridProps) => {
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  const totalWidth = duration * pixelsPerSecond;

  // Generate grid lines
  const gridLines = useMemo(() => {
    const lines: { position: number; type: "bar" | "beat" | "subdivision"; label?: string }[] = [];
    
    // Calculate optimal subdivision based on zoom level
    const pixelsPerBeat = secondsPerBeat * pixelsPerSecond;
    const showSubdivisions = pixelsPerBeat > 30;
    const showBeats = pixelsPerBeat > 10;

    let time = 0;
    let barNumber = 1;
    
    while (time < duration) {
      // Bar lines
      lines.push({
        position: time * pixelsPerSecond,
        type: "bar",
        label: `${barNumber}`
      });

      // Beat lines within bar
      if (showBeats) {
        for (let beat = 1; beat < beatsPerBar; beat++) {
          const beatTime = time + beat * secondsPerBeat;
          if (beatTime < duration) {
            lines.push({
              position: beatTime * pixelsPerSecond,
              type: "beat"
            });

            // Subdivisions (16th notes)
            if (showSubdivisions) {
              for (let sub = 1; sub < 4; sub++) {
                const subTime = beatTime - secondsPerBeat + (sub * secondsPerBeat / 4);
                if (subTime > time && subTime < duration) {
                  lines.push({
                    position: subTime * pixelsPerSecond,
                    type: "subdivision"
                  });
                }
              }
            }
          }
        }
      }

      time += secondsPerBar;
      barNumber++;
    }

    return lines;
  }, [bpm, duration, pixelsPerSecond, beatsPerBar, secondsPerBeat, secondsPerBar]);

  const playheadPosition = currentTime * pixelsPerSecond;

  return (
    <div className={`relative ${className}`} style={{ width: totalWidth, height }}>
      {/* Grid lines */}
      {gridLines.map((line, index) => (
        <div
          key={index}
          className={`absolute top-0 ${
            line.type === "bar" 
              ? "w-px bg-border" 
              : line.type === "beat"
              ? "w-px bg-border/50"
              : "w-px bg-border/20"
          }`}
          style={{ 
            left: line.position, 
            height: line.type === "bar" ? height : line.type === "beat" ? height * 0.7 : height * 0.4,
            top: line.type === "bar" ? 0 : line.type === "beat" ? height * 0.15 : height * 0.3
          }}
        >
          {line.label && (
            <span className="absolute -top-5 left-1 text-[10px] text-muted-foreground font-mono">
              {line.label}
            </span>
          )}
        </div>
      ))}

      {/* Playhead */}
      <div
        className="absolute top-0 w-0.5 bg-primary z-20 shadow-[0_0_10px_hsl(var(--primary))]"
        style={{ left: playheadPosition, height }}
      >
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-primary" />
      </div>
    </div>
  );
});

BPMGrid.displayName = "BPMGrid";

export default BPMGrid;

// Helper function to snap time to grid
export const snapTimeToGrid = (time: number, bpm: number, snapResolution: "bar" | "beat" | "16th" | "off" = "16th"): number => {
  if (snapResolution === "off") return time;
  
  const secondsPerBeat = 60 / bpm;
  let snapInterval: number;
  
  switch (snapResolution) {
    case "bar":
      snapInterval = secondsPerBeat * 4;
      break;
    case "beat":
      snapInterval = secondsPerBeat;
      break;
    case "16th":
      snapInterval = secondsPerBeat / 4;
      break;
  }
  
  return Math.round(time / snapInterval) * snapInterval;
};
