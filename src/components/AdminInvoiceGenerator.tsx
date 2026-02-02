import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Loader2, Download, Plus, Trash2, CreditCard, Building2 } from "lucide-react";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface AdminInvoiceGeneratorProps {
  prefilledData?: {
    clientName?: string;
    clientEmail?: string;
    sessionType?: string | null;
    hours?: number;
    totalPrice?: number;
    sessionDate?: string;
    sessionStartTime?: string;
    sessionEndTime?: string;
  };
}

const AdminInvoiceGenerator = ({ prefilledData }: AdminInvoiceGeneratorProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Calculate due date (+15 days from today)
  const getDefaultDueDate = () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);
    return dueDate.toISOString().split("T")[0];
  };

  // Service type descriptions
  const serviceDescriptions: Record<string, string> = {
    "with-engineer": "Session d'enregistrement avec ingénieur son",
    "without-engineer": "Location studio (autonomie)",
    "mixing": "Mixage + Mastering projet",
    "mastering": "Mastering digital",
    "analog-mastering": "Mastering analogique premium",
    "podcast": "Mixage podcast",
  };
  
  const getInitialItems = (): InvoiceItem[] => {
    if (prefilledData?.sessionType && prefilledData.totalPrice) {
      return [{
        description: serviceDescriptions[prefilledData.sessionType] || "Service studio",
        quantity: prefilledData.hours || 1,
        unitPrice: Math.round(prefilledData.totalPrice / (prefilledData.hours || 1)),
      }];
    }
    return [{ description: "", quantity: 1, unitPrice: 0 }];
  };
  
  const [invoiceData, setInvoiceData] = useState({
    clientName: prefilledData?.clientName || "",
    clientEmail: prefilledData?.clientEmail || "",
    clientAddress: "",
    invoiceNumber: `FAC-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString().split("T")[0],
    dueDate: getDefaultDueDate(), // Auto +15 days
    notes: "",
    sessionType: prefilledData?.sessionType || "",
    // Session fields - pre-filled from session data
    sessionDate: prefilledData?.sessionDate || "",
    sessionStartTime: prefilledData?.sessionStartTime || "",
    sessionEndTime: prefilledData?.sessionEndTime || "",
    hours: prefilledData?.hours || 0,
    // Payment options
    includePaymentLink: false,
    stripePaymentUrl: "",
    // Bank details
    includeBankDetails: true,
    bankIban: "BE28 6506 1537 7020",
    bankBic: "REVOBEB2",
  });
  const [items, setItems] = useState<InvoiceItem[]>(getInitialItems());

  // Initialize data from prefilledData immediately on mount (before dialog opens)
  useEffect(() => {
    if (prefilledData) {
      console.log("[INVOICE] Component mounted - Initializing from prefilledData:", prefilledData);
      
      // Update invoice data with prefilled values
      setInvoiceData(prev => ({
        ...prev,
        clientName: prefilledData.clientName || prev.clientName,
        clientEmail: prefilledData.clientEmail || prev.clientEmail,
        sessionType: prefilledData.sessionType || prev.sessionType,
        sessionDate: prefilledData.sessionDate || prev.sessionDate,
        sessionStartTime: prefilledData.sessionStartTime || prev.sessionStartTime,
        sessionEndTime: prefilledData.sessionEndTime || prev.sessionEndTime,
        hours: prefilledData.hours ?? prev.hours,
      }));
      
      // Update items
      if (prefilledData.sessionType || prefilledData.totalPrice || prefilledData.hours) {
        const hours = prefilledData.hours || 1;
        const totalPrice = prefilledData.totalPrice || 0;
        const unitPrice = totalPrice > 0 ? Math.round(totalPrice / hours) : 0;
        
        setItems([{
          description: serviceDescriptions[prefilledData.sessionType || ""] || "Service studio",
          quantity: hours,
          unitPrice: unitPrice,
        }]);
      }
    }
  }, []); // Run only once on mount

  // Update data when dialog opens (in case prefilledData changed since mount)
  useEffect(() => {
    if (open && prefilledData) {
      console.log("[INVOICE] Dialog opened - Syncing from prefilledData:", prefilledData);
      console.log("[INVOICE] Session details:", {
        sessionDate: prefilledData.sessionDate,
        sessionStartTime: prefilledData.sessionStartTime,
        sessionEndTime: prefilledData.sessionEndTime,
        hours: prefilledData.hours,
      });
      
      // FORCE update all session data from prefilledData (don't keep old values)
      setInvoiceData(prev => ({
        ...prev,
        clientName: prefilledData.clientName || prev.clientName,
        clientEmail: prefilledData.clientEmail || prev.clientEmail,
        sessionType: prefilledData.sessionType || prev.sessionType,
        // Always update session details from prefilledData
        sessionDate: prefilledData.sessionDate || prev.sessionDate,
        sessionStartTime: prefilledData.sessionStartTime || prev.sessionStartTime,
        sessionEndTime: prefilledData.sessionEndTime || prev.sessionEndTime,
        hours: prefilledData.hours ?? prev.hours,
      }));
      
      // Update items based on session type and price
      if (prefilledData.sessionType || prefilledData.totalPrice || prefilledData.hours) {
        const hours = prefilledData.hours || 1;
        const totalPrice = prefilledData.totalPrice || 0;
        const unitPrice = totalPrice > 0 ? Math.round(totalPrice / hours) : 0;
        
        setItems([{
          description: serviceDescriptions[prefilledData.sessionType || ""] || "Service studio",
          quantity: hours,
          unitPrice: unitPrice,
        }]);
      }
    }
  }, [open]);

  // Also update when prefilledData changes (props update)
  useEffect(() => {
    if (prefilledData) {
      console.log("[INVOICE] prefilledData props changed:", prefilledData);
      setInvoiceData(prev => ({
        ...prev,
        clientName: prefilledData.clientName || prev.clientName,
        clientEmail: prefilledData.clientEmail || prev.clientEmail,
        sessionType: prefilledData.sessionType || prev.sessionType,
        sessionDate: prefilledData.sessionDate || prev.sessionDate,
        sessionStartTime: prefilledData.sessionStartTime || prev.sessionStartTime,
        sessionEndTime: prefilledData.sessionEndTime || prev.sessionEndTime,
        hours: prefilledData.hours ?? prev.hours,
      }));
      
      // Update items too
      if (prefilledData.sessionType || prefilledData.totalPrice || prefilledData.hours) {
        const hours = prefilledData.hours || 1;
        const totalPrice = prefilledData.totalPrice || 0;
        const unitPrice = totalPrice > 0 ? Math.round(totalPrice / hours) : 0;
        
        setItems([{
          description: serviceDescriptions[prefilledData.sessionType || ""] || "Service studio",
          quantity: hours,
          unitPrice: unitPrice,
        }]);
      }
    }
  }, [prefilledData?.sessionDate, prefilledData?.sessionStartTime, prefilledData?.sessionEndTime, prefilledData?.hours, prefilledData?.clientName, prefilledData?.clientEmail, prefilledData?.sessionType, prefilledData?.totalPrice]);

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  // Generate Stripe payment link for invoice
  const generateStripeLink = async () => {
    const total = calculateTotal();
    if (total <= 0) {
      toast({
        title: "Erreur",
        description: "Le montant doit être supérieur à 0",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create a Stripe Checkout Session specifically for invoice payment
      const { data, error } = await supabase.functions.invoke("create-stripe-payment", {
        body: {
          amount: total,
          email: invoiceData.clientEmail,
          name: invoiceData.clientName,
          // Mark this as an invoice payment (not a booking)
          sessionType: "invoice",
          hours: 0,
          date: invoiceData.sessionDate || "",
          time: "",
          isDeposit: false,
          totalPrice: total,
          message: `Facture ${invoiceData.invoiceNumber}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        setInvoiceData(prev => ({ ...prev, stripePaymentUrl: data.url, includePaymentLink: true }));
        toast({
          title: "Lien de paiement créé !",
          description: "Le lien Stripe a été ajouté à la facture. Il expirera dans 24h.",
        });
      } else {
        throw new Error("Aucune URL de paiement reçue");
      }
    } catch (err) {
      console.error("Error creating Stripe link:", err);
      toast({
        title: "Erreur",
        description: "Impossible de créer le lien de paiement. Vérifiez la configuration Stripe.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateInvoice = async () => {
    if (!invoiceData.clientName || !invoiceData.clientEmail || items.some(i => !i.description || i.unitPrice <= 0)) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-invoice", {
        body: {
          invoiceNumber: invoiceData.invoiceNumber,
          date: invoiceData.date,
          dueDate: invoiceData.dueDate,
          clientName: invoiceData.clientName,
          clientEmail: invoiceData.clientEmail,
          clientAddress: invoiceData.clientAddress,
          items: items,
          notes: invoiceData.notes,
          sendEmail: false,
          // Session details
          sessionType: invoiceData.sessionType,
          sessionDate: invoiceData.sessionDate,
          sessionStartTime: invoiceData.sessionStartTime,
          sessionEndTime: invoiceData.sessionEndTime,
          hours: invoiceData.hours || items[0]?.quantity || 0,
          // Payment
          includePaymentLink: invoiceData.includePaymentLink,
          stripePaymentUrl: invoiceData.stripePaymentUrl,
          // Bank details
          includeBankDetails: invoiceData.includeBankDetails,
          bankIban: invoiceData.bankIban,
          bankBic: invoiceData.bankBic,
        },
      });

      if (error) throw error;

      // Download the invoice HTML as PDF (using browser print)
      if (data.invoiceHtml) {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(data.invoiceHtml);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      }

      toast({
        title: "Facture générée !",
        description: `Facture ${invoiceData.invoiceNumber} créée avec succès.`,
      });

    } catch (err) {
      console.error("Error generating invoice:", err);
      toast({
        title: "Erreur",
        description: "Impossible de générer la facture. Réessayez.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!invoiceData.clientName || !invoiceData.clientEmail || items.some(i => !i.description || i.unitPrice <= 0)) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke("generate-invoice", {
        body: {
          invoiceNumber: invoiceData.invoiceNumber,
          date: invoiceData.date,
          dueDate: invoiceData.dueDate,
          clientName: invoiceData.clientName,
          clientEmail: invoiceData.clientEmail,
          clientAddress: invoiceData.clientAddress,
          items: items,
          notes: invoiceData.notes,
          sendEmail: true,
          // Session details
          sessionType: invoiceData.sessionType,
          sessionDate: invoiceData.sessionDate,
          sessionStartTime: invoiceData.sessionStartTime,
          sessionEndTime: invoiceData.sessionEndTime,
          hours: invoiceData.hours || items[0]?.quantity || 0,
          // Payment
          includePaymentLink: invoiceData.includePaymentLink,
          stripePaymentUrl: invoiceData.stripePaymentUrl,
          // Bank details
          includeBankDetails: invoiceData.includeBankDetails,
          bankIban: invoiceData.bankIban,
          bankBic: invoiceData.bankBic,
        },
      });

      if (error) throw error;

      toast({
        title: "Facture envoyée !",
        description: `Facture envoyée à ${invoiceData.clientEmail} + copie admin`,
      });

      setOpen(false);
    } catch (err) {
      console.error("Error sending invoice:", err);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la facture. Réessayez.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Preset templates based on session type
  const applyPreset = (type: string) => {
    const presets: Record<string, InvoiceItem[]> = {
      "with-engineer": [{ description: "Session d'enregistrement avec ingénieur son", quantity: 1, unitPrice: 45 }],
      "without-engineer": [{ description: "Location studio (autonomie)", quantity: 1, unitPrice: 22 }],
      "mixing": [{ description: "Mixage + Mastering projet", quantity: 1, unitPrice: 200 }],
      "mastering": [{ description: "Mastering digital", quantity: 1, unitPrice: 60 }],
      "analog-mastering": [{ description: "Mastering analogique premium", quantity: 1, unitPrice: 100 }],
      "podcast": [{ description: "Mixage podcast (par minute)", quantity: 1, unitPrice: 40 }],
    };

    if (presets[type]) {
      setItems(presets[type]);
      setInvoiceData({ ...invoiceData, sessionType: type });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/50 text-primary hover:bg-primary/10">
          <FileText className="w-4 h-4" />
          Générer une facture
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileText className="w-5 h-5 text-primary" />
            Générer une facture complète
          </DialogTitle>
          <DialogDescription>
            Créez une facture professionnelle avec tous les détails de la session.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Invoice info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-number">N° Facture</Label>
              <Input
                id="invoice-number"
                value={invoiceData.invoiceNumber}
                onChange={(e) => setInvoiceData({ ...invoiceData, invoiceNumber: e.target.value })}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-date">Date facture</Label>
              <Input
                id="invoice-date"
                type="date"
                value={invoiceData.date}
                onChange={(e) => setInvoiceData({ ...invoiceData, date: e.target.value })}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-due">Échéance</Label>
              <Input
                id="invoice-due"
                type="date"
                value={invoiceData.dueDate}
                onChange={(e) => setInvoiceData({ ...invoiceData, dueDate: e.target.value })}
                className="bg-secondary/50 border-border"
              />
            </div>
          </div>

          {/* Client info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client-name">Nom du client *</Label>
              <Input
                id="client-name"
                value={invoiceData.clientName}
                onChange={(e) => setInvoiceData({ ...invoiceData, clientName: e.target.value })}
                placeholder="Nom complet"
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-email">Email du client *</Label>
              <Input
                id="client-email"
                type="email"
                value={invoiceData.clientEmail}
                onChange={(e) => setInvoiceData({ ...invoiceData, clientEmail: e.target.value })}
                placeholder="email@exemple.com"
                className="bg-secondary/50 border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-address">Adresse du client</Label>
            <Textarea
              id="client-address"
              value={invoiceData.clientAddress}
              onChange={(e) => setInvoiceData({ ...invoiceData, clientAddress: e.target.value })}
              placeholder="Adresse de facturation"
              className="bg-secondary/50 border-border min-h-[60px]"
            />
          </div>

          {/* Session details section */}
          <div className="border border-primary/30 rounded-lg p-4 space-y-4 bg-primary/5">
            <h4 className="font-semibold text-primary flex items-center gap-2">
              📅 Détails de la session
            </h4>
            
            {/* Preset selector */}
            <div className="space-y-2">
              <Label>Type de service</Label>
              <Select value={invoiceData.sessionType || undefined} onValueChange={applyPreset}>
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue placeholder="Sélectionner un type de service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="with-engineer">Session avec ingénieur (45€/h)</SelectItem>
                  <SelectItem value="without-engineer">Location sèche (22€/h)</SelectItem>
                  <SelectItem value="mixing">Mixage (200€)</SelectItem>
                  <SelectItem value="mastering">Mastering (60€)</SelectItem>
                  <SelectItem value="analog-mastering">Mastering analogique (100€)</SelectItem>
                  <SelectItem value="podcast">Mixage podcast (40€/min)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de la session</Label>
                <Input
                  type="date"
                  value={invoiceData.sessionDate}
                  onChange={(e) => setInvoiceData({ ...invoiceData, sessionDate: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Durée (heures)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={invoiceData.hours || ""}
                  onChange={(e) => setInvoiceData({ ...invoiceData, hours: parseFloat(e.target.value) || 0 })}
                  placeholder="4"
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Heure de début</Label>
                <Input
                  type="time"
                  value={invoiceData.sessionStartTime}
                  onChange={(e) => setInvoiceData({ ...invoiceData, sessionStartTime: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Heure de fin</Label>
                <Input
                  type="time"
                  value={invoiceData.sessionEndTime}
                  onChange={(e) => setInvoiceData({ ...invoiceData, sessionEndTime: e.target.value })}
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>
          </div>

          {/* Invoice items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Articles *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1" /> Ajouter
              </Button>
            </div>
            
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6 space-y-1">
                  {index === 0 && <Label className="text-xs">Description</Label>}
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Description du service"
                    className="bg-secondary/50 border-border"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  {index === 0 && <Label className="text-xs">Qté</Label>}
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                    className="bg-secondary/50 border-border"
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  {index === 0 && <Label className="text-xs">Prix unit. (€)</Label>}
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                    className="bg-secondary/50 border-border"
                  />
                </div>
                <div className="col-span-1">
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <div className="flex justify-end pt-2 border-t border-border">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="font-display text-2xl text-primary">{calculateTotal().toFixed(2)}€</p>
              </div>
            </div>
          </div>

          {/* Payment options */}
          <div className="border border-green-500/30 rounded-lg p-4 space-y-4 bg-green-500/5">
            <h4 className="font-semibold text-green-400 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Options de paiement
            </h4>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Inclure lien de paiement Stripe</p>
                <p className="text-xs text-muted-foreground">Permet au client de payer en ligne</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={invoiceData.includePaymentLink}
                  onCheckedChange={(v) => setInvoiceData({ ...invoiceData, includePaymentLink: v })}
                />
                {!invoiceData.stripePaymentUrl && invoiceData.includePaymentLink && (
                  <Button type="button" size="sm" variant="outline" onClick={generateStripeLink}>
                    Générer
                  </Button>
                )}
              </div>
            </div>
            
            {invoiceData.stripePaymentUrl && (
              <div className="space-y-2">
                <Label className="text-xs">Lien Stripe généré</Label>
                <Input
                  value={invoiceData.stripePaymentUrl}
                  onChange={(e) => setInvoiceData({ ...invoiceData, stripePaymentUrl: e.target.value })}
                  placeholder="https://checkout.stripe.com/..."
                  className="bg-secondary/50 border-border text-xs"
                />
              </div>
            )}
          </div>

          {/* Bank details */}
          <div className="border border-blue-500/30 rounded-lg p-4 space-y-4 bg-blue-500/5">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-blue-400 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Coordonnées bancaires
              </h4>
              <Switch
                checked={invoiceData.includeBankDetails}
                onCheckedChange={(v) => setInvoiceData({ ...invoiceData, includeBankDetails: v })}
              />
            </div>
            
            {invoiceData.includeBankDetails && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">IBAN</Label>
                  <Input
                    value={invoiceData.bankIban}
                    onChange={(e) => setInvoiceData({ ...invoiceData, bankIban: e.target.value })}
                    placeholder="BE00 0000 0000 0000"
                    className="bg-secondary/50 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">BIC</Label>
                  <Input
                    value={invoiceData.bankBic}
                    onChange={(e) => setInvoiceData({ ...invoiceData, bankBic: e.target.value })}
                    placeholder="GEBABEBB"
                    className="bg-secondary/50 border-border"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="invoice-notes">Notes (optionnel)</Label>
            <Textarea
              id="invoice-notes"
              value={invoiceData.notes}
              onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
              placeholder="Notes additionnelles, conditions particulières..."
              className="bg-secondary/50 border-border min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleGenerateInvoice} disabled={loading} variant="outline">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Télécharger PDF
          </Button>
          <Button onClick={handleSendInvoice} disabled={loading} variant="hero">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
            Envoyer par email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminInvoiceGenerator;
