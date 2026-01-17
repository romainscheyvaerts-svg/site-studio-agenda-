import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Trash2,
  Edit,
  X
} from "lucide-react";
import { 
  format, 
  addDays, 
  addWeeks,
  addMonths,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  eachDayOfInterval
} from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import AdminEventEditPanel from "./AdminEventEditPanel";
import { useAdmin } from "@/hooks/useAdmin";
import { useViewMode } from "@/hooks/useViewMode";

type ViewMode = "month" | "week" | "day";

interface TimeSlot {
  hour: number;
  available: boolean;
  status: "available" | "unavailable" | "on-request";
  eventName?: string;
  eventId?: string;
  clientEmail?: string;
  driveFolderLink?: string;
  driveSessionFolderLink?: string;
  // Secondary calendar (superadmin only)
  hasSecondaryCalendarConflict?: boolean;
  secondaryCalendarEventName?: string;
  // Tertiary calendar (superadmin only)
  hasTertiaryCalendarConflict?: boolean;
  tertiaryCalendarEventName?: string;
}

interface DayAvailability {
  date: string;
  slots: TimeSlot[];
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startHour: number;
  endHour: number;
  status: "available" | "unavailable" | "on-request";
  clientEmail?: string;
}

interface AdminCalendarModernProps {
  onSelectSlot?: (date: string, time: string, duration: number) => void;
  selectedDate?: string;
  selectedTime?: string;
  isAdminMode?: boolean;
  showPriceCalculator?: boolean;
}

