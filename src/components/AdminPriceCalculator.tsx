import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Mic,
  Building2,
  Music,
  Headphones,
  Disc,
  Radio,
  Euro,
  Percent,
  Calculator,
  Clock,
  Calendar,
  X,
  FileText,
  Loader2,
  Mail,
  FolderOpen,
  CreditCard,
  Send,
  Check,
  CheckCircle,
} from "lucide-react";
import ModernCalendar from "./ModernCalendar";
import AdminInvoiceGenerator from "./AdminInvoiceGenerator";
import AdminPaymentQRCode from "./AdminPaymentQRCode";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/usePricing";

type SessionType = "with-engineer" | "without-engineer" | "mixing" | "mastering" | "analog-mastering" | "podcast" | null;

interface AdminPriceCalculatorProps {
  selectedDate?: string;
  selectedTime?: string;
  selectedDuration?: number;
  onPriceCalculated?: (data: {
    sessionType: SessionType;
    hours: number;
    totalPrice: number;
    discountPercent: number;
    finalPrice: number;
    date?: string;
    time?: string;
  }) => void;
  onEventCreated?: () => void; // Callback to refresh calendar after event creation
}

const AdminPriceCalculator = ({
  selectedDate: externalDate,
  selectedTime: externalTime,
  selectedDuration: externalDuration,
  onPriceCalculated,
  onEventCreated
}: AdminPriceCalculatorProps) => {
  const { toast } = useToast();
  const { getPrice } = usePricing();

  const [selectedService, setSelectedService] = useState<SessionType>(null);
  const [hours, setHours] = useState(externalDuration || 2);
  const [podcastMinutes, setPodcastMinutes] = useState(1);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(externalDate || null);
  const [selectedTime, setSelectedTime] = useState<string | null>(externalTime || null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [includeStripeLink, setIncludeStripeLink] = useState(false);
  const [includeDriveLink, setIncludeDriveLink] = useState(false);
  const [sendConfirmationEmail, setSendConfirmationEmail] = useState(false);

  // Sync with external date/time/duration from calendar
  useEffect(() => {
    if (externalDate) setSelectedDate(externalDate);
    if (externalTime) setSelectedTime(externalTime);
    if (externalDuration) setHours(externalDuration);
  }, [externalDate, externalTime, externalDuration]);

  const unitPrice = useMemo(() => {
    if (!selectedService) return 0;
    return getPrice(selectedService);
  }, [getPrice, selectedService]);

  const formatServicePrice = useCallback(
    (service: Exclude<SessionType, null>) => {
      const price = getPrice(service);
      if (service === "with-engineer" || service === "without-engineer") return `${price}€/h`;
      if (service === "podcast") return `${price}€/min`;
      return `${price}€`;
    },
    [getPrice]
  );

  const serviceLabels: Record<string, string> = {
    "with-engineer": "Avec Ingénieur",
    "without-engineer": "Location Sèche",
    "mixing": "Mixage",
    "mastering": "Mastering",
    "analog-mastering": "Mastering Analogique",
    "podcast": "Mixage Podcast",
  };

  const isHourlyService =
    selectedService === "with-engineer" || selectedService === "without-engineer";
  const isPodcast = selectedService === "podcast";

  const totalPrice = useMemo(() => {
    if (!selectedService) return 0;
    if (isPodcast) {
      return podcastMinutes * unitPrice;
    }
    if (isHourlyService) {
      return hours * unitPrice;
    }
    return unitPrice;
  }, [selectedService, hours, podcastMinutes, isHourlyService, isPodcast, unitPrice]);

  const discountAmount = useMemo(() => {
    return Math.round(totalPrice * (discountPercent / 100));
  }, [totalPrice, discountPercent]);

  const finalPrice = totalPrice - discountAmount;

  const handleServiceClick = (service: SessionType) => {
    setSelectedService(service);
    // Notify parent of price calculation when service is selected
    if (onPriceCalculated) {
      const price = getPrice(service);
      const isHourly = service === "with-engineer" || service === "without-engineer";
      const calculatedTotal = isHourly ? hours * price : price;
      const calculatedFinal =
        discountPercent > 0
          ? Math.round(calculatedTotal * (1 - discountPercent / 100))
          : calculatedTotal;

      onPriceCalculated({
        sessionType: service,
        hours,
        totalPrice: calculatedTotal,
        discountPercent,
        finalPrice: calculatedFinal,
        date: selectedDate || undefined,
        time: selectedTime || undefined,
      });
    }
  };

  const handleSlotSelect = (date: string, time: string, duration: number) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setHours(duration);

    if (onPriceCalculated && selectedService) {
      const calculatedTotal = isHourlyService ? duration * unitPrice : unitPrice;
      const calculatedFinal =
        discountPercent > 0
          ? Math.round(calculatedTotal * (1 - discountPercent / 100))
          : calculatedTotal;

      onPriceCalculated({
        sessionType: selectedService,
        hours: duration,
        totalPrice: calculatedTotal,
        discountPercent,
        finalPrice: calculatedFinal,
        date,
        time,
      });
    }
  };

  const services = [
    { id: "with-engineer" as SessionType, icon: Mic, label: "AVEC INGÉNIEUR", color: "primary" },
    { id: "without-engineer" as SessionType, icon: Building2, label: "LOCATION SÈCHE", color: "accent" },
    { id: "mixing" as SessionType, icon: Music, label: "MIXAGE", color: "primary" },
    { id: "mastering" as SessionType, icon: Headphones, label: "MASTERING", color: "primary" },
    { id: "analog-mastering" as SessionType, icon: Disc, label: "MASTERING ANALOGIQUE", color: "accent" },
    { id: "podcast" as SessionType, icon: Radio, label: "PODCAST", color: "primary" },
  ] as const;

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
                  <Icon
                    className={cn(
                      "w-4 h-4",
                      service.color === "accent" ? "text-accent" : "text-primary"
                    )}
                  />
                  <span className="font-display text-sm text-foreground">{service.label}</span>
                </div>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    service.color === "accent" ? "text-accent" : "text-primary"
                  )}
                >
                  {formatServicePrice(service.id)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Podcast duration input - only for podcast service */}
      {isPodcast && (
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
      )}

      {/* Selected slot info from external calendar */}
      {selectedDate && selectedTime && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
          <p className="text-sm text-muted-foreground">Créneau sélectionné depuis l'agenda:</p>
          <p className="font-medium text-foreground">{selectedDate} à {selectedTime} ({hours}h)</p>
        </div>
      )}

      {/* Price calculation summary - always show for hourly services when selected, for others always */}
      {selectedService && (
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
                  <span className="text-foreground font-medium">
                    {hours}h × {unitPrice}€
                  </span>
                </div>
              )}

              {isPodcast && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Durée:</span>
                  <span className="text-foreground font-medium">
                    {podcastMinutes}min × {unitPrice}€
                  </span>
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

            {/* Discount & Client info */}
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
                    Titre personnalisé (optionnel)
                  </Label>
                  <Input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Ex: SESSION ENREGISTREMENT - Artiste"
                    className="bg-secondary/50 border-border"
                  />
                </div>
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
                    Email du client
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
                <div className="pt-4 space-y-4">
                  {/* Email options toggle */}
                  <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-primary" />
                        <Label className="text-foreground font-medium">Envoyer un email au client</Label>
                      </div>
                      <Switch
                        checked={sendConfirmationEmail}
                        onCheckedChange={setSendConfirmationEmail}
                      />
                    </div>

                    {sendConfirmationEmail && (
                      <div className="space-y-3 pt-2">
                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background border border-border">
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-blue-500" />
                              <span className="text-sm">Lien de paiement Stripe</span>
                            </div>
                            <Switch
                              checked={includeStripeLink}
                              onCheckedChange={setIncludeStripeLink}
                              disabled={finalPrice <= 0}
                            />
                          </div>

                          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background border border-border">
                            <div className="flex items-center gap-2">
                              <FolderOpen className="w-4 h-4 text-amber-500" />
                              <span className="text-sm">Créer dossier Drive</span>
                            </div>
                            <Switch
                              checked={includeDriveLink}
                              onCheckedChange={setIncludeDriveLink}
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm text-muted-foreground mb-2 block">
                            Message personnalisé (optionnel)
                          </Label>
                          <Textarea
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            placeholder="Message à inclure dans l'email..."
                            className="bg-background border-border"
                            rows={2}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Create event button */}
                  <Button
                    variant="hero"
                    className="w-full"
                    disabled={creatingEvent || (sendConfirmationEmail && !clientEmail)}
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

                        const title = customTitle.trim()
                          ? customTitle.trim()
                          : clientName
                            ? `SESSION ${sessionLabels[selectedService!]} - ${clientName}`
                            : `SESSION ${sessionLabels[selectedService!]}`;

                        // Create the calendar event
                        const { error } = await supabase.functions.invoke("create-admin-event", {
                          body: {
                            title,
                            clientName: clientName || "",
                            clientEmail: clientEmail || undefined,
                            description: `Prix: ${finalPrice}€${discountPercent > 0 ? ` (remise ${discountPercent}%)` : ''}\n${clientEmail ? `Email: ${clientEmail}` : ''}`,
                            date: selectedDate,
                            time: selectedTime,
                            hours: isHourlyService ? hours : (isPodcast ? Math.ceil(podcastMinutes / 60) : 1),
                          },
                        });

                        if (error) throw error;

                        // Send email if option is enabled
                        if (sendConfirmationEmail && clientEmail) {
                          setSendingEmail(true);
                          const { data: emailData, error: emailError } = await supabase.functions.invoke("send-admin-email", {
                            body: {
                              clientEmail,
                              clientName: clientName || clientEmail.split("@")[0],
                              sessionType: selectedService,
                              sessionDate: selectedDate,
                              sessionTime: selectedTime,
                              hours: isHourlyService ? hours : (isPodcast ? podcastMinutes : 1),
                              totalPrice: finalPrice,
                              includeStripeLink: includeStripeLink && finalPrice > 0,
                              includeDriveLink,
                              customMessage,
                            },
                          });
                          setSendingEmail(false);

                          if (emailError) {
                            console.error("Email error:", emailError);
                            toast({
                              title: "Événement créé",
                              description: `Session ajoutée mais l'email n'a pas pu être envoyé.`,
                              variant: "destructive",
                            });
                          } else {
                            toast({
                              title: "Événement créé et email envoyé !",
                              description: `Session du ${selectedDate} à ${selectedTime} ajoutée. Email envoyé à ${clientEmail}.${emailData?.driveFolderLink ? ' Dossier Drive créé.' : ''}`,
                            });
                          }
                        } else {
                          toast({
                            title: "Événement créé !",
                            description: `Session du ${selectedDate} à ${selectedTime} ajoutée à l'agenda.`,
                          });
                        }

                        // Refresh the calendar to show the new event
                        onEventCreated?.();

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
                          description: "Impossible de créer l'événement.",
                          variant: "destructive",
                        });
                      } finally {
                        setCreatingEvent(false);
                        setSendingEmail(false);
                      }
                    }}
                  >
                    {creatingEvent ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {sendingEmail ? "Envoi de l'email..." : "Création..."}
                      </>
                    ) : (
                      <>
                        {sendConfirmationEmail ? (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            CRÉER ET ENVOYER
                          </>
                        ) : (
                          <>
                            <Calendar className="w-4 h-4 mr-2" />
                            CRÉER L'ÉVÉNEMENT
                          </>
                        )}
                      </>
                    )}
                  </Button>

                  {sendConfirmationEmail && !clientEmail && (
                    <p className="text-xs text-amber-500 text-center">
                      Entrez l'email du client pour activer l'envoi d'email
                    </p>
                  )}

                  <AdminInvoiceGenerator
                    prefilledData={{
                      clientName,
                      clientEmail,
                      sessionType: selectedService,
                      hours: isHourlyService ? hours : (isPodcast ? podcastMinutes : 1),
                      totalPrice: finalPrice,
                    }}
                  />

                  {/* QR Code payment */}
                  <div className="pt-4 border-t border-border">
                    <AdminPaymentQRCode calculatedPrice={finalPrice} />
                  </div>
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
