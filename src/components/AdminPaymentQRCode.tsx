import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Euro, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminPaymentQRCodeProps {
  calculatedPrice: number;
}

const AdminPaymentQRCode = ({ calculatedPrice }: AdminPaymentQRCodeProps) => {
  const { toast } = useToast();
  const [customAmount, setCustomAmount] = useState(calculatedPrice.toString());
  const [showQR, setShowQR] = useState(false);

  const amount = parseFloat(customAmount) || 0;

  const paypalLink = `https://www.paypal.me/makemusicstudio/${amount}EUR`;
  const revolutLink = `https://revolut.me/makemusic?amount=${amount}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié !",
      description: `Lien ${label} copié dans le presse-papier`,
    });
  };

  // Generate QR code URL using a free API
  const getQRCodeUrl = (data: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <QrCode className="w-5 h-5 text-primary" />
        <h4 className="font-display text-lg text-foreground">QR CODE PAIEMENT</h4>
      </div>

      {/* Amount input */}
      <div>
        <Label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
          <Euro className="w-4 h-4" />
          Montant à payer (modifiable)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            step={0.01}
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            className="w-32 bg-secondary/50 border-border"
          />
          <span className="text-foreground font-semibold">€</span>
          {parseFloat(customAmount) !== calculatedPrice && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCustomAmount(calculatedPrice.toString())}
              className="text-xs text-muted-foreground"
            >
              Réinitialiser ({calculatedPrice}€)
            </Button>
          )}
        </div>
      </div>

      <Button 
        onClick={() => setShowQR(!showQR)}
        variant="outline"
        className="w-full"
      >
        <QrCode className="w-4 h-4 mr-2" />
        {showQR ? "Masquer les QR codes" : "Générer les QR codes"}
      </Button>

      {showQR && amount > 0 && (
        <div className="grid md:grid-cols-2 gap-6 p-4 rounded-xl bg-secondary/30 border border-border">
          {/* PayPal */}
          <div className="text-center space-y-3">
            <h5 className="font-semibold text-foreground flex items-center justify-center gap-2">
              <span className="text-blue-500">PayPal</span>
            </h5>
            <div className="bg-white p-3 rounded-lg inline-block">
              <img 
                src={getQRCodeUrl(paypalLink)} 
                alt="PayPal QR Code"
                className="w-[150px] h-[150px]"
              />
            </div>
            <p className="text-2xl font-display text-blue-500">{amount}€</p>
            <div className="flex gap-2 justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(paypalLink, "PayPal")}
              >
                <Copy className="w-4 h-4 mr-1" />
                Copier
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(paypalLink, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Ouvrir
              </Button>
            </div>
          </div>

          {/* Revolut */}
          <div className="text-center space-y-3">
            <h5 className="font-semibold text-foreground flex items-center justify-center gap-2">
              <span className="text-purple-500">Revolut</span>
            </h5>
            <div className="bg-white p-3 rounded-lg inline-block">
              <img 
                src={getQRCodeUrl(revolutLink)} 
                alt="Revolut QR Code"
                className="w-[150px] h-[150px]"
              />
            </div>
            <p className="text-2xl font-display text-purple-500">{amount}€</p>
            <div className="flex gap-2 justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(revolutLink, "Revolut")}
              >
                <Copy className="w-4 h-4 mr-1" />
                Copier
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(revolutLink, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Ouvrir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPaymentQRCode;
