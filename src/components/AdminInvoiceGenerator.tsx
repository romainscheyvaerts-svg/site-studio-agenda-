import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { FileText, Loader2, Download, Plus, Trash2 } from "lucide-react";

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
  };
}

const AdminInvoiceGenerator = ({ prefilledData }: AdminInvoiceGeneratorProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const getInitialItems = (): InvoiceItem[] => {
    if (prefilledData?.sessionType && prefilledData.totalPrice) {
      const descriptions: Record<string, string> = {
        "with-engineer": "Session d'enregistrement avec ingénieur son",
        "without-engineer": "Location studio (autonomie)",
        "mixing": "Mixage + Mastering projet",
        "mastering": "Mastering digital",
        "analog-mastering": "Mastering analogique premium",
        "podcast": "Mixage podcast",
      };
      return [{
        description: descriptions[prefilledData.sessionType] || "Service studio",
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
    dueDate: "",
    notes: "",
    sessionType: prefilledData?.sessionType || "",
  });
  const [items, setItems] = useState<InvoiceItem[]>(getInitialItems());

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
          sendEmail: false, // Admin generates, can choose to send later
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
        },
      });

      if (error) throw error;

      toast({
        title: "Facture envoyée !",
        description: `Facture envoyée à ${invoiceData.clientEmail}`,
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
      <DialogContent className="sm:max-w-[700px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileText className="w-5 h-5 text-primary" />
            Générer une facture
          </DialogTitle>
          <DialogDescription>
            Créez une facture personnalisée pour un client.
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
              <Label htmlFor="invoice-date">Date</Label>
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

          {/* Preset selector */}
          <div className="space-y-2">
            <Label>Modèle rapide</Label>
            <Select onValueChange={applyPreset}>
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="invoice-notes">Notes (optionnel)</Label>
            <Textarea
              id="invoice-notes"
              value={invoiceData.notes}
              onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
              placeholder="Notes additionnelles..."
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
            Télécharger
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
