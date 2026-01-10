import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2, Clock, X, Trash2, Calendar, Plus, FolderOpen } from "lucide-react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import AdminEventCreator from "./AdminEventCreator";
import { useViewMode } from "@/hooks/useViewMode";
interface TimeSlot {
  hour: number;
  available: boolean;
  status: "available" | "unavailable" | "on-request";
  eventName?: string;
  eventId?: string;
  clientEmail?: string;
  driveFolderLink?: string;
  driveSessionFolderLink?: string;
}

interface DayAvailability {
  date: string;
  slots: TimeSlot[];
}

interface AdminCalendarProps {
  onSelectSlot?: (date: string, time: string, duration: number) => void;
  selectedDate?: string;
  selectedTime?: string;
}

interface SelectedRange {
  date: string;
  startHour: number;
  endHour: number;
}

const AdminCalendar = ({ 
  onSelectSlot, 
  selectedDate: externalDate, 
  selectedTime: externalTime
}: AdminCalendarProps) => {
  const { toast } = useToast();
  const { isMobileView } = useViewMode();
  const [weekStart, setWeekStart] = useState<Date>(startOfDay(new Date()));
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingEvent, setDeletingEvent] = useState(false);
  
  // Range selection state
  const [selectionStart, setSelectionStart] = useState<{ date: string; hour: number } | null>(null);
  const [selectedRange, setSelectedRange] = useState<SelectedRange | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{ date: string; hour: number } | null>(null);
  
  // Multi-select for deletion
  const [selectedForDeletion, setSelectedForDeletion] = useState<{ date: string; hour: number; eventId: string }[]>([]);
  const [selectedDriveFolderLink, setSelectedDriveFolderLink] = useState<string | null>(null);
  
  // Show event creator form
  const [showEventCreator, setShowEventCreator] = useState(false);

  // Fetch availability data
  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-weekly-availability", {
        body: {
          startDate: weekStart.toISOString().split("T")[0],
          days: 14,
        },
      });

      if (error) throw error;
      setAvailability(data.availability || []);
    } catch (err) {
      console.error("Failed to fetch availability:", err);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const handlePreviousWeek = () => {
    const newStart = addDays(weekStart, -7);
    if (newStart >= startOfDay(new Date())) {
      setWeekStart(newStart);
    }
  };

  const handleNextWeek = () => {
    setWeekStart(addDays(weekStart, 7));
  };

  // Handle click on a slot
  const handleSlotClick = (date: string, hour: number) => {
    const dayData = availability.find(d => d.date === date);
    const slot = dayData?.slots.find(s => s.hour === hour);
    
    // If clicking on a booked slot, toggle deletion selection
    if (slot?.status === "unavailable" && slot?.eventId) {
      const existing = selectedForDeletion.find(s => s.date === date && s.hour === hour);
      if (existing) {
        const next = selectedForDeletion.filter(s => !(s.date === date && s.hour === hour));
        setSelectedForDeletion(next);
        if (next.length === 0) setSelectedDriveFolderLink(null);
      } else {
        const next = [...selectedForDeletion, { date, hour, eventId: slot.eventId }];
        setSelectedForDeletion(next);
        // Prefer session subfolder link, fallback to client folder link
        setSelectedDriveFolderLink(slot.driveSessionFolderLink || slot.driveFolderLink || null);
      }
      return;
    }
    
    // For available slots, handle range selection
    if (!selectionStart) {
      // Start new selection
      setSelectionStart({ date, hour });
      setSelectedRange({ date, startHour: hour, endHour: hour });
    } else if (selectionStart.date === date) {
      // Complete selection on same day
      const startH = Math.min(selectionStart.hour, hour);
      const endH = Math.max(selectionStart.hour, hour);
      const range = { date, startHour: startH, endHour: endH };
      setSelectedRange(range);
      setSelectionStart(null);
      
      // Notify parent
      if (onSelectSlot) {
        const duration = endH - startH + 1;
        onSelectSlot(date, `${startH.toString().padStart(2, "0")}:00`, duration);
      }
    } else {
      // Different day - restart selection
      setSelectionStart({ date, hour });
      setSelectedRange({ date, startHour: hour, endHour: hour });
    }
  };

  // Handle hover for preview
  const handleSlotHover = (date: string, hour: number) => {
    setHoveredSlot({ date, hour });
  };

  // Calculate preview range while selecting
  const getPreviewRange = (date: string, hour: number): { start: number; end: number } | null => {
    if (!selectionStart || selectionStart.date !== date) return null;
    return {
      start: Math.min(selectionStart.hour, hour),
      end: Math.max(selectionStart.hour, hour)
    };
  };

  // Check if slot is in selection range
  const isInSelectedRange = (date: string, hour: number): boolean => {
    if (!selectedRange || selectedRange.date !== date) return false;
    return hour >= selectedRange.startHour && hour <= selectedRange.endHour;
  };

  // Check if slot is in preview range
  const isInPreviewRange = (date: string, hour: number): boolean => {
    if (!selectionStart || !hoveredSlot || selectionStart.date !== date || hoveredSlot.date !== date) return false;
    const start = Math.min(selectionStart.hour, hoveredSlot.hour);
    const end = Math.max(selectionStart.hour, hoveredSlot.hour);
    return hour >= start && hour <= end;
  };

  // Check if slot is selected for deletion
  const isSelectedForDeletion = (date: string, hour: number): boolean => {
    return selectedForDeletion.some(s => s.date === date && s.hour === hour);
  };

  // Delete multiple events
  const handleDeleteSelected = async () => {
    if (selectedForDeletion.length === 0) return;
    
    setDeletingEvent(true);
    let successCount = 0;
    let errorCount = 0;

    // Group by unique eventIds
    const uniqueEventIds = [...new Set(selectedForDeletion.map(s => s.eventId))];

    for (const eventId of uniqueEventIds) {
      try {
        const { data, error } = await supabase.functions.invoke("delete-admin-event", {
          body: { eventId },
        });
        
        if (error) {
          console.error("Delete error:", error);
          errorCount++;
        } else if (data?.error) {
          console.error("Delete response error:", data.error);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error("Delete exception:", err);
        errorCount++;
      }
    }

    toast({
      title: `${successCount} événement(s) supprimé(s)`,
      description: errorCount > 0 ? `${errorCount} erreur(s)` : undefined,
      variant: errorCount > 0 ? "destructive" : "default",
    });

    setSelectedForDeletion([]);
    setSelectedDriveFolderLink(null);
    await fetchAvailability();
    setDeletingEvent(false);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectionStart(null);
    setSelectedRange(null);
    setSelectedForDeletion([]);
    setSelectedDriveFolderLink(null);
  };

  const formatHour = (hour: number) => `${hour.toString().padStart(2, "0")}:00`;

  // Show fewer days on mobile
  const displayDays = availability.slice(0, isMobileView ? 3 : 7);

  return (
    <div className={cn("bg-card rounded-2xl border border-primary/30 box-glow-cyan", isMobileView ? "p-3" : "p-6")}>
      <div className={cn("flex items-center justify-between", isMobileView ? "mb-3" : "mb-6")}>
        <h3 className={cn("font-display text-foreground flex items-center gap-2", isMobileView ? "text-base" : "text-xl")}>
          <Clock className={cn("text-primary", isMobileView ? "w-4 h-4" : "w-5 h-5")} />
          {isMobileView ? "AGENDA" : "AGENDA ADMIN"}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className={isMobileView ? "h-7 w-7" : ""}
            onClick={handlePreviousWeek}
            disabled={isSameDay(weekStart, startOfDay(new Date()))}
          >
            <ChevronLeft className={isMobileView ? "w-3 h-3" : "w-4 h-4"} />
          </Button>
          <span className={cn("text-muted-foreground text-center", isMobileView ? "text-xs min-w-[100px]" : "text-sm min-w-[150px]")}>
            {format(weekStart, "d MMM", { locale: fr })} - {format(addDays(weekStart, isMobileView ? 2 : 6), "d MMM", { locale: fr })}
          </span>
          <Button variant="outline" size="icon" className={isMobileView ? "h-7 w-7" : ""} onClick={handleNextWeek}>
            <ChevronRight className={isMobileView ? "w-3 h-3" : "w-4 h-4"} />
          </Button>
        </div>
      </div>

      {/* Legend - compact on mobile */}
      <div className={cn("flex items-center flex-wrap", isMobileView ? "gap-2 mb-3 text-[10px]" : "gap-4 mb-4 text-xs")}>
        <div className="flex items-center gap-1">
          <div className={cn("rounded bg-green-500", isMobileView ? "w-2 h-2" : "w-3 h-3")} />
          <span className="text-muted-foreground">Dispo</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={cn("rounded bg-amber-500", isMobileView ? "w-2 h-2" : "w-3 h-3")} />
          <span className="text-muted-foreground">Demande</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={cn("rounded bg-destructive", isMobileView ? "w-2 h-2" : "w-3 h-3")} />
          <span className="text-muted-foreground">Réservé</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={cn("rounded bg-primary", isMobileView ? "w-2 h-2" : "w-3 h-3")} />
          <span className="text-muted-foreground">Sélection</span>
        </div>
      </div>

      {/* Instructions - hidden on mobile for space */}
      {!isMobileView && (
        <div className="mb-4 p-3 rounded-lg bg-secondary/50 border border-border text-sm text-muted-foreground">
          <p>💡 <strong>Sélection:</strong> Cliquez sur une case de début puis une case de fin pour définir la durée.</p>
          <p>🗑️ <strong>Suppression:</strong> Cliquez sur les cases réservées (rouges) pour les sélectionner, puis "Supprimer".</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Chargement de l'agenda...</span>
        </div>
      ) : (
        <>
          {/* Calendar grid */}
          <div className="overflow-x-auto -mx-3 px-3">
            <div className={isMobileView ? "min-w-[320px]" : "min-w-[700px]"}>
              {/* Days header */}
              <div className={cn("grid gap-1 mb-2", isMobileView ? "grid-cols-4" : "grid-cols-8")}>
                <div className={cn("text-muted-foreground p-1", isMobileView ? "text-[10px]" : "text-xs p-2")}>H</div>
                {displayDays.map((day) => {
                  const date = new Date(day.date);
                  const isSelected = selectedRange?.date === day.date;
                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "text-center rounded-lg",
                        isMobileView ? "p-1" : "p-2",
                        isSelected ? "bg-primary/20 text-primary" : "text-muted-foreground"
                      )}
                    >
                      <div className={cn("font-semibold", isMobileView ? "text-[10px]" : "text-xs")}>
                        {format(date, "EEE", { locale: fr })}
                      </div>
                      <div className={cn("font-display", isMobileView ? "text-sm" : "text-lg")}>{format(date, "d")}</div>
                      <div className={isMobileView ? "text-[8px]" : "text-[10px]"}>{format(date, "MMM", { locale: fr })}</div>
                    </div>
                  );
                })}
              </div>

              {/* Time slots grid */}
              <div className={cn("space-y-1 overflow-y-auto", isMobileView ? "max-h-[300px]" : "max-h-[400px]")}>
                {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                  <div key={hour} className={cn("grid gap-1", isMobileView ? "grid-cols-4" : "grid-cols-8")}>
                    <div className={cn("text-muted-foreground flex items-center", isMobileView ? "text-[10px] p-0.5" : "text-xs p-2")}>
                      {isMobileView ? hour.toString().padStart(2, "0") : formatHour(hour)}
                    </div>
                    {displayDays.map((day) => {
                      const slot = day.slots.find(s => s.hour === hour);
                      const status = slot?.status || "unavailable";
                      const eventName = slot?.eventName;
                      
                      const inRange = isInSelectedRange(day.date, hour);
                      const inPreview = isInPreviewRange(day.date, hour);
                      const forDeletion = isSelectedForDeletion(day.date, hour);
                      
                      return (
                        <button
                          key={`${day.date}-${hour}`}
                          onClick={() => handleSlotClick(day.date, hour)}
                          onMouseEnter={() => handleSlotHover(day.date, hour)}
                          className={cn(
                            "rounded transition-all duration-200 flex flex-col items-center justify-center cursor-pointer",
                            isMobileView ? "p-0.5 min-h-[28px] text-[8px]" : "p-1 min-h-[36px] text-[10px]",
                            forDeletion
                              ? "bg-blue-500 text-white ring-2 ring-blue-400"
                              : inRange
                                ? "bg-primary text-primary-foreground ring-2 ring-primary"
                                : inPreview
                                  ? "bg-primary/50 text-primary-foreground"
                                  : status === "available"
                                    ? "bg-green-500/20 text-green-500 hover:bg-green-500/40"
                                    : status === "on-request"
                                      ? "bg-amber-500/20 text-amber-500 hover:bg-amber-500/40"
                                      : "bg-destructive/20 text-destructive hover:bg-destructive/40"
                          )}
                          title={eventName || formatHour(hour)}
                        >
                          <span className="font-medium">{isMobileView ? hour.toString().padStart(2, "0") : formatHour(hour)}</span>
                          {forDeletion ? (
                            <span className={isMobileView ? "text-[6px]" : "text-[8px]"}>✓</span>
                          ) : status === "unavailable" && eventName && !isMobileView ? (
                            <span className="truncate w-full text-[8px] opacity-80 px-0.5">{eventName}</span>
                          ) : status === "available" ? (
                            <span className="opacity-50">✓</span>
                          ) : status === "on-request" ? (
                            <span className="opacity-50">?</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Selection actions */}
          {(selectedRange || selectedForDeletion.length > 0) && (
            <div className={cn("rounded-xl bg-secondary/50 border border-border", isMobileView ? "mt-3 p-3" : "mt-4 p-4")}>
              <div className={cn("flex flex-wrap items-center gap-3", isMobileView ? "justify-center" : "justify-between gap-4")}>
                {selectedRange && (
                  <div className={cn("flex items-center", isMobileView ? "flex-col gap-2" : "gap-3")}>
                    <p className={cn("text-foreground", isMobileView ? "text-xs text-center" : "text-sm")}>
                      <Calendar className={cn("inline mr-1", isMobileView ? "w-3 h-3" : "w-4 h-4")} />
                      <strong>{format(new Date(selectedRange.date), isMobileView ? "d MMM" : "EEEE d MMMM", { locale: fr })}</strong>
                      {" • "}
                      {formatHour(selectedRange.startHour)} - {formatHour(selectedRange.endHour + 1)}
                      {" • "}
                      <span className="text-primary font-semibold">
                        {selectedRange.endHour - selectedRange.startHour + 1}h
                      </span>
                    </p>
                    {!showEventCreator && (
                      <Button
                        size={isMobileView ? "sm" : "default"}
                        onClick={() => setShowEventCreator(true)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Plus className={cn(isMobileView ? "w-3 h-3 mr-1" : "w-4 h-4 mr-1")} />
                        {isMobileView ? "Créer" : "Créer un événement"}
                      </Button>
                    )}
                  </div>
                )}
                
                {selectedForDeletion.length > 0 && (
                  <div className={cn("flex items-center gap-2", isMobileView && "flex-wrap justify-center")}>
                    <span className={cn("text-blue-400", isMobileView ? "text-xs" : "text-sm")}>
                      {selectedForDeletion.length} à supprimer
                    </span>

                    {selectedDriveFolderLink && !isMobileView && (
                      <Button asChild variant="outline" size="sm">
                        <a href={selectedDriveFolderLink} target="_blank" rel="noreferrer">
                          <FolderOpen className="w-4 h-4 mr-1" />
                          DRIVE
                        </a>
                      </Button>
                    )}

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteSelected}
                      disabled={deletingEvent}
                    >
                      {deletingEvent ? (
                        <Loader2 className={cn("animate-spin", isMobileView ? "w-3 h-3" : "w-4 h-4 mr-1")} />
                      ) : (
                        <Trash2 className={cn(isMobileView ? "w-3 h-3" : "w-4 h-4 mr-1")} />
                      )}
                      {!isMobileView && "Supprimer"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Event Creator Form (inline) */}
          {showEventCreator && selectedRange && (
            <AdminEventCreator
              selectedDate={selectedRange.date}
              selectedTime={formatHour(selectedRange.startHour)}
              duration={selectedRange.endHour - selectedRange.startHour + 1}
              onEventCreated={() => {
                setShowEventCreator(false);
                clearSelection();
                fetchAvailability();
              }}
              onCancel={() => setShowEventCreator(false)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default AdminCalendar;
