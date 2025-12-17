import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2, Clock, X, Trash2, Calendar, Plus } from "lucide-react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import AdminEventCreator from "./AdminEventCreator";
interface TimeSlot {
  hour: number;
  available: boolean;
  status: "available" | "unavailable" | "on-request";
  eventName?: string;
  eventId?: string;
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
        setSelectedForDeletion(selectedForDeletion.filter(s => !(s.date === date && s.hour === hour)));
      } else {
        setSelectedForDeletion([...selectedForDeletion, { date, hour, eventId: slot.eventId }]);
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
    await fetchAvailability();
    setDeletingEvent(false);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectionStart(null);
    setSelectedRange(null);
    setSelectedForDeletion([]);
  };

  const formatHour = (hour: number) => `${hour.toString().padStart(2, "0")}:00`;

  const displayDays = availability.slice(0, 7);

  return (
    <div className="bg-card rounded-2xl border border-primary/30 p-6 box-glow-cyan">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-xl text-foreground flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          AGENDA ADMIN
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePreviousWeek}
            disabled={isSameDay(weekStart, startOfDay(new Date()))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[150px] text-center">
            {format(weekStart, "d MMM", { locale: fr })} - {format(addDays(weekStart, 6), "d MMM yyyy", { locale: fr })}
          </span>
          <Button variant="outline" size="icon" onClick={handleNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-muted-foreground">Disponible</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <span className="text-muted-foreground">Sur demande</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-destructive" />
          <span className="text-muted-foreground">Réservé (cliquez pour supprimer)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary" />
          <span className="text-muted-foreground">Sélectionné</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="mb-4 p-3 rounded-lg bg-secondary/50 border border-border text-sm text-muted-foreground">
        <p>💡 <strong>Sélection:</strong> Cliquez sur une case de début puis une case de fin pour définir la durée.</p>
        <p>🗑️ <strong>Suppression:</strong> Cliquez sur les cases réservées (rouges) pour les sélectionner, puis "Supprimer".</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Chargement de l'agenda...</span>
        </div>
      ) : (
        <>
          {/* Calendar grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Days header */}
              <div className="grid grid-cols-8 gap-1 mb-2">
                <div className="text-xs text-muted-foreground p-2">Heure</div>
                {displayDays.map((day) => {
                  const date = new Date(day.date);
                  const isSelected = selectedRange?.date === day.date;
                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "text-center p-2 rounded-lg text-xs",
                        isSelected ? "bg-primary/20 text-primary" : "text-muted-foreground"
                      )}
                    >
                      <div className="font-semibold">{format(date, "EEE", { locale: fr })}</div>
                      <div className="text-lg font-display">{format(date, "d")}</div>
                      <div className="text-[10px]">{format(date, "MMM", { locale: fr })}</div>
                    </div>
                  );
                })}
              </div>

              {/* Time slots grid */}
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                  <div key={hour} className="grid grid-cols-8 gap-1">
                    <div className="text-xs text-muted-foreground p-2 flex items-center">
                      {formatHour(hour)}
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
                            "p-1 rounded text-[10px] transition-all duration-200 min-h-[36px] flex flex-col items-center justify-center cursor-pointer",
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
                          <span className="font-medium">{formatHour(hour)}</span>
                          {forDeletion ? (
                            <span className="text-[8px]">✓</span>
                          ) : status === "unavailable" && eventName ? (
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
            <div className="mt-4 p-4 rounded-xl bg-secondary/50 border border-border">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {selectedRange && (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-foreground">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      <strong>{format(new Date(selectedRange.date), "EEEE d MMMM", { locale: fr })}</strong>
                      {" • "}
                      {formatHour(selectedRange.startHour)} - {formatHour(selectedRange.endHour + 1)}
                      {" • "}
                      <span className="text-primary font-semibold">
                        {selectedRange.endHour - selectedRange.startHour + 1}h
                      </span>
                    </p>
                    {!showEventCreator && (
                      <Button
                        size="sm"
                        onClick={() => setShowEventCreator(true)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Créer un événement
                      </Button>
                    )}
                  </div>
                )}
                
                {selectedForDeletion.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-blue-400">
                      {selectedForDeletion.length} créneau(x) à supprimer
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteSelected}
                      disabled={deletingEvent}
                    >
                      {deletingEvent ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-1" />
                      )}
                      Supprimer
                    </Button>
                  </div>
                )}
                
                <Button variant="outline" size="sm" onClick={() => { clearSelection(); setShowEventCreator(false); }}>
                  <X className="w-4 h-4 mr-1" />
                  Effacer
                </Button>
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
