r jour de lagenda aimport { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  X,
  Calendar,
  Clock,
  Plus,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Euro,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import AdminPriceCalculator from "./AdminPriceCalculator";

interface AdminQuickEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated?: () => void;
}

type AvailabilityStatus = "idle" | "checking" | "available" | "unavailable" | "error";

interface TimeSlot {
  hour: number;
  available: boolean;
  status: "available" | "unavailable" | "on-request";
  eventName?: string;
}

const AdminQuickEventModal = ({ isOpen, onClose, onEventCreated }: AdminQuickEventModalProps) => {
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<number>(2);
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>("idle");
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [daySlots, setDaySlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Generate next 30 days for date selection
  const availableDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 30; i++) {
      const date = addDays(new Date(), i);
      dates.push({
        value: format(date, "yyyy-MM-dd"),
        label: format(date, "EEEE d MMMM", { locale: fr }),
      });
    }
    return dates;
  }, []);

  // Fetch availability for selected date
  useEffect(() => {
    const fetchDayAvailability = async () => {
      if (!selectedDate) {
        setDaySlots([]);
        return;
      }

      setLoadingSlots(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-weekly-availability", {
          body: {
            startDate: selectedDate,
            days: 1,
          },
        });

        if (error) throw error;

        const dayData = data.availability?.[0];
        if (dayData) {
          setDaySlots(dayData.slots || []);
        } else {
          setDaySlots([]);
        }
      } catch (err) {
        console.error("Failed to fetch day availability:", err);
        setDaySlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchDayAvailability();
  }, [selectedDate]);

  // Check availability when date, time, duration changes
  useEffect(() => {
    const checkAvailability = async () => {
      if (!selectedDate || !selectedTime) {
        setAvailabilityStatus("idle");
        return;
      }

      setAvailabilityStatus("checking");

      try {
        const { data, error } = await supabase.functions.invoke("check-availability", {
          body: {
            date: selectedDate,
            time: selectedTime,
            duration: selectedDuration,
            sessionType: "with-engineer",
          },
        });

        if (error) throw error;

        if (data.available) {
          setAvailabilityStatus("available");
          setAvailabilityMessage(data.message || "Créneau disponible");
        } else {
          setAvailabilityStatus("unavailable");
          setAvailabilityMessage(data.message || "Créneau non disponible");
        }
      } catch (err) {
        console.error("Availability check failed:", err);
        setAvailabilityStatus("error");
        setAvailabilityMessage("Erreur lors de la vérification");
      }
    };

    const debounce = setTimeout(checkAvailability, 300);
    return () => clearTimeout(debounce);
  }, [selectedDate, selectedTime, selectedDuration]);

  // Generate time options (8h to 22h)
  const timeOptions = useMemo(() => {
    const options = [];
    for (let hour = 8; hour <= 22; hour++) {
      const timeStr = `${hour.toString().padStart(2, "0")}:00`;
      const slot = daySlots.find(s => s.hour === hour);
      const status = slot?.status || "unavailable";
      const eventName = slot?.eventName;
      
      options.push({
        value: timeStr,
        label: `${timeStr}`,
        status,
        eventName,
        disabled: status === "unavailable",
      });
    }
    return options;
  }, [daySlots]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setSelectedDate("");
      setSelectedTime("");
      setSelectedDuration(2);
      setAvailabilityStatus("idle");
      setAvailabilityMessage("");
      setDaySlots([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            <h2 className="font-display text-lg text-foreground">AJOUTER UN ÉVÉNEMENT</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Date & Time Selection */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30">
            <h4 className="font-display text-base text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              SÉLECTIONNER UN CRÉNEAU
            </h4>

            <div className="grid md:grid-cols-3 gap-4">
              {/* Date Selection */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Date</Label>
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger className="bg-background/50 border-primary/30">
                    <SelectValue placeholder="Choisir une date" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDates.map((date) => (
                      <SelectItem key={date.value} value={date.value}>
                        {date.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Time Selection */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Heure de début</Label>
                <Select 
                  value={selectedTime} 
                  onValueChange={setSelectedTime}
                  disabled={!selectedDate || loadingSlots}
                >
                  <SelectTrigger className="bg-background/50 border-primary/30">
                    <SelectValue placeholder={loadingSlots ? "Chargement..." : "Choisir l'heure"} />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map((time) => (
                      <SelectItem 
                        key={time.value} 
                        value={time.value}
                        disabled={time.disabled}
                        className={cn(
                          time.status === "available" && "text-green-500",
                          time.status === "on-request" && "text-amber-500",
                          time.status === "unavailable" && "text-muted-foreground line-through"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span>{time.label}</span>
                          {time.status === "available" && <span className="text-xs text-green-500">✓</span>}
                          {time.status === "on-request" && <span className="text-xs text-amber-500">?</span>}
                          {time.status === "unavailable" && time.eventName && (
                            <span className="text-xs text-muted-foreground">({time.eventName})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Durée</Label>
                <Select 
                  value={selectedDuration.toString()} 
                  onValueChange={(v) => setSelectedDuration(parseInt(v))}
                >
                  <SelectTrigger className="bg-background/50 border-primary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                      <SelectItem key={h} value={h.toString()}>
                        {h} heure{h > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Availability Status */}
            {selectedDate && selectedTime && (
              <div className={cn(
                "mt-4 p-3 rounded-lg border flex items-center gap-3",
                availabilityStatus === "checking" && "bg-secondary/50 border-border",
                availabilityStatus === "available" && "bg-green-500/10 border-green-500/30",
                availabilityStatus === "unavailable" && "bg-destructive/10 border-destructive/30",
                availabilityStatus === "error" && "bg-amber-500/10 border-amber-500/30"
              )}>
                {availabilityStatus === "checking" && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Vérification de la disponibilité...</span>
                  </>
                )}
                {availabilityStatus === "available" && (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-500">{availabilityMessage}</span>
                  </>
                )}
                {availabilityStatus === "unavailable" && (
                  <>
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span className="text-sm text-destructive">{availabilityMessage}</span>
                  </>
                )}
                {availabilityStatus === "error" && (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-amber-500">{availabilityMessage}</span>
                  </>
                )}
              </div>
            )}

            {/* Quick info about selected slot */}
            {selectedDate && selectedTime && availabilityStatus === "available" && (
              <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/30">
                <p className="text-sm text-foreground">
                  <strong>Créneau sélectionné :</strong>{" "}
                  {format(new Date(selectedDate), "EEEE d MMMM yyyy", { locale: fr })} à {selectedTime} ({selectedDuration}h)
                </p>
              </div>
            )}
          </div>

          {/* Price Calculator - Only show when slot is selected and available */}
          {selectedDate && selectedTime && (availabilityStatus === "available" || availabilityStatus === "idle") && (
            <AdminPriceCalculator
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              selectedDuration={selectedDuration}
              onEventCreated={() => {
                onEventCreated?.();
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminQuickEventModal;