import { useState } from "react";
import { FileAudio, Loader2, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface TransferFile {
  id: string;
  name: string;
  blob: Blob;
  objectUrl: string;
  ready: boolean;
}

interface TransferZoneProps {
  className?: string;
}

const TransferZone = ({ className }: TransferZoneProps) => {
  const [files, setFiles] = useState<TransferFile[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const loadFileToZone = async (instrumental: {
    id: string;
    title: string;
    drive_file_id: string;
  }) => {
    // Check if already loaded
    if (files.find((f) => f.id === instrumental.id)) {
      return;
    }

    setLoadingId(instrumental.id);

    try {
      const streamUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-instrumental?fileId=${instrumental.drive_file_id}`;

      const response = await fetch(streamUrl, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch audio");
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "audio/wav" });
      const objectUrl = URL.createObjectURL(blob);

      setFiles((prev) => [
        ...prev,
        {
          id: instrumental.id,
          name: instrumental.title,
          blob,
          objectUrl,
          ready: true,
        },
      ]);
    } catch (error) {
      console.error("Error loading file:", error);
    } finally {
      setLoadingId(null);
    }
  };

  const removeFile = (id: string) => {
    const file = files.find((f) => f.id === id);
    if (file) {
      URL.revokeObjectURL(file.objectUrl);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    }
  };

  const handleDragStart = (e: React.DragEvent, file: TransferFile) => {
    setDraggingId(file.id);

    // Create a File object from the Blob
    const wavFile = new File([file.blob], `${file.name}.wav`, {
      type: "audio/wav",
    });

    // Set data for the DAW
    const audioData = {
      type: "EXTERNAL_IMPORT_AUDIO",
      url: file.objectUrl,
      name: file.name,
      format: "wav",
    };

    e.dataTransfer.setData("application/daw-audio", JSON.stringify(audioData));
    e.dataTransfer.setData("text/plain", file.objectUrl);
    e.dataTransfer.setData("text/uri-list", file.objectUrl);

    // Try to set as file (note: this may not work in all browsers due to security)
    try {
      const dt = new DataTransfer();
      dt.items.add(wavFile);
      // Some browsers don't allow setting files directly
    } catch (err) {
      console.log("Cannot set files directly, using URLs instead");
    }

    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  // Expose loadFileToZone globally for the sidebar to call
  if (typeof window !== "undefined") {
    (window as any).transferZone = { loadFileToZone };
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-2 border-b border-border bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <FileAudio className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Zone de Transfert</span>
        </div>
      </div>

      {/* Files */}
      <div className="p-2 min-w-[200px] max-w-[300px]">
        {loadingId && (
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md mb-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">
              Chargement du fichier WAV...
            </span>
          </div>
        )}

        {files.length === 0 && !loadingId && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Cliquez sur une instru pour la charger ici
          </p>
        )}

        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              draggable={file.ready}
              onDragStart={(e) => handleDragStart(e, file)}
              onDragEnd={handleDragEnd}
              className={cn(
                "group flex items-center gap-2 p-2 bg-background/80 rounded-md border border-border transition-all",
                file.ready &&
                  "cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-md",
                draggingId === file.id && "opacity-50 scale-95"
              )}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              <FileAudio className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm truncate flex-1">{file.name}</span>
              {file.ready && (
                <span className="text-xs text-green-500 shrink-0">WAV</span>
              )}
              <button
                onClick={() => removeFile(file.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/20 rounded"
              >
                <X className="w-3 h-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TransferZone;
