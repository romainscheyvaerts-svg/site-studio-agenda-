import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, Loader2, CheckCircle, ChevronLeft, ChevronRight, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

interface AdminEventCreatorProps {
  selectedDate?: string;
  selectedTime?: string;
  duration?: number;
  onEventCreated?: () => void;
}

// Color options for calendar events
const colorOptions = [
  { id: "1", name: "Lavande", color: "#7986cb", bgClass: "bg-[#7986cb]" },
  { id: "2", name: "Sauge", color: "#33b679", bgClass: "bg-[#33b679]" },
  { id: "3", name: "Raisin", color: "#8e24aa", bgClass: "bg-[#8e24aa]" },
  { id: "4", name: "Flamant", color: "#e67c73", bgClass: "bg-[#e67c73]" },
  { id: "5", name: "Banane", color: "#f6bf26", bgClass: "bg-[#f6bf26]" },
  { id: "6", name: "Mandarine", color: "#f4511e", bgClass: "bg-[#f4511e]" },
  { id: "7", name: "Paon", color: "#039be5", bgClass: "bg-[#039be5]" },
  { id: "8", name: "Graphite", color: "#616161", bgClass: "bg-[#616161]" },
  { id: "9", name: "Myrtille", color: "#3f51b5", bgClass: "bg-[#3f51b5]" },
  { id: "10", name: "Basilic", color: "#0b8043", bgClass: "bg-[#0b8043]" },
  { id: "11", name: "Tomate", color: "#d50000", bgClass: "bg-[#d50000]" },
];

interface TimeSlot {
  hour: number;
  available: boolean;
}

interface DayAvailability {
  date: string;
  slots: TimeSlot[];
}

