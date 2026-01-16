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
  Trash2
} from "lucide-react";
import { 
  format, 
  addDays, 
  addWeeks,
  addMonths,
  startOfDay, 
  startOfWeek,
  startOfMonth,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  eachDayOfInterval,
  getHours,
  parseISO
} from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import AdminEventEditPanel from "./AdminEventEditPanel";
import { useAdmin } from "@/hooks/useAdmin";

type ViewMode = "month" | "week" | "day";

interface TimeSlot {
  hour: number;
  available: boolean;
  status: "available" | "unavailable" | "on-request";
  eventName?: string;
  eventId?: string;
  clientEmail?: string;
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
}

const AdminCalendarModern = () => {
  const { toast } = useToast();
  const { isSuperAdmin } = useAdmin();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventCreator, setShowEventCreator] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; hour: number } | null>(null);

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

    dayData.slots.forEach((slot, index) => {
      if (slot.status === "unavailable" && slot.eventName) {
        if (currentEvent && currentEvent.title === slot.eventName) {
          currentEvent.endHour = slot.hour + 1;
        } else {
          if (currentEvent) events.push(currentEvent);
          currentEvent = {
            id: slot.eventId || `${date}-${slot.hour}`,
            title: slot.eventName,
            date,
            startHour: slot.hour,
            endHour: slot.hour + 1,
            status: slot.status,
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

  // Render Month View
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(day => (
          <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {days.map(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const events = getEventsForDay(dateStr);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={dateStr}
              onClick={() => {
                setCurrentDate(day);
                setViewMode("day");
              }}
              className={cn(
                "min-h-[100px] p-1 border border-border/50 rounded-lg cursor-pointer transition-all hover:bg-secondary/50",
                !isCurrentMonth && "opacity-40",
                isToday && "ring-2 ring-primary"
              )}
            >
              <div className={cn(
                "text-sm font-medium mb-1",
                isToday ? "text-primary" : "text-foreground"
              )}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {events.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    className="text-[10px] px-1 py-0.5 rounded bg-destructive/20 text-destructive truncate"
                    title={`${event.title} (${event.startHour}h-${event.endHour}h)`}
                  >
                    {event.startHour}h {event.title}
                  </div>
                ))}
                {events.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{events.length - 3} autres
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Week View
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
    const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 7h to 22h

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header with days */}
          <div className="grid grid-cols-8 gap-1 mb-2">
            <div className="w-16"></div>
            {days.map(day => {
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "text-center py-2 rounded-lg",
                    isToday && "bg-primary/20"
                  )}
                >
                  <div className="text-xs text-muted-foreground">
                    {format(day, "EEE", { locale: fr })}
                  </div>
                  <div className={cn(
                    "text-lg font-display",
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
              <div key={hour} className="grid grid-cols-8 gap-1 h-12 border-t border-border/30">
                <div className="w-16 text-xs text-muted-foreground pr-2 text-right -mt-2">
                  {hour}:00
                </div>
                {days.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayData = availability.find(d => d.date === dateStr);
                  const slot = dayData?.slots.find(s => s.hour === hour);
                  const status = slot?.status || "unavailable";
                  const isBooked = status === "unavailable" && slot?.eventName;

                  return (
                    <div
                      key={`${dateStr}-${hour}`}
                      onClick={() => {
                        if (status === "available" || status === "on-request") {
                          setSelectedSlot({ date: dateStr, hour });
                          setShowEventCreator(true);
                        }
                      }}
                      className={cn(
                        "rounded cursor-pointer transition-all relative",
                        status === "available" && "bg-green-500/10 hover:bg-green-500/30",
                        status === "on-request" && "bg-amber-500/10 hover:bg-amber-500/30",
                        isBooked && "bg-destructive/20"
                      )}
                    >
                      {isBooked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] text-destructive font-medium truncate px-1">
                            {slot.eventName}
                          </span>
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
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="space-y-1">
        {hours.map(hour => {
          const slot = dayData?.slots.find(s => s.hour === hour);
          const status = slot?.status || "unavailable";
          const isBooked = status === "unavailable" && slot?.eventName;

          return (
            <div
              key={hour}
              onClick={() => {
                if (status === "available" || status === "on-request") {
                  setSelectedSlot({ date: dateStr, hour });
                  setShowEventCreator(true);
                }
              }}
              className={cn(
                "flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-all",
                status === "available" && "bg-green-500/10 hover:bg-green-500/20",
                status === "on-request" && "bg-amber-500/10 hover:bg-amber-500/20",
                isBooked && "bg-destructive/10"
              )}
            >
              <div className="w-20 text-sm font-medium text-muted-foreground">
                {hour.toString().padStart(2, "0")}:00
              </div>
              <div className="flex-1">
                {isBooked ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-destructive font-medium">{slot.eventName}</span>
                      {slot.clientEmail && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({slot.clientEmail})
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle delete
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <span className={cn(
                    "text-sm",
                    status === "available" ? "text-green-500" : "text-amber-500"
                  )}>
                    {status === "available" ? "Disponible" : "Sur demande"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-card rounded-2xl border border-primary/30 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-display text-foreground flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            AGENDA
          </h3>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Aujourd'hui
          </Button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg">
          {(["month", "week", "day"] as ViewMode[]).map(mode => (
            <Button
              key={mode}
              variant={viewMode === mode ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode(mode)}
              className={cn(
                "capitalize",
                viewMode === mode && "bg-primary text-primary-foreground"
              )}
            >
              {mode === "month" ? "Mois" : mode === "week" ? "Semaine" : "Jour"}
            </Button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevious}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="min-w-[200px] text-center font-medium capitalize">
            {getTitle()}
          </span>
          <Button variant="outline" size="icon" onClick={goToNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
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
          <span className="text-muted-foreground">Réservé</span>
        </div>
      </div>

      {/* Calendar Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Chargement...</span>
        </div>
      ) : (
        <div className="mt-4">
          {viewMode === "month" && renderMonthView()}
          {viewMode === "week" && renderWeekView()}
          {viewMode === "day" && renderDayView()}
        </div>
      )}

      {/* Event Creator Modal */}
      {showEventCreator && selectedSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full">
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
    </div>
  );
};

export default AdminCalendarModern;
