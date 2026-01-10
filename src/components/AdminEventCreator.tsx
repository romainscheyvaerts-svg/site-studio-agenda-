import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AdminEventCreatorProps {
  selectedDate?: string;
  selectedTime?: string;
  duration?: number;
  onEventCreated?: () => void;
  onCancel?: () => void;
}

// Color options for calendar events
// Note: "Mandarine" (id 6, orange) is reserved for secondary/tertiary calendars display
const colorOptions = [
  { id: "1", name: "Lavande", color: "#7986cb", bgClass: "bg-[#7986cb]" },
  { id: "2", name: "Sauge", color: "#33b679", bgClass: "bg-[#33b679]" },
  { id: "3", name: "Raisin", color: "#8e24aa", bgClass: "bg-[#8e24aa]" },
  { id: "4", name: "Flamant", color: "#e67c73", bgClass: "bg-[#e67c73]" },
  { id: "5", name: "Banane", color: "#f6bf26", bgClass: "bg-[#f6bf26]" },
  // { id: "6", name: "Mandarine" } - RESERVED for 2e/3e agenda display
  { id: "7", name: "Paon", color: "#039be5", bgClass: "bg-[#039be5]" },
  { id: "8", name: "Graphite", color: "#616161", bgClass: "bg-[#616161]" },
  { id: "9", name: "Myrtille", color: "#3f51b5", bgClass: "bg-[#3f51b5]" },
  { id: "10", name: "Basilic", color: "#0b8043", bgClass: "bg-[#0b8043]" },
  { id: "11", name: "Tomate", color: "#d50000", bgClass: "bg-[#d50000]" },
];

const AdminEventCreator = ({ 
  selectedDate, 
  selectedTime, 
  duration = 1,
  onEventCreated,
  onCancel
}: AdminEventCreatorProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [eventData, setEventData] = useState({
    title: "",
    clientName: "",
    clientEmail: "",
    totalPrice: 0,
    sendConfirmationEmail: false,
    description: "",
    colorId: "7", // Default to Paon (cyan)
  });

  const formatHour = (time: string, addHours: number = 0) => {
    const hour = parseInt(time.split(":")[0]) + addHours;
    return `${hour.toString().padStart(2, "0")}:00`;
  };

  const handleCreateEvent = async () => {
    if (!eventData.title || !selectedDate || !selectedTime) {
      toast({
        title: "Champs requis",
        description: "Veuillez sélectionner un créneau et remplir le titre",
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
          date: selectedDate,
          time: selectedTime,
          hours: duration,
          colorId: eventData.colorId,
        },
      });

      if (error) throw error;

      // Optional: send confirmation email to the client
      if (eventData.sendConfirmationEmail && eventData.clientEmail) {
        const { error: emailError } = await supabase.functions.invoke("send-booking-notification", {
          body: {
            clientName: eventData.clientName || eventData.clientEmail.split("@")[0],
            clientEmail: eventData.clientEmail,
            clientPhone: "",
            sessionType: "admin-event",
            date: selectedDate,
            time: selectedTime,
            duration: duration,
            totalPrice: Number(eventData.totalPrice) || 0,
            isDeposit: false,
            isAdmin: true,
            isCashPayment: false,
          },
        });

        if (emailError) {
          console.error("Admin event confirmation email error:", emailError);
          toast({
            title: "Événement créé",
            description: "Événement créé, mais l'email de confirmation n'a pas pu être envoyé.",
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Événement créé !",
        description: `L'événement "${eventData.title}" a été ajouté à l'agenda.`,
      });

      // Reset form
      setEventData({
        title: "",
        clientName: "",
        clientEmail: "",
        totalPrice: 0,
        sendConfirmationEmail: false,
        description: "",
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

  if (!selectedDate || !selectedTime) {
    return null;
  }

  return (
    <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/30 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-green-400 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Créer un événement
        </h4>
        <div className="text-sm text-muted-foreground">
          {format(new Date(selectedDate), "EEEE d MMMM", { locale: fr })} • {selectedTime} - {formatHour(selectedTime, duration)} ({duration}h)
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
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
      </div>

      {/* Color Selection */}
      <div className="space-y-2">
        <Label>Couleur de l'événement</Label>
        <div className="flex flex-wrap gap-2">
          {colorOptions.map((color) => (
            <button
              key={color.id}
              onClick={() => setEventData({ ...eventData, colorId: color.id })}
              className={cn(
                "w-7 h-7 rounded-full transition-all",
                color.bgClass,
                eventData.colorId === color.id
                  ? "ring-2 ring-offset-2 ring-offset-background ring-white scale-110"
                  : "opacity-70 hover:opacity-100"
              )}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (optionnel)</Label>
        <Textarea
          id="description"
          value={eventData.description}
          onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
          placeholder="Notes, détails..."
          rows={2}
          className="bg-secondary/50 border-border resize-none"
        />
      </div>

      {/* Optional confirmation email */}
      <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-foreground text-sm">Envoyer email de confirmation</Label>
            <p className="text-xs text-muted-foreground">Le client recevra un email de confirmation.</p>
          </div>
          <input
            type="checkbox"
            checked={eventData.sendConfirmationEmail}
            onChange={(e) => setEventData({ ...eventData, sendConfirmationEmail: e.target.checked })}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
        </div>

        {eventData.sendConfirmationEmail && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="client-email" className="text-xs">Email client *</Label>
              <Input
                id="client-email"
                type="email"
                value={eventData.clientEmail}
                onChange={(e) => setEventData({ ...eventData, clientEmail: e.target.value })}
                placeholder="client@email.com"
                className="bg-secondary/50 border-border h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="total-price" className="text-xs">Montant (€)</Label>
              <Input
                id="total-price"
                type="number"
                min={0}
                step={1}
                value={eventData.totalPrice}
                onChange={(e) => setEventData({ ...eventData, totalPrice: Number(e.target.value) })}
                className="bg-secondary/50 border-border h-9"
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
        )}
        <Button 
          onClick={handleCreateEvent} 
          disabled={loading || !eventData.title}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Créer l'événement
        </Button>
      </div>
    </div>
  );
};

export default AdminEventCreator;
