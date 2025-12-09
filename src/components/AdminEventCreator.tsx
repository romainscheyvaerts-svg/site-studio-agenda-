import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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

const AdminEventCreator = ({ 
  selectedDate, 
  selectedTime, 
  duration = 2,
  onEventCreated 
}: AdminEventCreatorProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [eventData, setEventData] = useState({
    title: "",
    clientName: "",
    description: "",
    date: selectedDate || "",
    time: selectedTime || "",
    hours: duration,
    colorId: "7", // Default to Paon (cyan)
  });

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-green-500/50 text-green-500 hover:bg-green-500/10">
          <Plus className="w-4 h-4" />
          Créer un événement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Calendar className="w-5 h-5 text-primary" />
            Créer un événement (Admin)
          </DialogTitle>
          <DialogDescription>
            Ajoutez un événement personnalisé à l'agenda du studio.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
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

          {/* Date and Time */}
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
            <div className="flex items-center gap-2">
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
                    "w-8 h-8 rounded-full transition-all duration-200",
                    color.bgClass,
                    eventData.colorId === color.id 
                      ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-110" 
                      : "hover:scale-105 opacity-70 hover:opacity-100"
                  )}
                  title={color.name}
                >
                  {eventData.colorId === color.id && (
                    <CheckCircle className="w-4 h-4 text-white mx-auto" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleCreateEvent} disabled={loading} variant="hero">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminEventCreator;
