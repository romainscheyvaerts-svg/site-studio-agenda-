import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, User, Mail, Phone, Euro, Mic, Building2, CreditCard, Loader2, CheckCircle, XCircle, AlertCircle, ExternalLink, Music, Headphones, Disc, Radio, Tag, Lock, Shield, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PayPalCheckout from "./PayPalCheckout";
import IdentityVerification from "./IdentityVerification";
import VIPCalendar from "./VIPCalendar";
import AdminCalendar from "./AdminCalendar";
import AdminEventCreator from "./AdminEventCreator";
import AdminPanel from "./AdminPanel";
import AdminInvoiceGenerator from "./AdminInvoiceGenerator";
import AdminPriceCalculator from "./AdminPriceCalculator";
import StripeCheckoutButton from "./StripeCheckoutButton";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";

type SessionType = "with-engineer" | "without-engineer" | "mixing" | "mastering" | "analog-mastering" | "podcast" | null;
type AvailabilityStatus = "idle" | "checking" | "available" | "unavailable" | "error";

// Services qui ne nécessitent pas de calendrier ni de vérification d'identité
const IMMEDIATE_SERVICES: SessionType[] = ["mixing", "mastering", "analog-mastering", "podcast"];

// Promo code effects returned from server (no codes stored client-side)
type PromoEffects = {
  code: string; // Only stored after validation, for display/removal purposes
  fullCalendarVisibility: boolean;
  skipPayment: boolean;
  skipIdentityVerification: boolean;
  skipFormFields: boolean;
  autoSelectService: SessionType;
  discounts: Record<string, number>;
  customPrices: Record<string, number>;
  requireFullPayment: boolean;
};

