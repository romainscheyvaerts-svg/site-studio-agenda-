import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { 
  Mic, Building2, Music, Headphones, Disc, Radio, 
  Euro, Percent, Calculator, Clock, Calendar, X, FileText, Loader2
} from "lucide-react";
import VIPCalendar from "./VIPCalendar";
import AdminInvoiceGenerator from "./AdminInvoiceGenerator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type SessionType = "with-engineer" | "without-engineer" | "mixing" | "mastering" | "analog-mastering" | "podcast" | null;

interface AdminPriceCalculatorProps {
  onPriceCalculated?: (data: {
    sessionType: SessionType;
    hours: number;
    totalPrice: number;
    discountPercent: number;
    finalPrice: number;
    date?: string;
    time?: string;
  }) => void;
}

const AdminPriceCalculator = ({ onPriceCalculated }: AdminPriceCalculatorProps) => {
  const { toast } = useToast();
  const [selectedService, setSelectedService] = useState<SessionType>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [hours, setHours] = useState(2);
  const [podcastMinutes, setPodcastMinutes] = useState(1);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);

  const pricing: Record<string, number> = {
    "with-engineer": 45,
    "without-engineer": 22,
    "mixing": 200,
    "mastering": 60,
    "analog-mastering": 100,
    "podcast": 40,
  };

  const serviceLabels: Record<string, string> = {
    "with-engineer": "Avec Ingénieur",
    "without-engineer": "Location Sèche",
    "mixing": "Mixage",
    "mastering": "Mastering",
    "analog-mastering": "Mastering Analogique",
    "podcast": "Mixage Podcast",
  };

  const isHourlyService = selectedService === "with-engineer" || selectedService === "without-engineer";
  const isPodcast = selectedService === "podcast";

  const totalPrice = useMemo(() => {
    if (!selectedService) return 0;
    if (isPodcast) {
      return podcastMinutes * pricing[selectedService];
    }
    if (isHourlyService) {
      return hours * pricing[selectedService];
    }
    return pricing[selectedService];
  }, [selectedService, hours, podcastMinutes, isHourlyService, isPodcast]);

  const discountAmount = useMemo(() => {
    return Math.round(totalPrice * (discountPercent / 100));
  }, [totalPrice, discountPercent]);

  const finalPrice = totalPrice - discountAmount;

  const handleServiceClick = (service: SessionType) => {
    setSelectedService(service);
    setShowCalendar(true);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const handleSlotSelect = (date: string, time: string, duration: number) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setHours(duration);
    
    if (onPriceCalculated && selectedService) {
      onPriceCalculated({
        sessionType: selectedService,
        hours: duration,
        totalPrice: isHourlyService ? duration * pricing[selectedService] : totalPrice,
        discountPercent,
        finalPrice: isHourlyService 
          ? Math.round((duration * pricing[selectedService]) * (1 - discountPercent / 100))
          : finalPrice,
        date,
        time,
      });
    }
  };

  const handleCloseCalendar = () => {
    setShowCalendar(false);
  };

  const services = [
    { id: "with-engineer" as SessionType, icon: Mic, label: "AVEC INGÉNIEUR", price: "45€/h", color: "primary" },
    { id: "without-engineer" as SessionType, icon: Building2, label: "LOCATION SÈCHE", price: "22€/h", color: "accent" },
    { id: "mixing" as SessionType, icon: Music, label: "MIXAGE", price: "200€", color: "primary" },
    { id: "mastering" as SessionType, icon: Headphones, label: "MASTERING", price: "60€", color: "primary" },
    { id: "analog-mastering" as SessionType, icon: Disc, label: "MASTERING ANALOGIQUE", price: "100€", color: "accent" },
    { id: "podcast" as SessionType, icon: Radio, label: "PODCAST", price: "40€/min", color: "primary" },
  ];

  return (
    <div className="space-y-6">
      {/* Service selector buttons */}
      <div>
        <Label className="text-sm text-muted-foreground mb-3 block flex items-center gap-2">
          <Calculator className="w-4 h-4" />
          Sélectionnez un service pour ouvrir l'agenda et calculer le prix
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {services.map((service) => {
            const Icon = service.icon;
            const isSelected = selectedService === service.id;
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => handleServiceClick(service.id)}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all duration-300",
                  isSelected
                    ? service.color === "accent" 
                      ? "border-accent bg-accent/10 box-glow-gold"
                      : "border-primary bg-primary/10 box-glow-cyan"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn("w-4 h-4", service.color === "accent" ? "text-accent" : "text-primary")} />
                  <span className="font-display text-sm text-foreground">{service.label}</span>
                </div>
                <span className={cn("text-xs font-semibold", service.color === "accent" ? "text-accent" : "text-primary")}>
                  {service.price}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* VIP Calendar Modal */}
      {showCalendar && selectedService && (
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-display text-lg text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {serviceLabels[selectedService]} - Sélectionnez un créneau
            </h4>
            <Button variant="ghost" size="icon" onClick={handleCloseCalendar}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {/* For podcast, show minutes input instead of calendar */}
          {isPodcast ? (
            <div className="p-4 rounded-xl bg-secondary/50 border border-border">
              <Label className="text-sm text-muted-foreground mb-2 block">
                Durée du podcast (minutes)
              </Label>
              <Input
                type="number"
                min={1}
                max={180}
                value={podcastMinutes}
                onChange={(e) => setPodcastMinutes(parseInt(e.target.value) || 1)}
                className="w-32"
              />
            </div>
          ) : (
            <VIPCalendar
              onSelectSlot={handleSlotSelect}
              selectedDate={selectedDate || undefined}
              selectedTime={selectedTime || undefined}
            />
          )}
        </div>
      )}

      {/* Price calculation summary */}
      {selectedService && (selectedDate || !isHourlyService) && (
        <div className="p-6 rounded-xl bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 border border-green-500/30">
          <h4 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
            <Euro className="w-5 h-5 text-green-500" />
            CALCUL DU PRIX
          </h4>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Price breakdown */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service:</span>
                <span className="text-foreground font-medium">{serviceLabels[selectedService]}</span>
              </div>
              
              {isHourlyService && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Durée:</span>
                  <span className="text-foreground font-medium">{hours}h × {pricing[selectedService]}€</span>
                </div>
              )}
              
              {isPodcast && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Durée:</span>
                  <span className="text-foreground font-medium">{podcastMinutes}min × {pricing[selectedService]}€</span>
                </div>
              )}

              {selectedDate && selectedTime && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Créneau:</span>
                  <span className="text-foreground font-medium">{selectedDate} à {selectedTime}</span>
                </div>
              )}

              <div className="flex justify-between text-sm border-t border-border pt-2">
                <span className="text-muted-foreground">Sous-total:</span>
                <span className="text-foreground font-semibold">{totalPrice}€</span>
              </div>

              {discountPercent > 0 && (
                <div className="flex justify-between text-sm text-green-500">
                  <span>Remise ({discountPercent}%):</span>
                  <span>-{discountAmount}€</span>
                </div>
              )}

              <div className="flex justify-between text-lg border-t border-border pt-3">
                <span className="text-foreground font-display">TOTAL:</span>
                <span className="text-green-500 font-display text-2xl">{finalPrice}€</span>
              </div>
            </div>

            {/* Discount input */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  Appliquer une remise (%)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>

              {/* Client info for event creation */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">
                    Nom du client (optionnel)
                  </Label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Nom du client"
                    className="bg-secondary/50 border-border"
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">
                    Email du client (optionnel)
                  </Label>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="email@exemple.com"
                    className="bg-secondary/50 border-border"
                  />
                </div>
              </div>

              {selectedDate && selectedTime && (
                <div className="pt-4 space-y-3">
                  <Button 
                    variant="hero" 
                    className="w-full"
                    disabled={creatingEvent}
                    onClick={async () => {
                      setCreatingEvent(true);
                      try {
                        const sessionLabels: Record<string, string> = {
                          "with-engineer": "Session avec ingénieur",
                          "without-engineer": "Location sèche",
                          "mixing": "Mixage",
                          "mastering": "Mastering",
                          "analog-mastering": "Mastering analogique",
                          "podcast": "Podcast"
                        };
                        
                        const title = clientName 
                          ? `SESSION ${sessionLabels[selectedService!]} - ${clientName}`
                          : `SESSION ${sessionLabels[selectedService!]}`;
                        
                        const { error } = await supabase.functions.invoke("create-admin-event", {
                          body: {
                            title,
                            clientName: clientName || "",
                            description: `Prix: ${finalPrice}€${discountPercent > 0 ? ` (remise ${discountPercent}%)` : ''}\n${clientEmail ? `Email: ${clientEmail}` : ''}`,
                            date: selectedDate,
                            time: selectedTime,
                            hours: isHourlyService ? hours : (isPodcast ? Math.ceil(podcastMinutes / 60) : 1),
                            colorId: "7",
                          },
                        });
                        
                        if (error) throw error;
                        
                        toast({
                          title: "Événement créé !",
                          description: `Session du ${selectedDate} à ${selectedTime} ajoutée à l'agenda.`,
                        });
                        
                        if (onPriceCalculated && selectedService) {
                          onPriceCalculated({
                            sessionType: selectedService,
                            hours: isHourlyService ? hours : (isPodcast ? podcastMinutes : 1),
                            totalPrice,
                            discountPercent,
                            finalPrice,
                            date: selectedDate,
                            time: selectedTime,
                          });
                        }
                      } catch (err) {
                        console.error("Error creating event:", err);
                        toast({
                          title: "Erreur",
                          description: "Impossible de créer l'événement. Réessayez.",
                          variant: "destructive",
                        });
                      } finally {
                        setCreatingEvent(false);
                      }
                    }}
                  >
                    {creatingEvent ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Création...
                      </>
                    ) : (
                      <>
                        <Calendar className="w-4 h-4 mr-2" />
                        CRÉER L'ÉVÉNEMENT
                      </>
                    )}
                  </Button>
                  
                  <AdminInvoiceGenerator 
                    prefilledData={{
                      clientName,
                      clientEmail,
                      sessionType: selectedService,
                      hours: isHourlyService ? hours : (isPodcast ? podcastMinutes : 1),
                      totalPrice: finalPrice,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPriceCalculator;
