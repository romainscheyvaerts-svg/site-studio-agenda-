import { useState, useEffect } from "react";
import { format, addDays, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, Clock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface TimeSlot {
  hour: number;
  available: boolean;
  eventName?: string;
}

interface DayAvailability {
  date: string;
  slots: TimeSlot[];
}

interface Service {
  id: string;
  service_key: string;
  name_fr: string;
  base_price: number;
  price_unit: string;
}

interface SalesConfig {
  is_active: boolean;
  sale_name: string;
  discount_percentage: number;
  discount_with_engineer: number | null;
  discount_without_engineer: number | null;
  discount_mixing: number | null;
  discount_mastering: number | null;
  discount_analog_mastering: number | null;
  discount_podcast: number | null;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 9); // 9h to 22h

export default function PublicBookingCalendar() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [salesConfig, setSalesConfig] = useState<SalesConfig | null>(null);
  
  // Selection state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedStartHour, setSelectedStartHour] = useState<number | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(2);
  const [selectedService, setSelectedService] = useState<string>("");
  
  // Form state - pre-fill with user data if logged in
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  
  // Payment state
  const [processingPayment, setProcessingPayment] = useState(false);

  // Pre-fill form with user data when logged in
  useEffect(() => {
    if (user) {
      if (!clientName) {
        setClientName((user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || "");
      }
      if (!clientEmail) {
        setClientEmail(user.email || "");
      }
      if (!clientPhone) {
        setClientPhone((user.user_metadata?.phone as string) || "");
      }
    }
  }, [user]);

  // Fetch services and sales config
  useEffect(() => {
    const fetchData = async () => {
      const [servicesRes, salesRes] = await Promise.all([
        supabase.from('services').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('sales_config').select('*').limit(1).single()
      ]);
      
      if (!servicesRes.error && servicesRes.data) {
        setServices(servicesRes.data);
        if (servicesRes.data.length > 0) {
          setSelectedService(servicesRes.data[0].service_key);
        }
      }
      
      if (!salesRes.error && salesRes.data) {
        setSalesConfig(salesRes.data as SalesConfig);
      }
    };
    fetchData();
  }, []);

  // Fetch availability for the week
  useEffect(() => {
    const fetchAvailability = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-weekly-availability', {
          body: {
            startDate: format(weekStart, 'yyyy-MM-dd'),
            days: 7
          }
        });

        if (error) throw error;
        
        if (data?.availability) {
          setAvailability(data.availability);
        }
      } catch (error) {
        console.error('Error fetching availability:', error);
        toast.error("Erreur lors du chargement des disponibilités");
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [weekStart]);

  const handlePreviousWeek = () => {
    setWeekStart(prev => subWeeks(prev, 1));
    setSelectedDate(null);
    setSelectedStartHour(null);
  };

  const handleNextWeek = () => {
    setWeekStart(prev => addWeeks(prev, 1));
    setSelectedDate(null);
    setSelectedStartHour(null);
  };

  const handleSlotClick = (date: string, hour: number) => {
    // Check if all hours for the duration are available
    const dayAvailability = availability.find(d => d.date === date);
    if (!dayAvailability) return;

    const isBlockAvailable = Array.from({ length: selectedDuration }, (_, i) => {
      const targetHour = hour + i;
      const slot = dayAvailability.slots.find(s => s.hour === targetHour);
      return slot?.available;
    }).every(Boolean);

    if (!isBlockAvailable) {
      toast.error("Ce créneau n'est pas entièrement disponible pour la durée sélectionnée");
      return;
    }

    setSelectedDate(date);
    setSelectedStartHour(hour);
  };

  const getSlotStatus = (date: string, hour: number) => {
    const dayAvailability = availability.find(d => d.date === date);
    if (!dayAvailability) return 'unknown';
    
    const slot = dayAvailability.slots.find(s => s.hour === hour);
    if (!slot) return 'unknown';
    
    return slot.available ? 'available' : 'unavailable';
  };

  const isSlotSelected = (date: string, hour: number) => {
    if (!selectedDate || selectedStartHour === null) return false;
    if (date !== selectedDate) return false;
    return hour >= selectedStartHour && hour < selectedStartHour + selectedDuration;
  };

  const getDiscountedPrice = (serviceKey: string, basePrice: number): { original: number; discounted: number; hasDiscount: boolean } => {
    if (!salesConfig?.is_active) return { original: basePrice, discounted: basePrice, hasDiscount: false };

    const discountMap: Record<string, number | null | undefined> = {
      'with-engineer': salesConfig.discount_with_engineer,
      'without-engineer': salesConfig.discount_without_engineer,
      'mixing': salesConfig.discount_mixing,
      'mastering': salesConfig.discount_mastering,
      'analog-mastering': salesConfig.discount_analog_mastering,
      'podcast': salesConfig.discount_podcast,
    };

    const discount = discountMap[serviceKey] ?? salesConfig.discount_percentage;
    if (!discount || discount <= 0) return { original: basePrice, discounted: basePrice, hasDiscount: false };

    const discounted = Math.round(basePrice * (1 - discount / 100));
    return { original: basePrice, discounted, hasDiscount: true };
  };

  const calculatePrice = () => {
    const service = services.find(s => s.service_key === selectedService);
    if (!service) return { original: 0, discounted: 0, hasDiscount: false };
    
    let baseTotal = service.base_price;
    if (service.price_unit === 'hourly') {
      baseTotal = service.base_price * selectedDuration;
    }
    
    return getDiscountedPrice(service.service_key, baseTotal);
  };

  const handlePayment = async () => {
    if (!selectedDate || selectedStartHour === null) {
      toast.error("Veuillez sélectionner un créneau");
      return;
    }
    
    if (!clientName || !clientEmail) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      toast.error("Veuillez entrer une adresse email valide");
      return;
    }

    setProcessingPayment(true);

    try {
      const service = services.find(s => s.service_key === selectedService);
      const priceData = calculatePrice();
      const amount = priceData.discounted;
      const startTime = `${selectedStartHour.toString().padStart(2, '0')}:00`;
      const endTime = `${(selectedStartHour + selectedDuration).toString().padStart(2, '0')}:00`;

      // Create Stripe payment session
      const { data, error } = await supabase.functions.invoke('create-stripe-payment', {
        body: {
          amount,
          email: clientEmail,
          sessionType: service?.name_fr || 'Session studio',
          sessionDate: selectedDate,
          startTime,
          endTime,
          duration: selectedDuration,
          clientName,
          clientPhone,
          bookingData: {
            clientName,
            clientEmail,
            clientPhone,
            sessionType: service?.name_fr || 'Session studio',
            sessionDate: selectedDate,
            startTime,
            endTime,
            durationHours: selectedDuration,
            amount
          }
        }
      });

      if (error) throw error;

      if (data?.url) {
        // Store booking data in session storage for after payment
        sessionStorage.setItem('pendingBooking', JSON.stringify({
          clientName,
          clientEmail,
          clientPhone,
          sessionType: service?.name_fr || 'Session studio',
          sessionDate: selectedDate,
          startTime,
          endTime,
          durationHours: selectedDuration,
          amount
        }));
        
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error("Erreur lors de la création du paiement");
    } finally {
      setProcessingPayment(false);
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-6">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handlePreviousWeek}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Semaine précédente
        </Button>
        <h2 className="text-lg font-semibold">
          {format(weekStart, 'd MMMM', { locale: fr })} - {format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: fr })}
        </h2>
        <Button variant="outline" onClick={handleNextWeek}>
          Semaine suivante
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Duration selector */}
      <div className="flex items-center gap-4">
        <Label className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Durée de la session :
        </Label>
        <Select value={selectedDuration.toString()} onValueChange={(v) => setSelectedDuration(parseInt(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(h => (
              <SelectItem key={h} value={h.toString()}>{h}h</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-500" />
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500/50" />
          <span>Indisponible</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary" />
          <span>Sélectionné</span>
        </div>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-8 gap-1 min-w-[800px]">
            {/* Header row */}
            <div className="p-2 font-medium text-muted-foreground">Heure</div>
            {weekDays.map(day => (
              <div key={day.toISOString()} className="p-2 text-center font-medium">
                <div className="text-sm text-muted-foreground">
                  {format(day, 'EEE', { locale: fr })}
                </div>
                <div className="text-lg">{format(day, 'd')}</div>
              </div>
            ))}

            {/* Time slots */}
            {HOURS.map(hour => (
              <>
                <div key={`hour-${hour}`} className="p-2 text-sm text-muted-foreground text-right">
                  {hour}:00
                </div>
                {weekDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const status = getSlotStatus(dateStr, hour);
                  const isSelected = isSlotSelected(dateStr, hour);
                  const isPast = day < new Date() && !isSelected;

                  return (
                    <button
                      key={`${dateStr}-${hour}`}
                      onClick={() => !isPast && status === 'available' && handleSlotClick(dateStr, hour)}
                      disabled={isPast || status !== 'available'}
                      className={`
                        p-2 rounded text-xs transition-all
                        ${isSelected 
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2' 
                          : status === 'available' && !isPast
                            ? 'bg-emerald-500/20 hover:bg-emerald-500/40 cursor-pointer'
                            : 'bg-red-500/20 cursor-not-allowed opacity-50'
                        }
                      `}
                    >
                      {isSelected && hour === selectedStartHour && (
                        <span className="font-medium">Début</span>
                      )}
                    </button>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      )}

      {/* Booking form */}
      {selectedDate && selectedStartHour !== null && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Réserver votre session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected slot summary */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Date :</span>
                  <span className="ml-2 font-medium">
                    {format(new Date(selectedDate), 'EEEE d MMMM yyyy', { locale: fr })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Horaire :</span>
                  <span className="ml-2 font-medium">
                    {selectedStartHour}:00 - {selectedStartHour + selectedDuration}:00
                  </span>
                </div>
              </div>
            </div>

            {/* Service selection */}
            <div className="space-y-2">
              <Label>Type de session</Label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map(service => {
                    const priceInfo = getDiscountedPrice(service.service_key, service.base_price);
                    return (
                      <SelectItem key={service.id} value={service.service_key}>
                        {service.name_fr} - {priceInfo.hasDiscount ? (
                          <><span className="line-through text-muted-foreground">{priceInfo.original}€</span> <span className="text-destructive font-bold">{priceInfo.discounted}€</span></>
                        ) : (
                          <>{service.base_price}€</>
                        )}{service.price_unit === 'hourly' ? '/h' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Client info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Nom complet *</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Votre nom"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientEmail">Email *</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="clientPhone">Téléphone</Label>
                <Input
                  id="clientPhone"
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+32 xxx xx xx xx"
                />
              </div>
            </div>

            {/* Price and payment */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <span className="text-muted-foreground">Total à payer :</span>
                {calculatePrice().hasDiscount ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg line-through text-muted-foreground">{calculatePrice().original}€</span>
                    <span className="text-2xl font-bold text-destructive">{calculatePrice().discounted}€</span>
                    {salesConfig?.sale_name && (
                      <span className="text-xs px-2 py-1 bg-destructive/20 text-destructive rounded-full">
                        {salesConfig.sale_name}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="ml-2 text-2xl font-bold text-primary">{calculatePrice().discounted}€</span>
                )}
              </div>
              <Button 
                size="lg" 
                onClick={handlePayment}
                disabled={processingPayment || !clientName || !clientEmail}
              >
                {processingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Payer et réserver
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
