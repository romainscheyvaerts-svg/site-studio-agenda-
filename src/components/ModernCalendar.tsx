import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  X, 
  Plus, 
  Calendar as CalendarIcon,
  Trash2,
  FolderOpen,
  Pencil,
  Check,
  Mail
} from "lucide-react";
import { 
  format, 
  addDays, 
  startOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  addWeeks,
  isToday
} from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useViewMode } from "@/hooks/useViewMode";
import { useAdmin } from "@/hooks/useAdmin";
import { useStudio } from "@/hooks/useStudio";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AdminEventEditPanel from "./AdminEventEditPanel";

interface TimeSlot {
  hour: number;
  available: boolean;
  status: "available" | "unavailable" | "on-request";
  eventName?: string;
  eventId?: string;
  clientEmail?: string;
  driveFolderLink?: string;
  driveSessionFolderLink?: string;
  secondaryCalendarEventName?: string;
  hasSecondaryCalendarConflict?: boolean;
  tertiaryCalendarEventName?: string;
  hasTertiaryCalendarConflict?: boolean;
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
  color: string;
  driveFolderLink?: string;
  clientEmail?: string;
}

type ViewMode = "month" | "week";

// Props for optional slot selection mode
interface ModernCalendarProps {
  onSelectSlot?: (date: string, time: string, duration: number) => void;
  selectedDate?: string;
  selectedTime?: string;
  selectionMode?: boolean; // When true, enables slot selection in week view
}

// Google Calendar color IDs mapping
const CALENDAR_COLORS = [
  { id: "1", name: "Lavande", color: "bg-purple-400", hex: "#7986cb" },
  { id: "2", name: "Sauge", color: "bg-green-400", hex: "#33b679" },
  { id: "3", name: "Raisin", color: "bg-violet-500", hex: "#8e24aa" },
  { id: "4", name: "Flamingo", color: "bg-pink-400", hex: "#e67c73" },
  { id: "5", name: "Banane", color: "bg-yellow-400", hex: "#f6bf26" },
  { id: "6", name: "Mandarine", color: "bg-orange-500", hex: "#f4511e" },
  { id: "7", name: "Paon", color: "bg-cyan-500", hex: "#039be5" },
  { id: "8", name: "Graphite", color: "bg-gray-500", hex: "#616161" },
  { id: "9", name: "Myrtille", color: "bg-blue-600", hex: "#3f51b5" },
  { id: "10", name: "Basilic", color: "bg-emerald-600", hex: "#0b8043" },
  { id: "11", name: "Tomate", color: "bg-red-500", hex: "#d50000" },
];

