import { useState, useRef, useCallback, memo } from "react";

interface VintageKnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  size?: number;
  label?: string;
  unit?: string;
  color?: string;
  className?: string;
}

const VintageKnob = memo(({
  value,
  min,
  max,
  onChange,
  size = 48,
  label,
  unit = "",
  color = "hsl(var(--primary))",
  className = ""
}: VintageKnobProps) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startValue = useRef(value);

  // Convert value to rotation angle (-135 to 135 degrees)
  const normalizedValue = (value - min) / (max - min);
  const rotation = normalizedValue * 270 - 135;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY.current - moveEvent.clientY;
      const sensitivity = (max - min) / 100;
      const newValue = Math.max(min, Math.min(max, startValue.current + deltaY * sensitivity));
      onChange(newValue);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [value, min, max, onChange]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const step = (max - min) / 50;
    const newValue = Math.max(min, Math.min(max, value + delta * step));
    onChange(newValue);
  }, [value, min, max, onChange]);

  // Format display value
  const displayValue = value.toFixed(value % 1 === 0 ? 0 : 1);

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      {label && (
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      )}
      
      <div
        ref={knobRef}
        className={`relative cursor-ns-resize select-none transition-transform ${isDragging ? "scale-105" : ""}`}
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        {/* Outer ring with tick marks */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
        >
          {/* Background arc */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="4"
            strokeDasharray="212 71"
            strokeDashoffset="-35"
            strokeLinecap="round"
          />
          
          {/* Value arc */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={`${normalizedValue * 212} ${283 - normalizedValue * 212}`}
            strokeDashoffset="-35"
            strokeLinecap="round"
            className="drop-shadow-[0_0_6px_var(--tw-shadow-color)]"
            style={{ "--tw-shadow-color": color } as React.CSSProperties}
          />
          
          {/* Tick marks */}
          {Array.from({ length: 11 }).map((_, i) => {
            const angle = (i * 27 - 135) * (Math.PI / 180);
            const x1 = 50 + 38 * Math.cos(angle);
            const y1 = 50 + 38 * Math.sin(angle);
            const x2 = 50 + 42 * Math.cos(angle);
            const y2 = 50 + 42 * Math.sin(angle);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="1"
                opacity="0.5"
              />
            );
          })}
        </svg>

        {/* Knob body */}
        <div
          className="absolute rounded-full bg-gradient-to-b from-zinc-600 to-zinc-800 shadow-lg border-2 border-zinc-700"
          style={{
            width: size * 0.65,
            height: size * 0.65,
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          }}
        >
          {/* Knob indicator line */}
          <div
            className="absolute w-0.5 h-1/3 rounded-full left-1/2 -translate-x-1/2"
            style={{
              top: "10%",
              backgroundColor: color,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
          
          {/* Inner circle highlight */}
          <div
            className="absolute rounded-full bg-gradient-to-b from-zinc-500 to-zinc-700"
            style={{
              width: "50%",
              height: "50%",
              left: "25%",
              top: "25%",
            }}
          />
        </div>
      </div>

      {/* Value display */}
      <span className="text-xs font-mono text-foreground">
        {displayValue}{unit}
      </span>
    </div>
  );
});

VintageKnob.displayName = "VintageKnob";

export default VintageKnob;