const AdminEventCreator = ({ 
  selectedDate, 
  selectedTime, 
  duration = 2,
  onEventCreated 
}: AdminEventCreatorProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Calendar state
  const [weekStart, setWeekStart] = useState<Date>(startOfDay(new Date()));
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  
  const [eventData, setEventData] = useState({
    title: "",
    clientName: "",
    description: "",
    date: selectedDate || "",
    time: selectedTime || "",
    hours: duration,
    colorId: "7", // Default to Paon (cyan)
  });

  // Fetch availability when dialog opens
  useEffect(() => {
    if (open) {
      fetchAvailability();
    }
  }, [open, weekStart]);

  const fetchAvailability = async () => {
    setCalendarLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-weekly-availability", {
        body: {
          startDate: weekStart.toISOString().split("T")[0],
          days: 7,
        },
      });

      if (error) throw error;
      setAvailability(data.availability || []);
    } catch (err) {
      console.error("Failed to fetch availability:", err);
    } finally {
      setCalendarLoading(false);
    }
  };

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
    setEventData(prev => ({
      ...prev,
      date: date,
      time: `${hour.toString().padStart(2, "0")}:00`,
    }));
  };

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, "0")}:00`;
  };

  // Check if a consecutive block of hours is available
  const isBlockAvailable = (daySlots: TimeSlot[], startHour: number, blockSize: number): boolean => {
    for (let i = 0; i < blockSize; i++) {
      const slot = daySlots.find(s => s.hour === startHour + i);
      if (!slot || !slot.available) return false;
    }
    return true;
  };

  const handleCreateEvent = async () => {
    if (!eventData.title || !eventData.date || !eventData.time) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir le titre, la date et l'heure",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-admin-event", {
        body: {
          title: eventData.title,
          clientName: eventData.clientName,
          description: eventData.description,
          date: eventData.date,
          time: eventData.time,
          hours: eventData.hours,
          colorId: eventData.colorId,
        },
      });

      if (error) throw error;

      toast({
        title: "Événement créé !",
        description: `L'événement "${eventData.title}" a été ajouté à l'agenda.`,
      });

      setOpen(false);
      setEventData({
        title: "",
        clientName: "",
        description: "",
        date: "",
        time: "",
        hours: 2,
        colorId: "7",
      });

      onEventCreated?.();
    } catch (err) {
      console.error("Error creating event:", err);
      toast({
        title: "Erreur",
        description: "Impossible de créer l'événement. Réessayez.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedHour = eventData.time ? parseInt(eventData.time.split(":")[0]) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-green-500/50 text-green-500 hover:bg-green-500/10">
          <Plus className="w-4 h-4" />
          Créer un événement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] lg:max-w-[1200px] max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Calendar className="w-5 h-5 text-primary" />
            Créer un événement (Admin)
          </DialogTitle>
          <DialogDescription>
            Sélectionnez un créneau sur l'agenda et remplissez les détails de l'événement.
          </DialogDescription>
        </DialogHeader>

        <div className="grid lg:grid-cols-2 gap-6 py-4">
          {/* Left side - Calendar View */}
          <div className="bg-secondary/30 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Agenda en temps réel
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handlePreviousWeek}
                  disabled={isSameDay(weekStart, startOfDay(new Date()))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[120px] text-center">
                  {format(weekStart, "d MMM", { locale: fr })} - {format(addDays(weekStart, 6), "d MMM", { locale: fr })}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextWeek}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mb-3 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded bg-green-500" />
                <span className="text-muted-foreground">Libre</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded bg-destructive" />
                <span className="text-muted-foreground">Occupé</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded bg-primary ring-1 ring-primary" />
                <span className="text-muted-foreground">Sélection</span>
              </div>
            </div>

            {calendarLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Chargement...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[500px]">
                  {/* Days header */}
                  <div className="grid grid-cols-8 gap-0.5 mb-1">
                    <div className="text-[10px] text-muted-foreground p-1"></div>
                    {availability.map((day) => {
                      const date = new Date(day.date);
                      const isSelected = eventData.date === day.date;
                      return (
                        <div
                          key={day.date}
                          className={cn(
                            "text-center p-1 rounded text-[10px]",
                            isSelected ? "bg-primary/20 text-primary" : "text-muted-foreground"
                          )}
                        >
                          <div className="font-semibold uppercase">{format(date, "EEE", { locale: fr })}</div>
                          <div className="text-sm font-display">{format(date, "d")}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Time slots grid */}
                  <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                    {[10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map((hour) => (
                      <div key={hour} className="grid grid-cols-8 gap-0.5">
                        <div className="text-[10px] text-muted-foreground p-1 flex items-center">
                          {formatHour(hour)}
                        </div>
                        {availability.map((day) => {
                          const slot = day.slots.find((s) => s.hour === hour);
                          const isAvailable = slot?.available && isBlockAvailable(day.slots, hour, eventData.hours);
                          const isSelected = eventData.date === day.date && selectedHour === hour;

                          return (
                            <button
                              key={`${day.date}-${hour}`}
                              onClick={() => handleSelectSlot(day.date, hour)}
                              className={cn(
                                "p-1.5 rounded text-[10px] transition-all duration-150",
                                isAvailable
                                  ? isSelected
                                    ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background"
                                    : "bg-green-500/20 text-green-500 hover:bg-green-500/40 cursor-pointer"
                                  : isSelected
                                    ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background"
                                    : "bg-destructive/20 text-destructive/60 hover:bg-destructive/30 cursor-pointer"
                              )}
                            >
                              {isSelected ? (
                                <CheckCircle className="w-3 h-3 mx-auto" />
                              ) : isAvailable ? (
                                <span className="opacity-70">✓</span>
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
            )}

            {/* Selection info */}
            {eventData.date && eventData.time && (
              <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm">
                <p className="text-muted-foreground text-xs">Créneau sélectionné :</p>
                <p className="font-semibold text-foreground">
                  {format(new Date(eventData.date), "EEEE d MMMM", { locale: fr })} à {eventData.time}
                </p>
                <p className="text-primary text-xs">
                  {eventData.time} - {formatHour(selectedHour! + eventData.hours)} ({eventData.hours}h)
                </p>
              </div>
            )}
          </div>

          {/* Right side - Event Form */}
          <div className="space-y-4">
            {/* Event Title */}
            <div className="space-y-2">
              <Label htmlFor="event-title">Titre de l'événement *</Label>
              <Input
                id="event-title"
                value={eventData.title}
                onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
                placeholder="Ex: Session enregistrement, Réunion..."
                className="bg-secondary/50 border-border"
              />
            </div>

            {/* Client Name */}
            <div className="space-y-2">
              <Label htmlFor="client-name">Nom du client (optionnel)</Label>
              <Input
                id="client-name"
                value={eventData.clientName}
                onChange={(e) => setEventData({ ...eventData, clientName: e.target.value })}
                placeholder="Nom du client"
                className="bg-secondary/50 border-border"
              />
            </div>

            {/* Date and Time (manual override) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-date">Date *</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={eventData.date}
                  onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-time">Heure *</Label>
                <Input
                  id="event-time"
                  type="time"
                  value={eventData.time}
                  onChange={(e) => setEventData({ ...eventData, time: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>Durée</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 8, 10].map((h) => (
                  <Button
                    key={h}
                    type="button"
                    variant={eventData.hours === h ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEventData({ ...eventData, hours: h })}
                    className={cn(
                      "px-3",
                      eventData.hours === h && "bg-primary text-primary-foreground"
                    )}
                  >
                    {h}h
                  </Button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>Couleur de l'événement</Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setEventData({ ...eventData, colorId: color.id })}
                    className={cn(
                      "w-7 h-7 rounded-full transition-all duration-200",
                      color.bgClass,
                      eventData.colorId === color.id 
                        ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-110" 
                        : "hover:scale-105 opacity-70 hover:opacity-100"
                    )}
                    title={color.name}
                  >
                    {eventData.colorId === color.id && (
                      <CheckCircle className="w-3 h-3 text-white mx-auto" />
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {colorOptions.find(c => c.id === eventData.colorId)?.name}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="event-description">Description (optionnel)</Label>
              <Textarea
                id="event-description"
                value={eventData.description}
                onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                placeholder="Notes, détails supplémentaires..."
                className="bg-secondary/50 border-border min-h-[80px]"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Annuler
              </Button>
              <Button onClick={handleCreateEvent} disabled={loading} variant="hero" className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Créer l'événement
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminEventCreator;
