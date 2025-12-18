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
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Get audio data - mix channels if stereo
    let data: Float32Array;
    if (audioBuffer.numberOfChannels > 1) {
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      data = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        data[i] = (left[i] + right[i]) / 2;
      }
    } else {
      data = audioBuffer.getChannelData(0);
    }

    const step = Math.max(1, Math.floor(data.length / width));
    const amp = height / 2;

    // Draw waveform as filled bars from center
    ctx.fillStyle = color;
    
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      const startIdx = i * step;
      const endIdx = Math.min(startIdx + step, data.length);
      
      for (let j = startIdx; j < endIdx; j++) {
        const datum = data[j];
        if (datum !== undefined) {
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
      }

      // Calculate y positions - draw from center
      const yTop = amp - (max * amp);
      const yBottom = amp - (min * amp);
      const barHeight = Math.max(1, yBottom - yTop);
      
      ctx.fillRect(i, yTop, 1, barHeight);
    }

    // Add gradient overlay for depth
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.15)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.15)");
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
