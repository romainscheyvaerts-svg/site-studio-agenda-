import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/useAdmin";
import { usePricing } from "@/hooks/usePricing";
import AdminInvoiceGenerator from "./AdminInvoiceGenerator";
import {
  Loader2,
  Send,
  CreditCard,
  FolderPlus,
  Mail,
  Clock,
  Check,
  X,
  Gift,
  UserCog,
  Plus,
  Users,
  Euro,
  Mic,
  Building2,
  Music,
  Headphones,
  Calendar,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AdminEventEditPanelProps {
  // For editing existing events
  eventId?: string;
  eventTitle?: string;

  // Date and time
  date: string;
  startHour: number;
  endHour: number;

  // Optional existing data
  clientEmail?: string;
  driveFolderLink?: string;

  // Mode: "create" or "edit"
  mode: "create" | "edit";

  // Callbacks
  onSave: () => void;
  onCancel: () => void;
}

const hours = Array.from({ length: 24 }, (_, i) => i);

const AdminEventEditPanel = ({
  eventId,
  eventTitle = "",
  date,
  startHour,
  endHour,
  clientEmail: existingClientEmail = "",
  driveFolderLink: existingDriveFolderLink,
  mode,
  onSave,
  onCancel,
}: AdminEventEditPanelProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Form state
  const [title, setTitle] = useState(eventTitle);
  const [currentDate, setCurrentDate] = useState(date);
  const [currentStartHour, setCurrentStartHour] = useState(startHour);
  const [currentEndHour, setCurrentEndHour] = useState(endHour);

  // Client and email options
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState(existingClientEmail);
  const [notes, setNotes] = useState("");
  const [totalPrice, setTotalPrice] = useState<number>(0);
  
  // Service type
  const [selectedServiceType, setSelectedServiceType] = useState<string>("with-engineer");
  
  // Show invoice generator
  const [showInvoiceGenerator, setShowInvoiceGenerator] = useState(false);

  // Email options
  const [sendEmail, setSendEmail] = useState(false);
  const [includeStripeLink, setIncludeStripeLink] = useState(false);
  const [includeDriveLink, setIncludeDriveLink] = useState(false);

  // Session type
  const [isFreeSession, setIsFreeSession] = useState(false);

  // Results
  const [createdDriveLink, setCreatedDriveLink] = useState<string | null>(existingDriveFolderLink || null);
  const [createdStripeLink, setCreatedStripeLink] = useState<string | null>(null);

  // Admin assignment
  const { user } = useAdmin();
  const { getEffectivePrice, loading: pricingLoading } = usePricing();
  const [admins, setAdmins] = useState<Array<{ user_id: string; display_name: string; color: string; email?: string }>>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");
  const hasUserSelectedAdmin = useRef(false); // Track if user manually selected an admin
  const adminsLoadedRef = useRef(false); // Track if admins have been loaded

  // Multiple client emails support
  const [clientEmails, setClientEmails] = useState<string[]>(existingClientEmail ? existingClientEmail.split(',').map(e => e.trim()).filter(Boolean) : []);
  const [newEmailInput, setNewEmailInput] = useState("");

  // Default colors for admins without profile - MUST MATCH AdminCalendarModern
  const defaultColors = ['#00D9FF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3'];

  // Consistent color generation based on user_id hash (same as AdminCalendarModern)
  const getColorFromUserId = (userId: string): string => {
    const hashCode = userId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    const colorIndex = Math.abs(hashCode) % defaultColors.length;
    return defaultColors[colorIndex];
  };

  // Load existing assignment and session data for this event (when editing)
  useEffect(() => {
    const loadExistingSessionData = async () => {
      if (mode !== "edit" || !eventId) return;
      
      try {
        const { data: assignment, error } = await supabase
          .from("session_assignments" as any)
          .select("assigned_to, service_type, total_price, client_name, notes")
          .eq("event_id", eventId)
          .single();
        
        if (error) {
          console.log("[EDIT-PANEL] No existing session data for event:", eventId);
          return;
        }
        
        const assignmentData = assignment as unknown as { 
          assigned_to: string | null;
          service_type: string | null;
          total_price: number | null;
          client_name: string | null;
          notes: string | null;
        } | null;
        
        if (assignmentData) {
          console.log("[EDIT-PANEL] Found existing session data:", assignmentData);
          
          if (assignmentData.assigned_to) {
            setSelectedAdminId(assignmentData.assigned_to);
            hasUserSelectedAdmin.current = true; // Prevent overwriting with default
          }
          
          if (assignmentData.service_type) {
            setSelectedServiceType(assignmentData.service_type);
          }
          
          if (assignmentData.total_price !== null && assignmentData.total_price !== undefined) {
            setTotalPrice(assignmentData.total_price);
          }
          
          if (assignmentData.client_name) {
            setClientName(assignmentData.client_name);
          }
          
          if (assignmentData.notes) {
            setNotes(assignmentData.notes);
          }
        }
      } catch (err) {
        console.error("Error loading existing session data:", err);
      }
    };
    
    loadExistingSessionData();
  }, [eventId, mode]);

  // Load all admins from user_roles + admin_profiles
  useEffect(() => {
    const loadAdmins = async () => {
      try {
        // 1. Get all admin/superadmin users from user_roles
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["admin", "superadmin"]);

        if (roleError) {
          console.error("Error loading admin roles:", roleError);
          return;
        }

        if (!roleData || roleData.length === 0) {
          console.log("No admins found in user_roles");
          return;
        }

        // Emails to exclude from session assignment (studio emails, not engineers)
        const excludedEmails = ['prod.makemusic@gmail.com'];

        const adminUserIds = roleData.map(r => r.user_id);

        // 2. Get admin profiles for those who have one (no email column in table)
        const { data: profilesData, error: profileError } = await supabase
          .from("admin_profiles" as any)
          .select("user_id, display_name, color")
          .in("user_id", adminUserIds);

        if (profileError) {
          console.error("Error loading admin profiles:", profileError);
        }

        const profiles = (profilesData || []) as any[];
        console.log("[ADMINS] Loaded profiles:", profiles);

        // 3. Get emails from list-users function for ALL admins (to filter excluded emails)
        let userEmails: Record<string, string> = {};
        try {
          const { data: usersData } = await supabase.functions.invoke("list-users");
          if (usersData?.users) {
            usersData.users.forEach((u: any) => {
              if (adminUserIds.includes(u.id)) {
                userEmails[u.id] = u.email;
              }
            });
          }
        } catch (e) {
          console.log("Could not fetch user emails:", e);
        }

        // 4. Build combined admin list and filter excluded emails
        const adminsList = adminUserIds.map((userId, index) => {
          const profile = profiles.find(p => p.user_id === userId);
          const email = profile?.email || userEmails[userId] || '';
          
          if (profile && profile.color) {
            // Admin with profile and color defined
            return {
              user_id: profile.user_id,
              display_name: profile.display_name,
              color: profile.color,
              email: email
            };
          } else {
            // Admin without profile OR without color - use consistent hash-based color
            const fallbackEmail = userEmails[userId] || `Admin ${index + 1}`;
            const displayName = profile?.display_name || fallbackEmail.split('@')[0].toUpperCase();
            // Use hash-based color for consistency with AdminCalendarModern
            const fallbackColor = getColorFromUserId(userId);
            return {
              user_id: userId,
              display_name: displayName,
              color: fallbackColor,
              email: fallbackEmail
            };
          }
        }).filter(admin => {
          // Filter out excluded emails (studio emails, not engineers)
          return !excludedEmails.includes(admin.email?.toLowerCase() || '');
        });

        setAdmins(adminsList);

        // Only set default admin if user hasn't manually selected one and admins haven't been loaded yet
        if (!hasUserSelectedAdmin.current && !adminsLoadedRef.current) {
          // Special rule: if current user is prod.makemusic@gmail.com or romain.scheyvaerts@gmail.com
          // set LENNON as default responsible (if available)
          const studioEmails = ['prod.makemusic@gmail.com', 'romain.scheyvaerts@gmail.com'];
          const currentUserEmail = Object.entries(userEmails).find(([id]) => id === user?.id)?.[1]?.toLowerCase();
          
          if (currentUserEmail && studioEmails.includes(currentUserEmail)) {
            // Find Lennon in the list (by display_name containing LENNON)
            const lennonAdmin = adminsList.find(a => 
              a.display_name.toUpperCase().includes('LENNON')
            );
            if (lennonAdmin) {
              console.log("[ADMINS] Studio email detected, defaulting to LENNON:", lennonAdmin.user_id);
              setSelectedAdminId(lennonAdmin.user_id);
              adminsLoadedRef.current = true;
              return;
            }
          }
          
          // Priority order for default admin selection:
          // 1. Current user if they are in the list (and not studio email)
          // 2. First admin in the list
          if (user?.id) {
            const currentAdmin = adminsList.find(a => a.user_id === user.id);
            if (currentAdmin) {
              setSelectedAdminId(currentAdmin.user_id);
              adminsLoadedRef.current = true;
              return;
            }
          }

          // Fallback to first admin
          if (adminsList.length > 0) {
            setSelectedAdminId(adminsList[0].user_id);
          }
          adminsLoadedRef.current = true;
        }
      } catch (err) {
        console.error("Error loading admins:", err);
      }
    };
    loadAdmins();
  }, [user?.id]);

  useEffect(() => {
    setTitle(eventTitle);
    setCurrentStartHour(startHour);
    setCurrentEndHour(endHour);
    setClientEmail(existingClientEmail);
    setCreatedDriveLink(existingDriveFolderLink || null);
  }, [eventTitle, startHour, endHour, existingClientEmail, existingDriveFolderLink]);

  const formatHour = (hour: number) => `${hour.toString().padStart(2, "0")}:00`;
  const duration = currentEndHour - currentStartHour;

  // Auto-calculate price based on service type and duration
  // Only calculate if totalPrice is 0 (not manually set) or when service type changes
  useEffect(() => {
    // Skip if pricing is loading or if we're in edit mode and already have a price from DB
    if (pricingLoading) return;
    
    // Calculate price based on service type and duration
    const hourlyRate = getEffectivePrice(selectedServiceType);
    const calculatedPrice = hourlyRate * duration;
    
    // Only auto-update if:
    // 1. Price is currently 0 (not set)
    // 2. Or if service type just changed (user selected different service)
    if (totalPrice === 0 && calculatedPrice > 0) {
      setTotalPrice(calculatedPrice);
    }
  }, [selectedServiceType, pricingLoading, getEffectivePrice, duration]);

  // Update price when duration changes (if price was auto-calculated)
  useEffect(() => {
    if (pricingLoading) return;
    
    const hourlyRate = getEffectivePrice(selectedServiceType);
    if (hourlyRate > 0) {
      // Check if current price matches a calculated value (meaning it was auto-calculated)
      const wouldBePrice = hourlyRate * duration;
      
      // If price looks auto-calculated, update it with new duration
      if (totalPrice === wouldBePrice || totalPrice === 0) {
        setTotalPrice(hourlyRate * duration);
      }
    }
  }, [duration, pricingLoading, getEffectivePrice, selectedServiceType]);

  // Service type based on whether engineer is implied
  const sessionType = "with-engineer";

  const handleSaveAndSendEmail = async () => {
    // Use currentDate for edit mode (can be changed), date for create mode
    const effectiveDate = mode === "edit" ? currentDate : date;
    
    console.log("[EDIT-PANEL] handleSaveAndSendEmail called with:", { mode, eventId, title, effectiveDate, currentStartHour, currentEndHour });
    
    if (!title.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un titre pour l'événement",
        variant: "destructive",
      });
      return;
    }

    if (sendEmail && !clientEmail) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer l'email du client pour envoyer un email",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setSendingEmail(sendEmail);

    try {
      if (mode === "create") {
        // Build description with [FREE] tag if session is free
        let eventDescription = notes;
        if (isFreeSession) {
          eventDescription = "[FREE]\n" + (notes || "");
        }
        
        // Create the event first
        const { data, error } = await supabase.functions.invoke("create-admin-event", {
          body: {
            title: title.trim(),
            clientName: clientName || title.trim(),
            clientEmail: clientEmail || undefined,
            description: eventDescription,
            date: effectiveDate,
            time: formatHour(currentStartHour),
            hours: duration,
            assignedAdminId: selectedAdminId || undefined,
            serviceType: selectedServiceType,
            totalPrice: totalPrice,
          },
        });

        if (error) throw error;
      } else if (mode === "edit") {
        // Update the event
        if (!eventId) {
          console.error("[EDIT-PANEL] No eventId provided for edit mode!");
          toast({
            title: "Erreur",
            description: "ID de l'événement manquant - impossible de modifier",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        console.log("[EDIT-PANEL] Updating event with data:", {
          eventId,
          title: title.trim(),
          date: effectiveDate,
          startTime: formatHour(currentStartHour),
          endTime: formatHour(currentEndHour),
          assignedAdminId: selectedAdminId,
        });

        const { data, error } = await supabase.functions.invoke("update-admin-event", {
          body: {
            eventId,
            title: title.trim(),
            date: effectiveDate,
            startTime: formatHour(currentStartHour),
            endTime: formatHour(currentEndHour),
            assignedAdminId: selectedAdminId || undefined,
            // Session details to persist
            serviceType: selectedServiceType,
            totalPrice: totalPrice,
            clientName: clientName || undefined,
            notes: notes || undefined,
          },
        });

        console.log("[EDIT-PANEL] Update response:", { data, error });
        
        if (error) throw error;
      }

      // Send email if requested
      if (sendEmail && clientEmail) {
        const { data: emailData, error: emailError } = await supabase.functions.invoke("send-admin-email", {
          body: {
            clientEmail,
            clientName: clientName || clientEmail.split("@")[0],
            sessionType: selectedServiceType,
            sessionDate: format(new Date(effectiveDate), "EEEE d MMMM yyyy", { locale: fr }),
            sessionTime: formatHour(currentStartHour),
            hours: duration,
            totalPrice,
            includeStripeLink: includeStripeLink && totalPrice > 0,
            includeDriveLink,
            customMessage: notes,
          },
        });

        if (emailError) {
          console.error("Email error:", emailError);
          toast({
            title: "Événement sauvegardé",
            description: "L'événement a été sauvegardé mais l'email n'a pas pu être envoyé.",
            variant: "destructive",
          });
        } else {
          // Store any generated links
          if (emailData?.stripePaymentUrl) {
            setCreatedStripeLink(emailData.stripePaymentUrl);
          }
          if (emailData?.driveFolderLink) {
            setCreatedDriveLink(emailData.driveFolderLink);
          }

          toast({
            title: "Succès ! 🎉",
            description: `Événement ${mode === "create" ? "créé" : "modifié"} et email envoyé à ${clientEmail}`,
          });
        }
      } else {
        toast({
          title: mode === "create" ? "Événement créé !" : "Événement modifié !",
          description: `"${title}" ${mode === "create" ? "ajouté à" : "mis à jour dans"} l'agenda`,
        });
      }

      onSave();
    } catch (err) {
      console.error("Error:", err);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue. Réessayez.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setSendingEmail(false);
    }
  };

  // Send email only (for existing events)
  const handleSendEmailOnly = async () => {
    if (!clientEmail) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer l'email du client",
        variant: "destructive",
      });
      return;
    }

    setSendingEmail(true);

    try {
      const { data: emailData, error: emailError } = await supabase.functions.invoke("send-admin-email", {
        body: {
          clientEmail,
          clientName: clientName || clientEmail.split("@")[0],
          sessionType,
          sessionDate: format(new Date(date), "EEEE d MMMM yyyy", { locale: fr }),
          sessionTime: formatHour(currentStartHour),
          hours: duration,
          totalPrice,
          includeStripeLink: includeStripeLink && totalPrice > 0,
          includeDriveLink,
          customMessage: notes,
        },
      });

      if (emailError) throw emailError;

      // Store any generated links
      if (emailData?.stripePaymentUrl) {
        setCreatedStripeLink(emailData.stripePaymentUrl);
      }
      if (emailData?.driveFolderLink) {
        setCreatedDriveLink(emailData.driveFolderLink);
      }

      toast({
        title: "Email envoyé ! 📧",
        description: `Email envoyé à ${clientEmail}`,
      });
    } catch (err) {
      console.error("Email error:", err);
      toast({
        title: "Erreur",
        description: "L'email n'a pas pu être envoyé.",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="border border-primary/30 rounded-xl p-4 space-y-4 bg-primary/5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          {mode === "create" ? "Créer un événement" : "Modifier l'événement"}
        </h4>
        <div className="text-sm text-muted-foreground">
          {format(new Date(date), "EEEE d MMMM", { locale: fr })}
        </div>
      </div>

      {/* Event details */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="event-title">Titre de l'événement *</Label>
          <Input
            id="event-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Session enregistrement..."
            className="bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-name">Nom du client</Label>
          <Input
            id="client-name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Nom du client"
            className="bg-background"
          />
        </div>
      </div>

      {/* Date selection (only in edit mode) */}
      {mode === "edit" && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Date de l'événement
          </Label>
          <Input
            type="date"
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="bg-background w-auto"
          />
        </div>
      )}

      {/* Time selection */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Début</Label>
          <select
            value={currentStartHour}
            onChange={(e) => {
              const newStart = Number(e.target.value);
              setCurrentStartHour(newStart);
              if (currentEndHour <= newStart) {
                setCurrentEndHour(newStart + 1);
              }
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {hours.map((h) => (
              <option key={h} value={h}>{formatHour(h)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Fin</Label>
          <select
            value={currentEndHour}
            onChange={(e) => setCurrentEndHour(Number(e.target.value))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {hours.filter(h => h > currentStartHour).map((h) => (
              <option key={h} value={h}>{formatHour(h)}</option>
            ))}
            <option value={24}>00:00 (minuit)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Durée</Label>
          <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted text-sm font-medium">
            {duration}h
          </div>
        </div>
      </div>

      {/* Service type and Price */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            Type de service
          </Label>
          <Select value={selectedServiceType} onValueChange={setSelectedServiceType}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Sélectionner un service..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="with-engineer">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-primary" />
                  Session avec ingénieur
                </div>
              </SelectItem>
              <SelectItem value="without-engineer">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-accent" />
                  Location sèche
                </div>
              </SelectItem>
              <SelectItem value="mixing">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-primary" />
                  Mixage
                </div>
              </SelectItem>
              <SelectItem value="mastering">
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-primary" />
                  Mastering
                </div>
              </SelectItem>
              <SelectItem value="other">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  Autre service
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Euro className="w-4 h-4 text-green-500" />
            Prix total (€)
          </Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={totalPrice}
            onChange={(e) => setTotalPrice(Number(e.target.value))}
            placeholder="0"
            className="bg-background"
          />
        </div>
      </div>

      {/* Invoice generator button */}
      <div className="space-y-2">
        <Button 
          type="button"
          variant="outline"
          onClick={() => setShowInvoiceGenerator(!showInvoiceGenerator)}
          className="w-full border-amber-500/30 hover:bg-amber-500/10"
        >
          <FileText className="w-4 h-4 mr-2 text-amber-500" />
          {showInvoiceGenerator ? "Masquer" : "Générer une facture"}
        </Button>
        
        {showInvoiceGenerator && (
          <div className="pt-2">
            <AdminInvoiceGenerator
              prefilledData={{
                clientName: clientName || title,
                clientEmail: clientEmail,
                sessionType: selectedServiceType as any,
                hours: duration,
                totalPrice: totalPrice,
                sessionDate: mode === "edit" ? currentDate : date,
                sessionStartTime: formatHour(currentStartHour),
                sessionEndTime: formatHour(currentEndHour),
              }}
            />
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes / Message personnalisé</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes internes ou message à inclure dans l'email..."
          rows={2}
          className="bg-background resize-none"
        />
      </div>

      {/* Admin assignment */}
      {admins.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-primary" />
            Admin responsable
          </Label>
          <Select value={selectedAdminId} onValueChange={(value) => {
            setSelectedAdminId(value);
            hasUserSelectedAdmin.current = true; // Mark that user manually selected an admin
          }}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Sélectionner un admin..." />
            </SelectTrigger>
            <SelectContent>
              {admins.map((admin) => (
                <SelectItem key={admin.user_id} value={admin.user_id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: admin.color }}
                    />
                    {admin.display_name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            L'admin responsable sera affiché sur le calendrier avec sa couleur
          </p>
        </div>
      )}

      {/* Free session option */}
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-green-500/10 border border-green-500/30">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-green-500" />
          <div>
            <span className="text-sm font-medium text-foreground">Session gratuite</span>
            <p className="text-xs text-muted-foreground">Ne sera pas comptabilisée dans les revenus</p>
          </div>
        </div>
        <Switch
          checked={isFreeSession}
          onCheckedChange={setIsFreeSession}
        />
      </div>

      {/* Email options section */}
      <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <Label className="text-foreground font-medium">Options email</Label>
          </div>
          <Switch
            checked={sendEmail}
            onCheckedChange={setSendEmail}
          />
        </div>

        {sendEmail && (
          <div className="space-y-4 pt-2">
            {/* Multiple client emails */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Emails des participants
              </Label>
              
              {/* Display existing emails as tags */}
              {clientEmails.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {clientEmails.map((email, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/20 border border-primary/30 text-sm"
                    >
                      <span className="text-foreground">{email}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newEmails = clientEmails.filter((_, i) => i !== index);
                          setClientEmails(newEmails);
                          setClientEmail(newEmails.join(', '));
                        }}
                        className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add new email input */}
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  placeholder="Ajouter un email..."
                  className="bg-background flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newEmailInput.trim()) {
                      e.preventDefault();
                      const email = newEmailInput.trim().toLowerCase();
                      if (email.includes('@') && !clientEmails.includes(email)) {
                        const newEmails = [...clientEmails, email];
                        setClientEmails(newEmails);
                        setClientEmail(newEmails.join(', '));
                        setNewEmailInput('');
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const email = newEmailInput.trim().toLowerCase();
                    if (email && email.includes('@') && !clientEmails.includes(email)) {
                      const newEmails = [...clientEmails, email];
                      setClientEmails(newEmails);
                      setClientEmail(newEmails.join(', '));
                      setNewEmailInput('');
                    }
                  }}
                  disabled={!newEmailInput.trim() || !newEmailInput.includes('@')}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ajoutez plusieurs emails pour envoyer à tous les participants
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="total-price">Montant (€)</Label>
              <Input
                id="total-price"
                type="number"
                min={0}
                step={1}
                value={totalPrice}
                onChange={(e) => setTotalPrice(Number(e.target.value))}
                className="bg-background"
              />
            </div>

            {/* Link options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Inclure lien de paiement Stripe</span>
                </div>
                <Switch
                  checked={includeStripeLink}
                  onCheckedChange={setIncludeStripeLink}
                  disabled={totalPrice <= 0}
                />
              </div>

              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background border border-border">
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-amber-500" />
                  <span className="text-sm">Créer dossier Google Drive</span>
                </div>
                <Switch
                  checked={includeDriveLink}
                  onCheckedChange={setIncludeDriveLink}
                />
              </div>
            </div>

            {/* Generated links display */}
            {(createdStripeLink || createdDriveLink) && (
              <div className="space-y-2 pt-2">
                {createdStripeLink && (
                  <a 
                    href={createdStripeLink} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 underline"
                  >
                    <CreditCard className="w-3 h-3" />
                    Lien Stripe généré
                  </a>
                )}
                {createdDriveLink && (
                  <a 
                    href={createdDriveLink} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 underline"
                  >
                    <FolderPlus className="w-3 h-3" />
                    Dossier Drive créé
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 justify-end pt-2">
        <Button 
          variant="outline" 
          onClick={onCancel} 
          disabled={loading || sendingEmail}
        >
          <X className="w-4 h-4 mr-1" />
          Annuler
        </Button>

        {mode === "edit" && clientEmail && (
          <Button 
            variant="secondary"
            onClick={handleSendEmailOnly}
            disabled={loading || sendingEmail || !clientEmail}
          >
            {sendingEmail ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Envoyer email seulement
          </Button>
        )}

        <Button 
          onClick={handleSaveAndSendEmail}
          disabled={loading || !title.trim()}
          className="bg-primary hover:bg-primary/90"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          {mode === "create" 
            ? (sendEmail ? "Créer et envoyer" : "Créer l'événement")
            : (sendEmail ? "Sauvegarder et envoyer" : "Sauvegarder")}
        </Button>
      </div>
    </div>
  );
};

export default AdminEventEditPanel;
