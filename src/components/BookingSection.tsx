import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, User, Mail, Phone, Euro, Mic, Building2, CreditCard, Loader2, CheckCircle, XCircle, AlertCircle, ExternalLink, Music, Headphones, Disc, Radio, Tag, Lock, Shield, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PayPalCheckout from "./PayPalCheckout";
import IdentityVerification from "./IdentityVerification";
import VIPCalendar from "./VIPCalendar";
import ModernCalendar from "./ModernCalendar";
import AdminCalendarModern from "./AdminCalendarModern";
import AdminPanel from "./AdminPanel";
import AdminInvoiceGenerator from "./AdminInvoiceGenerator";
import AdminPriceCalculator from "./AdminPriceCalculator";
import AdminQuickEventModal from "./AdminQuickEventModal";
import StripeCheckoutButton from "./StripeCheckoutButton";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { usePricing } from "@/hooks/usePricing";

type SessionType = "with-engineer" | "without-engineer" | "mixing" | "mastering" | "analog-mastering" | "podcast" | "composition" | "custom" | null;
type AvailabilityStatus = "idle" | "checking" | "available" | "unavailable" | "error";
type CompositionMode = "remote" | "onsite";

// Services qui ne nécessitent pas de calendrier ni de vérification d'identité
// Pour "composition", cela dépend du mode (remote = pas de calendrier, onsite = calendrier + acompte 20€)
const IMMEDIATE_SERVICES: SessionType[] = ["mixing", "mastering", "analog-mastering", "podcast"];

