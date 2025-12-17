import { memo, useRef, useState, useCallback } from "react";
import WaveformDisplay from "./WaveformDisplay";
import { Scissors, Copy, Trash2, GripVertical } from "lucide-react";

export interface ClipData {
  id: string;
  startTime: number;
  duration: number;
  audioBuffer: AudioBuffer;
  offset: number;
  name?: string;
  color?: string;
}

interface AudioClipProps {
  clip: ClipData;
  pixelsPerSecond: number;
  trackHeight: number;
  isSelected: boolean;
  onSelect: (clipId: string, addToSelection: boolean) => void;
  onMove: (clipId: string, newStartTime: number) => void;
  onResize: (clipId: string, newDuration: number, newOffset: number) => void;
  onDelete: (clipId: string) => void;
  onDuplicate: (clipId: string) => void;
  onCut: (clipId: string, cutTime: number) => void;
  snapToGrid: (time: number) => number;
}

const AudioClip = memo(({
  clip,
  pixelsPerSecond,
  trackHeight,
  isSelected,
  onSelect,
  onMove,
  onResize,
  onDelete,
  onDuplicate,
  onCut,
  snapToGrid
}: AudioClipProps) => {
  const clipRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<"left" | "right" | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const width = clip.duration * pixelsPerSecond;
  const left = clip.startTime * pixelsPerSecond;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    
    const rect = clipRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const edgeThreshold = 10;

    if (clickX < edgeThreshold) {
      setIsResizing("left");
    } else if (clickX > rect.width - edgeThreshold) {
      setIsResizing("right");
    } else {
      setIsDragging(true);
    }

    onSelect(clip.id, e.shiftKey || e.ctrlKey || e.metaKey);

    const startX = e.clientX;
    const startTime = clip.startTime;
    const startDuration = clip.duration;
    const startOffset = clip.offset;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = deltaX / pixelsPerSecond;

      if (isResizing === "left") {
        const newOffset = Math.max(0, startOffset + deltaTime);
        const offsetDiff = newOffset - startOffset;
        const newStartTime = snapToGrid(startTime + offsetDiff);
        const newDuration = startDuration - offsetDiff;
        if (newDuration > 0.1) {
          onResize(clip.id, newDuration, newOffset);
          onMove(clip.id, newStartTime);
        }
      } else if (isResizing === "right") {
        const newDuration = Math.max(0.1, startDuration + deltaTime);
        const maxDuration = clip.audioBuffer.duration - clip.offset;
        onResize(clip.id, Math.min(newDuration, maxDuration), clip.offset);
      } else if (isDragging) {
        const newStartTime = snapToGrid(Math.max(0, startTime + deltaTime));
        onMove(clip.id, newStartTime);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [clip, pixelsPerSecond, onSelect, onMove, onResize, snapToGrid, isDragging, isResizing]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, []);

  const handleCutAtPosition = useCallback((e: React.MouseEvent) => {
    const rect = clipRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const clickX = e.clientX - rect.left;
    const cutTime = clip.startTime + (clickX / pixelsPerSecond);
    onCut(clip.id, snapToGrid(cutTime));
    setShowContextMenu(false);
  }, [clip, pixelsPerSecond, onCut, snapToGrid]);

  return (
    <>
      <div
        ref={clipRef}
        className={`absolute top-1 bottom-1 rounded-md overflow-hidden cursor-move transition-all ${
          isSelected 
            ? "ring-2 ring-primary shadow-lg shadow-primary/20 z-10" 
            : "hover:ring-1 hover:ring-primary/50"
        } ${isDragging || isResizing ? "opacity-80" : ""}`}
        style={{
          left: `${left}px`,
          width: `${width}px`,
          backgroundColor: clip.color || "hsl(var(--primary) / 0.3)",
        }}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleCutAtPosition}
      >
        {/* Header with name and grip */}
        <div className="absolute top-0 left-0 right-0 h-5 bg-black/30 flex items-center px-1 gap-1">
          <GripVertical className="h-3 w-3 text-white/50" />
          <span className="text-[10px] text-white truncate">
            {clip.name || "Clip"}
          </span>
        </div>

        {/* Waveform */}
        <div className="absolute top-5 bottom-0 left-0 right-0">
          <WaveformDisplay
            audioBuffer={clip.audioBuffer}
            width={Math.floor(width)}
            height={trackHeight - 24}
            color="hsl(var(--primary))"
            className="opacity-80"
          />
        </div>

        {/* Resize handles */}
        <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20" />
        <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20" />
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowContextMenu(false)}
          />
          <div
            className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-32"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            <button
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
              onClick={() => { onDuplicate(clip.id); setShowContextMenu(false); }}
            >
              <Copy className="h-3 w-3" /> Dupliquer
            </button>
            <button
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
              onClick={handleCutAtPosition}
            >
              <Scissors className="h-3 w-3" /> Couper ici
            </button>
            <button
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-destructive/20 text-destructive flex items-center gap-2"
              onClick={() => { onDelete(clip.id); setShowContextMenu(false); }}
            >
              <Trash2 className="h-3 w-3" /> Supprimer
            </button>
          </div>
        </>
      )}
    </>
  );
});

AudioClip.displayName = "AudioClip";

export default AudioClip;
