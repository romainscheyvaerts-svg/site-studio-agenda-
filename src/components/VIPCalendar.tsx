import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2, Clock, CheckCircle, X, MessageCircle, Plus, Trash2, FolderOpen } from "lucide-react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useViewMode } from "@/hooks/useViewMode";

interface TimeSlot {
  hour: number;
  available: boolean;
  status: "available" | "unavailable" | "on-request";
  eventName?: string;
  eventId?: string;
  clientEmail?: string;
  driveFolderLink?: string;
}

interface DayAvailability {
  date: string;
  slots: TimeSlot[];
}

interface VIPCalendarProps {
  onSelectSlot: (date: string, time: string, duration: number) => void;
  onConfirmBooking?: (date: string, time: string, duration: number) => void;
  selectedDate?: string;
  selectedTime?: string;
  showConfirmButton?: boolean;
  confirmLoading?: boolean;
  isAdminMode?: boolean;
  isVIPMode?: boolean;
  currentUserEmail?: string;
}

interface SelectedSlot {
  date: string;
  hour: number;
  eventId?: string;
}

const VIPCalendar = ({ 
  onSelectSlot, 
  onConfirmBooking, 
  selectedDate, 
  selectedTime, 
  showConfirmButton = false, 
  confirmLoading = false,
  isAdminMode = false,
  isVIPMode = false,
  currentUserEmail = ""
}: VIPCalendarProps) => {
  // VIP mode has similar features to admin mode but with restrictions
  const hasAdminFeatures = isAdminMode || isVIPMode;
  const { toast } = useToast();
  const { isMobileView } = useViewMode();
  const [weekStart, setWeekStart] = useState<Date>(startOfDay(new Date()));
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(selectedDate || null);
  const [selectedHour, setSelectedHour] = useState<number | null>(
    selectedTime ? parseInt(selectedTime.split(":")[0]) : null
  );
  const [duration, setDuration] = useState(2);
  const [eventName, setEventName] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [driveFolderLink, setDriveFolderLink] = useState<string | null>(null);
  
  // Multi-select for admin - always enabled in admin mode for booked slots
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
  
  // Mobile: selected day index for single-day navigation
  const [mobileSelectedDayIndex, setMobileSelectedDayIndex] = useState(0);

  // Fetch availability data
  useEffect(() => {
    const fetchAvailability = async () => {
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
    };

    fetchAvailability();
  }, [weekStart]);

  const handlePreviousWeek = () => {
    const newStart = addDays(weekStart, -7);
    if (newStart >= startOfDay(new Date())) {
      setWeekStart(newStart);
    }
  };

  const handleNextWeek = () => {
    setWeekStart(addDays(weekStart, 7));
  };

  const handleSelectSlot = async (date: string, hour: number) => {
    const dayData = availability.find(d => d.date === date);
    const slot = dayData?.slots.find(s => s.hour === hour);
    
    // Reset drive folder link
    setDriveFolderLink(null);
    
    // In admin/VIP mode, clicking on a booked slot toggles its selection for deletion
    if (hasAdminFeatures && slot?.status === "unavailable" && slot?.eventId) {
      // VIP users can only select their own events (check if event name contains their email)
      const canSelectSlot = isAdminMode || (isVIPMode && slot.eventName?.toLowerCase().includes(currentUserEmail.toLowerCase()));
      
      if (canSelectSlot) {
        const slotKey = `${date}-${hour}`;
        const existingIndex = selectedSlots.findIndex(s => `${s.date}-${s.hour}` === slotKey);
        
        if (existingIndex >= 0) {
          // Deselect if already selected
          setSelectedSlots(selectedSlots.filter((_, i) => i !== existingIndex));
        } else {
          // Add to selection
          setSelectedSlots([...selectedSlots, { date, hour, eventId: slot.eventId }]);
        }
        
        if (isAdminMode) {
          // Drive link now comes directly from the slot (computed server-side)
          setDriveFolderLink(slot.driveFolderLink || null);
        }
      } else {
        // VIP trying to select someone else's event - just show it normally
        setSelectedDay(date);
        setSelectedHour(hour);
      }
    } else {
      // Regular selection for available slots
      setSelectedDay(date);
      setSelectedHour(hour);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedDay && selectedHour !== null) {
      const timeStr = `${selectedHour.toString().padStart(2, "0")}:00`;
      onSelectSlot(selectedDay, timeStr, duration);
    }
  };

  const handleCreateEvent = async () => {
    if (!selectedDay || selectedHour === null) {
      toast({
        title: "Créneau requis",
        description: "Veuillez sélectionner un créneau",
        variant: "destructive",
      });
      return;
    }

    if (!eventName.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez entrer un nom pour l'événement",
        variant: "destructive",
      });
      return;
    }

    setCreatingEvent(true);

    try {
      const timeStr = `${selectedHour.toString().padStart(2, "0")}:00`;
      const { data, error } = await supabase.functions.invoke("create-admin-event", {
        body: {
          title: eventName.trim(),
          date: selectedDay,
          time: timeStr,
          duration: duration,
          clientName: eventName.trim(),
          clientEmail: "admin@makemusicstudio.be",
          sessionType: "with-engineer",
        },
      });

      if (error) throw error;

      toast({
        title: "Événement créé ! 🎉",
        description: `${eventName} ajouté à l'agenda`,
      });

      setEventName("");
      setSelectedDay(null);
      setSelectedHour(null);
      
      // Refresh availability
      setLoading(true);
      const refreshData = await supabase.functions.invoke("get-weekly-availability", {
        body: {
          startDate: weekStart.toISOString().split("T")[0],
          days: 14,
        },
      });
      setAvailability(refreshData.data?.availability || []);
      setLoading(false);
    } catch (err) {
      console.error("Failed to create event:", err);
      toast({
        title: "Erreur",
        description: "Impossible de créer l'événement",
        variant: "destructive",
      });
    } finally {
      setCreatingEvent(false);
    }
  };

  // Delete event handler for admin mode
  const handleDeleteEvent = async () => {
    if (!selectedDay || selectedHour === null) return;
    
    const dayData = availability.find(d => d.date === selectedDay);
    const slot = dayData?.slots.find(s => s.hour === selectedHour);
    
    if (!slot?.eventId) {
      toast({
        title: "Erreur",
        description: "Impossible de trouver l'ID de l'événement",
        variant: "destructive",
      });
      return;
    }

    setDeletingEvent(true);

    try {
      const { data, error } = await supabase.functions.invoke("delete-admin-event", {
        body: { eventId: slot.eventId },
      });

      if (error) {
        console.error("Function error:", error);
        throw new Error(error.message || "Erreur de fonction");
      }
      
      if (data?.error) {
        console.error("Response error:", data.error);
        throw new Error(data.error);
      }

      toast({
        title: "Événement supprimé ! 🗑️",
        description: `L'événement a été retiré de l'agenda`,
      });

      setSelectedDay(null);
      setSelectedHour(null);
      
      // Refresh availability
      await refreshAvailability();
    } catch (err: any) {
      console.error("Failed to delete event:", err);
      toast({
        title: "Erreur",
        description: err.message || "Impossible de supprimer l'événement",
        variant: "destructive",
      });
    } finally {
      setDeletingEvent(false);
    }
  };

  // Delete multiple events
  const handleDeleteMultiple = async () => {
    if (selectedSlots.length === 0) return;
    
    setDeletingEvent(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const slot of selectedSlots) {
        if (slot.eventId) {
          try {
            const { error } = await supabase.functions.invoke("delete-admin-event", {
              body: { eventId: slot.eventId },
            });
            if (!error) successCount++;
            else errorCount++;
          } catch {
            errorCount++;
          }
        }
      }

      toast({
        title: `${successCount} événement(s) supprimé(s)`,
        description: errorCount > 0 ? `${errorCount} erreur(s)` : undefined,
        variant: errorCount > 0 ? "destructive" : "default",
      });

      setSelectedSlots([]);
      
      // Refresh availability
      await refreshAvailability();
    } catch (err) {
      console.error("Failed to delete events:", err);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer les événements",
        variant: "destructive",
      });
    } finally {
      setDeletingEvent(false);
    }
  };

  const refreshAvailability = async () => {
    setLoading(true);
    const refreshData = await supabase.functions.invoke("get-weekly-availability", {
      body: {
        startDate: weekStart.toISOString().split("T")[0],
        days: 14,
      },
    });
    setAvailability(refreshData.data?.availability || []);
    setLoading(false);
  };

  // Check if slot is in multi-select
  const isSlotMultiSelected = (date: string, hour: number): boolean => {
    return selectedSlots.some(s => s.date === date && s.hour === hour);
  };

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, "0")}:00`;
  };

  // Check if a consecutive block of hours is available (available or on-request)
  const isBlockAvailable = (daySlots: TimeSlot[], startHour: number, blockSize: number): boolean => {
    for (let i = 0; i < blockSize; i++) {
      const slot = daySlots.find(s => s.hour === startHour + i);
      if (!slot || slot.status === "unavailable") return false;
    }
    return true;
  };

  // Check if any slot in block is on-request
  const isBlockOnRequest = (daySlots: TimeSlot[], startHour: number, blockSize: number): boolean => {
    for (let i = 0; i < blockSize; i++) {
      const slot = daySlots.find(s => s.hour === startHour + i);
      if (slot?.status === "on-request") return true;
    }
    return false;
  };

  // Get status for a slot considering the block
  const getSlotDisplayStatus = (daySlots: TimeSlot[], hour: number): "available" | "unavailable" | "on-request" => {
    const slot = daySlots.find(s => s.hour === hour);
    if (!slot) return "unavailable";
    
    // Check if the block starting at this hour is available
    if (!isBlockAvailable(daySlots, hour, duration)) {
      return "unavailable";
    }
    
    // If block is available, check if any slot is on-request
    if (isBlockOnRequest(daySlots, hour, duration)) {
      return "on-request";
    }
    
    return "available";
  };

  // Get event name for a slot
  const getSlotEventName = (daySlots: TimeSlot[], hour: number): string | undefined => {
    const slot = daySlots.find(s => s.hour === hour);
    return slot?.eventName;
  };

  // Get event ID for a slot (for deletion)
  const getSlotEventId = (daySlots: TimeSlot[], hour: number): string | undefined => {
    const slot = daySlots.find(s => s.hour === hour);
    return slot?.eventId;
  };

  // Check if selected slot can be deleted (has eventId and is unavailable)
  // Admin can delete any event, VIP can only delete their own events
  const canDeleteSelectedSlot = hasAdminFeatures && selectedDay && selectedHour !== null && (() => {
    const dayData = availability.find(d => d.date === selectedDay);
    const slot = dayData?.slots.find(s => s.hour === selectedHour);
    if (!slot?.eventId || slot?.status !== "unavailable") return false;
    
    // Admin can delete any event
    if (isAdminMode) return true;
    
    // VIP can only delete their own events (check if event name contains their email or name)
    if (isVIPMode && currentUserEmail) {
      const eventNameLower = slot.eventName?.toLowerCase() || "";
      return eventNameLower.includes(currentUserEmail.toLowerCase());
    }
    
    return false;
  })();

  const openWhatsApp = () => {
    const phoneNumber = "+32476094172";
    const message = selectedDay && selectedHour !== null 
      ? `Bonjour, je souhaite réserver le studio le ${format(new Date(selectedDay), "EEEE d MMMM yyyy", { locale: fr })} de ${formatHour(selectedHour)} à ${formatHour(selectedHour + duration)}. Ce créneau est-il disponible ?`
      : "Bonjour, je souhaite vérifier la disponibilité du studio.";
    window.open(`https://wa.me/${phoneNumber.replace("+", "")}?text=${encodeURIComponent(message)}`, "_blank");
  };

  // Get the days to display - 3 days on mobile, 8 on desktop (removed hour column = space for 1 more day)
  const daysToShow = isMobileView ? 3 : 8;
  const displayDays = availability.slice(0, daysToShow);
  
  // Mobile: get single day for mobile navigation
  const mobileDays = availability.slice(mobileSelectedDayIndex, mobileSelectedDayIndex + 1);
  
  // Auto-scroll to 8am on mount
  useEffect(() => {
    const scrollContainer = document.getElementById('calendar-scroll-container');
    if (scrollContainer && !loading) {
      // Each row is approximately 37px (36px + 1px gap), scroll to 8th row (8am)
      scrollContainer.scrollTop = 8 * 37;
    }
  }, [loading]);

  // Check if selected slot is on-request
  const selectedSlotOnRequest = selectedDay && selectedHour !== null 
    ? (() => {
        const dayData = availability.find(d => d.date === selectedDay);
        return dayData ? isBlockOnRequest(dayData.slots, selectedHour, duration) : false;
      })()
    : false;

  return (
    <div className={cn(
      "bg-card rounded-2xl border border-primary/30 box-glow-cyan",
      isMobileView ? "p-3" : "p-6"
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between",
        isMobileView ? "mb-3 flex-col gap-2" : "mb-6"
      )}>
        <h3 className={cn(
          "font-display text-foreground flex items-center gap-2",
          isMobileView ? "text-sm" : "text-xl"
        )}>
          <Clock className={cn(isMobileView ? "w-4 h-4" : "w-5 h-5", "text-primary")} />
          {isAdminMode ? "AGENDA" : "AGENDA VIP"}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className={cn(isMobileView && "h-8 w-8")}
            onClick={handlePreviousWeek}
            disabled={isSameDay(weekStart, startOfDay(new Date()))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className={cn(
            "text-muted-foreground text-center",
            isMobileView ? "text-xs min-w-[100px]" : "text-sm min-w-[150px]"
          )}>
            {format(weekStart, "d MMM", { locale: fr })} - {format(addDays(weekStart, 6), "d MMM", { locale: fr })}
          </span>
          <Button variant="outline" size="icon" className={cn(isMobileView && "h-8 w-8")} onClick={handleNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Legend - Compact on mobile */}
      <div className={cn(
        "flex items-center gap-2 mb-3 text-xs flex-wrap",
        isMobileView ? "justify-center gap-x-3 gap-y-1" : "gap-4 mb-4"
      )}>
        <div className="flex items-center gap-1">
          <div className={cn("rounded bg-green-500", isMobileView ? "w-2 h-2" : "w-3 h-3")} />
          <span className="text-muted-foreground">{isMobileView ? "Dispo" : "Disponible"}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={cn("rounded bg-amber-500", isMobileView ? "w-2 h-2" : "w-3 h-3")} />
          <span className="text-muted-foreground">{isMobileView ? "Demande" : "Sur demande"}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={cn("rounded bg-destructive", isMobileView ? "w-2 h-2" : "w-3 h-3")} />
          <span className="text-muted-foreground">Réservé</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={cn("rounded bg-primary ring-2 ring-primary", isMobileView ? "w-2 h-2" : "w-3 h-3")} />
          <span className="text-muted-foreground">{isMobileView ? "Sélec." : "Sélectionné"}</span>
        </div>
      </div>

      {/* Duration selector */}
      <div className={cn(
        "rounded-lg bg-secondary/50 border border-border",
        isMobileView ? "mb-3 p-2" : "mb-4 p-3"
      )}>
        <Label className={cn("text-muted-foreground mb-2 block", isMobileView ? "text-xs" : "text-sm")}>
          Durée de la session
        </Label>
        <div className={cn("flex items-center gap-1 justify-center", isMobileView ? "flex-wrap" : "gap-2")}>
          {[1, 2, 3, 4, 5, 6].map((h) => (
            <Button
              key={h}
              variant={duration === h ? "default" : "outline"}
              size="sm"
              onClick={() => setDuration(h)}
              className={cn(
                duration === h && "bg-primary text-primary-foreground",
                isMobileView && "h-7 w-10 text-xs"
              )}
            >
              {h}h
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className={cn("animate-spin text-primary", isMobileView ? "w-6 h-6" : "w-8 h-8")} />
          <span className={cn("ml-2 text-muted-foreground", isMobileView && "text-sm")}>Chargement...</span>
        </div>
      ) : (
        <>
          {/* Calendar grid */}
          {isMobileView ? (
            /* MOBILE VIEW - Single day at a time with horizontal navigation */
            <div className="space-y-2">
              {/* Day selector for mobile */}
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setMobileSelectedDayIndex(Math.max(0, mobileSelectedDayIndex - 1))}
                  disabled={mobileSelectedDayIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                {/* Day pills */}
                <div className="flex gap-1 overflow-x-auto flex-1 mx-2 justify-center">
                  {availability.slice(0, 7).map((day, idx) => {
                    const date = new Date(day.date);
                    const isActive = idx === mobileSelectedDayIndex;
                    return (
                      <button
                        key={day.date}
                        onClick={() => setMobileSelectedDayIndex(idx)}
                        className={cn(
                          "px-2 py-1 rounded-lg text-xs flex-shrink-0 transition-colors",
                          isActive 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-secondary/50 text-muted-foreground"
                        )}
                      >
                        <div className="font-semibold">{format(date, "EEE", { locale: fr })}</div>
                        <div className="text-sm font-display">{format(date, "d")}</div>
                      </button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setMobileSelectedDayIndex(Math.min(6, mobileSelectedDayIndex + 1))}
                  disabled={mobileSelectedDayIndex >= 6}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Single day time slots - Full width, larger cells */}
              <div className="grid grid-cols-4 gap-1.5 max-h-[50vh] overflow-y-auto pb-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((hour) => {
                  const day = availability[mobileSelectedDayIndex];
                  if (!day) return null;
                  
                  const displayStatus = getSlotDisplayStatus(day.slots, hour);
                  const eventName = getSlotEventName(day.slots, hour);
                  const isClickable = displayStatus !== "unavailable" || hasAdminFeatures;
                  const isSelected = selectedDay === day.date && selectedHour === hour;
                  const isMultiSelected = hasAdminFeatures && isSlotMultiSelected(day.date, hour);
                  
                  return (
                    <button
                      key={`${day.date}-${hour}`}
                      onClick={() => isClickable && handleSelectSlot(day.date, hour)}
                      disabled={!isClickable && !hasAdminFeatures}
                      className={cn(
                        "p-2 rounded-lg text-xs transition-all duration-200 min-h-[48px] flex flex-col items-center justify-center",
                        isMultiSelected
                          ? "bg-blue-500 text-white ring-2 ring-blue-400"
                          : displayStatus === "available"
                            ? isSelected
                              ? "bg-primary text-primary-foreground ring-2 ring-primary"
                              : "bg-green-500/20 text-green-500 active:bg-green-500/40"
                            : displayStatus === "on-request"
                              ? isSelected
                                ? "bg-primary text-primary-foreground ring-2 ring-amber-500"
                                : "bg-amber-500/20 text-amber-500 active:bg-amber-500/40"
                              : isSelected
                                ? "bg-primary text-primary-foreground ring-2 ring-primary"
                                : hasAdminFeatures 
                                  ? "bg-destructive/20 text-destructive active:bg-destructive/40"
                                  : "bg-destructive/20 text-destructive/60"
                      )}
                    >
                      <span className="font-semibold text-sm">{formatHour(hour)}</span>
                      {isMultiSelected ? (
                        <span className="text-[10px]">✓</span>
                      ) : displayStatus === "unavailable" && eventName ? (
                        <span className="truncate w-full text-[10px] opacity-80">{eventName.slice(0, 8)}</span>
                      ) : displayStatus === "available" ? (
                        <span className="opacity-50 text-[10px]">✓</span>
                      ) : displayStatus === "on-request" ? (
                        <span className="opacity-50 text-[10px]">?</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* DESKTOP VIEW - Week grid - No hour column, 8 days */
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Days header - 8 columns */}
                <div className="grid grid-cols-8 gap-1 mb-2">
                  {displayDays.map((day) => {
                    const date = new Date(day.date);
                    const isSelected = selectedDay === day.date;
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

                {/* Time slots grid - scroll starts at 8am */}
                <div id="calendar-scroll-container" className="space-y-1 max-h-[400px] overflow-y-auto">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((hour) => (
                    <div key={hour} className="grid grid-cols-8 gap-1">
                      {displayDays.map((day) => {
                        const displayStatus = getSlotDisplayStatus(day.slots, hour);
                        const eventName = getSlotEventName(day.slots, hour);
                        const isClickable = displayStatus !== "unavailable" || hasAdminFeatures;
                        const isSelected = selectedDay === day.date && selectedHour === hour;
                        const isMultiSelected = hasAdminFeatures && isSlotMultiSelected(day.date, hour);
                        
                        return (
                          <button
                            key={`${day.date}-${hour}`}
                            onClick={() => isClickable && handleSelectSlot(day.date, hour)}
                            disabled={!isClickable && !hasAdminFeatures}
                            className={cn(
                              "p-1 rounded text-[10px] transition-all duration-200 min-h-[36px] flex flex-col items-center justify-center",
                              isMultiSelected
                                ? "bg-blue-500 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-background"
                                : displayStatus === "available"
                                  ? isSelected
                                    ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                                    : "bg-green-500/20 text-green-500 hover:bg-green-500/40 cursor-pointer"
                                  : displayStatus === "on-request"
                                    ? isSelected
                                      ? "bg-primary text-primary-foreground ring-2 ring-amber-500 ring-offset-2 ring-offset-background"
                                      : "bg-amber-500/20 text-amber-500 hover:bg-amber-500/40 cursor-pointer"
                                    : isSelected
                                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                                      : hasAdminFeatures 
                                        ? "bg-destructive/20 text-destructive hover:bg-destructive/40 cursor-pointer"
                                        : "bg-destructive/20 text-destructive cursor-pointer"
                            )}
                            title={eventName || formatHour(hour)}
                          >
                            <span className="font-medium">{formatHour(hour)}</span>
                            {isMultiSelected ? (
                              <span className="text-[8px]">✓ sélectionné</span>
                            ) : displayStatus === "unavailable" && eventName ? (
                              <span className="truncate w-full text-[8px] opacity-80 px-0.5">{eventName}</span>
                            ) : displayStatus === "available" ? (
                              <span className="opacity-50">✓</span>
                            ) : displayStatus === "on-request" ? (
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
          )}

          {/* Multi-select delete button for admin */}
          {hasAdminFeatures && selectedSlots.length > 0 && (
            <div className={cn(
              "rounded-xl bg-blue-500/10 border border-blue-500/30",
              isMobileView ? "mt-3 p-3" : "mt-4 p-4"
            )}>
              <div className={cn(
                "flex items-center gap-2",
                isMobileView ? "flex-col" : "justify-between flex-wrap"
              )}>
                <p className={cn("text-blue-400", isMobileView ? "text-xs" : "text-sm")}>
                  {selectedSlots.length} créneau(x) à supprimer
                </p>
                <div className={cn("flex gap-2", isMobileView && "w-full")}>
                  {driveFolderLink && (
                    <Button 
                      onClick={() => window.open(driveFolderLink, '_blank')}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "border-blue-500 text-blue-500 hover:bg-blue-500/10",
                        isMobileView && "flex-1 text-xs h-8"
                      )}
                    >
                      <FolderOpen className="w-4 h-4 mr-1" />
                      Drive
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteMultiple}
                    disabled={deletingEvent}
                    className={cn(isMobileView && "flex-1 text-xs h-8")}
                  >
                    {deletingEvent ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {!isMobileView && <span className="ml-1">Supprimer</span>}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSlots([])}
                    className={cn(isMobileView && "h-8 w-8 p-0")}
                  >
                    <X className="w-4 h-4" />
                    {!isMobileView && <span className="ml-1">Effacer</span>}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Selection summary and confirm */}
          {selectedDay && selectedHour !== null && (
            <div className={cn(
              "rounded-xl border",
              isMobileView ? "mt-3 p-3" : "mt-6 p-4",
              selectedSlotOnRequest 
                ? "bg-amber-500/10 border-amber-500/30" 
                : "bg-primary/10 border-primary/30"
            )}>
              <div className={cn("flex flex-col", isMobileView ? "gap-3" : "gap-4")}>
                <div>
                  <p className={cn("text-muted-foreground", isMobileView ? "text-xs" : "text-sm")}>
                    Créneau sélectionné
                  </p>
                  <p className={cn("font-display text-foreground", isMobileView ? "text-sm" : "text-xl")}>
                    {format(new Date(selectedDay), isMobileView ? "EEE d MMM" : "EEEE d MMMM yyyy", { locale: fr })}
                  </p>
                  <p className={cn(
                    "font-semibold",
                    isMobileView && "text-sm",
                    selectedSlotOnRequest ? "text-amber-500" : "text-primary"
                  )}>
                    {formatHour(selectedHour)} - {formatHour(selectedHour + duration)} ({duration}h)
                  </p>
                  {selectedSlotOnRequest && (
                    <p className={cn(
                      "text-amber-500 mt-2 flex items-center gap-2",
                      isMobileView ? "text-xs" : "text-sm"
                    )}>
                      <MessageCircle className={cn(isMobileView ? "w-3 h-3" : "w-4 h-4")} />
                      {isMobileView ? "Créneau sur demande" : "Ce créneau est sur demande. Contactez le studio pour confirmer."}
                    </p>
                  )}
                </div>

                {/* Admin/VIP event deletion */}
                {hasAdminFeatures && (
                  <div className={cn(
                    "border-t border-border space-y-3",
                    isMobileView ? "pt-3" : "pt-4 space-y-4"
                  )}>
                    {/* Delete button for booked slots */}
                    {canDeleteSelectedSlot && (
                      <div className={cn(
                        "rounded-lg bg-destructive/10 border border-destructive/30",
                        isMobileView ? "p-2" : "p-3"
                      )}>
                        <p className={cn(
                          "text-destructive mb-2 flex items-center gap-2",
                          isMobileView ? "text-xs" : "text-sm"
                        )}>
                          <Trash2 className={cn(isMobileView ? "w-3 h-3" : "w-4 h-4")} />
                          {isMobileView ? "Supprimer cet événement" : "Cet événement peut être supprimé"}
                        </p>
                        <div className={cn("flex gap-2", isMobileView && "flex-col")}>
                          {driveFolderLink && (
                            <Button 
                              onClick={() => window.open(driveFolderLink, '_blank')}
                              variant="outline"
                              size={isMobileView ? "sm" : "default"}
                              className={cn(
                                "border-blue-500 text-blue-500 hover:bg-blue-500/10",
                                isMobileView && "text-xs h-8"
                              )}
                            >
                              <FolderOpen className={cn(isMobileView ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2")} />
                              {isMobileView ? "DRIVE" : "DOSSIER GOOGLE DRIVE"}
                            </Button>
                          )}
                          <Button 
                            onClick={handleDeleteEvent}
                            disabled={deletingEvent}
                            variant="destructive"
                            size={isMobileView ? "sm" : "default"}
                            className={cn(
                              !driveFolderLink && "w-full",
                              isMobileView && "text-xs h-8"
                            )}
                          >
                            {deletingEvent ? (
                              <Loader2 className={cn("animate-spin", isMobileView ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2")} />
                            ) : (
                              <Trash2 className={cn(isMobileView ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2")} />
                            )}
                            SUPPRIMER
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Create new event - Admin only */}
                    {isAdminMode && (
                      <div>
                        <Label className={cn("text-muted-foreground mb-2 block", isMobileView ? "text-xs" : "text-sm")}>
                          {isMobileView ? "Créer événement" : "Créer un nouvel événement"}
                        </Label>
                        <div className={cn("flex gap-2", isMobileView && "flex-col")}>
                          <Input
                            value={eventName}
                            onChange={(e) => setEventName(e.target.value)}
                            placeholder="Ex: Session John Doe"
                            className={cn("flex-1", isMobileView && "text-sm h-9")}
                          />
                          <Button 
                            onClick={handleCreateEvent}
                            disabled={creatingEvent || !eventName.trim()}
                            className={cn("bg-green-600 hover:bg-green-700", isMobileView && "text-xs h-9")}
                            size={isMobileView ? "sm" : "default"}
                          >
                            {creatingEvent ? (
                              <Loader2 className={cn("animate-spin", isMobileView ? "w-3 h-3" : "w-4 h-4")} />
                            ) : (
                              <>
                                <Plus className={cn(isMobileView ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2")} />
                                CRÉER
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* VIP user booking actions (can book but not create events) */}
                {isVIPMode && !canDeleteSelectedSlot && (
                  <div className={cn("flex gap-2", isMobileView ? "flex-col" : "flex-wrap")}>
                    {selectedSlotOnRequest ? (
                      <Button 
                        variant="outline" 
                        onClick={openWhatsApp}
                        size={isMobileView ? "sm" : "default"}
                        className={cn(
                          "border-amber-500 text-amber-500 hover:bg-amber-500/10",
                          isMobileView && "text-xs h-9"
                        )}
                      >
                        <MessageCircle className={cn(isMobileView ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2")} />
                        {isMobileView ? "WHATSAPP" : "CONTACTER VIA WHATSAPP"}
                      </Button>
                    ) : (
                      <>
                        <Button 
                          variant="outline" 
                          onClick={handleConfirmSelection}
                          size={isMobileView ? "sm" : "default"}
                          className={cn(isMobileView && "text-xs h-9")}
                        >
                          <CheckCircle className={cn(isMobileView ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2")} />
                          SÉLECTIONNER
                        </Button>
                        {showConfirmButton && onConfirmBooking && (
                          <Button 
                            variant="hero" 
                            onClick={() => onConfirmBooking(selectedDay!, `${selectedHour!.toString().padStart(2, "0")}:00`, duration)}
                            disabled={confirmLoading}
                            size={isMobileView ? "sm" : "default"}
                            className={cn(isMobileView && "text-xs h-9")}
                          >
                            {confirmLoading ? (
                              <>
                                <Loader2 className={cn("animate-spin", isMobileView ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2")} />
                                {isMobileView ? "..." : "Validation..."}
                              </>
                            ) : (
                              <>
                                <CheckCircle className={cn(isMobileView ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2")} />
                                {isMobileView ? "VALIDER" : "VALIDER LA RÉSERVATION"}
                              </>
                            )}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Regular user actions (not admin mode, not VIP mode) */}
                {!isAdminMode && !isVIPMode && (
                  <div className={cn("flex gap-2", isMobileView ? "flex-col" : "flex-wrap")}>
                    {selectedSlotOnRequest ? (
                      <Button 
                        variant="outline" 
                        onClick={openWhatsApp}
                        size={isMobileView ? "sm" : "default"}
                        className={cn(
                          "border-amber-500 text-amber-500 hover:bg-amber-500/10",
                          isMobileView && "text-xs h-9"
                        )}
                      >
                        <MessageCircle className={cn(isMobileView ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2")} />
                        {isMobileView ? "WHATSAPP" : "CONTACTER VIA WHATSAPP"}
                      </Button>
                    ) : (
                      <>
                        <Button 
                          variant="outline" 
                          onClick={handleConfirmSelection}
                          size={isMobileView ? "sm" : "default"}
                          className={cn(isMobileView && "text-xs h-9")}
                        >
                          <CheckCircle className={cn(isMobileView ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2")} />
                          SÉLECTIONNER
                        </Button>
                        {showConfirmButton && onConfirmBooking && (
                          <Button 
                            variant="hero" 
                            onClick={() => onConfirmBooking(selectedDay!, `${selectedHour!.toString().padStart(2, "0")}:00`, duration)}
                            disabled={confirmLoading}
                            size={isMobileView ? "sm" : "default"}
                            className={cn(isMobileView && "text-xs h-9")}
                          >
                            {confirmLoading ? (
                              <>
                                <Loader2 className={cn("animate-spin", isMobileView ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2")} />
                                {isMobileView ? "..." : "Validation..."}
                              </>
                            ) : (
                              <>
                                <CheckCircle className={cn(isMobileView ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2")} />
                                {isMobileView ? "VALIDER" : "VALIDER LA RÉSERVATION"}
                              </>
                            )}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VIPCalendar;