// Acompte pour composition en présentiel
const COMPOSITION_ONSITE_DEPOSIT = 20;
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
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin } = useAdmin();
  const { pricing: dbPricing, loading: pricingLoading, getEffectivePrice: getPricingEffectivePrice } = usePricing();
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
  const [stripeEnabled, setStripeEnabled] = useState(true);
  const [paypalEnabled, setPaypalEnabled] = useState(true);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [showQuickEventModal, setShowQuickEventModal] = useState(false);
  const [isTrustedUser, setIsTrustedUser] = useState(false);
  const [isFreeSession, setIsFreeSession] = useState(false);
  const [compositionMode, setCompositionMode] = useState<CompositionMode>("remote");
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
      
      // Check if user is trusted (can pay in cash without ID verification)
      const checkTrustedStatus = async () => {
        try {
          const { data, error } = await (supabase as any)
            .from("trusted_users")
            .select("user_id")
            .eq("user_id", user.id)
            .single();
          
          if (!error && data) {
            setIsTrustedUser(true);
            setIsFreeSession(true); // Auto-cocher "Free" pour les clients de confiance
          } else {
            setIsTrustedUser(false);
            setIsFreeSession(false);
          }
        } catch (err) {
          setIsTrustedUser(false);
        }
      };
      
      checkTrustedStatus();
    } else {
      setIsTrustedUser(false);
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
      setPromoError(t("booking.code_already_applied"));
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
        setPromoError(data.error || t("booking.invalid_promo_code"));
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
        title: t("booking.promo_applied"),
        description: validatedPromo.skipFormFields
          ? t("booking.promo_vip_full")
          : validatedPromo.fullCalendarVisibility 
          ? t("booking.promo_calendar_visibility")
          : validatedPromo.skipPayment
          ? t("booking.promo_cash_payment")
          : t("booking.promo_discounts"),
      });
    } catch (err) {
      console.error("Promo code validation error:", err);
      setPromoError(t("booking.promo_validation_error"));
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromoCode = (codeToRemove: string) => {
    setActivePromos(activePromos.filter(p => p.code !== codeToRemove));
  };

  // Check if identity verification should be skipped (promo code OR trusted user)
  const skipIdentityVerification = combinedPromoEffects.skipIdentityVerification || isTrustedUser;
  
  // Check if cashonly777 is active (skip payment, but still create calendar event and send email)
  const isCashOnly = activePromos.some(p => p.code.toLowerCase() === "cashonly777");
  
  // Trusted users can always pay in cash
  const canPayCash = isTrustedUser || isCashOnly;
  
  // Check if payment should be skipped (cashonly777 or vip777 + without-engineer)
  const skipPayment = combinedPromoEffects.skipPayment && (sessionType === "without-engineer" || isCashOnly);

  // Use dynamic pricing from database, with fallbacks
  const pricing: Record<string, number> = useMemo(() => {
    const fallbackPricing: Record<string, number> = {
      "with-engineer": 45,
      "without-engineer": 22,
      "mixing": 200,
      "mastering": 60,
      "analog-mastering": 100,
      "podcast": 40,
      "composition": 200,
    };
    
    // Merge DB pricing with fallbacks
    return { ...fallbackPricing, ...dbPricing };
  }, [dbPricing]);

  // Get effective price (custom price from promo or dynamic DB price)
  const getEffectivePrice = (service: string): number => {
    const customPrice = combinedPromoEffects.customPrices?.[service];
    if (customPrice !== undefined && customPrice !== null) {
      return customPrice;
    }
    // Use the dynamic price from hook (includes sale discounts if active)
    return getPricingEffectivePrice(service) || pricing[service] || 0;
  };

  // Pour les services immédiats, pas de notion d'heures
  // La composition à distance est aussi considérée comme immédiate (pas de calendrier)
  const isImmediateService = sessionType && (
    IMMEDIATE_SERVICES.includes(sessionType) || 
    (sessionType === "composition" && compositionMode === "remote")
  );
  
  // Composition en présentiel nécessite le calendrier
  const isCompositionOnsite = sessionType === "composition" && compositionMode === "onsite";
  
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
  // Composition à distance = 0€ (pas de paiement), Composition en présentiel = 20€ d'acompte
  // Clients de confiance : pas d'acompte pour composition en présentiel
  const paymentAmount = useMemo(() => {
    if (!sessionType) return 0;
    if (skipPayment) return 0; // VIP777 + without-engineer = free booking
    
    // Composition à distance : pas de paiement requis
    if (sessionType === "composition" && compositionMode === "remote") {
      return 0;
    }
    
    // Composition en présentiel : clients de confiance = pas d'acompte, sinon 20€
    if (sessionType === "composition" && compositionMode === "onsite") {
      if (isTrustedUser) {
        return 0; // Pas d'acompte pour les clients de confiance
      }
      return COMPOSITION_ONSITE_DEPOSIT;
    }
    
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
  }, [sessionType, finalPrice, skipPayment, promoDiscount, requireFullPayment, compositionMode]);

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
          title: t("booking.config_error"),
          description: t("booking.payment_system_error"),
          variant: "destructive",
        });
      } finally {
        setLoadingClientId(false);
      }
    };
    fetchClientId();
  }, [toast]);

  // Fetch payment settings (Stripe/PayPal enabled)
  useEffect(() => {
    const fetchPaymentSettings = async () => {
      try {
        const { data: stripeData } = await supabase
          .from("site_config")
          .select("config_value")
          .eq("config_key", "stripe_enabled")
          .single();

        const { data: paypalData } = await supabase
          .from("site_config")
          .select("config_value")
          .eq("config_key", "paypal_enabled")
          .single();

        if (stripeData) {
          setStripeEnabled(stripeData.config_value === "true");
        }
        if (paypalData) {
          setPaypalEnabled(paypalData.config_value === "true");
        }
      } catch (err) {
        // Settings not found, keep defaults (both enabled)
        console.log("Payment settings not configured, using defaults");
      }
    };
    fetchPaymentSettings();
  }, []);

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

  // Listen for open-admin-calendar event from Hero (legacy) or URL param
  useEffect(() => {
    const handleOpenAdminCalendar = () => {
      if (isAdmin) {
        setShowVIPCalendar(true);
      }
    };

    // Check URL param for direct calendar opening (using window.location to avoid circular dependency)
    const urlParams = new URLSearchParams(window.location.search);
    const openCalendarParam = urlParams.get('openCalendar');
    if (openCalendarParam === 'true' && isAdmin) {
      setShowVIPCalendar(true);
      // Clear the URL param after reading it
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    window.addEventListener("open-admin-calendar", handleOpenAdminCalendar);
    return () => {
      window.removeEventListener("open-admin-calendar", handleOpenAdminCalendar);
    };
  }, [isAdmin]);

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
            title: t("booking.payment_verified"),
            description: t("booking.please_wait"),
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
              title: t("booking.payment_confirmed"),
              description: t("booking.payment_confirmed_desc"),
            });

            // Clear URL params
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            toast({
              title: t("booking.payment_error"),
              description: data?.error || t("booking.payment_not_verified"),
              variant: "destructive",
            });
          }
        } catch (err) {
          console.error("Payment verification error:", err);
          toast({
            title: t("booking.verification_error"),
            description: t("booking.verification_error_desc"),
            variant: "destructive",
          });
        }
      };

      verifyAndCreateBooking();
    } else if (paymentStatus === "cancelled") {
      toast({
        title: t("booking.payment_cancelled"),
        description: t("booking.payment_cancelled_desc"),
        variant: "destructive",
      });
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  // Read service from URL query params (from pricing page navigation)
  const [searchParams, setSearchParams] = useSearchParams();
  
  useEffect(() => {
    const serviceFromUrl = searchParams.get('service') as SessionType;
    if (serviceFromUrl && ['with-engineer', 'without-engineer', 'mixing', 'mastering', 'analog-mastering', 'podcast', 'composition'].includes(serviceFromUrl)) {
      setSessionType(serviceFromUrl);
      setShowPayment(false);
      // Clear the URL param after reading it
      setSearchParams({}, { replace: true });
      // Only scroll to details form if user is logged in (otherwise login overlay blocks the view)
      if (user) {
        setTimeout(() => {
          document.getElementById('booking-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      } else {
        // Scroll to the top of the booking section instead so login overlay is visible
        setTimeout(() => {
          document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
    }
  }, [searchParams, setSearchParams, user]);

  // Listen for select-service event from pricing cards (for same-page navigation)
  useEffect(() => {
    const handleSelectService = (event: CustomEvent<string>) => {
      const serviceType = event.detail as SessionType;
      if (serviceType) {
        setSessionType(serviceType);
        setShowPayment(false);
        // Only scroll to details form if user is logged in
        if (user) {
          setTimeout(() => {
            document.getElementById('booking-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        } else {
          // Scroll to booking section top so login overlay is visible
          setTimeout(() => {
            document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        }
      }
    };

    window.addEventListener("select-service", handleSelectService as EventListener);
    return () => {
      window.removeEventListener("select-service", handleSelectService as EventListener);
    };
  }, [user]);

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
        setAvailabilityMessage(t("booking.check_availability_error"));
      }
    };

    const debounce = setTimeout(checkAvailability, 500);
    return () => clearTimeout(debounce);
  }, [sessionType, formData.date, formData.time, hours]);

  const validateForm = (): boolean => {
    if (!sessionType) {
      toast({
        title: t("booking.service_required"),
        description: t("booking.select_service_type"),
        variant: "destructive",
      });
      return false;
    }

    // For VIP codes with skipFormFields, only date/time is required (no personal info)
    if (combinedPromoEffects.skipFormFields) {
      // Only need date/time if not using VIP calendar
      if (!combinedPromoEffects.fullCalendarVisibility && (!formData.date || !formData.time)) {
        toast({
          title: t("booking.slot_required"),
          description: t("booking.select_date_time"),
          variant: "destructive",
        });
        return false;
      }
      return true;
    }

    // Validate name length (minimum 2 characters)
    if (formData.name && formData.name.trim().length < 2) {
      toast({
        title: t("booking.invalid_name"),
        description: t("booking.name_min_2"),
        variant: "destructive",
      });
      return false;
    }

    // Pour les services immédiats, seuls nom, email et téléphone sont requis
    if (isImmediateService) {
      if (!formData.name || !formData.email || !formData.phone) {
        toast({
          title: t("booking.incomplete_form"),
          description: t("booking.fill_required_fields"),
          variant: "destructive",
        });
        return false;
      }
      return true;
    }

    // Pour les sessions avec calendrier
    if (!formData.name || !formData.email || !formData.phone || !formData.date || !formData.time) {
      toast({
        title: t("booking.incomplete_form"),
        description: t("booking.fill_required_fields"),
        variant: "destructive",
      });
      return false;
    }

    // Skip availability check for VIP777 (full calendar visibility allows any booking)
    if (!combinedPromoEffects.fullCalendarVisibility && availabilityStatus !== "available") {
      toast({
        title: t("booking.slot_not_available"),
        description: t("booking.choose_another_slot"),
        variant: "destructive",
      });
      return false;
    }

    // KYC is required only for session types (not immediate services) unless promo skips it
    if (!skipIdentityVerification && !identityVerified) {
      toast({
        title: t("booking.id_verification_required_msg"),
        description: t("booking.verify_before_payment"),
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleProceedToPayment = async () => {
    if (!validateForm()) return;
    await savePhoneToProfile();
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

  // Save phone to user metadata if changed
  const savePhoneToProfile = async () => {
    if (user && formData.phone && formData.phone.trim()) {
      const currentPhone = (user.user_metadata?.phone as string) || "";
      if (currentPhone !== formData.phone.trim()) {
        try {
          await supabase.auth.updateUser({ data: { phone: formData.phone.trim() } });
        } catch (err) {
          console.error("Error saving phone:", err);
        }
      }
    }
  };

  // Handle cash-only booking (no payment, but create calendar event and send email)
  const handleCashOnlyBooking = async () => {
    if (!validateForm()) return;
    await savePhoneToProfile();
    
    setCashOnlyLoading(true);
    
    try {
      const effectiveEmail = user?.email || formData.email;
      if (!effectiveEmail) {
        toast({
          title: t("booking.email_required"),
          description: t("booking.use_account_email"),
          variant: "destructive",
        });
        return;
      }

      // Call the paypal-webhook directly to create calendar event and send email
      // Use the same field names as PayPal webhook expects
      const { data, error } = await supabase.functions.invoke("paypal-webhook", {
        body: {
          orderId: `CASH-${Date.now()}`,
          payerName: formData.name || "Client",
          payerEmail: effectiveEmail,
          phone: formData.phone || "",
          sessionType: sessionType,
          date: formData.date,
          time: formData.time,
          hours: hours,
          totalAmount: finalPrice,
          message: formData.message || "",
          isCashPayment: true,
          isFreeSession: isFreeSession, // Si cochée, ajoute [FREE] au nom de l'événement
          podcastMinutes: sessionType === "podcast" ? podcastMinutes : undefined,
        },
      });
      
      if (error) throw error;
      
      toast({
        title: t("booking.booking_confirmed"),
        description: t("booking.booking_confirmed_cash"),
      });
      
      handlePaymentSuccess();
    } catch (err) {
      console.error("Cash-only booking error:", err);
      toast({
        title: t("booking.booking_error"),
        description: t("booking.error_try_again"),
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
            {t("booking.title")}
          </span>
          <h2 className="font-display text-5xl md:text-7xl text-foreground mb-4">
            {t("booking.book_your")} <span className="text-primary text-glow-cyan">{t("booking.session")}</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t("booking.subtitle")}
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
                  {t("booking.login_required")}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {t("booking.login_required_desc")}
                </p>
                <div className="flex flex-col gap-3">
                  <Button 
                    variant="neon" 
                    onClick={() => navigate("/auth")}
                    className="w-full"
                  >
                    {t("booking.login_signup")}
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
                  <h3 className="font-display text-2xl text-green-400">{t("booking.admin_mode")}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowVIPCalendar(!showVIPCalendar)}
                    className="border-green-500 text-green-500 hover:bg-green-500/10"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    {showVIPCalendar ? t("booking.close_calendar") : t("booking.view_calendar")}
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground mb-4">
                {t("booking.admin_access")}
              </p>
              
              {/* Admin-only Calendar viewer with integrated price calculator */}
              {/* Quick Event Modal */}
              <AdminQuickEventModal
                isOpen={showQuickEventModal}
                onClose={() => setShowQuickEventModal(false)}
                onEventCreated={() => {
                  setCalendarRefreshKey(prev => prev + 1);
                  toast({
                    title: t("booking.event_created"),
                    description: t("booking.event_created_desc"),
                  });
                }}
              />

              {showVIPCalendar && (
                <div className="mt-4 animate-in fade-in-0 slide-in-from-top-4 duration-500 space-y-6">
                  <AdminCalendarModern
                    key={`admin-calendar-${calendarRefreshKey}`}
                    onSelectSlot={(date, time, duration) => {
                      setFormData(prev => ({
                        ...prev,
                        date,
                        time,
                      }));
                      setHours(duration);
                    }}
                    selectedDate={formData.date}
                    selectedTime={formData.time}
                    isAdminMode={true}
                    showPriceCalculator={true}
                  />
                  
                  {/* Integrated Price Calculator below calendar */}
                  <div className="p-6 rounded-2xl bg-card border border-border">
                    <h4 className="font-display text-xl text-foreground mb-4 flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-primary" />
                      {t("booking.admin_price_calculator")}
                    </h4>
                    <AdminPriceCalculator
                      selectedDate={formData.date}
                      selectedTime={formData.time}
                      selectedDuration={hours}
                      onPriceCalculated={(data) => {
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
                          title: t("booking.price_calculated"),
                          description: `${data.finalPrice}€ (${data.discountPercent}% ${t("booking.discount_applied")})`,
                        });
                      }}
                      onEventCreated={() => {
                        // Increment key to force calendar refresh
                        setCalendarRefreshKey(prev => prev + 1);
                      }}
                    />
                  </div>
                </div>
              )}
              
            </div>
          )}

          {/* Trusted User Banner - shown when user is trusted */}
          {!isAdmin && isTrustedUser && !combinedPromoEffects.skipFormFields && (
            <div className="mb-10 p-6 rounded-2xl bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 border-2 border-green-500/50">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-8 h-8 text-green-500" />
                <h3 className="font-display text-2xl text-green-500">{t("booking.trusted_client")}</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                {t("booking.trusted_client_desc")}
              </p>
              
              {/* Free session checkbox for trusted users */}
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <Checkbox
                  id="freeSession"
                  checked={isFreeSession}
                  onCheckedChange={(checked) => setIsFreeSession(checked === true)}
                  className="border-purple-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                />
                <Label htmlFor="freeSession" className="text-sm cursor-pointer flex-1">
                  <span className="font-semibold text-purple-400">💰 Prix à voir le jour de la session</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Non comptabilisée dans les stats (prix indicatif : {totalPrice}€)
                  </span>
                </Label>
              </div>
            </div>
          )}

          {/* VIP Access Banner - shown when skipFormFields is active */}
          {!isAdmin && combinedPromoEffects.skipFormFields && (
            <div className="mb-10 p-6 rounded-2xl bg-gradient-to-r from-accent/20 via-primary/20 to-accent/20 border-2 border-accent/50 box-glow-gold">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">👑</span>
                <h3 className="font-display text-2xl text-accent">{t("booking.vip_access")}</h3>
              </div>
              <p className="text-muted-foreground">
                {t("booking.vip_booking_simplified")}
                {t("booking.vip_service")} <span className="text-accent font-semibold">{t("booking.vip_free")}</span>
              </p>
            </div>
          )}

          {/* Session type selector - Hidden when autoSelectService is active or in admin mode */}
          {!isAdmin && !combinedPromoEffects.autoSelectService && (
          <div className="mb-10">
            <div className="mb-6">
              <h3 className="font-display text-2xl text-foreground mb-2">
                1. {t("booking.select_service")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t("booking.select_service_desc")}
              </p>
            </div>
            
            {/* Sessions studio */}
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">{t("booking.studio_sessions")}</p>
            <div className="grid md:grid-cols-2 gap-4 mb-6" id="booking-form">
              <button
                type="button"
                onClick={() => {
                  setSessionType("with-engineer");
                  setShowPayment(false);
                  setTimeout(() => {
                    document.getElementById('booking-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 150);
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
                    <h4 className="font-display text-xl text-foreground">{t("booking.with_engineer")}</h4>
                    <p className="text-primary font-semibold">{pricing["with-engineer"]}€/{t("booking.hour")}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("booking.with_engineer_desc")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">💳 {t("booking.deposit_50")} • 🪪 {t("booking.id_required")}</p>
                <p className="text-xs text-accent mt-1">⭐ {t("booking.from_5h")} : {Math.round(pricing["with-engineer"] * 0.89)}€/h ({t("booking.deducted_session")})</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSessionType("without-engineer");
                  setShowPayment(false);
                  setTimeout(() => {
                    document.getElementById('booking-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 150);
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
                    <h4 className="font-display text-xl text-foreground">{t("booking.without_engineer")}</h4>
                    <p className="text-accent font-semibold">{pricing["without-engineer"]}€/{t("booking.hour")}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("booking.without_engineer_desc")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">💳 {t("booking.full_payment")} • 🪪 {t("booking.id_required")}</p>
                <p className="text-xs text-primary mt-1">⭐ {t("booking.from_5h")} : {Math.round(pricing["without-engineer"] * 0.91)}€/h ({t("booking.deducted_session")})</p>
              </button>
            </div>

            {/* Services post-production */}
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">{t("booking.post_production")} ({t("booking.delay_2_weeks")})</p>
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
                    <h4 className="font-display text-lg text-foreground">{t("booking.mixing")}</h4>
                    <p className="text-primary font-semibold text-sm">{pricing["mixing"]}€/{t("booking.per_project")}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("booking.deposit_50")}</p>
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
                    <h4 className="font-display text-lg text-foreground">{t("booking.mastering")}</h4>
                    <p className="text-primary font-semibold text-sm">{pricing["mastering"]}€/{t("booking.per_track")}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("booking.deposit_50")}</p>
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
                    <h4 className="font-display text-lg text-foreground">{t("booking.analog_mastering")}</h4>
                    <p className="text-accent font-semibold text-sm">{pricing["analog-mastering"]}€/{t("booking.per_track")}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("booking.deposit_80")}</p>
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
                    <h4 className="font-display text-lg text-foreground">{t("booking.podcast_mixing")}</h4>
                    <p className="text-primary font-semibold text-sm">{pricing["podcast"]}€/min</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("booking.deposit_50")}</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSessionType("composition");
                  setShowPayment(false);
                }}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all duration-300",
                  sessionType === "composition"
                    ? "border-pink-500 bg-pink-500/10"
                    : "border-border bg-card hover:border-pink-500/50"
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                    <Music className="w-4 h-4 text-pink-500" />
                  </div>
                  <div>
                    <h4 className="font-display text-lg text-foreground">{t("booking.composition")}</h4>
                    <p className="text-pink-500 font-semibold text-sm">{pricing["composition"]}€</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("booking.composition_desc")}</p>
                <p className="text-xs text-pink-500 mt-1">🌐 {t("booking.composition_remote")}</p>
              </button>
            </div>
          </div>
          )}

          {/* Booking form - Hidden in admin mode and until a service is selected */}
          {!isAdmin && !sessionType && !combinedPromoEffects.skipFormFields && (
            <div className="bg-card/50 rounded-2xl border border-border/50 p-8 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mic className="w-8 h-8 text-primary/50" />
              </div>
              <h4 className="font-display text-xl text-muted-foreground mb-2">
                {t("booking.select_a_service")}
              </h4>
              <p className="text-muted-foreground/70 text-sm">
                {t("booking.select_service_above")}
              </p>
            </div>
          )}
          
          {!isAdmin && (sessionType || combinedPromoEffects.skipFormFields) && (
          <div className="bg-card rounded-2xl border border-border p-8">
            {/* Composition mode selector - Remote or On-site */}
            {sessionType === "composition" && (
              <div className="mb-6 p-4 rounded-xl bg-pink-500/10 border border-pink-500/30">
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Music className="w-5 h-5 text-pink-500" />
                  {t("booking.composition_mode_title", "Comment souhaitez-vous travailler ?")}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {/* Remote option (default) */}
                  <button
                    type="button"
                    onClick={() => setCompositionMode("remote")}
                    className={cn(
                      "p-4 rounded-xl border-2 text-left transition-all duration-300",
                      compositionMode === "remote"
                        ? "border-pink-500 bg-pink-500/20"
                        : "border-border bg-card hover:border-pink-500/50"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">🌐</span>
                      <span className="font-semibold text-foreground">{t("booking.composition_remote_title", "À distance")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("booking.composition_remote_desc", "Travail à distance sans réservation de créneau. Pas de paiement requis pour commander.")}
                    </p>
                    <p className="text-xs text-green-500 mt-2 font-medium">✓ {t("booking.no_payment_required", "Aucun paiement requis")}</p>
                  </button>

                  {/* On-site option */}
                  <button
                    type="button"
                    onClick={() => setCompositionMode("onsite")}
                    className={cn(
                      "p-4 rounded-xl border-2 text-left transition-all duration-300",
                      compositionMode === "onsite"
                        ? "border-pink-500 bg-pink-500/20"
                        : "border-border bg-card hover:border-pink-500/50"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">🏢</span>
                      <span className="font-semibold text-foreground">{t("booking.composition_onsite_title", "En présentiel")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("booking.composition_onsite_desc", "Réservez le studio pour travailler ensemble sur place.")}
                    </p>
                    <p className="text-xs text-accent mt-2 font-medium">💳 {t("booking.deposit_required", "Acompte")} : {COMPOSITION_ONSITE_DEPOSIT}€</p>
                  </button>
                </div>
              </div>
            )}

            {/* Info message for immediate services */}
            {isImmediateService && (
              <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/30">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-foreground">{t("booking.processing_delay")}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t("booking.processing_desc")}
                </p>
                <p className="text-sm text-muted-foreground">
                  💬 {t("booking.be_present_mixing")}{" "}
                  <a 
                    href="https://wa.me/33612345678?text=Bonjour%2C%20je%20souhaite%20%C3%AAtre%20pr%C3%A9sent%20pendant%20le%20mix%20de%20mon%20projet."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:text-primary/80 transition-colors"
                  >
                    {t("booking.contact_whatsapp")}
                  </a>
                  {" "}{t("booking.define_date_engineer")}
                </p>
              </div>
            )}

            <div id="booking-details" className={cn("grid gap-6 mb-6", isImmediateService ? "md:grid-cols-1" : "md:grid-cols-2")}>
              {/* Personal info - Hidden when skipFormFields is active */}
              {!combinedPromoEffects.skipFormFields && (
                <div className="space-y-4">
                  <h4 className="font-display text-lg text-foreground flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm text-primary">2</span>
                    {t("booking.fill_form")}
                  </h4>
                  <div>
                    <Label htmlFor="name" className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <User className="w-4 h-4" /> {t("booking.full_name")} <span className="text-xs text-muted-foreground/70">({t("booking.required")})</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        setShowPayment(false);
                      }}
                      placeholder={t("booking.your_name")}
                      className="bg-secondary/50 border-border"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> {t("booking.email")} <span className="text-xs text-muted-foreground/70">({t("booking.required")})</span>
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
                      <Phone className="w-4 h-4" /> {t("booking.phone")} <span className="text-xs text-muted-foreground/70">({t("booking.required")})</span>
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
                      <Calendar className="w-4 h-4" /> {t("booking.desired_date")} <span className="text-xs text-muted-foreground/70">({t("booking.required")})</span>
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
                      <Clock className="w-4 h-4" /> {t("booking.start_time")} <span className="text-xs text-muted-foreground/70">({t("booking.required")})</span>
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
                    <Label className="text-sm text-muted-foreground mb-2 block">{t("booking.duration_hours")}</Label>
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
                      {t("booking.audio_duration")}
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
                      title: t("booking.slot_selected"),
                      description: t("booking.slot_format", { date, time, duration }),
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
                      const effectiveEmail = user?.email || updatedFormData.email;
                      if (!effectiveEmail) {
                        toast({
                          title: t("booking.email_required"),
                          description: t("booking.use_account_email"),
                          variant: "destructive",
                        });
                        return;
                      }

                      const { data, error } = await supabase.functions.invoke("paypal-webhook", {
                        body: {
                          orderId: `VIP-${Date.now()}`,
                          payerName: updatedFormData.name || "Client",
                          payerEmail: effectiveEmail,
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
                    <span className="text-muted-foreground">{t("booking.checking_availability")}</span>
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
                  {t("booking.identity_verification")}
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
                  {t("booking.id_not_required_vip")}
                </p>
              </div>
            )}

            {/* Price display - Hidden for admin, VIP codes that skip payment, and composition remote */}
            {sessionType && !skipPayment && !isAdmin && !(sessionType === "composition" && compositionMode === "remote") && (
              <div className="mb-6">
                <h4 className="font-display text-lg text-foreground flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm text-primary">4</span>
                  {t("booking.payment")}
                </h4>
                <div className="p-4 rounded-xl bg-secondary/50 border border-primary/20">
                {!isImmediateService && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm text-muted-foreground">{t("booking.total_session")}</p>
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
                          <p className="text-sm font-semibold text-accent">{t("booking.promo_offer_applied")}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("booking.discount_reduction", {
                              hours: hours,
                              discount: sessionType === "with-engineer" ? Math.round(pricing["with-engineer"] * 0.11) : Math.round(pricing["without-engineer"] * 0.09),
                              price: sessionType === "with-engineer" ? Math.round(pricing["with-engineer"] * 0.89) : Math.round(pricing["without-engineer"] * 0.91),
                              original: pricing[sessionType!]
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-display text-lg text-accent">
                            -{sessionType === "with-engineer" ? hours * Math.round(pricing["with-engineer"] * 0.11) : hours * Math.round(pricing["without-engineer"] * 0.09)}€
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Promo code discount display */}
                    {promoDiscount > 0 && (
                      <div className="flex items-center justify-between mb-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                        <div>
                          <p className="text-sm font-semibold text-green-500">{t("booking.promo_code_discount")}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("booking.discount_percent", { percent: combinedPromoEffects.discounts[sessionType!] })}
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
                          {sessionType === "mixing" && t("booking.mixing_project")}
                          {sessionType === "mastering" && t("booking.mastering")}
                          {sessionType === "analog-mastering" && t("booking.analog_mastering")}
                          {sessionType === "podcast" && `${t("booking.podcast_mixing")} (${podcastMinutes} min)`}
                          {sessionType === "composition" && t("booking.composition")}
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
                          <p className="text-sm font-semibold text-green-500">{t("booking.promo_code_discount")}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("booking.discount_percent", { percent: combinedPromoEffects.discounts[sessionType!] })}
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
                      {skipPayment ? t("booking.vip_booking") : isDeposit ? t("booking.deposit_to_pay") : t("booking.amount_due")}
                    </p>
                    {skipPayment && (
                      <p className="text-xs text-green-500">{t("booking.vip_free_booking")}</p>
                    )}
                    {!skipPayment && isDeposit && !isImmediateService && sessionType === "with-engineer" && (
                      <p className="text-xs text-accent">
                        {hours >= 5
                          ? t("booking.balance_at_studio", { amount: finalPrice - paymentAmount - hours * 5 })
                          : t("booking.rest_paid_at_studio")
                        }
                      </p>
                    )}
                    {!skipPayment && !isImmediateService && sessionType === "without-engineer" && hours >= 5 && !promoDiscount && (
                      <p className="text-xs text-accent">
                        {t("booking.discount_deducted_on_site", { amount: hours * 2 })}
                      </p>
                    )}
                    {!skipPayment && !isImmediateService && sessionType === "without-engineer" && hours < 5 && !promoDiscount && (
                      <p className="text-xs text-muted-foreground">{t("booking.full_payment_required")}</p>
                    )}
                    {!skipPayment && isDeposit && isImmediateService && (
                      <p className="text-xs text-accent">{t("booking.rest_after_listening")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Euro className="w-6 h-6 text-primary" />
                    <span className={cn(
                      "font-display text-4xl text-glow-cyan",
                      skipPayment ? "text-green-500" : "text-primary"
                    )}>
                      {skipPayment ? t("pricing.free") : `${paymentAmount}€`}
                    </span>
                  </div>
                </div>
              </div>
              </div>
            )}

            {/* Last-minute booking disclaimer - only for studio sessions, hidden for admin */}
            {sessionType && !isImmediateService && !isAdmin && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-sm">
                {t("booking.last_minute_disclaimer")}
              </div>
            )}

            {/* Helper message when form is incomplete - shown only when button would be disabled */}
            {!isAdmin && sessionType && !combinedPromoEffects.skipFormFields && (!formData.name || !formData.email || !formData.phone || (!isImmediateService && !skipIdentityVerification && !identityVerified)) && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm">
                <p className="text-muted-foreground flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>
                    {t("booking.to_continue_complete")}
                    {!formData.name && <span className="block text-primary">• {t("booking.your_full_name")}</span>}
                    {!formData.email && <span className="block text-primary">• {t("booking.your_email")}</span>}
                    {!formData.phone && <span className="block text-primary">• {t("booking.your_phone")}</span>}
                    {!isImmediateService && !skipIdentityVerification && !identityVerified && (
                      <span className="block text-primary">• {t("booking.id_verification_card")}</span>
                    )}
                  </span>
                </p>
              </div>
            )}

            {/* Payment section - Hidden for admin and when VIP calendar is shown */}
            {!isAdmin && !showVIPCalendar && !showPayment ? (
              /* Composition remote - Simple "Commander" button without payment */
              sessionType === "composition" && compositionMode === "remote" ? (
                <Button 
                  type="button" 
                  variant="hero" 
                  size="xl" 
                  className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
                  onClick={handleCashOnlyBooking}
                  disabled={
                    cashOnlyLoading ||
                    (!combinedPromoEffects.skipFormFields && (!formData.name || !formData.email || !formData.phone))
                  }
                >
                  {cashOnlyLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {t("booking.sending_request", "Envoi en cours...")}
                    </>
                  ) : (
                    <>
                      <Music className="w-5 h-5 mr-2" />
                      {t("booking.order_composition", "Commander ma composition")}
                    </>
                  )}
                </Button>
              ) : showVIPCalendarButton ? (
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
                  {t("booking.reserve_open_vip")}
                </Button>
              ) : canPayCash ? (
                /* CashOnly777 or Trusted User - Show "Validate booking" button that creates event and sends email without payment */
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
                      {t("booking.validating")}
                    </>
                  ) : !isImmediateService && availabilityStatus === "checking" ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {t("booking.verification")}
                    </>
                  ) : !isImmediateService && availabilityStatus === "unavailable" ? (
                    <>
                      <XCircle className="w-5 h-5 mr-2" />
                      {t("booking.slot_unavailable")}
                    </>
                  ) : !isImmediateService && !skipIdentityVerification && !identityVerified ? (
                    <>
                      <AlertCircle className="w-5 h-5 mr-2" />
                      {t("booking.id_verification_required_btn")}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      {t("booking.validate_booking")}
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
                      {t("booking.loading")}
                    </>
                  ) : !isImmediateService && availabilityStatus === "checking" ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {t("booking.verification")}
                    </>
                  ) : !isImmediateService && availabilityStatus === "unavailable" ? (
                    <>
                      <XCircle className="w-5 h-5 mr-2" />
                      {t("booking.slot_unavailable")}
                    </>
                  ) : !isImmediateService && !skipIdentityVerification && !identityVerified ? (
                    <>
                      <AlertCircle className="w-5 h-5 mr-2" />
                      {t("booking.id_verification_required_btn")}
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 mr-2" />
                      {t("booking.proceed_to_payment")}
                    </>
                  )}
                </Button>
              )
            ) : !isAdmin && !showVIPCalendar && showPayment && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-5 h-5 text-accent" />
                    <span className="font-semibold text-foreground">{t("booking.payment")}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("booking.deposit_info")} - {paymentAmount}€
                    {promoDiscount > 0 && ` (${t("booking.discount_percent", { percent: combinedPromoEffects.discounts[sessionType!] })})`}
                  </p>
                  
                  <div className="space-y-4">
                    {/* Stripe Checkout Option (Card, Apple Pay, Google Pay) */}
                    {stripeEnabled && (
                      <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">{t("booking.pay_by_card")}</p>
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
                    )}

                    {/* Divider - only show if both payment methods are enabled */}
                    {stripeEnabled && paypalEnabled && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground">{t("booking.or")}</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}

                    {/* PayPal Option */}
                    {paypalEnabled && (
                      <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">{t("booking.pay_with_paypal")}</p>
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
                    )}
                  </div>
                </div>

                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => setShowPayment(false)}
                >
                  ← {t("booking.proceed_payment")}
                </Button>
              </div>
            )}

            {!isAdmin && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              {skipPayment 
                ? t("booking.vip_free_booking")
                : sessionType === "without-engineer" || sessionType === "analog-mastering"
                  ? t("booking.full_payment_required")
                  : isImmediateService 
                    ? t("booking.rest_after_listening")
                    : t("booking.rest_paid_at_studio")
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