const ModernCalendar = ({
  onSelectSlot,
  selectedDate: externalSelectedDate, 
  selectedTime: externalSelectedTime,
  selectionMode = false 
}: ModernCalendarProps = {}) => {
  const { toast } = useToast();
  const { isMobileView } = useViewMode();
  const { isSuperAdmin } = useAdmin();
  const { studio } = useStudio();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  
  // Event creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventStartHour, setEventStartHour] = useState(10);
  const [eventDuration, setEventDuration] = useState(2);
  const [eventColorId, setEventColorId] = useState("7"); // Default: Paon (cyan)
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  
  // Event editing state
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editEventName, setEditEventName] = useState("");
  const [editEventStartHour, setEditEventStartHour] = useState(10);
  const [editEventEndHour, setEditEventEndHour] = useState(12);
  const [editEventColorId, setEditEventColorId] = useState("7");
  const [updatingEvent, setUpdatingEvent] = useState(false);
  
  // Slot selection state (for selectionMode)
  const [selectionStart, setSelectionStart] = useState<{ date: string; hour: number } | null>(null);
  const [selectedSlotRange, setSelectedSlotRange] = useState<{ date: string; startHour: number; endHour: number } | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{ date: string; hour: number } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(2);

  // Fetch availability for a date range
  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch 45 days to cover current month + buffer
      const startDate = startOfMonth(currentDate);
      const { data, error } = await supabase.functions.invoke("get-weekly-availability", {
        body: {
          startDate: format(startDate, "yyyy-MM-dd"),
          days: 45,
          includeSuperadminCalendars: isSuperAdmin,
          studioId: studio?.id,
        },
      });

      if (error) throw error;
      setAvailability(data.availability || []);
    } catch (err) {
      console.error("Failed to fetch availability:", err);
    } finally {
      setLoading(false);
    }
  }, [currentDate, isSuperAdmin]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Auto-scroll to 8am on mount (week view)
  useEffect(() => {
    if (viewMode === "week" && !loading) {
      const scrollContainer = document.getElementById('modern-calendar-scroll-container');
      if (scrollContainer) {
        // Each row is approximately 48px, scroll to 8th row (8am)
        scrollContainer.scrollTop = 8 * 48;
      }
    }
  }, [loading, viewMode]);

  // Get events for a specific day
  const getEventsForDay = (date: Date): CalendarEvent[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayData = availability.find(d => d.date === dateStr);
    if (!dayData) return [];

    const events: CalendarEvent[] = [];
    let currentEvent: CalendarEvent | null = null;

    dayData.slots.forEach((slot, index) => {
      if (slot.status === "unavailable" && slot.eventId) {
        if (currentEvent && currentEvent.id === slot.eventId) {
          currentEvent.endHour = slot.hour + 1;
        } else {
          if (currentEvent) events.push(currentEvent);
          currentEvent = {
            id: slot.eventId,
            title: slot.eventName || "Réservé",
            date: dateStr,
            startHour: slot.hour,
            endHour: slot.hour + 1,
            color: getEventColor(slot.eventName),
            driveFolderLink: slot.driveSessionFolderLink || slot.driveFolderLink,
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

  // Generate color based on event name
  const getEventColor = (name?: string): string => {
    const colors = [
      "bg-blue-500",
      "bg-purple-500",
      "bg-green-500",
      "bg-orange-500",
      "bg-pink-500",
      "bg-teal-500",
    ];
    if (!name) return colors[0];
    const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Get calendar days for month view
  const getCalendarDays = (): Date[] => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  // Get week days for week view
  const getWeekDays = (): Date[] => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  };

  // Navigation
  const navigatePrev = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, -1));
    } else {
      setCurrentDate(addWeeks(currentDate, -1));
    }
  };

  const navigateNext = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Open day detail
  const openDayDetail = (date: Date) => {
    setSelectedDay(date);
    setShowDayModal(true);
    setShowCreateForm(false);
  };

  // Open edit mode for an event
  const openEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEditEventName(event.title);
    setEditEventStartHour(event.startHour);
    setEditEventEndHour(event.endHour);
    // Try to match color
    const matchedColor = CALENDAR_COLORS.find(c => event.color.includes(c.color.split('-')[1]));
    setEditEventColorId(matchedColor?.id || "7");
  };

  // Close edit mode
  const closeEditEvent = () => {
    setEditingEvent(null);
    setEditEventName("");
    setEditEventStartHour(10);
    setEditEventEndHour(12);
    setEditEventColorId("7");
  };

  // Update event
  const handleUpdateEvent = async () => {
    if (!editingEvent || !selectedDay || !editEventName.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }

    setUpdatingEvent(true);
    try {
      const startTimeStr = `${editEventStartHour.toString().padStart(2, "0")}:00`;
      const endTimeStr = `${editEventEndHour.toString().padStart(2, "0")}:00`;
      
      const { error } = await supabase.functions.invoke("update-admin-event", {
        body: {
          eventId: editingEvent.id,
          title: editEventName.trim(),
          date: format(selectedDay, "yyyy-MM-dd"),
          startTime: startTimeStr,
          endTime: endTimeStr,
          colorId: editEventColorId,
          studioId: studio?.id,
        },
      });

      if (error) throw error;

      toast({
        title: "Événement modifié ! ✅",
        description: `${editEventName} mis à jour`,
      });

      closeEditEvent();
      await fetchAvailability();
    } catch (err) {
      console.error("Failed to update event:", err);
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'événement",
        variant: "destructive",
      });
    } finally {
      setUpdatingEvent(false);
    }
  };

  // Create event
  const handleCreateEvent = async () => {
    if (!selectedDay || !eventName.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }

    setCreatingEvent(true);
    try {
      const timeStr = `${eventStartHour.toString().padStart(2, "0")}:00`;
      const { error } = await supabase.functions.invoke("create-admin-event", {
        body: {
          title: eventName.trim(),
          date: format(selectedDay, "yyyy-MM-dd"),
          time: timeStr,
          hours: eventDuration,
          clientName: eventName.trim(),
          clientEmail: "admin@makemusicstudio.be",
          sessionType: "with-engineer",
          colorId: eventColorId,
          studioId: studio?.id,
        },
      });

      if (error) throw error;

      toast({
        title: "Événement créé ! 🎉",
        description: `${eventName} ajouté à l'agenda`,
      });

      setEventName("");
      setShowCreateForm(false);
      await fetchAvailability();
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

  // Delete event
  const handleDeleteEvent = async (eventId: string) => {
    setDeletingEvent(true);
    try {
      const { error } = await supabase.functions.invoke("delete-admin-event", {
        body: { eventId, studioId: studio?.id },
      });

      if (error) throw error;

      toast({
        title: "Événement supprimé",
        description: "L'événement a été retiré de l'agenda",
      });

      await fetchAvailability();
    } catch (err) {
      console.error("Failed to delete event:", err);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'événement",
        variant: "destructive",
      });
    } finally {
      setDeletingEvent(false);
    }
  };

  // Check if day has secondary/tertiary calendar events
  const getSecondaryTertiaryStatus = (date: Date): { hasSecondaryOrTertiary: boolean; eventNames: string[] } => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayData = availability.find(d => d.date === dateStr);
    if (!dayData) return { hasSecondaryOrTertiary: false, eventNames: [] };
    
    const eventNames: string[] = [];
    let hasConflict = false;
    
    dayData.slots.forEach(slot => {
      if (slot.hasSecondaryCalendarConflict && slot.secondaryCalendarEventName) {
        if (!eventNames.includes(slot.secondaryCalendarEventName)) {
          eventNames.push(slot.secondaryCalendarEventName);
        }
        hasConflict = true;
      }
      if (slot.hasTertiaryCalendarConflict && slot.tertiaryCalendarEventName) {
        if (!eventNames.includes(slot.tertiaryCalendarEventName)) {
          eventNames.push(slot.tertiaryCalendarEventName);
        }
        hasConflict = true;
      }
    });
    
    return { hasSecondaryOrTertiary: hasConflict, eventNames };
  };

  // Get slot status for a day
  const getDayStatus = (date: Date): { hasEvents: boolean; eventCount: number; colors: string[]; hasSecondaryOrTertiary: boolean } => {
    const events = getEventsForDay(date);
    const { hasSecondaryOrTertiary } = getSecondaryTertiaryStatus(date);
    return {
      hasEvents: events.length > 0,
      eventCount: events.length,
      colors: events.slice(0, 3).map(e => e.color),
      hasSecondaryOrTertiary,
    };
  };

  // Format hour
  const formatHour = (hour: number) => `${hour.toString().padStart(2, "0")}:00`;

  // Get availability status for a specific hour
  const getHourStatus = (date: Date, hour: number): TimeSlot | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayData = availability.find(d => d.date === dateStr);
    return dayData?.slots.find(s => s.hour === hour);
  };

  const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const hours = Array.from({ length: 24 }, (_, i) => i); // 0h to 23h (full 24 hours)

  // Slot selection helpers (for selectionMode)
  const handleSlotClick = (date: Date, hour: number) => {
    if (!selectionMode) {
      openDayDetail(date);
      return;
    }
    
    const dateStr = format(date, "yyyy-MM-dd");
    const slot = getHourStatus(date, hour);
    
    // Can't select unavailable slots
    if (slot?.status === "unavailable") {
      toast({
        title: "Créneau non disponible",
        description: "Ce créneau est déjà réservé.",
        variant: "destructive",
      });
      return;
    }

    if (!selectionStart) {
      // Start new selection
      setSelectionStart({ date: dateStr, hour });
      setSelectedSlotRange({ date: dateStr, startHour: hour, endHour: hour + 1 });
    } else if (selectionStart.date === dateStr) {
      // Complete selection on same day
      const startHour = Math.min(selectionStart.hour, hour);
      const endHour = Math.max(selectionStart.hour, hour) + 1;
      const duration = endHour - startHour;
      
      setSelectedSlotRange({ date: dateStr, startHour, endHour });
      setSelectedDuration(duration);
      
      // Check if all slots in range are available
      const dayData = availability.find(d => d.date === dateStr);
      const allAvailable = dayData?.slots
        .filter(s => s.hour >= startHour && s.hour < endHour)
        .every(s => s.status !== "unavailable");
      
      if (!allAvailable) {
        toast({
          title: "Créneaux non disponibles",
          description: "Certains créneaux dans cette plage sont déjà réservés.",
          variant: "destructive",
        });
        setSelectionStart(null);
        setSelectedSlotRange(null);
        return;
      }
      
      // Call the callback
      if (onSelectSlot) {
        onSelectSlot(dateStr, `${startHour.toString().padStart(2, "0")}:00`, duration);
      }
      
      setSelectionStart(null);
    } else {
      // Different day, restart selection
      setSelectionStart({ date: dateStr, hour });
      setSelectedSlotRange({ date: dateStr, startHour: hour, endHour: hour + 1 });
    }
  };

  const handleSlotHover = (date: Date, hour: number) => {
    if (!selectionMode || !selectionStart) return;
    
    const dateStr = format(date, "yyyy-MM-dd");
    if (selectionStart.date === dateStr) {
      setHoveredSlot({ date: dateStr, hour });
    }
  };

  const isSlotInSelection = (dateStr: string, hour: number): boolean => {
    if (!selectedSlotRange || selectedSlotRange.date !== dateStr) return false;
    return hour >= selectedSlotRange.startHour && hour < selectedSlotRange.endHour;
  };

  const isSlotInPreview = (dateStr: string, hour: number): boolean => {
    if (!selectionStart || !hoveredSlot) return false;
    if (selectionStart.date !== dateStr || hoveredSlot.date !== dateStr) return false;
    
    const startHour = Math.min(selectionStart.hour, hoveredSlot.hour);
    const endHour = Math.max(selectionStart.hour, hoveredSlot.hour) + 1;
    return hour >= startHour && hour < endHour;
  };

  const clearSelection = () => {
    setSelectionStart(null);
    setSelectedSlotRange(null);
    setHoveredSlot(null);
  };


  return (
    <div className="bg-background rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Agenda</h2>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode("month")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                viewMode === "month"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mois
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                viewMode === "week"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Semaine
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Aujourd'hui
            </Button>
            <div className="flex items-center">
              <Button variant="ghost" size="icon" onClick={navigatePrev}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center text-foreground">
                {viewMode === "month"
                  ? format(currentDate, "MMMM yyyy", { locale: fr })
                  : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: fr })} - ${format(addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), 6), "d MMM", { locale: fr })}`}
              </span>
              <Button variant="ghost" size="icon" onClick={navigateNext}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border text-xs text-muted-foreground flex-wrap">
          {isSuperAdmin && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span>2e/3e Agenda</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span>Session</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Sur demande</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Chargement...</span>
        </div>
      ) : (
        <>
          {/* Month View */}
          {viewMode === "month" && (
            <div className="p-4">
              {/* Day names header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {getCalendarDays().map((day) => {
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isSelectedDay = selectedDay && isSameDay(day, selectedDay);
                  const dayStatus = getDayStatus(day);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => openDayDetail(day)}
                      className={cn(
                        "aspect-square p-1 rounded-lg transition-all relative group",
                        "hover:bg-accent/50 cursor-pointer",
                        isCurrentMonth ? "text-foreground" : "text-muted-foreground/50",
                        isToday(day) && "ring-2 ring-primary ring-inset",
                        isSelectedDay && "bg-primary/20"
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm font-medium flex items-center justify-center w-7 h-7 rounded-full mx-auto",
                          isToday(day) && "bg-primary text-primary-foreground"
                        )}
                      >
                        {format(day, "d")}
                      </span>

                      {/* Event indicators */}
                      {(dayStatus.hasEvents || dayStatus.hasSecondaryOrTertiary) && (
                        <div className="flex justify-center gap-0.5 mt-0.5">
                          {/* Orange dot for secondary/tertiary calendar events */}
                          {dayStatus.hasSecondaryOrTertiary && (
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          )}
                          {dayStatus.colors.map((color, i) => (
                            <div
                              key={i}
                              className={cn("w-1.5 h-1.5 rounded-full", color)}
                            />
                          ))}
                          {dayStatus.eventCount > 3 && (
                            <span className="text-[8px] text-muted-foreground">
                              +{dayStatus.eventCount - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Week View */}
          {viewMode === "week" && (
            <div className="overflow-auto">
              <div className={cn("min-w-[700px]", isMobileView && "min-w-[500px]")}>
                {/* Week header */}
                <div className="grid grid-cols-8 border-b border-border sticky top-0 bg-card z-10">
                  <div className="p-2 text-xs text-muted-foreground border-r border-border">
                    Heure
                  </div>
                  {getWeekDays().map((day) => (
                    <div
                      key={day.toISOString()}
                      onClick={() => openDayDetail(day)}
                      className={cn(
                        "p-2 text-center border-r border-border last:border-r-0 cursor-pointer hover:bg-accent/30 transition-colors",
                        isToday(day) && "bg-primary/10"
                      )}
                    >
                      <div className="text-xs text-muted-foreground">
                        {format(day, "EEE", { locale: fr })}
                      </div>
                      <div
                        className={cn(
                          "text-lg font-semibold w-8 h-8 rounded-full flex items-center justify-center mx-auto",
                          isToday(day) && "bg-primary text-primary-foreground"
                        )}
                      >
                        {format(day, "d")}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Selection mode instructions */}
                {selectionMode && (
                  <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-3">
                    <p className="text-sm text-foreground">
                      💡 <strong>Sélection:</strong> Cliquez sur une heure de début puis une heure de fin pour définir votre créneau.
                    </p>
                    {selectedSlotRange && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm text-primary font-medium">
                          Sélection: {formatHour(selectedSlotRange.startHour)} - {formatHour(selectedSlotRange.endHour)} ({selectedSlotRange.endHour - selectedSlotRange.startHour}h)
                        </span>
                        <Button variant="ghost" size="sm" onClick={clearSelection}>
                          <X className="w-4 h-4 mr-1" />
                          Annuler
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Time grid - scroll starts at 8am */}
                <div id="modern-calendar-scroll-container" className="max-h-[500px] overflow-y-auto">
                  {hours.map((hour) => (
                    <div key={hour} className="grid grid-cols-8 border-b border-border/50">
                      <div className="p-2 text-xs text-muted-foreground border-r border-border text-right pr-3">
                        {formatHour(hour)}
                      </div>
                      {getWeekDays().map((day) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const slot = getHourStatus(day, hour);
                        const events = getEventsForDay(day).filter(
                          (e) => e.startHour === hour
                        );
                        const isSelected = isSlotInSelection(dateStr, hour);
                        const isPreview = isSlotInPreview(dateStr, hour);
                        const isExternallySelected = externalSelectedDate === dateStr && 
                          externalSelectedTime === `${hour.toString().padStart(2, "0")}:00`;

                        return (
                          <div
                            key={`${day.toISOString()}-${hour}`}
                            onClick={() => handleSlotClick(day, hour)}
                            onMouseEnter={() => handleSlotHover(day, hour)}
                            className={cn(
                              "min-h-[48px] border-r border-border/30 last:border-r-0 relative cursor-pointer transition-colors",
                              // Selection mode styles
                              selectionMode && slot?.status === "available" && "hover:bg-green-500/20",
                              selectionMode && slot?.status === "on-request" && "hover:bg-amber-500/20",
                              selectionMode && isSelected && "bg-primary/30 border-primary",
                              selectionMode && isPreview && "bg-primary/15",
                              selectionMode && isExternallySelected && "ring-2 ring-primary",
                              // Normal mode styles
                              !selectionMode && slot?.status === "available" && "hover:bg-green-500/10",
                              !selectionMode && slot?.status === "on-request" && "bg-amber-500/5 hover:bg-amber-500/10",
                              slot?.status === "unavailable" && !events.length && "bg-muted/30"
                            )}
                          >
                            {/* Selection mode indicator for available slots */}
                            {selectionMode && slot?.status === "available" && !events.length && (
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <div className="w-3 h-3 rounded-full bg-green-500/50" />
                              </div>
                            )}
                            {selectionMode && slot?.status === "on-request" && !events.length && (
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                              </div>
                            )}
                            {events.map((event) => (
                              <div
                                key={event.id}
                                className={cn(
                                  "absolute inset-x-0.5 rounded-md p-1 text-white text-xs overflow-hidden",
                                  event.color
                                )}
                                style={{
                                  top: "2px",
                                  height: `${(event.endHour - event.startHour) * 48 - 4}px`,
                                }}
                              >
                                <div className="font-medium truncate">{event.title}</div>
                                <div className="text-[10px] opacity-80">
                                  {formatHour(event.startHour)} - {formatHour(event.endHour)}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Day Detail Modal */}
      <Dialog open={showDayModal} onOpenChange={setShowDayModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              {selectedDay && format(selectedDay, "EEEE d MMMM yyyy", { locale: fr })}
            </DialogTitle>
          </DialogHeader>

          {selectedDay && (
            <div className="space-y-4">
              {/* Events list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-foreground">Événements</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter
                  </Button>
                </div>

                {getEventsForDay(selectedDay).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Aucun événement ce jour
                  </p>
                ) : (
                  <div className="space-y-2">
                    {getEventsForDay(selectedDay).map((event) => (
                      <div key={event.id}>
                        {/* Edit mode for this event - using new AdminEventEditPanel */}
                        {editingEvent?.id === event.id ? (
                          <AdminEventEditPanel
                            eventId={event.id}
                            eventTitle={event.title}
                            date={event.date}
                            startHour={event.startHour}
                            endHour={event.endHour}
                            colorId={editEventColorId}
                            clientEmail={event.clientEmail}
                            driveFolderLink={event.driveFolderLink}
                            mode="edit"
                            onSave={() => {
                              closeEditEvent();
                              fetchAvailability();
                            }}
                            onCancel={closeEditEvent}
                          />
                        ) : (
                          /* Display mode */
                          <div
                            className={cn(
                              "p-3 rounded-lg text-white",
                              event.color
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-medium">{event.title}</div>
                                <div className="text-sm opacity-80">
                                  {formatHour(event.startHour)} - {formatHour(event.endHour)}
                                  {" • "}
                                  {event.endHour - event.startHour}h
                                </div>
                                {event.clientEmail && (
                                  <div className="text-xs opacity-60 mt-1 flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {event.clientEmail}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {event.driveFolderLink && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
                                    onClick={() => window.open(event.driveFolderLink, "_blank")}
                                  >
                                    <FolderOpen className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
                                  onClick={() => openEditEvent(event)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
                                  onClick={() => handleDeleteEvent(event.id)}
                                  disabled={deletingEvent}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Secondary/Tertiary Calendar Events */}
              {selectedDay && (() => {
                const { hasSecondaryOrTertiary, eventNames } = getSecondaryTertiaryStatus(selectedDay);
                if (!hasSecondaryOrTertiary) return null;
                return (
                  <div className="space-y-2 mt-4">
                    <h4 className="font-medium text-foreground flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      2e / 3e Agenda
                    </h4>
                    <div className="space-y-1">
                      {eventNames.map((name, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-2 rounded-lg bg-orange-500/10 border border-orange-500/30"
                        >
                          <div className="w-1 h-8 bg-orange-500 rounded-full" />
                          <span className="text-sm text-foreground">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Create event form - using new AdminEventEditPanel */}
              {showCreateForm && selectedDay && (
                <AdminEventEditPanel
                  date={format(selectedDay, "yyyy-MM-dd")}
                  startHour={eventStartHour}
                  endHour={eventStartHour + eventDuration}
                  colorId={eventColorId}
                  mode="create"
                  onSave={() => {
                    setShowCreateForm(false);
                    setEventName("");
                    fetchAvailability();
                  }}
                  onCancel={() => setShowCreateForm(false)}
                />
              )}

              {/* Day schedule overview */}
              <div>
                <h4 className="font-medium text-foreground mb-2">Créneaux</h4>
                <div className="grid grid-cols-4 gap-1">
                  {hours.map((hour) => {
                    const slot = getHourStatus(selectedDay, hour);
                    return (
                      <div
                        key={hour}
                        className={cn(
                          "p-2 rounded text-center text-xs",
                          slot?.status === "available" && "bg-green-500/20 text-green-600",
                          slot?.status === "on-request" && "bg-amber-500/20 text-amber-600",
                          slot?.status === "unavailable" && "bg-muted text-muted-foreground"
                        )}
                      >
                        {formatHour(hour)}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ModernCalendar;
