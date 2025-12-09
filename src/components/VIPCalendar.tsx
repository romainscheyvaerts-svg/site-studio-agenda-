import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2, Clock, CheckCircle, X, MessageCircle } from "lucide-react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

interface TimeSlot {
  hour: number;
  available: boolean;
  status: "available" | "unavailable" | "on-request";
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
}

const VIPCalendar = ({ onSelectSlot, onConfirmBooking, selectedDate, selectedTime, showConfirmButton = false, confirmLoading = false }: VIPCalendarProps) => {
  const [weekStart, setWeekStart] = useState<Date>(startOfDay(new Date()));
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(selectedDate || null);
  const [selectedHour, setSelectedHour] = useState<number | null>(
    selectedTime ? parseInt(selectedTime.split(":")[0]) : null
  );
  const [duration, setDuration] = useState(2);

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

  const handleSelectSlot = (date: string, hour: number) => {
    setSelectedDay(date);
    setSelectedHour(hour);
  };

  const handleConfirmSelection = () => {
    if (selectedDay && selectedHour !== null) {
      const timeStr = `${selectedHour.toString().padStart(2, "0")}:00`;
      onSelectSlot(selectedDay, timeStr, duration);
    }
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

  const openWhatsApp = () => {
    const phoneNumber = "+32476094172";
    const message = selectedDay && selectedHour !== null 
      ? `Bonjour, je souhaite réserver le studio le ${format(new Date(selectedDay), "EEEE d MMMM yyyy", { locale: fr })} de ${formatHour(selectedHour)} à ${formatHour(selectedHour + duration)}. Ce créneau est-il disponible ?`
      : "Bonjour, je souhaite vérifier la disponibilité du studio.";
    window.open(`https://wa.me/${phoneNumber.replace("+", "")}?text=${encodeURIComponent(message)}`, "_blank");
  };

  // Get the 7 days to display
  const displayDays = availability.slice(0, 7);

  // Check if selected slot is on-request
  const selectedSlotOnRequest = selectedDay && selectedHour !== null 
    ? (() => {
        const dayData = availability.find(d => d.date === selectedDay);
        return dayData ? isBlockOnRequest(dayData.slots, selectedHour, duration) : false;
      })()
    : false;

  return (
    <div className="bg-card rounded-2xl border border-primary/30 p-6 box-glow-cyan">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-xl text-foreground flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          AGENDA VIP - Visibilité Complète
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
          <span className="text-muted-foreground">Réservé</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary ring-2 ring-primary" />
          <span className="text-muted-foreground">Sélectionné</span>
        </div>
      </div>

      {/* Duration selector */}
      <div className="mb-4 p-3 rounded-lg bg-secondary/50 border border-border">
        <Label className="text-sm text-muted-foreground mb-2 block">Durée de la session</Label>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5, 6].map((h) => (
            <Button
              key={h}
              variant={duration === h ? "default" : "outline"}
              size="sm"
              onClick={() => setDuration(h)}
              className={cn(duration === h && "bg-primary text-primary-foreground")}
            >
              {h}h
            </Button>
          ))}
        </div>
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

              {/* Time slots grid */}
              <div className="space-y-1">
                {[10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map((hour) => (
                  <div key={hour} className="grid grid-cols-8 gap-1">
                    <div className="text-xs text-muted-foreground p-2 flex items-center">
                      {formatHour(hour)}
                    </div>
                    {displayDays.map((day) => {
                      const displayStatus = getSlotDisplayStatus(day.slots, hour);
                      const isClickable = displayStatus !== "unavailable";
                      const isSelected = selectedDay === day.date && selectedHour === hour;

                      return (
                        <button
                          key={`${day.date}-${hour}`}
                          onClick={() => isClickable && handleSelectSlot(day.date, hour)}
                          disabled={!isClickable}
                          className={cn(
                            "p-2 rounded text-xs transition-all duration-200",
                            displayStatus === "available"
                              ? isSelected
                                ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                                : "bg-green-500/20 text-green-500 hover:bg-green-500/40 cursor-pointer"
                              : displayStatus === "on-request"
                                ? isSelected
                                  ? "bg-primary text-primary-foreground ring-2 ring-amber-500 ring-offset-2 ring-offset-background"
                                  : "bg-amber-500/20 text-amber-500 hover:bg-amber-500/40 cursor-pointer"
                                : "bg-destructive/20 text-destructive cursor-not-allowed"
                          )}
                        >
                          {displayStatus === "available" ? (
                            isSelected ? (
                              <CheckCircle className="w-3 h-3 mx-auto" />
                            ) : (
                              <span className="opacity-70">✓</span>
                            )
                          ) : displayStatus === "on-request" ? (
                            isSelected ? (
                              <MessageCircle className="w-3 h-3 mx-auto" />
                            ) : (
                              <span className="opacity-70">?</span>
                            )
                          ) : (
                            <X className="w-3 h-3 mx-auto opacity-50" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Selection summary and confirm */}
          {selectedDay && selectedHour !== null && (
            <div className={cn(
              "mt-6 p-4 rounded-xl border",
              selectedSlotOnRequest 
                ? "bg-amber-500/10 border-amber-500/30" 
                : "bg-primary/10 border-primary/30"
            )}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Créneau sélectionné</p>
                  <p className="font-display text-xl text-foreground">
                    {format(new Date(selectedDay), "EEEE d MMMM yyyy", { locale: fr })}
                  </p>
                  <p className={cn(
                    "font-semibold",
                    selectedSlotOnRequest ? "text-amber-500" : "text-primary"
                  )}>
                    {formatHour(selectedHour)} - {formatHour(selectedHour + duration)} ({duration}h)
                  </p>
                  {selectedSlotOnRequest && (
                    <p className="text-sm text-amber-500 mt-2 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      Ce créneau est sur demande. Contactez le studio pour confirmer.
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {selectedSlotOnRequest ? (
                    <Button 
                      variant="outline" 
                      onClick={openWhatsApp}
                      className="border-amber-500 text-amber-500 hover:bg-amber-500/10"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      CONTACTER VIA WHATSAPP
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={handleConfirmSelection}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        SÉLECTIONNER
                      </Button>
                      {showConfirmButton && onConfirmBooking && (
                        <Button 
                          variant="hero" 
                          onClick={() => onConfirmBooking(selectedDay, `${selectedHour.toString().padStart(2, "0")}:00`, duration)}
                          disabled={confirmLoading}
                        >
                          {confirmLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Validation...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              VALIDER LA RÉSERVATION
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VIPCalendar;
