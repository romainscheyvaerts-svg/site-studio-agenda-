import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  Plus,
  ChevronsUpDown,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import ModernCalendar from "./ModernCalendar";
import AdminInvoiceGenerator from "./AdminInvoiceGenerator";
import AdminPaymentQRCode from "./AdminPaymentQRCode";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/usePricing";
import { useStudio } from "@/hooks/useStudio";

type SessionType = string | null;

interface ClientInfo {
  id: string;
  email: string;
  name: string;
}

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
  onEventCreated?: () => void;
}

// Icon mapping for known service keys
const serviceIconMap: Record<string, LucideIcon> = {
  "with-engineer": Mic,
  "without-engineer": Building2,
  "mixing": Music,
  "mastering": Headphones,
  "analog-mastering": Disc,
  "podcast": Radio,
  "composition": Music,
};

const getServiceIcon = (serviceKey: string): LucideIcon => {
  return serviceIconMap[serviceKey] || Wrench;
};

const AdminPriceCalculator = ({
  selectedDate: externalDate,
  selectedTime: externalTime,
  selectedDuration: externalDuration,
  onPriceCalculated,
  onEventCreated
}: AdminPriceCalculatorProps) => {
  const { studio } = useStudio();
  const { toast } = useToast();
  const { getPrice, services: dbServices, loading: loadingServices } = usePricing();

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

  // Custom service states
  const [customServiceName, setCustomServiceName] = useState("");
  const [customServicePrice, setCustomServicePrice] = useState(0);
  const [customServiceHours, setCustomServiceHours] = useState(1);
  const [customServiceIsHourly, setCustomServiceIsHourly] = useState(false);

  // Client list for autocomplete
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [openNameCombobox, setOpenNameCombobox] = useState(false);
  const [openEmailCombobox, setOpenEmailCombobox] = useState(false);

  // Load clients on mount
  useEffect(() => {
    const loadClients = async () => {
      setLoadingClients(true);
      try {
        const { data, error } = await supabase.functions.invoke("list-users");
        if (error) throw error;
        
        if (data?.users) {
          const clientList: ClientInfo[] = data.users.map((u: any) => ({
            id: u.id,
            email: u.email || "",
            name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split("@")[0] || "",
          }));
          setClients(clientList);
        }
      } catch (err) {
        console.error("Error loading clients:", err);
      } finally {
        setLoadingClients(false);
      }
    };
    loadClients();
  }, []);

  // Select client by email
  const selectClientByEmail = (email: string) => {
    setClientEmail(email);
    const client = clients.find(c => c.email === email);
    if (client) {
      setClientName(client.name);
    }
    setOpenEmailCombobox(false);
  };

  // Select client by name
  const selectClientByName = (name: string) => {
    setClientName(name);
    const client = clients.find(c => c.name === name);
    if (client) {
      setClientEmail(client.email);
    }
    setOpenNameCombobox(false);
  };

  // Filtered clients for search
  const filteredClientsByName = useMemo(() => {
    if (!clientName) return clients;
    return clients.filter(c => 
      c.name.toLowerCase().includes(clientName.toLowerCase())
    );
  }, [clients, clientName]);

  const filteredClientsByEmail = useMemo(() => {
    if (!clientEmail) return clients;
    return clients.filter(c => 
      c.email.toLowerCase().includes(clientEmail.toLowerCase())
    );
  }, [clients, clientEmail]);

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

  // Build dynamic services list from DB + always "Autre Service"
  const services = useMemo(() => {
    const dynamicServices: Array<{
      id: string;
      icon: LucideIcon;
      label: string;
      color: string;
      priceUnit: string;
    }> = dbServices.map((s, index) => ({
      id: s.service_key,
      icon: getServiceIcon(s.service_key),
      label: s.name_fr.toUpperCase(),
      color: index % 2 === 0 ? "primary" : "accent",
      priceUnit: s.price_unit,
    }));
    // Always add "Autre Service" at the end
    dynamicServices.push({
      id: "custom",
      icon: Plus,
      label: "AUTRE SERVICE",
      color: "secondary",
      priceUnit: "fixed",
    });
    return dynamicServices;
  }, [dbServices]);

  // Get the selected DB service for unit info
  const selectedDbService = useMemo(() => {
    if (!selectedService || selectedService === "custom") return null;
    return dbServices.find(s => s.service_key === selectedService) || null;
  }, [selectedService, dbServices]);

  const formatServicePrice = useCallback(
    (serviceKey: string) => {
      const price = getPrice(serviceKey);
      const dbSvc = dbServices.find(s => s.service_key === serviceKey);
      if (dbSvc?.price_unit === "hourly") return `${price}€/h`;
      if (dbSvc?.price_unit === "per_minute") return `${price}€/min`;
      return `${price}€`;
    },
    [getPrice, dbServices]
  );

  // Dynamic service labels from DB
  const serviceLabels: Record<string, string> = useMemo(() => {
    const labels: Record<string, string> = { "custom": customServiceName || "Autre service" };
    dbServices.forEach(s => { labels[s.service_key] = s.name_fr; });
    return labels;
  }, [dbServices, customServiceName]);

  const isHourlyService = selectedDbService?.price_unit === "hourly";
  const isPodcast = selectedDbService?.price_unit === "per_minute";
  const isCustomService = selectedService === "custom";

  const totalPrice = useMemo(() => {
    if (!selectedService) return 0;
    // Custom service calculation
    if (isCustomService) {
      return customServiceIsHourly 
        ? customServicePrice * customServiceHours 
        : customServicePrice;
    }
    if (isPodcast) {
      return podcastMinutes * unitPrice;
    }
    if (isHourlyService) {
      return hours * unitPrice;
    }
    return unitPrice;
  }, [selectedService, hours, podcastMinutes, isHourlyService, isPodcast, unitPrice, isCustomService, customServicePrice, customServiceHours, customServiceIsHourly]);

  const discountAmount = useMemo(() => {
    return Math.round(totalPrice * (discountPercent / 100));
  }, [totalPrice, discountPercent]);

  const finalPrice = totalPrice - discountAmount;

  const handleServiceClick = (service: SessionType) => {
    setSelectedService(service);
    // Notify parent of price calculation when service is selected
    if (onPriceCalculated && service) {
      const price = getPrice(service);
      const svc = dbServices.find(s => s.service_key === service);
      const isHourly = svc?.price_unit === "hourly";
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

  return (
    <div className="space-y-6">
      {/* Service selector buttons - dynamically from DB */}
      <div>
        <Label className="text-sm text-muted-foreground mb-3 block flex items-center gap-2">
          <Calculator className="w-4 h-4" />
          Sélectionnez un service pour ouvrir l'agenda et calculer le prix
        </Label>

        {loadingServices ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Chargement des services...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {services.map((service) => {
              const Icon = service.icon;
              const isSelected = selectedService === service.id;
              const isCustom = service.id === "custom";
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => handleServiceClick(service.id)}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all duration-300",
                    isSelected
                      ? isCustom
                        ? "border-purple-500 bg-purple-500/10 box-glow-purple"
                        : service.color === "accent"
                          ? "border-accent bg-accent/10 box-glow-gold"
                          : "border-primary bg-primary/10 box-glow-cyan"
                      : isCustom 
                        ? "border-dashed border-purple-500/50 bg-purple-500/5 hover:border-purple-500"
                        : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon
                      className={cn(
                        "w-4 h-4",
                        isCustom ? "text-purple-500" : service.color === "accent" ? "text-accent" : "text-primary"
                      )}
                    />
                    <span className="font-display text-sm text-foreground">{service.label}</span>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      isCustom ? "text-purple-500" : service.color === "accent" ? "text-accent" : "text-primary"
                    )}
                  >
                    {isCustom ? "Prix manuel" : formatServicePrice(service.id)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Podcast / per_minute duration input */}
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

      {/* Custom service configuration */}
      {isCustomService && (
        <div className="p-5 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 space-y-4">
          <h4 className="font-display text-base text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-purple-500" />
            CONFIGURER LE SERVICE PERSONNALISÉ
          </h4>
          
          <div className="grid md:grid-cols-2 gap-4">
            {/* Service name */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Nom du service</Label>
              <Input
                value={customServiceName}
                onChange={(e) => setCustomServiceName(e.target.value)}
                placeholder="Ex: Coaching vocal, Formation..."
                className="bg-background/50 border-purple-500/30 focus:border-purple-500"
              />
            </div>

            {/* Hourly toggle */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Type de tarification</Label>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-background/50 border border-purple-500/30">
                <button
                  type="button"
                  onClick={() => setCustomServiceIsHourly(false)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all",
                    !customServiceIsHourly
                      ? "bg-purple-500 text-white"
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Prix fixe
                </button>
                <button
                  type="button"
                  onClick={() => setCustomServiceIsHourly(true)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all",
                    customServiceIsHourly
                      ? "bg-purple-500 text-white"
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Prix/heure
                </button>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Price */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                {customServiceIsHourly ? "Prix par heure (€)" : "Prix total (€)"}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={customServicePrice}
                  onChange={(e) => setCustomServicePrice(Math.max(0, parseInt(e.target.value) || 0))}
                  className="bg-background/50 border-purple-500/30 focus:border-purple-500"
                />
                <span className="text-purple-400 font-semibold">€{customServiceIsHourly ? "/h" : ""}</span>
              </div>
            </div>

            {/* Hours (only for hourly pricing) */}
            {customServiceIsHourly && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Nombre d'heures</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    value={customServiceHours}
                    onChange={(e) => setCustomServiceHours(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))}
                    className="bg-background/50 border-purple-500/30 focus:border-purple-500"
                  />
                  <Clock className="w-4 h-4 text-purple-400" />
                </div>
              </div>
            )}

            {/* Duration for calendar (only for fixed price) */}
            {!customServiceIsHourly && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Durée sur le calendrier (heures)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    value={customServiceHours}
                    onChange={(e) => setCustomServiceHours(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))}
                    className="bg-background/50 border-purple-500/30 focus:border-purple-500"
                  />
                  <Clock className="w-4 h-4 text-purple-400" />
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="mt-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Aperçu:</span>
              <span className="text-purple-400 font-semibold">
                {customServiceName || "Autre service"} - {customServiceHours}h = {customServiceIsHourly ? customServicePrice * customServiceHours : customServicePrice}€
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Selected slot info from external calendar */}
      {selectedDate && selectedTime && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
          <p className="text-sm text-muted-foreground">Créneau sélectionné depuis l'agenda:</p>
          <p className="font-medium text-foreground">{selectedDate} à {selectedTime} ({hours}h)</p>
        </div>
      )}

      {/* Price calculation summary */}
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
                <span className="text-foreground font-medium">{serviceLabels[selectedService] || selectedService}</span>
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
                  <Popover open={openNameCombobox} onOpenChange={setOpenNameCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openNameCombobox}
                        className="w-full justify-between bg-secondary/50 border-border text-left font-normal"
                      >
                        {clientName || "Sélectionner un client..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Rechercher par nom..." 
                          value={clientName}
                          onValueChange={setClientName}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {loadingClients ? "Chargement..." : "Aucun client trouvé."}
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredClientsByName.slice(0, 10).map((client) => (
                              <CommandItem
                                key={client.id}
                                value={client.name}
                                onSelect={() => selectClientByName(client.name)}
                              >
                                <User className="mr-2 h-4 w-4" />
                                <div className="flex flex-col">
                                  <span>{client.name}</span>
                                  <span className="text-xs text-muted-foreground">{client.email}</span>
                                </div>
                                {clientName === client.name && (
                                  <Check className="ml-auto h-4 w-4" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">
                    Email du client
                  </Label>
                  <Popover open={openEmailCombobox} onOpenChange={setOpenEmailCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openEmailCombobox}
                        className="w-full justify-between bg-secondary/50 border-border text-left font-normal"
                      >
                        {clientEmail || "Sélectionner un email..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Rechercher par email..." 
                          value={clientEmail}
                          onValueChange={setClientEmail}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {loadingClients ? "Chargement..." : "Aucun client trouvé."}
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredClientsByEmail.slice(0, 10).map((client) => (
                              <CommandItem
                                key={client.id}
                                value={client.email}
                                onSelect={() => selectClientByEmail(client.email)}
                              >
                                <Mail className="mr-2 h-4 w-4" />
                                <div className="flex flex-col">
                                  <span>{client.email}</span>
                                  <span className="text-xs text-muted-foreground">{client.name}</span>
                                </div>
                                {clientEmail === client.email && (
                                  <Check className="ml-auto h-4 w-4" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                        // Use dynamic labels from DB for event title
                        const eventServiceLabel = serviceLabels[selectedService!] || selectedService || "Service";

                        // Calculate hours for event
                        const eventHours = isCustomService 
                          ? customServiceHours 
                          : isHourlyService 
                            ? hours 
                            : isPodcast 
                              ? Math.ceil(podcastMinutes / 60) 
                              : 1;

                        const title = customTitle.trim()
                          ? customTitle.trim()
                          : clientName
                            ? `${eventServiceLabel} - ${clientName}`
                            : eventServiceLabel;

                        // Get current session and token
                        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
                        console.log("[ADMIN-EVENT] Session check:", { 
                          hasSession: !!sessionData?.session, 
                          error: sessionError?.message,
                          accessToken: sessionData?.session?.access_token?.substring(0, 20) + "..."
                        });

                        if (sessionError || !sessionData.session) {
                          console.log("[ADMIN-EVENT] Trying to refresh session...");
                          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                          if (refreshError || !refreshData.session) {
                            console.error("[ADMIN-EVENT] Refresh failed:", refreshError);
                            throw new Error("Session expirée. Veuillez vous reconnecter.");
                          }
                        }

                        const { data: freshSession } = await supabase.auth.getSession();
                        const accessToken = freshSession?.session?.access_token;
                        
                        if (!accessToken) {
                          throw new Error("Pas de token d'accès. Veuillez vous reconnecter.");
                        }

                        console.log("[ADMIN-EVENT] Calling function with token length:", accessToken.length);

                        const { data, error } = await supabase.functions.invoke("create-admin-event", {
                          body: {
                            studioId: studio?.id,
                            title,
                            clientName: clientName || "",
                            clientEmail: clientEmail || undefined,
                            description: `Prix: ${finalPrice}€${discountPercent > 0 ? ` (remise ${discountPercent}%)` : ''}\nService: ${eventServiceLabel}\n${clientEmail ? `Email: ${clientEmail}` : ''}`,
                            date: selectedDate,
                            time: selectedTime,
                            hours: eventHours,
                          },
                          headers: {
                            Authorization: `Bearer ${accessToken}`
                          }
                        });

                        console.log("[ADMIN-EVENT] Response:", { data, error });
                        if (error) {
                          console.error("[ADMIN-EVENT] Full error:", error);
                          throw error;
                        }

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
                              studioId: studio?.id,
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
