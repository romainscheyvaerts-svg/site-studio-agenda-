 import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  X,
  User,
  RefreshCw
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
import { useStudio } from "@/hooks/useStudio";

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
  const { studio } = useStudio();

  // Vérifier si Google Calendar est configuré pour ce studio
  const isCalendarConfigured = studio?.google_calendar_id && studio?.google_service_account_key;

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [availability, setAvailability] = useState<DayAvailability[]>([]);

  // Always reset to today when the calendar mounts/opens
  useEffect(() => {
    setCurrentDate(new Date());
  }, []);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventCreator, setShowEventCreator] = useState(false);
  const [showEventEditor, setShowEventEditor] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; hour: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{ date: string; hour: number } | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ date: string; startHour: number; endHour: number } | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [lastFetchWasSuperAdmin, setLastFetchWasSuperAdmin] = useState<boolean>(false);
  
  // Admin profiles and session assignments for color indicators
  const [adminProfiles, setAdminProfiles] = useState<Array<{ user_id: string; display_name: string; color: string }>>([]);
  const [sessionAssignments, setSessionAssignments] = useState<Array<{ event_id: string; assigned_to: string | null; service_type: string | null }>>([]);

  // Swipe/scroll navigation refs
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const weekScrollContainerRef = useRef<HTMLDivElement>(null);
  const dayScrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);
  const lastScrollLeftRef = useRef<number>(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch availability data
  const fetchAvailability = useCallback(async () => {
    if (!isCalendarConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      let startDate: Date;
      let days: number;

      if (viewMode === "month") {
        // For month view, start from the Monday before the 1st of the month
        // to match what's displayed in the calendar grid
        startDate = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
        days = 42; // 6 weeks
      } else if (viewMode === "week") {
        startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
        days = 7;
      } else {
        startDate = currentDate;
        days = 1;
      }

      console.log("[FETCH] Requesting availability:", { viewMode, isSuperAdmin, startDate: format(startDate, "yyyy-MM-dd"), days });

      const { data, error } = await supabase.functions.invoke("get-weekly-availability", {
        body: {
          startDate: format(startDate, "yyyy-MM-dd"),
          days,
          includeSuperadminCalendars: isSuperAdmin,
          studioId: studio?.id,
        },
      });

      if (error) throw error;
      setAvailability(data.availability || []);
      setLastFetchWasSuperAdmin(!!isSuperAdmin);
    } catch (err) {
      console.error("Failed to fetch availability:", err);
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode, isSuperAdmin]);

  // Function to load admin data (profiles and assignments)
  const loadAdminData = useCallback(async () => {
    try {
      // Load admin profiles
      const { data: profiles } = await supabase
        .from("admin_profiles" as any)
        .select("user_id, display_name, color");
      
      if (profiles) {
        setAdminProfiles(profiles as any);
      }

      // Load session assignments with service_type for color coding
      const { data: assignments } = await supabase
        .from("session_assignments" as any)
        .select("event_id, assigned_to, service_type");
      
      if (assignments) {
        setSessionAssignments(assignments as any);
        console.log("[CALENDAR] Loaded session assignments:", assignments.length);
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
    }
  }, []);

  // Fetch admin profiles and session assignments
  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Default colors for admins without a profile - MUST MATCH AdminEventEditPanel
  const defaultAdminColors = ['#00D9FF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3'];

  // Helper function to get admin color for an event
  // Uses same logic as AdminEventEditPanel for consistency
  const getEventAdminColor = (eventId: string): string | null => {
    const assignment = sessionAssignments.find(a => a.event_id === eventId);
    if (!assignment?.assigned_to) return null;
    
    const profile = adminProfiles.find(p => p.user_id === assignment.assigned_to);
    if (profile?.color) return profile.color;
    
    // Fallback: find admin index in the profiles list for consistent color
    // This matches AdminEventEditPanel behavior
    const allAdminIds = adminProfiles.map(p => p.user_id);
    const adminIndex = allAdminIds.indexOf(assignment.assigned_to);
    
    if (adminIndex >= 0) {
      return defaultAdminColors[adminIndex % defaultAdminColors.length];
    }
    
    // Last resort: Generate a consistent color based on user_id hash
    const hashCode = assignment.assigned_to.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    const colorIndex = Math.abs(hashCode) % defaultAdminColors.length;
    return defaultAdminColors[colorIndex];
  };

  // Helper to get admin name for tooltip
  const getAdminNameForEvent = (eventId: string): string | null => {
    const assignment = sessionAssignments.find(a => a.event_id === eventId);
    if (!assignment?.assigned_to) return null;
    
    const profile = adminProfiles.find(p => p.user_id === assignment.assigned_to);
    return profile?.display_name || null;
  };

  // Service type color mapping
  const serviceTypeColors: Record<string, { bg: string; border: string; text: string }> = {
    "with-engineer": { bg: "bg-primary/80", border: "border-primary", text: "text-white" },
    "without-engineer": { bg: "bg-amber-500/80", border: "border-amber-500", text: "text-white" },
    "mixing": { bg: "bg-purple-500/80", border: "border-purple-500", text: "text-white" },
    "mastering": { bg: "bg-green-500/80", border: "border-green-500", text: "text-white" },
    "composition": { bg: "bg-pink-500/80", border: "border-pink-500", text: "text-white" },
    "default": { bg: "bg-destructive/80", border: "border-destructive", text: "text-white" },
  };

  // Helper to get service type color for an event
  const getEventServiceColor = (eventId: string): { bg: string; border: string; text: string } => {
    const assignment = sessionAssignments.find(a => a.event_id === eventId);
    const serviceType = assignment?.service_type || "default";
    return serviceTypeColors[serviceType] || serviceTypeColors["default"];
  };

  // Force refetch when isSuperAdmin becomes true but last fetch wasn't with super admin calendars
  useEffect(() => {
    if (isSuperAdmin && !lastFetchWasSuperAdmin && !loading) {
      console.log("[REFETCH] isSuperAdmin became true, refetching with super admin calendars");
      fetchAvailability();
    }
  }, [isSuperAdmin, lastFetchWasSuperAdmin, loading, fetchAvailability]);

  // Auto-scroll to 9h when week or day view loads
  useEffect(() => {
    if (!loading) {
      // Small delay to ensure DOM is rendered
      const timer = setTimeout(() => {
        if (viewMode === "week" && weekScrollContainerRef.current) {
          const hourHeight = 40; // Same as in renderWeekView
          const scrollTo = 9 * hourHeight; // 9h = 360px
          weekScrollContainerRef.current.scrollTop = scrollTo;
        } else if (viewMode === "day" && dayScrollContainerRef.current) {
          const hourHeight = 48; // Same as in renderDayView
          const scrollTo = 9 * hourHeight; // 9h = 432px
          dayScrollContainerRef.current.scrollTop = scrollTo;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, viewMode]);

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
        body: { eventId, studioId: studio?.id },
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

  // Touch/swipe navigation handlers with "elastic" effect
  // User must swipe a VERY long distance (like pulling an elastic band)
  const swipeProgressRef = useRef<number>(0);
  const swipeDirectionRef = useRef<"left" | "right" | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isSwipingRef.current = false;
    swipeProgressRef.current = 0;
    swipeDirectionRef.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartXRef.current) return;
    
    const deltaX = e.touches[0].clientX - touchStartXRef.current;
    const deltaY = e.touches[0].clientY - touchStartYRef.current;
    
    // Only consider horizontal swipes (deltaX > deltaY * 2 for stricter detection)
    if (Math.abs(deltaX) > Math.abs(deltaY) * 2 && Math.abs(deltaX) > 50) {
      isSwipingRef.current = true;
      swipeDirectionRef.current = deltaX > 0 ? "right" : "left";
      // Track progress (0 to 100%)
      swipeProgressRef.current = Math.min(100, (Math.abs(deltaX) / 200) * 100);
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isSwipingRef.current || !touchStartXRef.current) {
      touchStartXRef.current = 0;
      swipeProgressRef.current = 0;
      swipeDirectionRef.current = null;
      return;
    }
    
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    // VERY high threshold - user must swipe at least 200px (like pulling an elastic)
    const threshold = 200;
    
    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0) {
        // Swipe right -> go to previous
        goToPrevious();
      } else {
        // Swipe left -> go to next
        goToNext();
      }
    }
    
    touchStartXRef.current = 0;
    isSwipingRef.current = false;
    swipeProgressRef.current = 0;
    swipeDirectionRef.current = null;
  }, [goToPrevious, goToNext]);

  // Disabled scroll edge detection - too sensitive, removed
  const handleScroll = useCallback(() => {
    // Intentionally empty - scroll navigation disabled
  }, []);

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

            // Get secondary/tertiary events directly from availability data (like week view does)
            const dayData = availability.find(d => d.date === dateStr);
            const secondaryEvents: { hour: number; name: string }[] = [];
            const tertiaryEvents: { hour: number; name: string }[] = [];

            if (dayData && isSuperAdmin) {
              dayData.slots.forEach((slot) => {
                if (slot.hasSecondaryCalendarConflict && slot.secondaryCalendarEventName) {
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
            }

            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            const hasSecondaryEvents = secondaryEvents.length > 0;
            const hasTertiaryEvents = tertiaryEvents.length > 0;

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
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" title={secondaryEvents[0]?.name} />
                      )}
                      {hasTertiaryEvents && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title={tertiaryEvents[0]?.name} />
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {/* Main calendar events */}
                  {events.slice(0, isMobileView ? 1 : 2).map(event => {
                    const serviceColor = getEventServiceColor(event.id);
                    const adminColor = getEventAdminColor(event.id);
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditEvent(event);
                        }}
                        className={cn(
                          "text-[8px] px-0.5 py-0 rounded truncate leading-tight flex items-center gap-0.5 overflow-hidden",
                          serviceColor.bg.replace("/80", "/30"),
                          serviceColor.text.replace("text-white", "text-foreground")
                        )}
                        title={`${event.title} (${event.startHour}h-${event.endHour}h)`}
                      >
                        {adminColor && (
                          <div 
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: adminColor }}
                          />
                        )}
                        <span className="truncate">{event.startHour}h {event.title}</span>
                      </div>
                    );
                  })}
                  {/* Secondary calendar events (superadmin only - already filtered above) */}
                  {secondaryEvents.slice(0, 1).map((event, idx) => (
                    <div
                      key={`sec-${idx}`}
                      className="text-[8px] px-0.5 py-0 rounded bg-rose-500/20 text-rose-400 truncate leading-tight"
                      title={`${event.name} (${event.hour}h) - Agenda Claridge`}
                    >
                      {event.hour}h {event.name}
                    </div>
                  ))}
                  {/* Tertiary calendar events (superadmin only - already filtered above) */}
                  {tertiaryEvents.slice(0, 1).map((event, idx) => (
                    <div
                      key={`ter-${idx}`}
                      className="text-[8px] px-0.5 py-0 rounded bg-blue-500/20 text-blue-400 truncate leading-tight"
                      title={`${event.name} (${event.hour}h) - Agenda 3`}
                    >
                      {event.hour}h {event.name}
                    </div>
                  ))}
                  {/* Show count of additional events */}
                  {(events.length + secondaryEvents.length + tertiaryEvents.length) > (isMobileView ? 1 : 2) && (
                    <div className="text-[8px] text-muted-foreground px-0.5">
                      +{events.length + secondaryEvents.length + tertiaryEvents.length - (isMobileView ? 1 : 2)}
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

  // Render Week View - Google Calendar Style
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
    const hours = Array.from({ length: 24 }, (_, i) => i); // 0h to 23h
    const hourHeight = 40; // pixels per hour

    // Get events for all days in the week
    const weekEvents: { [date: string]: CalendarEvent[] } = {};
    days.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      weekEvents[dateStr] = getEventsForDay(dateStr);
    });

    return (
      <div 
        ref={weekScrollContainerRef}
        className={cn(
          "overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/30 hover:scrollbar-thumb-primary/50",
          calendarHeight
        )}
      >
        {/* Single wrapper for synchronized horizontal+vertical scroll */}
        <div className="min-w-max">
          {/* Header with days - sticky top, scrolls horizontally with content */}
          <div className="sticky top-0 bg-card z-20 border-b border-border/30">
            <div className="flex">
              {/* Empty corner for hours column */}
              <div className="w-14 shrink-0 bg-card sticky left-0 z-30 border-r border-border/30" />
              
              {/* Day headers */}
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
                      "flex-1 min-w-[100px] text-center py-2 cursor-pointer hover:bg-secondary/50 border-r border-border/20",
                      isToday && "bg-primary/10"
                    )}
                  >
                    <div className="text-[10px] text-muted-foreground uppercase">
                      {format(day, "EEE", { locale: fr })}.
                    </div>
                    <div className={cn(
                      "text-lg font-display",
                      isToday ? "text-primary bg-primary/20 rounded-full w-8 h-8 flex items-center justify-center mx-auto" : "text-foreground"
                    )}>
                      {format(day, "d")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grid content area - same horizontal context as header */}
          <div className="flex">
            {/* Sticky hour column */}
            <div className="w-14 shrink-0 sticky left-0 bg-card z-10 border-r border-border/30">
                {hours.map(hour => (
                  <div
                    key={hour}
                    className="border-t border-border/20 text-[11px] text-muted-foreground text-right pr-2 font-medium"
                    style={{ height: `${hourHeight}px` }}
                  >
                    <span className="-mt-2 block">{hour}:00</span>
                  </div>
                ))}
              </div>

            {/* Day columns with events */}
            <div className="flex flex-1">
                {days.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayData = availability.find(d => d.date === dateStr);
                  const events = weekEvents[dateStr] || [];
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        "flex-1 min-w-[100px] relative border-r border-border/20",
                        isToday && "bg-primary/5"
                      )}
                    >
                      {/* Hour grid lines */}
                      {hours.map(hour => {
                        const slot = dayData?.slots.find(s => s.hour === hour);
                        const status = slot?.status || "unavailable";
                        const hasSecondaryConflict = slot?.hasSecondaryCalendarConflict;
                        const hasTertiaryConflict = slot?.hasTertiaryCalendarConflict;
                        
                        // Check if this slot is part of a selected range
                        const isInSelectedRange = selectedRange && 
                          selectedRange.date === dateStr && 
                          hour >= selectedRange.startHour && 
                          hour < selectedRange.endHour;
                        
                        const isSelectionStart = selectionStart && 
                          selectionStart.date === dateStr && 
                          selectionStart.hour === hour;

                        const handleSlotClick = () => {
                          if (status === "available" || status === "on-request") {
                            if (!selectionStart) {
                              setSelectionStart({ date: dateStr, hour });
                              setSelectedRange({ date: dateStr, startHour: hour, endHour: hour + 1 });
                            } else if (selectionStart.date === dateStr && hour >= selectionStart.hour) {
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
                              "border-t border-border/20 cursor-pointer transition-colors",
                              status === "available" && !isInSelectedRange && "hover:bg-green-500/20",
                              status === "on-request" && !isInSelectedRange && "hover:bg-amber-500/20",
                              isInSelectedRange && "bg-primary/30",
                              isSelectionStart && "bg-primary/20 ring-1 ring-inset ring-primary",
                              (hasSecondaryConflict || hasTertiaryConflict) && !isInSelectedRange && "bg-purple-500/10"
                            )}
                            style={{ height: `${hourHeight}px` }}
                          >
                            {/* Secondary/Tertiary indicator dots */}
                            {(hasSecondaryConflict || hasTertiaryConflict) && (
                              <div className="absolute right-1 top-1 flex gap-0.5">
                                {hasSecondaryConflict && <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                                {hasTertiaryConflict && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Event blocks - positioned absolutely */}
                      {events.map(event => {
                        const top = event.startHour * hourHeight;
                        const height = (event.endHour - event.startHour) * hourHeight;
                        const adminColor = getEventAdminColor(event.id);
                        const serviceColor = getEventServiceColor(event.id);

                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditEvent(event);
                            }}
                            className={cn(
                              "absolute left-1 right-1 rounded-lg px-2 py-1 cursor-pointer transition-all",
                              serviceColor.bg,
                              "hover:opacity-90 border-l-4",
                              serviceColor.border,
                              "shadow-md hover:shadow-lg overflow-hidden"
                            )}
                            style={{
                              top: `${top}px`,
                              height: `${height - 2}px`,
                              minHeight: "24px"
                            }}
                          >
                            {/* Admin color indicator - larger and more visible */}
                            {adminColor && (
                              <div 
                                className="absolute top-1 right-1 w-4 h-4 rounded-full border-2 border-white/70 shadow-md"
                                style={{ backgroundColor: adminColor }}
                                title={getAdminNameForEvent(event.id) || "Admin responsable"}
                              />
                            )}
                            <div className="text-[11px] font-semibold text-white truncate leading-tight pr-5">
                              {event.title}
                            </div>
                            <div className="text-[9px] text-white/80 leading-tight">
                              {event.startHour}h - {event.endHour}h
                            </div>
                            {height > 60 && event.clientEmail && (
                              <div className="text-[9px] text-white/70 truncate mt-0.5">
                                {event.clientEmail}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Secondary/Tertiary calendar events as blocks */}
                      {isSuperAdmin && dayData?.slots.map((slot, idx) => {
                        // Only render at start of secondary/tertiary events
                        if (slot.hasSecondaryCalendarConflict && slot.secondaryCalendarEventName) {
                          // Check if previous slot had same event
                          const prevSlot = dayData.slots.find(s => s.hour === slot.hour - 1);
                          if (prevSlot?.secondaryCalendarEventName === slot.secondaryCalendarEventName) {
                            return null; // Skip, this is continuation
                          }
                          
                          // Find duration
                          let endHour = slot.hour + 1;
                          for (let h = slot.hour + 1; h < 24; h++) {
                            const nextSlot = dayData.slots.find(s => s.hour === h);
                            if (nextSlot?.secondaryCalendarEventName === slot.secondaryCalendarEventName) {
                              endHour = h + 1;
                            } else {
                              break;
                            }
                          }
                          
                          const top = slot.hour * hourHeight;
                          const height = (endHour - slot.hour) * hourHeight;

                          return (
                            <div
                              key={`sec-${slot.hour}`}
                              className="absolute left-1 right-1 rounded-lg px-2 py-1 bg-rose-500/60 border-l-4 border-rose-500 shadow-sm overflow-hidden pointer-events-none"
                              style={{
                                top: `${top}px`,
                                height: `${height - 2}px`,
                                minHeight: "20px"
                              }}
                            >
                              <div className="text-[10px] font-medium text-white truncate leading-tight">
                                {slot.secondaryCalendarEventName}
                              </div>
                              <div className="text-[8px] text-white/70">
                                {slot.hour}h - {endHour}h • Claridge
                              </div>
                            </div>
                          );
                        }
                        
                        if (slot.hasTertiaryCalendarConflict && slot.tertiaryCalendarEventName) {
                          const prevSlot = dayData.slots.find(s => s.hour === slot.hour - 1);
                          if (prevSlot?.tertiaryCalendarEventName === slot.tertiaryCalendarEventName) {
                            return null;
                          }
                          
                          let endHour = slot.hour + 1;
                          for (let h = slot.hour + 1; h < 24; h++) {
                            const nextSlot = dayData.slots.find(s => s.hour === h);
                            if (nextSlot?.tertiaryCalendarEventName === slot.tertiaryCalendarEventName) {
                              endHour = h + 1;
                            } else {
                              break;
                            }
                          }
                          
                          const top = slot.hour * hourHeight;
                          const height = (endHour - slot.hour) * hourHeight;

                          return (
                            <div
                              key={`ter-${slot.hour}`}
                              className="absolute left-1 right-1 rounded-lg px-2 py-1 bg-blue-500/60 border-l-4 border-blue-500 shadow-sm overflow-hidden pointer-events-none"
                              style={{
                                top: `${top}px`,
                                height: `${height - 2}px`,
                                minHeight: "20px"
                              }}
                            >
                              <div className="text-[10px] font-medium text-white truncate leading-tight">
                                {slot.tertiaryCalendarEventName}
                              </div>
                              <div className="text-[8px] text-white/70">
                                {slot.hour}h - {endHour}h
                              </div>
                            </div>
                          );
                        }
                        
                        return null;
                      })}
                    </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Day View - Google Calendar Style
  const renderDayView = () => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dayData = availability.find(d => d.date === dateStr);
    const hours = Array.from({ length: 24 }, (_, i) => i); // 0h to 23h
    const events = getEventsForDay(dateStr);
    const hourHeight = 48; // pixels per hour (taller for day view)

    return (
      <div 
        ref={dayScrollContainerRef}
        className={cn(
          "overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/30 hover:scrollbar-thumb-primary/50",
          calendarHeight
        )}
      >
        <div className="flex min-w-max">
          {/* Sticky hour column */}
          <div className="w-14 shrink-0 sticky left-0 bg-card z-10 border-r border-border/30">
            {hours.map(hour => (
              <div
                key={hour}
                className="border-t border-border/20 text-[11px] text-muted-foreground text-right pr-2 font-medium"
                style={{ height: `${hourHeight}px` }}
              >
                <span className="-mt-2 block">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* Day content with events */}
          <div className="flex-1 relative min-w-[200px]">
            {/* Hour grid lines */}
            {hours.map(hour => {
              const slot = dayData?.slots.find(s => s.hour === hour);
              const status = slot?.status || "unavailable";
              const hasSecondaryConflict = slot?.hasSecondaryCalendarConflict;
              const hasTertiaryConflict = slot?.hasTertiaryCalendarConflict;
              
              const isInSelectedRange = selectedRange &&
                selectedRange.date === dateStr &&
                hour >= selectedRange.startHour &&
                hour < selectedRange.endHour;
              
              const isSelectionStart = selectionStart &&
                selectionStart.date === dateStr &&
                selectionStart.hour === hour;

              const handleSlotClick = () => {
                if (status === "available" || status === "on-request") {
                  if (!selectionStart) {
                    setSelectionStart({ date: dateStr, hour });
                    setSelectedRange({ date: dateStr, startHour: hour, endHour: hour + 1 });
                  } else if (selectionStart.date === dateStr && hour >= selectionStart.hour) {
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
                    "border-t border-border/20 cursor-pointer transition-colors",
                    status === "available" && !isInSelectedRange && "hover:bg-green-500/20",
                    status === "on-request" && !isInSelectedRange && "hover:bg-amber-500/20",
                    isInSelectedRange && "bg-primary/30",
                    isSelectionStart && "bg-primary/20 ring-1 ring-inset ring-primary",
                              (hasSecondaryConflict || hasTertiaryConflict) && !isInSelectedRange && "bg-rose-500/10"
                  )}
                  style={{ height: `${hourHeight}px` }}
                />
              );
            })}

            {/* Event blocks - positioned absolutely */}
            {events.map(event => {
              const top = event.startHour * hourHeight;
              const height = (event.endHour - event.startHour) * hourHeight;
              const adminColor = getEventAdminColor(event.id);
              const serviceColor = getEventServiceColor(event.id);

              return (
                <div
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditEvent(event);
                  }}
                  className={cn(
                    "absolute left-2 right-2 rounded-lg px-3 py-2 cursor-pointer transition-all",
                    serviceColor.bg,
                    "hover:opacity-90 border-l-4",
                    serviceColor.border,
                    "shadow-md hover:shadow-lg overflow-hidden"
                  )}
                  style={{
                    top: `${top}px`,
                    height: `${height - 4}px`,
                    minHeight: "32px"
                  }}
                >
                  {/* Admin color indicator - larger and more visible */}
                  {adminColor && (
                    <div 
                      className="absolute top-2 right-2 w-5 h-5 rounded-full border-2 border-white/70 shadow-md"
                      style={{ backgroundColor: adminColor }}
                      title={getAdminNameForEvent(event.id) || "Admin responsable"}
                    />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 pr-7">
                      <div className="text-sm font-semibold text-white truncate leading-tight">
                        {event.title}
                      </div>
                      <div className="text-xs text-white/80 leading-tight">
                        {event.startHour}h - {event.endHour}h
                      </div>
                      {height > 80 && event.clientEmail && (
                        <div className="text-xs text-white/70 truncate mt-1">
                          {event.clientEmail}
                        </div>
                      )}
                    </div>
                    {/* Edit and Delete buttons */}
                    <div className="flex items-center gap-1 shrink-0 mt-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
                        onClick={(e) => handleEditEvent(event, e)}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
                        onClick={(e) => handleDeleteEvent(event.id, e)}
                        disabled={deletingEventId === event.id}
                      >
                        {deletingEventId === event.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Secondary/Tertiary calendar events as blocks */}
            {isSuperAdmin && dayData?.slots.map((slot) => {
              if (slot.hasSecondaryCalendarConflict && slot.secondaryCalendarEventName) {
                const prevSlot = dayData.slots.find(s => s.hour === slot.hour - 1);
                if (prevSlot?.secondaryCalendarEventName === slot.secondaryCalendarEventName) {
                  return null;
                }
                
                let endHour = slot.hour + 1;
                for (let h = slot.hour + 1; h < 24; h++) {
                  const nextSlot = dayData.slots.find(s => s.hour === h);
                  if (nextSlot?.secondaryCalendarEventName === slot.secondaryCalendarEventName) {
                    endHour = h + 1;
                  } else {
                    break;
                  }
                }
                
                const top = slot.hour * hourHeight;
                const height = (endHour - slot.hour) * hourHeight;

                          return (
                            <div
                              key={`sec-${slot.hour}`}
                              className="absolute left-1 right-1 rounded-lg px-2 py-1 bg-rose-500/60 border-l-4 border-rose-500 shadow-sm overflow-hidden pointer-events-none"
                              style={{
                                top: `${top}px`,
                                height: `${height - 2}px`,
                                minHeight: "20px"
                              }}
                            >
                              <div className="text-[10px] font-medium text-white truncate leading-tight">
                                {slot.secondaryCalendarEventName}
                              </div>
                              <div className="text-[8px] text-white/70">
                                {slot.hour}h - {endHour}h • Claridge
                              </div>
                            </div>
                          );
              }
              
              if (slot.hasTertiaryCalendarConflict && slot.tertiaryCalendarEventName) {
                const prevSlot = dayData.slots.find(s => s.hour === slot.hour - 1);
                if (prevSlot?.tertiaryCalendarEventName === slot.tertiaryCalendarEventName) {
                  return null;
                }
                
                let endHour = slot.hour + 1;
                for (let h = slot.hour + 1; h < 24; h++) {
                  const nextSlot = dayData.slots.find(s => s.hour === h);
                  if (nextSlot?.tertiaryCalendarEventName === slot.tertiaryCalendarEventName) {
                    endHour = h + 1;
                  } else {
                    break;
                  }
                }
                
                const top = slot.hour * hourHeight;
                const height = (endHour - slot.hour) * hourHeight;

                return (
                  <div
                    key={`ter-${slot.hour}`}
                    className="absolute left-2 right-2 rounded-lg px-3 py-2 bg-blue-500/60 border-l-4 border-blue-500 shadow-sm overflow-hidden pointer-events-none"
                    style={{
                      top: `${top}px`,
                      height: `${height - 4}px`,
                      minHeight: "28px"
                    }}
                  >
                    <div className="text-xs font-medium text-white truncate leading-tight">
                      {slot.tertiaryCalendarEventName}
                    </div>
                    <div className="text-[10px] text-white/70">
                      {slot.hour}h - {endHour}h • Agenda 3
                    </div>
                  </div>
                );
              }
              
              return null;
            })}
          </div>
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
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              fetchAvailability();
              loadAdminData();
            }}
            disabled={loading}
            className="h-7 w-7"
            title="Rafraîchir l'agenda"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
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

      {/* Legend - Service Types */}
      <div className={cn(
        "flex flex-wrap items-center gap-3 mb-2 text-[10px]",
        isMobileView && "gap-2"
      )}>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
          <span className="text-muted-foreground">Avec ingénieur</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
          <span className="text-muted-foreground">Location sèche</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
          <span className="text-muted-foreground">Mixage</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
          <span className="text-muted-foreground">Mastering</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-destructive" />
          <span className="text-muted-foreground">Non défini</span>
        </div>
      </div>

      {/* Calendar Content */}
      {!isCalendarConfigured ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-4">
          <div className="p-4 rounded-full bg-amber-500/10">
            <CalendarIcon className="w-8 h-8 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-white mb-1">Google Calendar non configuré</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Veuillez configurer votre Google Calendar dans les paramètres du studio pour afficher et gérer l'agenda.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
            <Clock className="w-3.5 h-3.5" />
            <span>Paramètres → Google → Configurer le Calendar</span>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground text-sm">Chargement...</span>
        </div>
      ) : (
        <div
          ref={calendarContainerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="touch-pan-y"
        >
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
                loadAdminData(); // Reload assignments to show updated admin color
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