const BookingSection = () => {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [sessionType, setSessionType] = useState<SessionType>(null);
  const [hours, setHours] = useState(2);
  const [podcastMinutes, setPodcastMinutes] = useState(1);
  const [showPayment, setShowPayment] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);
  const [loadingClientId, setLoadingClientId] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>("idle");
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [identityVerified, setIdentityVerified] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [activePromos, setActivePromos] = useState<PromoEffects[]>([]);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [showVIPCalendar, setShowVIPCalendar] = useState(false);
  const [cashOnlyLoading, setCashOnlyLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    date: "",
    time: "",
    message: "",
  });

  // Pre-fill form with user data when logged in
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        email: user.email || prev.email,
        name: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || prev.name,
        phone: (user.user_metadata?.phone as string) || prev.phone,
      }));
    }
  }, [user]);

  // Combined promo effects from all active promos + admin override
  const combinedPromoEffects = useMemo(() => {
    // Admin gets all VIP privileges automatically
    if (isAdmin) {
      return {
        fullCalendarVisibility: true,
        skipPayment: true,
        skipIdentityVerification: true,
        skipFormFields: true,
        autoSelectService: null as SessionType,
        discounts: {} as Record<string, number>,
        customPrices: {} as Record<string, number>,
        requireFullPayment: false,
      };
    }
    
    const autoService = activePromos.find(p => p.autoSelectService !== null)?.autoSelectService || null;
    return {
      fullCalendarVisibility: activePromos.some(p => p.fullCalendarVisibility),
      skipPayment: activePromos.some(p => p.skipPayment),
      skipIdentityVerification: activePromos.some(p => p.skipIdentityVerification),
      skipFormFields: activePromos.some(p => p.skipFormFields),
      autoSelectService: autoService,
      discounts: activePromos.reduce((acc, promo) => {
        Object.entries(promo.discounts).forEach(([key, value]) => {
          const currentDiscount = acc[key as keyof typeof acc] || 0;
          acc[key as keyof typeof acc] = Math.max(currentDiscount, value as number || 0);
        });
        return acc;
      }, {} as Record<string, number>),
      customPrices: activePromos.reduce((acc, promo) => {
        Object.entries(promo.customPrices || {}).forEach(([key, value]) => {
          // Custom price overrides - use the lowest custom price if multiple
          if (value !== undefined && value !== null) {
            const currentPrice = acc[key as keyof typeof acc];
            if (currentPrice === undefined || value < currentPrice) {
              acc[key as keyof typeof acc] = value as number;
            }
          }
        });
        return acc;
      }, {} as Record<string, number>),
      requireFullPayment: activePromos.some(p => p.requireFullPayment),
    };
  }, [activePromos, isAdmin]);

  // Validate promo code via server
  const handleApplyPromoCode = async () => {
    const normalizedCode = promoCode.trim();
    if (!normalizedCode) return;
    
    // Check if already applied
    if (activePromos.some(p => p.code.toLowerCase() === normalizedCode.toLowerCase())) {
      setPromoError("Ce code est déjà appliqué");
      return;
    }
    
    setPromoLoading(true);
    setPromoError("");
    
    try {
      const { data, error } = await supabase.functions.invoke("validate-promo-code", {
        body: { code: normalizedCode },
      });
      
      if (error) throw error;
      
      if (!data.valid) {
        setPromoError(data.error || "Code promo invalide");
        return;
      }
      
      // Store the validated promo with its code for display
      const validatedPromo: PromoEffects = {
        code: normalizedCode,
        fullCalendarVisibility: data.fullCalendarVisibility,
        skipPayment: data.skipPayment,
        skipIdentityVerification: data.skipIdentityVerification,
        skipFormFields: data.skipFormFields,
        autoSelectService: data.autoSelectService,
        discounts: data.discounts || {},
        customPrices: data.customPrices || {},
        requireFullPayment: data.requireFullPayment || false,
      };
      
      setActivePromos([...activePromos, validatedPromo]);
      setPromoCode("");
      
      // Auto-select service if specified
      if (validatedPromo.autoSelectService) {
        setSessionType(validatedPromo.autoSelectService);
      }
      
      toast({
        title: "Code promo appliqué !",
        description: validatedPromo.skipFormFields
          ? "Accès VIP complet - réservation simplifiée activée."
          : validatedPromo.fullCalendarVisibility 
          ? "Vous avez accès à la visibilité complète de l'agenda."
          : validatedPromo.skipPayment
          ? "Paiement en espèces activé - pas d'acompte requis."
          : "Réductions appliquées à votre réservation.",
      });
    } catch (err) {
      console.error("Promo code validation error:", err);
      setPromoError("Erreur de validation. Réessayez.");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromoCode = (codeToRemove: string) => {
    setActivePromos(activePromos.filter(p => p.code !== codeToRemove));
  };

  // Check if identity verification should be skipped
  const skipIdentityVerification = combinedPromoEffects.skipIdentityVerification;
  
  // Check if cashonly777 is active (skip payment, but still create calendar event and send email)
  const isCashOnly = activePromos.some(p => p.code.toLowerCase() === "cashonly777");
  
  // Check if payment should be skipped (cashonly777 or vip777 + without-engineer)
  const skipPayment = combinedPromoEffects.skipPayment && (sessionType === "without-engineer" || isCashOnly);

  const pricing: Record<string, number> = {
    "with-engineer": 45,
    "without-engineer": 22,
    "mixing": 200,
    "mastering": 60,
    "analog-mastering": 100,
    "podcast": 40, // par minute
  };

  // Get effective price (custom price from promo or base price)
  const getEffectivePrice = (service: string): number => {
    const customPrice = combinedPromoEffects.customPrices?.[service];
    if (customPrice !== undefined && customPrice !== null) {
      return customPrice;
    }
    return pricing[service] || 0;
  };

  // Pour les services immédiats, pas de notion d'heures
  const isImmediateService = sessionType && IMMEDIATE_SERVICES.includes(sessionType);
  
  // Check if VIP calendar should be available (vip777 with full calendar visibility)
  const showVIPCalendarButton = combinedPromoEffects.fullCalendarVisibility && !isImmediateService;
  
  // Check if full payment is required by promo code
  const requireFullPayment = combinedPromoEffects.requireFullPayment;
  
  // Debug logging
  console.log("VIP Debug:", { 
    activePromos: activePromos.map(p => p.code), 
    fullCalendarVisibility: combinedPromoEffects.fullCalendarVisibility,
    sessionType,
    isImmediateService,
    showVIPCalendarButton,
    skipPayment,
    showVIPCalendar,
    customPrices: combinedPromoEffects.customPrices,
    requireFullPayment
  });

  const totalPrice = useMemo(() => {
    if (!sessionType) return 0;
    const effectivePrice = getEffectivePrice(sessionType);
    if (sessionType === "podcast") {
      return podcastMinutes * effectivePrice;
    }
    if (isImmediateService) {
      return effectivePrice;
    }
    return hours * effectivePrice;
  }, [sessionType, hours, podcastMinutes, isImmediateService, combinedPromoEffects.customPrices]);

  // Calculate promo discount
  const promoDiscount = useMemo(() => {
    if (activePromos.length === 0 || !sessionType) return 0;
    const discountPercent = combinedPromoEffects.discounts[sessionType] || 0;
    return Math.round(totalPrice * (discountPercent / 100));
  }, [activePromos, combinedPromoEffects, sessionType, totalPrice]);

  const finalPrice = totalPrice - promoDiscount;

  // Location sèche = paiement complet, analog-mastering = 80€ acompte, autres = 50% acompte
  // Si requireFullPayment (code promo prixdami777), paiement à 100%
  const paymentAmount = useMemo(() => {
    if (!sessionType) return 0;
    if (skipPayment) return 0; // VIP777 + without-engineer = free booking
    
    // Si le code promo exige un paiement complet
    if (requireFullPayment) {
      return finalPrice; // 100% paiement
    }
    
    if (sessionType === "without-engineer") {
      return finalPrice; // Paiement complet
    }
    if (sessionType === "analog-mastering") {
      return Math.max(0, 80 - promoDiscount); // Acompte fixe de 80€ avec réduction
    }
    return Math.ceil(finalPrice / 2); // 50% acompte
  }, [sessionType, finalPrice, skipPayment, promoDiscount, requireFullPayment]);

  // isDeposit = false si paiement complet requis par promo code
  const isDeposit = !requireFullPayment && (sessionType === "with-engineer" || sessionType === "mixing" || sessionType === "mastering" || sessionType === "analog-mastering" || sessionType === "podcast");

  // Fetch PayPal client ID
  useEffect(() => {
    const fetchClientId = async () => {
      setLoadingClientId(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-paypal-client-id");
        if (error) throw error;
        setPaypalClientId(data.clientId);
      } catch (err) {
        console.error("Failed to fetch PayPal client ID:", err);
        toast({
          title: "Erreur de configuration",
          description: "Impossible de charger le système de paiement.",
          variant: "destructive",
        });
      } finally {
        setLoadingClientId(false);
      }
    };
    fetchClientId();
  }, [toast]);

  // Listen for chatbot summary event
  useEffect(() => {
    const handleChatbotSummary = (event: CustomEvent<string>) => {
      setFormData((prev) => ({
        ...prev,
        message: event.detail,
      }));
    };

    window.addEventListener("chatbot-summary", handleChatbotSummary as EventListener);
    return () => {
      window.removeEventListener("chatbot-summary", handleChatbotSummary as EventListener);
    };
  }, []);

  // Handle Stripe payment callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get("payment");
    const sessionId = urlParams.get("session_id");

    if (paymentStatus === "success" && sessionId) {
      // Verify payment and create booking
      const verifyAndCreateBooking = async () => {
        try {
          toast({
            title: "Vérification du paiement...",
            description: "Veuillez patienter pendant que nous vérifions votre paiement.",
          });

          const { data, error } = await supabase.functions.invoke("verify-stripe-payment", {
            body: { sessionId },
          });

          if (error) throw error;

          if (data?.success) {
            // Payment verified - create booking via paypal-webhook (reusing existing logic)
            const { data: bookingData, error: bookingError } = await supabase.functions.invoke("paypal-webhook", {
              body: {
                orderId: `STRIPE-${sessionId}`,
                payerName: data.metadata?.name || "Client",
                payerEmail: data.customerEmail || "",
                phone: data.metadata?.phone || "",
                sessionType: data.metadata?.sessionType,
                date: data.metadata?.date,
                time: data.metadata?.time,
                hours: parseInt(data.metadata?.hours || "2"),
                totalAmount: data.metadata?.totalPrice || data.amountTotal,
                message: data.metadata?.message || "",
                isCashPayment: false,
                podcastMinutes: data.metadata?.podcastMinutes ? parseInt(data.metadata.podcastMinutes) : undefined,
              },
            });

            if (bookingError) throw bookingError;

            toast({
              title: "Paiement confirmé ! 🎉",
              description: "Votre réservation a été enregistrée. Un email de confirmation vous a été envoyé.",
            });

            // Clear URL params
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            toast({
              title: "Erreur de paiement",
              description: data?.error || "Le paiement n'a pas pu être vérifié.",
              variant: "destructive",
            });
          }
        } catch (err) {
          console.error("Payment verification error:", err);
          toast({
            title: "Erreur de vérification",
            description: "Une erreur est survenue lors de la vérification du paiement.",
            variant: "destructive",
          });
        }
      };

      verifyAndCreateBooking();
    } else if (paymentStatus === "cancelled") {
      toast({
        title: "Paiement annulé",
        description: "Vous avez annulé le processus de paiement. Vous pouvez réessayer quand vous le souhaitez.",
        variant: "destructive",
      });
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  // Listen for select-service event from pricing cards
  useEffect(() => {
    const handleSelectService = (event: CustomEvent<string>) => {
      const serviceType = event.detail as SessionType;
      if (serviceType) {
        setSessionType(serviceType);
        setShowPayment(false);
        // Scroll to form after a short delay
        setTimeout(() => {
          document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    };

    window.addEventListener("select-service", handleSelectService as EventListener);
    return () => {
      window.removeEventListener("select-service", handleSelectService as EventListener);
    };
  }, []);

  // Check availability when date, time, duration or session type changes
  useEffect(() => {
    const checkAvailability = async () => {
      if (!sessionType || !formData.date || !formData.time) {
        setAvailabilityStatus("idle");
        return;
      }

      setAvailabilityStatus("checking");
      setShowPayment(false);

      try {
        const { data, error } = await supabase.functions.invoke("check-availability", {
          body: {
            date: formData.date,
            time: formData.time,
            duration: hours,
            sessionType,
          },
        });

        if (error) throw error;

        if (data.available) {
          setAvailabilityStatus("available");
          setAvailabilityMessage(data.message);
        } else {
          setAvailabilityStatus("unavailable");
          setAvailabilityMessage(data.message);
        }
      } catch (err) {
        console.error("Availability check failed:", err);
        setAvailabilityStatus("error");
        setAvailabilityMessage("Impossible de vérifier la disponibilité. Veuillez réessayer.");
      }
    };

    const debounce = setTimeout(checkAvailability, 500);
    return () => clearTimeout(debounce);
  }, [sessionType, formData.date, formData.time, hours]);

  const validateForm = (): boolean => {
    if (!sessionType) {
      toast({
        title: "Type de service requis",
        description: "Veuillez sélectionner un type de service",
        variant: "destructive",
      });
      return false;
    }

    // For VIP codes with skipFormFields, only date/time is required (no personal info)
    if (combinedPromoEffects.skipFormFields) {
      // Only need date/time if not using VIP calendar
      if (!combinedPromoEffects.fullCalendarVisibility && (!formData.date || !formData.time)) {
        toast({
          title: "Créneau requis",
          description: "Veuillez sélectionner une date et une heure",
          variant: "destructive",
        });
        return false;
      }
      return true;
    }

    // Validate name length (minimum 2 characters)
    if (formData.name && formData.name.trim().length < 2) {
      toast({
        title: "Nom invalide",
        description: "Le nom doit contenir au moins 2 caractères",
        variant: "destructive",
      });
      return false;
    }

    // Pour les services immédiats, seuls nom, email et téléphone sont requis
    if (isImmediateService) {
      if (!formData.name || !formData.email || !formData.phone) {
        toast({
          title: "Formulaire incomplet",
          description: "Veuillez remplir tous les champs obligatoires",
          variant: "destructive",
        });
        return false;
      }
      return true;
    }

    // Pour les sessions avec calendrier
    if (!formData.name || !formData.email || !formData.phone || !formData.date || !formData.time) {
      toast({
        title: "Formulaire incomplet",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return false;
    }

    // Skip availability check for VIP777 (full calendar visibility allows any booking)
    if (!combinedPromoEffects.fullCalendarVisibility && availabilityStatus !== "available") {
      toast({
        title: "Créneau non disponible",
        description: "Veuillez choisir un autre créneau",
        variant: "destructive",
      });
      return false;
    }

    // KYC is required only for session types (not immediate services) unless promo skips it
    if (!skipIdentityVerification && !identityVerified) {
      toast({
        title: "Vérification d'identité requise",
        description: "Veuillez vérifier votre identité avant de procéder au paiement",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleProceedToPayment = () => {
    if (!validateForm()) return;
    setShowPayment(true);
  };

  const handleIdentityVerified = (verified: boolean, extractedName?: string) => {
    setIdentityVerified(verified);
    if (extractedName) {
      setVerifiedName(extractedName);
    }
  };

  // Reset identity verification when name changes significantly
  useEffect(() => {
    if (identityVerified && formData.name && verifiedName) {
      // Use the same flexible matching logic as the backend
      const normalize = (str: string) => {
        return str
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      };
      
      const normalizedVerified = normalize(verifiedName);
      const normalizedForm = normalize(formData.name);
      
      // Check if names match (both orders, partial match allowed)
      const verifiedParts = normalizedVerified.split(" ");
      const formParts = normalizedForm.split(" ");
      
      // Check if at least 2 parts match (like the backend does)
      const matchCount = formParts.filter(part => verifiedParts.includes(part)).length;
      const isMatch = matchCount >= 2 || 
                      normalizedVerified.includes(normalizedForm) || 
                      normalizedForm.includes(normalizedVerified);
      
      if (!isMatch) {
        setIdentityVerified(false);
        setVerifiedName(null);
      }
    }
  }, [formData.name]);

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    setSessionType(null);
    setHours(2);
    setFormData({
      name: "",
      email: "",
      phone: "",
      date: "",
      time: "",
      message: "",
    });
  };

  // Handle cash-only booking (no payment, but create calendar event and send email)
  const handleCashOnlyBooking = async () => {
    if (!validateForm()) return;
    
    setCashOnlyLoading(true);
    
    try {
      // Call the paypal-webhook directly to create calendar event and send email
      // Use the same field names as PayPal webhook expects
      const { data, error } = await supabase.functions.invoke("paypal-webhook", {
        body: {
          orderId: `CASH-${Date.now()}`,
          payerName: formData.name || "Client VIP",
          payerEmail: formData.email || "vip@makemusicstudio.be",
          phone: formData.phone || "",
          sessionType: sessionType,
          date: formData.date,
          time: formData.time,
          hours: hours,
          totalAmount: finalPrice,
          message: formData.message || "",
          isCashPayment: true,
          podcastMinutes: sessionType === "podcast" ? podcastMinutes : undefined,
        },
      });
      
      if (error) throw error;
      
      toast({
        title: "Réservation confirmée ! 🎉",
        description: "Un email de confirmation vous a été envoyé. Le paiement sera effectué en espèces au studio.",
      });
      
      handlePaymentSuccess();
    } catch (err) {
      console.error("Cash-only booking error:", err);
      toast({
        title: "Erreur de réservation",
        description: "Une erreur est survenue. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setCashOnlyLoading(false);
    }
  };

  return (
    <section id="booking" className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 via-background to-primary/5" />
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[150px] -translate-y-1/2" />
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-4">
            RÉSERVATION
          </span>
          <h2 className="font-display text-5xl md:text-7xl text-foreground mb-4">
            BOOKEZ VOTRE <span className="text-primary text-glow-cyan">SESSION</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Sélectionnez votre type de session et vos créneaux. 
            Notre système vous indiquera les disponibilités en temps réel.
          </p>
        </div>

        <div className="max-w-4xl mx-auto relative">
          {/* Login Required Overlay */}
          {!authLoading && !user && (
            <div className="absolute inset-0 z-50 flex items-start justify-center pt-8 bg-background/80 backdrop-blur-sm rounded-2xl">
              <div className="text-center p-8 max-w-md">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-display text-2xl text-foreground mb-4">
                  CONNEXION REQUISE
                </h3>
                <p className="text-muted-foreground mb-6">
                  Pour réserver une session, vous devez être connecté à votre compte Make Music.
                </p>
                <div className="flex flex-col gap-3">
                  <Button 
                    variant="neon" 
                    onClick={() => navigate("/auth")}
                    className="w-full"
                  >
                    Se connecter / Créer un compte
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Admin Access Banner */}
          {isAdmin && (
            <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 border-2 border-green-500/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-8 h-8 text-green-500" />
                  <h3 className="font-display text-2xl text-green-400">MODE ADMIN ACTIVÉ</h3>
                </div>
                <div className="flex items-center gap-2">
                  <AdminEventCreator 
                    selectedDate={formData.date}
                    selectedTime={formData.time}
                    duration={hours}
                    onEventCreated={() => {
                      toast({
                        title: "Événement créé",
                        description: "L'événement a été ajouté à l'agenda",
                      });
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setShowVIPCalendar(!showVIPCalendar)}
                    className="border-green-500 text-green-500 hover:bg-green-500/10"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    {showVIPCalendar ? "Fermer l'agenda" : "Voir l'agenda"}
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground mb-4">
                Accès complet à l'agenda • Réservation sans paiement • Vérification d'identité désactivée
              </p>
              
              {/* Admin-only Calendar viewer */}
              {showVIPCalendar && (
                <div className="mt-4 animate-in fade-in-0 slide-in-from-top-4 duration-500">
                  <AdminCalendar
                    onSelectSlot={(date, time, duration) => {
                      setFormData(prev => ({ ...prev, date, time }));
                      setHours(duration);
                      toast({
                        title: "Créneau sélectionné",
                        description: `${date} à ${time} pour ${duration}h`,
                      });
                    }}
                    selectedDate={formData.date}
                    selectedTime={formData.time}
                  />
                </div>
              )}
              
            </div>
          )}

          {/* Admin Price Calculator - shown only for admin */}
          {isAdmin && (
            <div className="mb-10 p-6 rounded-2xl bg-card border border-border">
              <h3 className="font-display text-xl text-foreground mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                CALCULATEUR DE PRIX ADMIN
              </h3>
              <AdminPriceCalculator
                onPriceCalculated={(data) => {
                  // Set the session type and form data based on admin selection
                  setSessionType(data.sessionType);
                  setHours(data.hours);
                  if (data.date && data.time) {
                    setFormData(prev => ({
                      ...prev,
                      date: data.date!,
                      time: data.time!,
                    }));
                  }
                  toast({
                    title: "Prix calculé",
                    description: `${data.finalPrice}€ (remise ${data.discountPercent}% appliquée)`,
                  });
                }}
              />
            </div>
          )}

          {/* VIP Access Banner - shown when skipFormFields is active */}
          {!isAdmin && combinedPromoEffects.skipFormFields && (
            <div className="mb-10 p-6 rounded-2xl bg-gradient-to-r from-accent/20 via-primary/20 to-accent/20 border-2 border-accent/50 box-glow-gold">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">👑</span>
                <h3 className="font-display text-2xl text-accent">ACCÈS VIP ACTIVÉ</h3>
              </div>
              <p className="text-muted-foreground">
                Réservation simplifiée : sélectionnez directement votre créneau dans l'agenda.
                Service : <span className="text-accent font-semibold">Location sèche (gratuit)</span>
              </p>
            </div>
          )}

          {/* Session type selector - Hidden when autoSelectService is active or in admin mode */}
          {!isAdmin && !combinedPromoEffects.autoSelectService && (
          <div className="mb-10">
            <div className="mb-6">
              <h3 className="font-display text-2xl text-foreground mb-2">
                1. SÉLECTIONNEZ VOTRE SERVICE
              </h3>
              <p className="text-muted-foreground text-sm">
                Choisissez le type de prestation qui correspond à votre projet
              </p>
            </div>
            
            {/* Sessions studio */}
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Sessions Studio</p>
            <div className="grid md:grid-cols-2 gap-4 mb-6" id="booking-form">
              <button
                type="button"
                onClick={() => {
                  setSessionType("with-engineer");
                  setShowPayment(false);
                  setTimeout(() => {
                    document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
                className={cn(
                  "p-6 rounded-xl border-2 text-left transition-all duration-300",
                  sessionType === "with-engineer"
                    ? "border-primary bg-primary/10 box-glow-cyan"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Mic className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-display text-xl text-foreground">AVEC INGÉNIEUR</h4>
                    <p className="text-primary font-semibold">45€/heure</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Session accompagnée avec un ingénieur son professionnel
                </p>
                <p className="text-xs text-muted-foreground mt-1">💳 50% acompte • 🪪 Vérification d'identité requise</p>
                <p className="text-xs text-accent mt-1">⭐ Dès 5h : 40€/h (déduit du solde le jour de la session)</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSessionType("without-engineer");
                  setShowPayment(false);
                  setTimeout(() => {
                    document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
                className={cn(
                  "p-6 rounded-xl border-2 text-left transition-all duration-300",
                  sessionType === "without-engineer"
                    ? "border-accent bg-accent/10 box-glow-gold"
                    : "border-border bg-card hover:border-accent/50"
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h4 className="font-display text-xl text-foreground">LOCATION SÈCHE</h4>
                    <p className="text-accent font-semibold">22€/heure</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Accès au studio en autonomie
                </p>
                <p className="text-xs text-muted-foreground mt-1">💳 Paiement complet • 🪪 Vérification d'identité requise</p>
                <p className="text-xs text-primary mt-1">⭐ Dès 5h : 20€/h (déduit du solde le jour de la session)</p>
              </button>
            </div>

            {/* Services post-production */}
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Post-Production (délai ~2 semaines)</p>
            <div className="grid md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => {
                  setSessionType("mixing");
                  setShowPayment(false);
                }}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all duration-300",
                  sessionType === "mixing"
                    ? "border-primary bg-primary/10 box-glow-cyan"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Music className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-display text-lg text-foreground">MIXAGE</h4>
                    <p className="text-primary font-semibold text-sm">200€/projet</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">50% acompte</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSessionType("mastering");
                  setShowPayment(false);
                }}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all duration-300",
                  sessionType === "mastering"
                    ? "border-primary bg-primary/10 box-glow-cyan"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Headphones className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-display text-lg text-foreground">MASTERING</h4>
                    <p className="text-primary font-semibold text-sm">60€/titre</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">50% acompte</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSessionType("analog-mastering");
                  setShowPayment(false);
                }}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all duration-300",
                  sessionType === "analog-mastering"
                    ? "border-accent bg-accent/10 box-glow-gold"
                    : "border-border bg-card hover:border-accent/50"
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                    <Disc className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <h4 className="font-display text-lg text-foreground">MASTERING ANALOGIQUE</h4>
                    <p className="text-accent font-semibold text-sm">100€/titre</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Acompte 80€</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSessionType("podcast");
                  setShowPayment(false);
                }}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all duration-300",
                  sessionType === "podcast"
                    ? "border-primary bg-primary/10 box-glow-cyan"
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Radio className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-display text-lg text-foreground">MIXAGE PODCAST</h4>
                    <p className="text-primary font-semibold text-sm">40€/min</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">50% acompte</p>
              </button>
            </div>
          </div>
          )}

          {/* Booking form - Hidden in admin mode */}
          {!isAdmin && (
          <div className="bg-card rounded-2xl border border-border p-8">
            {/* Info message for immediate services */}
            {isImmediateService && (
              <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/30">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-foreground">Délai de traitement : ~2 semaines</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Dès que l'ingénieur aura terminé le travail, nous vous contacterons par email ou WhatsApp 
                  pour vous proposer des dates pour la session d'écoute au studio.
                </p>
                <p className="text-sm text-muted-foreground">
                  💬 Si vous souhaitez être présent pendant le mix,{" "}
                  <a 
                    href="https://wa.me/33612345678?text=Bonjour%2C%20je%20souhaite%20%C3%AAtre%20pr%C3%A9sent%20pendant%20le%20mix%20de%20mon%20projet."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:text-primary/80 transition-colors"
                  >
                    contactez-nous sur WhatsApp
                  </a>
                  {" "}pour définir une date avec l'ingénieur son.
                </p>
              </div>
            )}

            <div className={cn("grid gap-6 mb-6", isImmediateService ? "md:grid-cols-1" : "md:grid-cols-2")}>
              {/* Personal info - Hidden when skipFormFields is active */}
              {!combinedPromoEffects.skipFormFields && (
                <div className="space-y-4">
                  <h4 className="font-display text-lg text-foreground flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm text-primary">2</span>
                    REMPLISSEZ LE FORMULAIRE
                  </h4>
                  <div>
                    <Label htmlFor="name" className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <User className="w-4 h-4" /> Nom complet <span className="text-xs text-muted-foreground/70">(obligatoire)</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        setShowPayment(false);
                      }}
                      placeholder="Votre nom"
                      className="bg-secondary/50 border-border"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Email <span className="text-xs text-muted-foreground/70">(obligatoire)</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        setShowPayment(false);
                      }}
                      placeholder="votre@email.com"
                      className="bg-secondary/50 border-border"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <Phone className="w-4 h-4" /> Téléphone <span className="text-xs text-muted-foreground/70">(obligatoire)</span>
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData({ ...formData, phone: e.target.value });
                        setShowPayment(false);
                      }}
                      placeholder="06 12 34 56 78"
                      className="bg-secondary/50 border-border"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Date and time - Only for studio sessions */}
              {!isImmediateService && !combinedPromoEffects.fullCalendarVisibility && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="date" className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Date souhaitée <span className="text-xs text-muted-foreground/70">(obligatoire)</span>
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => {
                        setFormData({ ...formData, date: e.target.value });
                        setShowPayment(false);
                      }}
                      className="bg-secondary/50 border-border"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="time" className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Heure de début <span className="text-xs text-muted-foreground/70">(obligatoire)</span>
                    </Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.time}
                      onChange={(e) => {
                        setFormData({ ...formData, time: e.target.value });
                        setShowPayment(false);
                      }}
                      className="bg-secondary/50 border-border"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">Durée (heures)</Label>
                    <div className="flex items-center gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setHours(Math.max(1, hours - 1));
                          setShowPayment(false);
                        }}
                      >
                        -
                      </Button>
                      <span className="font-display text-3xl text-foreground w-12 text-center">{hours}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setHours(Math.min(12, hours + 1));
                          setShowPayment(false);
                        }}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Podcast duration - Only for podcast */}
              {sessionType === "podcast" && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">
                      Durée de l'audio (en minutes)
                    </Label>
                    <div className="flex items-center gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setPodcastMinutes(Math.max(1, podcastMinutes - 1));
                          setShowPayment(false);
                        }}
                      >
                        -
                      </Button>
                      <span className="font-display text-3xl text-foreground w-16 text-center">{podcastMinutes} min</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setPodcastMinutes(podcastMinutes + 1);
                          setShowPayment(false);
                        }}
                      >
                        +
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {podcastMinutes} minute{podcastMinutes > 1 ? "s" : ""} × 40€ = {podcastMinutes * 40}€
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* VIP Calendar - Shows when VIP button is clicked */}
            {showVIPCalendar && combinedPromoEffects.fullCalendarVisibility && (
              <div className="mb-6 animate-in fade-in-0 slide-in-from-top-4 duration-500">
                <VIPCalendar
                  onSelectSlot={(date, time, duration) => {
                    setFormData({ ...formData, date, time });
                    setHours(duration);
                    toast({
                      title: "Créneau sélectionné",
                      description: `${date} à ${time} pour ${duration}h`,
                    });
                  }}
                  onConfirmBooking={async (date, time, duration) => {
                    // Update form data first
                    const updatedFormData = { ...formData, date, time };
                    setFormData(updatedFormData);
                    setHours(duration);
                    
                    // Call the booking function
                    setCashOnlyLoading(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("paypal-webhook", {
                        body: {
                          orderId: `VIP-${Date.now()}`,
                          payerName: updatedFormData.name || "Client VIP",
                          payerEmail: updatedFormData.email || "vip@makemusicstudio.be",
                          phone: updatedFormData.phone || "",
                          sessionType: sessionType,
                          date: date,
                          time: time,
                          hours: duration,
                          totalAmount: duration * (pricing[sessionType!] || 0),
                          message: updatedFormData.message || "",
                          isCashPayment: true,
                        },
                      });
                      
                      if (error) throw error;
                      
                      toast({
                        title: "Réservation VIP confirmée ! 🎉",
                        description: `Votre session du ${date} à ${time} (${duration}h) a été ajoutée au calendrier.`,
                      });
                      
                      // Reset form
                      setShowVIPCalendar(false);
                      setShowPayment(false);
                      setSessionType(null);
                      setFormData({ name: "", email: "", phone: "", date: "", time: "", message: "" });
                      setActivePromos([]);
                      setPromoCode("");
                    } catch (err) {
                      console.error("VIP booking error:", err);
                      toast({
                        title: "Erreur de réservation",
                        description: "Une erreur est survenue. Veuillez réessayer.",
                        variant: "destructive",
                      });
                    } finally {
                      setCashOnlyLoading(false);
                    }
                  }}
                  selectedDate={formData.date}
                  selectedTime={formData.time}
                  showConfirmButton={true}
                  confirmLoading={cashOnlyLoading}
                  isVIPMode={true}
                  currentUserEmail={formData.email || user?.email || ""}
                />
                {formData.date && formData.time && (
                  <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                    <p className="text-lg text-green-500 flex items-center gap-2 font-semibold">
                      <CheckCircle className="w-5 h-5" />
                      Créneau sélectionné : {formData.date} à {formData.time} ({hours}h)
                    </p>
                  </div>
                )}

                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full mt-2"
                  onClick={() => setShowVIPCalendar(false)}
                >
                  ← Fermer l'agenda
                </Button>
              </div>
            )}

            {/* Message - Hidden for admin */}
            {!isAdmin && (
            <div className="mb-6">
              <Label htmlFor="message" className="text-sm text-muted-foreground mb-2 block">
                Décrivez votre projet (optionnel)
              </Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Type de projet, nombre de voix, besoins particuliers..."
                className="bg-secondary/50 border-border min-h-[100px]"
              />
            </div>
            )}

            {/* Promo Code Input - Hidden for admin */}
            {!isAdmin && (
            <div className="mb-6">
              <Label htmlFor="promoCode" className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Code promo (optionnel)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="promoCode"
                  type="password"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value);
                    setPromoError("");
                  }}
                  placeholder="Entrez votre code"
                  className="bg-secondary/50 border-border flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleApplyPromoCode}
                  className="shrink-0"
                  disabled={!promoCode.trim() || promoLoading}
                >
                  {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Appliquer"}
                </Button>
              </div>
              {promoError && (
                <p className="text-xs text-destructive mt-1">{promoError}</p>
              )}
              {/* Display all active promo codes */}
              {activePromos.length > 0 && (
                <div className="mt-2 space-y-2">
                  {activePromos.map((promo) => (
                    <div key={promo.code} className="p-2 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-between">
                      <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Code promo activé
                        {promo.fullCalendarVisibility && " - Agenda VIP"}
                        {promo.skipPayment && " - Paiement espèces"}
                        {promo.skipIdentityVerification && " - Sans vérif. ID"}
                        {Object.keys(promo.discounts).length > 0 && " - Réductions"}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePromoCode(promo.code)}
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Availability status - Only for studio sessions */}
            {!isImmediateService && sessionType && formData.date && formData.time && (
              <div className={cn(
                "mb-6 p-4 rounded-xl border flex items-center gap-3",
                availabilityStatus === "checking" && "bg-secondary/50 border-border",
                availabilityStatus === "available" && "bg-green-500/10 border-green-500/30",
                availabilityStatus === "unavailable" && "bg-destructive/10 border-destructive/30",
                availabilityStatus === "error" && "bg-accent/10 border-accent/30"
              )}>
                {availabilityStatus === "checking" && (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Vérification de la disponibilité...</span>
                  </>
                )}
                {availabilityStatus === "available" && (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-green-500">{availabilityMessage}</span>
                  </>
                )}
                {availabilityStatus === "unavailable" && (
                  <>
                    <XCircle className="w-5 h-5 text-destructive" />
                    <span className="text-destructive">{availabilityMessage}</span>
                  </>
                )}
                {availabilityStatus === "error" && (
                  <>
                    <AlertCircle className="w-5 h-5 text-accent" />
                    <span className="text-accent">{availabilityMessage}</span>
                  </>
                )}
              </div>
            )}

            {/* Identity Verification - Only for studio sessions and if not skipped by promo */}
            {!isImmediateService && !skipIdentityVerification && sessionType && formData.name && (availabilityStatus === "available" || combinedPromoEffects.fullCalendarVisibility) && (
              <div className="mb-6">
                <h4 className="font-display text-lg text-foreground flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm text-primary">3</span>
                  VÉRIFICATION D'IDENTITÉ
                </h4>
                <IdentityVerification
                  formName={formData.name}
                  onVerified={handleIdentityVerified}
                  isVerified={identityVerified}
                  verifiedName={verifiedName}
                />
              </div>
            )}

            {/* Show skip notice for promo codes that skip ID verification */}
            {!isImmediateService && skipIdentityVerification && sessionType && (
              <div className="mb-6 p-3 rounded-xl bg-green-500/10 border border-green-500/30">
                <p className="text-sm text-green-500 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Vérification d'identité non requise avec votre code VIP
                </p>
              </div>
            )}

            {/* Price display - Hidden for admin and VIP codes that skip payment */}
            {sessionType && !skipPayment && !isAdmin && (
              <div className="mb-6">
                <h4 className="font-display text-lg text-foreground flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm text-primary">4</span>
                  PAIEMENT
                </h4>
                <div className="p-4 rounded-xl bg-secondary/50 border border-primary/20">
                {!isImmediateService && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Total session</p>
                        <p className="text-xs text-muted-foreground">
                          {hours}h × {pricing[sessionType]}€
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-display text-2xl text-foreground">{totalPrice}€</span>
                      </div>
                    </div>
                    
                    {/* Promo discount display for 5+ hours */}
                    {hours >= 5 && (sessionType === "with-engineer" || sessionType === "without-engineer") && !promoDiscount && (
                      <div className="flex items-center justify-between mb-2 p-2 rounded-lg bg-accent/10 border border-accent/30">
                        <div>
                          <p className="text-sm font-semibold text-accent">🎉 Offre promo appliquée</p>
                          <p className="text-xs text-muted-foreground">
                            {sessionType === "with-engineer" 
                              ? `${hours}h × 5€ de réduction (40€/h au lieu de 45€/h)`
                              : `${hours}h × 2€ de réduction (20€/h au lieu de 22€/h)`
                            }
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-display text-lg text-accent">
                            -{sessionType === "with-engineer" ? hours * 5 : hours * 2}€
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Promo code discount display */}
                    {promoDiscount > 0 && (
                      <div className="flex items-center justify-between mb-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                        <div>
                          <p className="text-sm font-semibold text-green-500">🎁 Réduction code promo</p>
                          <p className="text-xs text-muted-foreground">
                            {combinedPromoEffects.discounts[sessionType!]}% de réduction
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-display text-lg text-green-500">-{promoDiscount}€</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {isImmediateService && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {sessionType === "mixing" && "Mixage projet"}
                          {sessionType === "mastering" && "Mastering"}
                          {sessionType === "analog-mastering" && "Mastering analogique"}
                          {sessionType === "podcast" && `Mixage Podcast (${podcastMinutes} min)`}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "font-display text-2xl",
                          promoDiscount > 0 ? "text-muted-foreground line-through" : "text-foreground"
                        )}>
                          {totalPrice}€
                        </span>
                      </div>
                    </div>

                    {/* Promo code discount for immediate services */}
                    {promoDiscount > 0 && (
                      <div className="flex items-center justify-between mb-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                        <div>
                          <p className="text-sm font-semibold text-green-500">🎁 Réduction code promo</p>
                          <p className="text-xs text-muted-foreground">
                            {combinedPromoEffects.discounts[sessionType!]}% de réduction
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-display text-lg text-green-500">-{promoDiscount}€</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {skipPayment ? "Réservation VIP" : isDeposit ? "Acompte à payer (50%)" : "Montant à payer"}
                    </p>
                    {skipPayment && (
                      <p className="text-xs text-green-500">Réservation gratuite avec votre code VIP</p>
                    )}
                    {!skipPayment && isDeposit && !isImmediateService && sessionType === "with-engineer" && (
                      <p className="text-xs text-accent">
                        {hours >= 5
                          ? `Solde au studio: ${finalPrice - paymentAmount - hours * 5}€ (après réduction)`
                          : "Le reste sera payé au studio"
                        }
                      </p>
                    )}
                    {!skipPayment && !isImmediateService && sessionType === "without-engineer" && hours >= 5 && !promoDiscount && (
                      <p className="text-xs text-accent">
                        Réduction de {hours * 2}€ déduite sur place
                      </p>
                    )}
                    {!skipPayment && !isImmediateService && sessionType === "without-engineer" && hours < 5 && !promoDiscount && (
                      <p className="text-xs text-muted-foreground">Paiement complet requis</p>
                    )}
                    {!skipPayment && isDeposit && isImmediateService && (
                      <p className="text-xs text-accent">Le reste après la session d'écoute</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Euro className="w-6 h-6 text-primary" />
                    <span className={cn(
                      "font-display text-4xl text-glow-cyan",
                      skipPayment ? "text-green-500" : "text-primary"
                    )}>
                      {skipPayment ? "GRATUIT" : `${paymentAmount}€`}
                    </span>
                  </div>
                </div>
              </div>
              </div>
            )}

            {/* Last-minute booking disclaimer - only for studio sessions, hidden for admin */}
            {sessionType && !isImmediateService && !isAdmin && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-sm">
                ⚠️ Pour les réservations moins de 24h à l'avance, le studio se réserve le droit d'annuler et de rembourser intégralement.
              </div>
            )}

            {/* Helper message when form is incomplete - shown only when button would be disabled */}
            {!isAdmin && sessionType && !combinedPromoEffects.skipFormFields && (!formData.name || !formData.email || !formData.phone || (!isImmediateService && !skipIdentityVerification && !identityVerified)) && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm">
                <p className="text-muted-foreground flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>
                    Pour continuer, veuillez compléter :
                    {!formData.name && <span className="block text-primary">• Votre nom complet</span>}
                    {!formData.email && <span className="block text-primary">• Votre adresse email</span>}
                    {!formData.phone && <span className="block text-primary">• Votre numéro de téléphone</span>}
                    {!isImmediateService && !skipIdentityVerification && !identityVerified && (
                      <span className="block text-primary">• La vérification d'identité (carte d'identité)</span>
                    )}
                  </span>
                </p>
              </div>
            )}

            {/* Payment section - Hidden for admin and when VIP calendar is shown */}
            {!isAdmin && !showVIPCalendar && !showPayment ? (
              showVIPCalendarButton ? (
                /* VIP777 - Show "Reserve" button that opens calendar */
                <Button 
                  type="button" 
                  variant="hero" 
                  size="xl" 
                  className="w-full"
                  onClick={() => {
                    console.log("Opening VIP Calendar...");
                    setShowVIPCalendar(true);
                  }}
                  disabled={!sessionType || (!combinedPromoEffects.skipFormFields && (!formData.name || !formData.email || !formData.phone))}
                >
                  <Calendar className="w-5 h-5 mr-2" />
                  RÉSERVER (Ouvrir l'agenda VIP)
                </Button>
              ) : isCashOnly ? (
                /* CashOnly777 - Show "Validate booking" button that creates event and sends email without payment */
                <Button 
                  type="button" 
                  variant="hero" 
                  size="xl" 
                  className="w-full"
                  onClick={() => {
                    console.log("CashOnly button clicked!");
                    console.log("Form data:", formData);
                    console.log("Session type:", sessionType);
                    console.log("Identity verified:", identityVerified);
                    console.log("Skip ID verification:", skipIdentityVerification);
                    handleCashOnlyBooking();
                  }}
                  disabled={
                    cashOnlyLoading ||
                    (!isImmediateService && (availabilityStatus === "checking" || availabilityStatus === "unavailable")) ||
                    (!isImmediateService && !skipIdentityVerification && !identityVerified) ||
                    (!combinedPromoEffects.skipFormFields && (!formData.name || !formData.email || !formData.phone))
                  }
                >
                  {cashOnlyLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Validation en cours...
                    </>
                  ) : !isImmediateService && availabilityStatus === "checking" ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Vérification...
                    </>
                  ) : !isImmediateService && availabilityStatus === "unavailable" ? (
                    <>
                      <XCircle className="w-5 h-5 mr-2" />
                      CRÉNEAU NON DISPONIBLE
                    </>
                  ) : !isImmediateService && !skipIdentityVerification && !identityVerified ? (
                    <>
                      <AlertCircle className="w-5 h-5 mr-2" />
                      VÉRIFICATION D'IDENTITÉ REQUISE
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      VALIDER LA RÉSERVATION
                    </>
                  )}
                </Button>
              ) : (
                /* Regular payment button */
                <Button 
                  type="button" 
                  variant="hero" 
                  size="xl" 
                  className="w-full"
                  onClick={handleProceedToPayment}
                  disabled={
                    loadingClientId || 
                    (!isImmediateService && (availabilityStatus === "checking" || availabilityStatus === "unavailable")) ||
                    (!isImmediateService && !skipIdentityVerification && !identityVerified) ||
                    (!combinedPromoEffects.skipFormFields && (!formData.name || !formData.email || !formData.phone))
                  }
                >
                  {loadingClientId ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Chargement...
                    </>
                  ) : !isImmediateService && availabilityStatus === "checking" ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Vérification...
                    </>
                  ) : !isImmediateService && availabilityStatus === "unavailable" ? (
                    <>
                      <XCircle className="w-5 h-5 mr-2" />
                      CRÉNEAU NON DISPONIBLE
                    </>
                  ) : !isImmediateService && !skipIdentityVerification && !identityVerified ? (
                    <>
                      <AlertCircle className="w-5 h-5 mr-2" />
                      VÉRIFICATION D'IDENTITÉ REQUISE
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 mr-2" />
                      PROCÉDER AU PAIEMENT
                    </>
                  )}
                </Button>
              )
            ) : !isAdmin && !showVIPCalendar && showPayment && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-5 h-5 text-accent" />
                    <span className="font-semibold text-foreground">Paiement sécurisé</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {isImmediateService ? (
                      isDeposit 
                        ? `Acompte de ${paymentAmount}€ pour votre ${sessionType === "mixing" ? "mixage" : "mastering"} (total: ${finalPrice}€)`
                        : `Paiement de ${paymentAmount}€ pour votre mastering analogique`
                    ) : (
                      isDeposit 
                        ? `Acompte de ${paymentAmount}€ pour réserver votre session de ${hours}h (total: ${finalPrice}€)`
                        : `Paiement complet de ${paymentAmount}€ pour votre location de ${hours}h`
                    )}
                    {promoDiscount > 0 && ` (réduction de ${promoDiscount}€ appliquée)`}
                  </p>
                  
                  <div className="space-y-4">
                    {/* PayPal Option */}
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-2 font-medium">Option 1 : PayPal</p>
                      {paypalClientId ? (
                        <PayPalCheckout
                          amount={paymentAmount}
                          sessionType={sessionType!}
                          hours={hours}
                          formData={formData}
                          clientId={paypalClientId}
                          onSuccess={handlePaymentSuccess}
                          isDeposit={isDeposit}
                          totalPrice={finalPrice}
                          podcastMinutes={sessionType === "podcast" ? podcastMinutes : undefined}
                        />
                      ) : (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">ou</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Stripe Checkout Option (Card, Apple Pay, Google Pay) */}
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-2 font-medium">Option 2 : Carte bancaire (Apple Pay / Google Pay disponible)</p>
                      <StripeCheckoutButton
                        amount={paymentAmount}
                        sessionType={sessionType!}
                        hours={hours}
                        formData={formData}
                        isDeposit={isDeposit}
                        totalPrice={finalPrice}
                        podcastMinutes={sessionType === "podcast" ? podcastMinutes : undefined}
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => setShowPayment(false)}
                >
                  ← Modifier ma commande
                </Button>
              </div>
            )}

            {!isAdmin && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              {skipPayment 
                ? "Réservation VIP sans paiement requis"
                : sessionType === "without-engineer" || sessionType === "analog-mastering"
                  ? "Paiement complet requis à la réservation"
                  : isImmediateService 
                    ? "Acompte de 50%, le reste après la session d'écoute"
                    : "Acompte de 50% à la réservation, le reste au studio"
              }
            </p>
            )}
          </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default BookingSection;
