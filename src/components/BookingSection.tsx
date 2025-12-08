import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, User, Mail, Phone, Euro, Mic, Building2, CreditCard, Loader2, CheckCircle, XCircle, AlertCircle, ExternalLink, Music, Headphones, Disc } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PayPalCheckout from "./PayPalCheckout";
import IdentityVerification from "./IdentityVerification";

type SessionType = "with-engineer" | "without-engineer" | "mixing" | "mastering" | "analog-mastering" | null;
type AvailabilityStatus = "idle" | "checking" | "available" | "unavailable" | "error";

// Services qui ne nécessitent pas de calendrier ni de vérification d'identité
const IMMEDIATE_SERVICES: SessionType[] = ["mixing", "mastering", "analog-mastering"];

const BookingSection = () => {
  const { toast } = useToast();
  const [sessionType, setSessionType] = useState<SessionType>(null);
  const [hours, setHours] = useState(2);
  const [showPayment, setShowPayment] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);
  const [loadingClientId, setLoadingClientId] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>("idle");
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [identityVerified, setIdentityVerified] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    date: "",
    time: "",
    message: "",
  });

  const pricing: Record<string, number> = {
    "with-engineer": 45,
    "without-engineer": 22,
    "mixing": 200,
    "mastering": 60,
    "analog-mastering": 100,
  };

  // Pour les services immédiats, pas de notion d'heures
  const isImmediateService = sessionType && IMMEDIATE_SERVICES.includes(sessionType);

  const totalPrice = useMemo(() => {
    if (!sessionType) return 0;
    if (isImmediateService) {
      return pricing[sessionType];
    }
    return hours * pricing[sessionType];
  }, [sessionType, hours, isImmediateService]);

  // Location sèche = paiement complet, analog-mastering = 80€ acompte, autres = 50% acompte
  const paymentAmount = useMemo(() => {
    if (!sessionType) return 0;
    if (sessionType === "without-engineer") {
      return totalPrice; // Paiement complet
    }
    if (sessionType === "analog-mastering") {
      return 80; // Acompte fixe de 80€
    }
    return Math.ceil(totalPrice / 2); // 50% acompte
  }, [sessionType, totalPrice]);

  const isDeposit = sessionType === "with-engineer" || sessionType === "mixing" || sessionType === "mastering" || sessionType === "analog-mastering";

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

    if (availabilityStatus !== "available") {
      toast({
        title: "Créneau non disponible",
        description: "Veuillez choisir un autre créneau",
        variant: "destructive",
      });
      return false;
    }

    // KYC is required only for session types (not immediate services)
    if (!identityVerified) {
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

        <div className="max-w-4xl mx-auto">
          {/* Session type selector */}
          <div className="mb-10">
            <Label className="text-sm text-muted-foreground mb-4 block">TYPE DE SERVICE</Label>
            
            {/* Sessions studio */}
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Sessions Studio</p>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <button
                type="button"
                onClick={() => {
                  setSessionType("with-engineer");
                  setShowPayment(false);
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
              </button>

              <button
                type="button"
                onClick={() => {
                  setSessionType("without-engineer");
                  setShowPayment(false);
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
                  Accès au studio en autonomie (vérification d'identité requise)
                </p>
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
            </div>
          </div>

          {/* Booking form */}
          <div className="bg-card rounded-2xl border border-border p-8">
            {/* Info message for immediate services */}
            {isImmediateService && (
              <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/30">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-foreground">Délai de traitement : ~2 semaines</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Dès que l'ingénieur aura terminé le travail, nous vous contacterons par email ou WhatsApp 
                  pour vous proposer des dates pour la session d'écoute au studio.
                </p>
              </div>
            )}

            <div className={cn("grid gap-6 mb-6", isImmediateService ? "md:grid-cols-1" : "md:grid-cols-2")}>
              {/* Personal info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" /> Nom complet
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
                    <Mail className="w-4 h-4" /> Email
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
                    <Phone className="w-4 h-4" /> Téléphone
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

              {/* Date and time - Only for studio sessions */}
              {!isImmediateService && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="date" className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Date souhaitée
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
                      <Clock className="w-4 h-4" /> Heure de début
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
            </div>

            {/* Message */}
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

            {/* Identity Verification - Only for studio sessions */}
            {!isImmediateService && sessionType && formData.name && availabilityStatus === "available" && (
              <div className="mb-6">
                <IdentityVerification
                  formName={formData.name}
                  onVerified={handleIdentityVerified}
                  isVerified={identityVerified}
                  verifiedName={verifiedName}
                />
              </div>
            )}

            {/* Price display */}
            {sessionType && (
              <div className="mb-6 p-4 rounded-xl bg-secondary/50 border border-primary/20">
                {!isImmediateService && (
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
                )}
                {isImmediateService && (
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {sessionType === "mixing" && "Mixage projet"}
                        {sessionType === "mastering" && "Mastering"}
                        {sessionType === "analog-mastering" && "Mastering analogique"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-display text-2xl text-foreground">{totalPrice}€</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {isDeposit ? "Acompte à payer (50%)" : "Montant à payer"}
                    </p>
                    {isDeposit && !isImmediateService && (
                      <p className="text-xs text-accent">Le reste sera payé au studio</p>
                    )}
                    {isDeposit && isImmediateService && (
                      <p className="text-xs text-accent">Le reste après la session d'écoute</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Euro className="w-6 h-6 text-primary" />
                    <span className="font-display text-4xl text-primary text-glow-cyan">{paymentAmount}€</span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment section */}
            {!showPayment ? (
              <Button 
                type="button" 
                variant="hero" 
                size="xl" 
                className="w-full"
                onClick={handleProceedToPayment}
                disabled={
                  loadingClientId || 
                  (!isImmediateService && (availabilityStatus === "checking" || availabilityStatus === "unavailable" || !identityVerified)) ||
                  !formData.name || !formData.email || !formData.phone
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
                ) : !isImmediateService && !identityVerified ? (
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
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-5 h-5 text-accent" />
                    <span className="font-semibold text-foreground">Paiement sécurisé</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {isImmediateService ? (
                      isDeposit 
                        ? `Acompte de ${paymentAmount}€ pour votre ${sessionType === "mixing" ? "mixage" : "mastering"} (total: ${totalPrice}€)`
                        : `Paiement de ${paymentAmount}€ pour votre mastering analogique`
                    ) : (
                      isDeposit 
                        ? `Acompte de ${paymentAmount}€ pour réserver votre session de ${hours}h (total: ${totalPrice}€)`
                        : `Paiement complet de ${paymentAmount}€ pour votre location de ${hours}h`
                    )}
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
                          totalPrice={totalPrice}
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

                    {/* Revolut Option */}
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-2 font-medium">Option 2 : Revolut</p>
                      <a
                        href={`https://revolut.me/makemusic?amount=${paymentAmount}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#0075EB] hover:bg-[#0066CC] text-white font-semibold rounded-lg transition-colors"
                      >
                        <span>Payer {paymentAmount}€ via Revolut</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Après paiement Revolut, envoyez-nous une capture d'écran de confirmation
                      </p>
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

            <p className="text-xs text-muted-foreground text-center mt-4">
              {sessionType === "without-engineer" || sessionType === "analog-mastering"
                ? "Paiement complet requis à la réservation"
                : isImmediateService 
                  ? "Acompte de 50%, le reste après la session d'écoute"
                  : "Acompte de 50% à la réservation, le reste au studio"
              }
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BookingSection;