const AdminCalendarModern = ({ 
  onSelectSlot,
  selectedDate: externalSelectedDate,
  selectedTime: externalSelectedTime,
  isAdminMode = false,
  showPriceCalculator = false
}: AdminCalendarModernProps) => {
  const { toast } = useToast();
  const { isSuperAdmin } = useAdmin();
  const { isMobileView } = useViewMode();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventCreator, setShowEventCreator] = useState(false);
  const [showEventEditor, setShowEventEditor] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; hour: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ date: string; hour: number } | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ date: string; startHour: number; endHour: number } | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // Fetch availability data
  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    try {
      let startDate: Date;
      let days: number;

      if (viewMode === "month") {
        startDate = startOfMonth(currentDate);
        days = 42; // 6 weeks
      } else if (viewMode === "week") {
        startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
        days = 7;
      } else {
        startDate = currentDate;
        days = 1;
      }

      const { data, error } = await supabase.functions.invoke("get-weekly-availability", {
        body: {
          startDate: format(startDate, "yyyy-MM-dd"),
          days,
          includeSuperadminCalendars: isSuperAdmin,
        },
      });

      if (error) throw error;
      setAvailability(data.availability || []);
    } catch (err) {
      console.error("Failed to fetch availability:", err);
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode, isSuperAdmin]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Navigation
  const goToPrevious = () => {
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, -1));
    else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, -1));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const goToNext = () => {
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  // Get events from availability data
  const getEventsForDay = (date: string): CalendarEvent[] => {
    const dayData = availability.find(d => d.date === date);
    if (!dayData) return [];

    const events: CalendarEvent[] = [];
    let currentEvent: CalendarEvent | null = null;

    dayData.slots.forEach((slot) => {
      if (slot.status === "unavailable" && slot.eventName) {
        // Debug: log slot data
        console.log("[EVENTS] Slot data:", { hour: slot.hour, eventName: slot.eventName, eventId: slot.eventId, hasEventId: !!slot.eventId });
        
        if (currentEvent && currentEvent.title === slot.eventName && currentEvent.id === slot.eventId) {
          currentEvent.endHour = slot.hour + 1;
        } else {
          if (currentEvent) events.push(currentEvent);
          const eventId = slot.eventId || `${date}-${slot.hour}`;
          console.log("[EVENTS] Creating event with ID:", eventId, "from slot.eventId:", slot.eventId);
          currentEvent = {
            id: eventId,
            title: slot.eventName,
            date,
            startHour: slot.hour,
            endHour: slot.hour + 1,
            status: slot.status,
            clientEmail: slot.clientEmail,
          };
        }
      } else {
        if (currentEvent) {
          events.push(currentEvent);
          currentEvent = null;
        }
      }
    });

    if (currentEvent) events.push(currentEvent);
    return events;
  };

  // Delete event handler
  const handleDeleteEvent = async (eventId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    console.log("[DELETE] Attempting to delete event with ID:", eventId);
    
    // Google Calendar event IDs are alphanumeric strings
    // Only reject if truly empty or if it's a generated placeholder ID (format: date-hour)
    const isPlaceholderId = /^\d{4}-\d{2}-\d{2}-\d+$/.test(eventId);
    
    console.log("[DELETE] Is placeholder ID:", isPlaceholderId);
    
    if (!eventId || isPlaceholderId) {
      console.error("[DELETE] Invalid event ID - empty or placeholder:", eventId);
      toast({
        title: "Erreur",
        description: `Impossible de supprimer cet événement (ID: ${eventId || "vide"})`,
        variant: "destructive",
      });
      return;
    }

    setDeletingEventId(eventId);
    
    try {
      // Get current session to verify auth
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("[DELETE] Current session:", sessionData?.session ? "Active" : "None");
      console.log("[DELETE] User ID:", sessionData?.session?.user?.id);
      console.log("[DELETE] User email:", sessionData?.session?.user?.email);
      
      console.log("[DELETE] Calling delete-admin-event function with eventId:", eventId);
      
      const { data, error } = await supabase.functions.invoke("delete-admin-event", {
        body: { eventId },
      });

      console.log("[DELETE] Response data:", data);
      console.log("[DELETE] Response error:", error);

      if (error) {
        console.error("[DELETE] Function error details:", {
          message: error.message,
          name: error.name,
          context: error.context,
        });
        
        // Check if it's an auth error
        if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
          throw new Error("Non autorisé - Vérifiez que vous êtes connecté et avez le rôle admin");
        }
        if (error.message?.includes("403") || error.message?.includes("Forbidden")) {
          throw new Error("Accès refusé - Vous n'avez pas les droits admin");
        }
        
        throw new Error(error.message || "Erreur de la fonction");
      }

      if (data?.error) {
        console.error("[DELETE] Data error:", data.error);
        throw new Error(data.error);
      }

      toast({
        title: "Événement supprimé",
        description: "L'événement a été supprimé du calendrier",
      });
      
      fetchAvailability();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      console.error("[DELETE] Error:", errorMessage, err);
      toast({
        title: "Erreur de suppression",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDeletingEventId(null);
    }
  };

  // Edit event handler
  const handleEditEvent = (event: CalendarEvent, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    console.log("[EDIT] Opening edit panel for event:", { id: event.id, title: event.title, date: event.date, startHour: event.startHour, endHour: event.endHour });
    setEditingEvent(event);
    setShowEventEditor(true);
  };

  // Get title for current view
  const getTitle = () => {
    if (viewMode === "month") return format(currentDate, "MMMM yyyy", { locale: fr });
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, "d MMM", { locale: fr })} - ${format(end, "d MMM yyyy", { locale: fr })}`;
    }
    return format(currentDate, "EEEE d MMMM yyyy", { locale: fr });
  };

  // Calendar container height - compact to fit on screen
  const calendarHeight = isMobileView ? "h-[450px]" : "h-[500px]";

  // Get secondary/tertiary calendar events for a day (superadmin only)
  const getSecondaryTertiaryEventsForDay = (date: string) => {
    const dayData = availability.find(d => d.date === date);
    if (!dayData) return { secondary: [], tertiary: [] };

    const secondaryEvents: { hour: number; name: string }[] = [];
    const tertiaryEvents: { hour: number; name: string }[] = [];

    dayData.slots.forEach((slot) => {
      if (slot.hasSecondaryCalendarConflict && slot.secondaryCalendarEventName) {
        // Check if we already have this event (consecutive hours)
        const existing = secondaryEvents.find(e => e.name === slot.secondaryCalendarEventName);
        if (!existing) {
          secondaryEvents.push({ hour: slot.hour, name: slot.secondaryCalendarEventName });
        }
      }
      if (slot.hasTertiaryCalendarConflict && slot.tertiaryCalendarEventName) {
        const existing = tertiaryEvents.find(e => e.name === slot.tertiaryCalendarEventName);
        if (!existing) {
          tertiaryEvents.push({ hour: slot.hour, name: slot.tertiaryCalendarEventName });
        }
      }
    });

    return { secondary: secondaryEvents, tertiary: tertiaryEvents };
  };

  // Render Month View
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className={cn(
        "overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/30 hover:scrollbar-thumb-primary/50",
        calendarHeight
      )}>
        <div className="grid grid-cols-7 gap-0.5">
          {/* Day headers */}
          {["L", "M", "M", "J", "V", "S", "D"].map((day, i) => (
            <div key={`${day}-${i}`} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
              {isMobileView ? day : ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][i]}
            </div>
          ))}

          {/* Calendar days */}
          {days.map(day => {
            const dateStr = format(day, "yyyy-MM-dd");
            const events = getEventsForDay(dateStr);
            const { secondary: secondaryEvents, tertiary: tertiaryEvents } = getSecondaryTertiaryEventsForDay(dateStr);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            const hasSecondaryEvents = isSuperAdmin && secondaryEvents.length > 0;
            const hasTertiaryEvents = isSuperAdmin && tertiaryEvents.length > 0;

            return (
              <div
                key={dateStr}
                onClick={() => {
                  setCurrentDate(day);
                  setViewMode("day");
                }}
                className={cn(
                  "p-0.5 border border-border/30 rounded cursor-pointer transition-all hover:bg-secondary/50",
                  !isCurrentMonth && "opacity-40",
                  isToday && "ring-1 ring-primary",
                  isMobileView ? "min-h-[50px]" : "min-h-[70px]"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "text-xs font-medium mb-0.5",
                    isToday ? "text-primary" : "text-foreground"
                  )}>
                    {format(day, "d")}
                  </div>
                  {/* Secondary/Tertiary calendar indicators */}
                  {(hasSecondaryEvents || hasTertiaryEvents) && (
                    <div className="flex gap-0.5">
                      {hasSecondaryEvents && (
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" title={secondaryEvents[0]?.name} />
                      )}
                      {hasTertiaryEvents && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title={tertiaryEvents[0]?.name} />
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-0.5">
                  {/* Main calendar events */}
                  {events.slice(0, isMobileView ? 1 : 2).map(event => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditEvent(event);
                      }}
                      className="text-[8px] px-0.5 py-0 rounded bg-destructive/20 text-destructive truncate leading-tight"
                      title={`${event.title} (${event.startHour}h-${event.endHour}h)`}
                    >
                      {event.startHour}h {event.title}
                    </div>
                  ))}
                  {/* Secondary calendar events (superadmin only) */}
                  {isSuperAdmin && secondaryEvents.slice(0, 1).map((event, idx) => (
                    <div
                      key={`sec-${idx}`}
                      className="text-[8px] px-0.5 py-0 rounded bg-purple-500/20 text-purple-400 truncate leading-tight"
                      title={`${event.name} (${event.hour}h) - Agenda 2`}
                    >
                      {event.hour}h {event.name}
                    </div>
                  ))}
                  {/* Tertiary calendar events (superadmin only) */}
                  {isSuperAdmin && tertiaryEvents.slice(0, 1).map((event, idx) => (
                    <div
                      key={`ter-${idx}`}
                      className="text-[8px] px-0.5 py-0 rounded bg-blue-500/20 text-blue-400 truncate leading-tight"
                      title={`${event.name} (${event.hour}h) - Agenda 3`}
                    >
                      {event.hour}h {event.name}
                    </div>
                  ))}
                  {/* Show count of additional events */}
                  {(events.length + (isSuperAdmin ? secondaryEvents.length + tertiaryEvents.length : 0)) > (isMobileView ? 1 : 2) && (
                    <div className="text-[8px] text-muted-foreground px-0.5">
                      +{events.length + (isSuperAdmin ? secondaryEvents.length + tertiaryEvents.length : 0) - (isMobileView ? 1 : 2)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Week View
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
    const hours = Array.from({ length: 24 }, (_, i) => i); // 0h to 23h (24/7)

    return (
      <div className={cn(
        "overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/30 hover:scrollbar-thumb-primary/50",
        calendarHeight
      )}>
        <div className={cn("min-w-[700px]", isMobileView && "min-w-[600px]")}>
          {/* Header with days - sticky */}
          <div className="grid grid-cols-8 gap-0.5 mb-1 sticky top-0 bg-card z-10 pb-1">
            <div className="w-12"></div>
            {days.map(day => {
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => {
                    setCurrentDate(day);
                    setViewMode("day");
                  }}
                  className={cn(
                    "text-center py-1 rounded cursor-pointer hover:bg-secondary/50",
                    isToday && "bg-primary/20"
                  )}
                >
                  <div className="text-[10px] text-muted-foreground">
                    {format(day, "EEE", { locale: fr })}.
                  </div>
                  <div className={cn(
                    "text-sm font-semibold",
                    isToday ? "text-primary" : "text-foreground"
                  )}>
                    {format(day, "d")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="relative">
            {hours.map(hour => (
              <div key={hour} className="grid grid-cols-8 gap-0.5 h-8 border-t border-border/20">
                <div className="w-12 text-[10px] text-muted-foreground pr-1 text-right -mt-1.5">
                  {hour}:00
                </div>
                {days.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayData = availability.find(d => d.date === dateStr);
                  const slot = dayData?.slots.find(s => s.hour === hour);
                  const status = slot?.status || "unavailable";
                  const isBooked = status === "unavailable" && slot?.eventName;

                  // Secondary/Tertiary calendar conflicts (superadmin only)
                  const hasSecondaryConflict = slot?.hasSecondaryCalendarConflict;
                  const hasTertiaryConflict = slot?.hasTertiaryCalendarConflict;
                  
                  // Check if this slot is part of a selected range
                  const isInSelectedRange = selectedRange && 
                    selectedRange.date === dateStr && 
                    hour >= selectedRange.startHour && 
                    hour < selectedRange.endHour;
                  
                  // Check if this is the selection start point
                  const isSelectionStart = selectionStart && 
                    selectionStart.date === dateStr && 
                    selectionStart.hour === hour;

                  const handleSlotClick = () => {
                    // If clicking on a booked slot, open edit/view
                    if (isBooked && slot?.eventId) {
                      const events = getEventsForDay(dateStr);
                      const event = events.find(e => e.id === slot.eventId);
                      if (event) {
                        handleEditEvent(event);
                        return;
                      }
                    }

                    if (status === "available" || status === "on-request") {
                      if (!selectionStart) {
                        // First click: set start
                        setSelectionStart({ date: dateStr, hour });
                        setSelectedRange({ date: dateStr, startHour: hour, endHour: hour + 1 });
                      } else if (selectionStart.date === dateStr && hour >= selectionStart.hour) {
                        // Second click on same day: set end and confirm
                        const duration = hour - selectionStart.hour + 1;
                        const timeStr = `${selectionStart.hour.toString().padStart(2, "0")}:00`;
                        
                        setSelectedRange({ date: dateStr, startHour: selectionStart.hour, endHour: hour + 1 });
                        
                        if (onSelectSlot) {
                          onSelectSlot(dateStr, timeStr, duration);
                          toast({
                            title: "Créneau sélectionné",
                            description: `${dateStr} de ${selectionStart.hour}h à ${hour + 1}h (${duration}h)`,
                          });
                        }
                        
                        // Reset selection for next selection
                        setSelectionStart(null);
                      } else {
                        // Different day or earlier hour: restart selection
                        setSelectionStart({ date: dateStr, hour });
                        setSelectedRange({ date: dateStr, startHour: hour, endHour: hour + 1 });
                      }
                    }
                  };

                  return (
                    <div
                      key={`${dateStr}-${hour}`}
                      onClick={handleSlotClick}
                      className={cn(
                        "rounded-sm cursor-pointer transition-all relative group",
                        status === "available" && !isInSelectedRange && "bg-green-500/10 hover:bg-green-500/30",
                        status === "on-request" && !isInSelectedRange && "bg-amber-500/10 hover:bg-amber-500/30",
                        isBooked && "bg-destructive/20 hover:bg-destructive/30",
                        isInSelectedRange && "bg-primary/40 ring-1 ring-primary",
                        isSelectionStart && "ring-1 ring-primary",
                        // Highlight secondary/tertiary calendar conflicts
                        (hasSecondaryConflict || hasTertiaryConflict) && !isBooked && "ring-1 ring-purple-500/50"
                      )}
                      title={
                        hasSecondaryConflict || hasTertiaryConflict
                          ? `${slot?.secondaryCalendarEventName || ""} ${slot?.tertiaryCalendarEventName || ""}`.trim()
                          : undefined
                      }
                    >
                      {/* Secondary/Tertiary calendar indicator */}
                      {(hasSecondaryConflict || hasTertiaryConflict) && !isBooked && (
                        <div className="absolute top-0 right-0 flex gap-0.5 p-0.5">
                          {hasSecondaryConflict && (
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" title={slot?.secondaryCalendarEventName} />
                          )}
                          {hasTertiaryConflict && (
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title={slot?.tertiaryCalendarEventName} />
                          )}
                        </div>
                      )}
                      {isBooked && (
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                          <span className="text-[9px] text-destructive font-medium truncate px-0.5 leading-tight">
                            {slot.eventName}
                          </span>
                        </div>
                      )}
                      {/* Show secondary/tertiary event names when not booked */}
                      {!isBooked && (hasSecondaryConflict || hasTertiaryConflict) && (
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                          <span className="text-[8px] text-purple-400 font-medium truncate px-0.5 leading-tight">
                            {slot?.secondaryCalendarEventName || slot?.tertiaryCalendarEventName}
                          </span>
                        </div>
                      )}
                      {isSelectionStart && !isInSelectedRange && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[9px] text-primary font-medium">▶</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render Day View
  const renderDayView = () => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dayData = availability.find(d => d.date === dateStr);
    const hours = Array.from({ length: 24 }, (_, i) => i); // 0h to 23h (24/7)
    const events = getEventsForDay(dateStr);

    // Group consecutive slots into events for display
    const getEventAtHour = (hour: number) => {
      return events.find(e => hour >= e.startHour && hour < e.endHour);
    };

    // Check if this hour is the start of an event
    const isEventStart = (hour: number) => {
      return events.some(e => e.startHour === hour);
    };

    return (
      <div className={cn(
        "overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/30 hover:scrollbar-thumb-primary/50",
        calendarHeight
      )}>
        <div className="space-y-0.5">
          {hours.map(hour => {
            const slot = dayData?.slots.find(s => s.hour === hour);
            const status = slot?.status || "unavailable";
            const isBooked = status === "unavailable" && slot?.eventName;
            const event = getEventAtHour(hour);
            const isStart = isEventStart(hour);

            // Secondary/Tertiary calendar conflicts (superadmin only)
            const hasSecondaryConflict = slot?.hasSecondaryCalendarConflict;
            const hasTertiaryConflict = slot?.hasTertiaryCalendarConflict;

            // Check if this slot is part of a selected range
            const isInSelectedRange = selectedRange &&
              selectedRange.date === dateStr &&
              hour >= selectedRange.startHour &&
              hour < selectedRange.endHour;

            // Check if this is the selection start point
            const isSelectionStart = selectionStart &&
              selectionStart.date === dateStr &&
              selectionStart.hour === hour;

            const handleSlotClick = () => {
              // If clicking on a booked slot, open edit
              if (isBooked && event) {
                handleEditEvent(event);
                return;
              }

              if (status === "available" || status === "on-request") {
                if (!selectionStart) {
                  // First click: set start
                  setSelectionStart({ date: dateStr, hour });
                  setSelectedRange({ date: dateStr, startHour: hour, endHour: hour + 1 });
                } else if (selectionStart.date === dateStr && hour >= selectionStart.hour) {
                  // Second click: set end and confirm
                  const duration = hour - selectionStart.hour + 1;
                  const timeStr = `${selectionStart.hour.toString().padStart(2, "0")}:00`;

                  setSelectedRange({ date: dateStr, startHour: selectionStart.hour, endHour: hour + 1 });

                  if (onSelectSlot) {
                    onSelectSlot(dateStr, timeStr, duration);
                    toast({
                      title: "Créneau sélectionné",
                      description: `${dateStr} de ${selectionStart.hour}h à ${hour + 1}h (${duration}h)`,
                    });
                  }

                  setSelectionStart(null);
                } else {
                  // Restart selection
                  setSelectionStart({ date: dateStr, hour });
                  setSelectedRange({ date: dateStr, startHour: hour, endHour: hour + 1 });
                }
              }
            };

            return (
              <div
                key={hour}
                onClick={handleSlotClick}
                className={cn(
                  "flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-all relative",
                  isMobileView ? "gap-1 px-1" : "gap-2 px-2",
                  status === "available" && !isInSelectedRange && "bg-green-500/10 hover:bg-green-500/20",
                  status === "on-request" && !isInSelectedRange && "bg-amber-500/10 hover:bg-amber-500/20",
                  isBooked && "bg-destructive/10 hover:bg-destructive/20",
                  isInSelectedRange && "bg-primary/40 ring-1 ring-primary",
                  isSelectionStart && "ring-1 ring-primary",
                  // Highlight secondary/tertiary calendar conflicts
                  (hasSecondaryConflict || hasTertiaryConflict) && !isBooked && "ring-1 ring-purple-500/50"
                )}
              >
                <div className={cn(
                  "text-xs font-medium text-muted-foreground shrink-0",
                  isMobileView ? "w-10" : "w-14"
                )}>
                  {hour.toString().padStart(2, "0")}:00
                </div>
                <div className="flex-1 min-w-0">
                  {isBooked && event ? (
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "text-destructive font-medium truncate block",
                          isMobileView ? "text-xs" : "text-sm"
                        )}>
                          {event.title}
                        </span>
                        {event.clientEmail && !isMobileView && (
                          <span className="text-[10px] text-muted-foreground truncate block">
                            {event.clientEmail}
                          </span>
                        )}
                      </div>
                      {/* Show controls only on first hour of event */}
                      {isStart && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "text-primary hover:text-primary hover:bg-primary/20",
                              isMobileView ? "h-6 w-6" : "h-7 w-7"
                            )}
                            onClick={(e) => handleEditEvent(event, e)}
                          >
                            <Edit className={isMobileView ? "w-3 h-3" : "w-3.5 h-3.5"} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "text-destructive hover:text-destructive hover:bg-destructive/20",
                              isMobileView ? "h-6 w-6" : "h-7 w-7"
                            )}
                            onClick={(e) => handleDeleteEvent(event.id, e)}
                            disabled={deletingEventId === event.id}
                          >
                            {deletingEventId === event.id ? (
                              <Loader2 className={cn("animate-spin", isMobileView ? "w-3 h-3" : "w-3.5 h-3.5")} />
                            ) : (
                              <Trash2 className={isMobileView ? "w-3 h-3" : "w-3.5 h-3.5"} />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (hasSecondaryConflict || hasTertiaryConflict) ? (
                    // Show secondary/tertiary calendar events
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {hasSecondaryConflict && (
                          <div className="w-2 h-2 rounded-full bg-purple-500" />
                        )}
                        {hasTertiaryConflict && (
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <span className={cn(
                        "text-purple-400 font-medium truncate",
                        isMobileView ? "text-xs" : "text-sm"
                      )}>
                        {slot?.secondaryCalendarEventName || slot?.tertiaryCalendarEventName || "Événement externe"}
                      </span>
                    </div>
                  ) : (
                    <span className={cn(
                      status === "available" ? "text-green-500" : "text-amber-500",
                      isMobileView ? "text-xs" : "text-sm"
                    )}>
                      {status === "available" ? "Disponible" : "Sur demande"}
                    </span>
                  )}
                </div>
                {/* Secondary/Tertiary calendar indicator badges */}
                {(hasSecondaryConflict || hasTertiaryConflict) && !isBooked && (
                  <div className="flex items-center gap-1 shrink-0">
                    {hasSecondaryConflict && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                        Agenda 2
                      </span>
                    )}
                    {hasTertiaryConflict && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                        Agenda 3
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={cn(
      "bg-card rounded-xl border border-primary/30",
      isMobileView ? "p-3" : "p-4"
    )}>
      {/* Header - Compact */}
      <div className={cn(
        "flex flex-wrap items-center justify-between gap-2 mb-3",
        isMobileView && "flex-col items-stretch"
      )}>
        <div className="flex items-center gap-2">
          <h3 className={cn(
            "font-display text-foreground flex items-center gap-1.5",
            isMobileView ? "text-base" : "text-lg"
          )}>
            <CalendarIcon className={isMobileView ? "w-4 h-4" : "w-5 h-5"} style={{ color: "var(--primary)" }} />
            AGENDA
          </h3>
          <Button variant="outline" size="sm" onClick={goToToday} className="h-7 text-xs px-2">
            Aujourd'hui
          </Button>
        </div>

        {/* View Mode Tabs + Navigation in one row */}
        <div className={cn(
          "flex items-center gap-2",
          isMobileView && "justify-between w-full"
        )}>
          {/* View Mode Tabs */}
          <div className="flex items-center gap-0.5 bg-secondary/50 p-0.5 rounded-md">
            {(["month", "week", "day"] as ViewMode[]).map(mode => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode(mode)}
                className={cn(
                  "h-7 px-2 text-xs",
                  viewMode === mode && "bg-primary text-primary-foreground"
                )}
              >
                {mode === "month" ? "Mois" : mode === "week" ? "Semaine" : "Jour"}
              </Button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={goToPrevious} className="h-7 w-7">
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className={cn(
              "text-center font-medium capitalize text-sm",
              isMobileView ? "min-w-[120px]" : "min-w-[160px]"
            )}>
              {getTitle()}
            </span>
            <Button variant="outline" size="icon" onClick={goToNext} className="h-7 w-7">
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Legend - Compact */}
      <div className={cn(
        "flex flex-wrap items-center gap-3 mb-2 text-[10px]",
        isMobileView && "gap-2"
      )}>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
          <span className="text-muted-foreground">Disponible</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
          <span className="text-muted-foreground">Sur demande</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-destructive" />
          <span className="text-muted-foreground">Réservé</span>
        </div>
        {isSuperAdmin && (
          <>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-muted-foreground">Agenda 2</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Agenda 3</span>
            </div>
          </>
        )}
      </div>

      {/* Calendar Content */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground text-sm">Chargement...</span>
        </div>
      ) : (
        <div>
          {viewMode === "month" && renderMonthView()}
          {viewMode === "week" && renderWeekView()}
          {viewMode === "day" && renderDayView()}
        </div>
      )}

      {/* Event Creator Modal */}
      {showEventCreator && selectedSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={cn(
            "bg-card rounded-xl border border-border max-h-[90vh] overflow-y-auto",
            isMobileView ? "p-4 w-full max-w-full mx-2" : "p-6 max-w-lg w-full"
          )}>
            <AdminEventEditPanel
              date={selectedSlot.date}
              startHour={selectedSlot.hour}
              endHour={selectedSlot.hour + 1}
              mode="create"
              onSave={() => {
                setShowEventCreator(false);
                setSelectedSlot(null);
                fetchAvailability();
              }}
              onCancel={() => {
                setShowEventCreator(false);
                setSelectedSlot(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Event Editor Modal */}
      {showEventEditor && editingEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={cn(
            "bg-card rounded-xl border border-border max-h-[90vh] overflow-y-auto",
            isMobileView ? "p-4 w-full max-w-full mx-2" : "p-6 max-w-lg w-full"
          )}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-foreground">Modifier l'événement</h4>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setShowEventEditor(false);
                  setEditingEvent(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <AdminEventEditPanel
              eventId={editingEvent.id}
              eventTitle={editingEvent.title}
              date={editingEvent.date}
              startHour={editingEvent.startHour}
              endHour={editingEvent.endHour}
              clientEmail={editingEvent.clientEmail}
              mode="edit"
              onSave={() => {
                setShowEventEditor(false);
                setEditingEvent(null);
                fetchAvailability();
              }}
              onCancel={() => {
                setShowEventEditor(false);
                setEditingEvent(null);
              }}
            />
            {/* Delete button in edit modal */}
            <div className="mt-4 pt-4 border-t border-border">
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => {
                  handleDeleteEvent(editingEvent.id);
                  setShowEventEditor(false);
                  setEditingEvent(null);
                }}
                disabled={deletingEventId === editingEvent.id}
              >
                {deletingEventId === editingEvent.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Supprimer l'événement
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCalendarModern;
