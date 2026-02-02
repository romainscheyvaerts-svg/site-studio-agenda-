import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/useAdmin";
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
  UserCog
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
  const [currentStartHour, setCurrentStartHour] = useState(startHour);
  const [currentEndHour, setCurrentEndHour] = useState(endHour);

  // Client and email options
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState(existingClientEmail);
  const [notes, setNotes] = useState("");
  const [totalPrice, setTotalPrice] = useState<number>(0);

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
  const [admins, setAdmins] = useState<Array<{ user_id: string; display_name: string; color: string; email?: string }>>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");

  // Default colors for admins without profile
  const defaultColors = ['#00D9FF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3'];

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

        const adminUserIds = roleData.map(r => r.user_id);

        // 2. Get admin profiles for those who have one
        const { data: profilesData } = await supabase
          .from("admin_profiles" as any)
          .select("user_id, display_name, color, email")
          .in("user_id", adminUserIds);

        const profiles = (profilesData || []) as any[];

        // 3. Get emails from list-users function for admins without profiles
        const adminsWithoutProfile = adminUserIds.filter(
          uid => !profiles.find(p => p.user_id === uid)
        );

        let userEmails: Record<string, string> = {};
        if (adminsWithoutProfile.length > 0) {
          // Try to get user emails via admin function
          try {
            const { data: usersData } = await supabase.functions.invoke("list-users");
            if (usersData?.users) {
              usersData.users.forEach((u: any) => {
                if (adminsWithoutProfile.includes(u.id)) {
                  userEmails[u.id] = u.email;
                }
              });
            }
          } catch (e) {
            console.log("Could not fetch user emails:", e);
          }
        }

        // 4. Build combined admin list
        const adminsList = adminUserIds.map((userId, index) => {
          const profile = profiles.find(p => p.user_id === userId);
          if (profile) {
            return {
              user_id: profile.user_id,
              display_name: profile.display_name,
              color: profile.color,
              email: profile.email
            };
          } else {
            // Admin without profile - use email as name
            const email = userEmails[userId] || `Admin ${index + 1}`;
            const displayName = email.split('@')[0].toUpperCase();
            return {
              user_id: userId,
              display_name: displayName,
              color: defaultColors[index % defaultColors.length],
              email: email
            };
          }
        });

        setAdmins(adminsList);

        // Priority order for default admin selection:
        // 1. Current user if they are in the list
        // 2. Admin named "Romain" (superadmin)
        // 3. First admin in the list
        if (user?.id) {
          const currentAdmin = adminsList.find(a => a.user_id === user.id);
          if (currentAdmin) {
            setSelectedAdminId(currentAdmin.user_id);
            return;
          }
        }

        // Look for "Romain" (superadmin) as default
        const romainAdmin = adminsList.find(a => 
          a.display_name.toLowerCase().includes("romain")
        );
        if (romainAdmin) {
          setSelectedAdminId(romainAdmin.user_id);
          return;
        }

        // Fallback to first admin
        if (adminsList.length > 0) {
          setSelectedAdminId(adminsList[0].user_id);
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

  // Service type based on whether engineer is implied
  const sessionType = "with-engineer";

  const handleSaveAndSendEmail = async () => {
    console.log("[EDIT-PANEL] handleSaveAndSendEmail called with:", { mode, eventId, title, date, currentStartHour, currentEndHour });
    
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
            date,
            time: formatHour(currentStartHour),
            hours: duration,
            assignedAdminId: selectedAdminId || undefined,
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
          date,
          startTime: formatHour(currentStartHour),
          endTime: formatHour(currentEndHour),
        });

        const { data, error } = await supabase.functions.invoke("update-admin-event", {
          body: {
            eventId,
            title: title.trim(),
            date,
            startTime: formatHour(currentStartHour),
            endTime: formatHour(currentEndHour),
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
          <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
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
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="client-email">Email du client *</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@email.com"
                  className="bg-background"
                />
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
