import { useRef, useEffect, memo } from "react";

interface WaveformDisplayProps {
  audioBuffer: AudioBuffer | null;
  width: number;
  height: number;
  color?: string;
  backgroundColor?: string;
  className?: string;
}

const WaveformDisplay = memo(({ 
  audioBuffer, 
  width, 
  height, 
  color = "hsl(var(--primary))",
  backgroundColor = "transparent",
  className = ""
}: WaveformDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Get audio data
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, amp);

    // Draw waveform
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      // Draw both positive and negative parts
      const yMin = (1 + min) * amp;
      const yMax = (1 + max) * amp;
      
      ctx.fillRect(i, yMin, 1, yMax - yMin);
    }

    // Add gradient overlay for depth
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.1)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

  }, [audioBuffer, width, height, color, backgroundColor]);

  if (!audioBuffer) {
    return (
      <div 
        className={`flex items-center justify-center text-muted-foreground/50 text-xs ${className}`}
        style={{ width, height }}
      >
        Pas d'audio
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
    />
  );
});

WaveformDisplay.displayName = "WaveformDisplay";

export default WaveformDisplay;
