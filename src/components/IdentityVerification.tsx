import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, CheckCircle, XCircle, Loader2, Shield, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface IdentityVerificationProps {
  formName: string;
  onVerified: (verified: boolean, extractedName?: string) => void;
  isVerified?: boolean;
  verifiedName?: string | null;
}

const IdentityVerification = ({ formName, onVerified, isVerified = false, verifiedName: initialVerifiedName = null }: IdentityVerificationProps) => {
  const [status, setStatus] = useState<"idle" | "uploading" | "verifying" | "verified" | "failed">(isVerified ? "verified" : "idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractedName, setExtractedName] = useState<string | null>(initialVerifiedName);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync status with isVerified prop - only when component mounts or isVerified becomes true
  useEffect(() => {
    if (isVerified && status === "idle") {
      setStatus("verified");
      if (initialVerifiedName) {
        setExtractedName(initialVerifiedName);
      }
    }
    // Only reset to idle when isVerified changes from true to false AND we're currently verified
    // Don't interfere with uploading/verifying states
  }, [isVerified, initialVerifiedName]);

  // Compress image to reduce size for upload
  const compressImage = (file: File, maxSizeMB: number = 2): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          
          // Calculate new dimensions (max 1600px on longest side)
          const maxDimension = 1600;
          let width = img.width;
          let height = img.height;
          
          if (width > height && width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Start with quality 0.8 and reduce if needed
          let quality = 0.8;
          let base64 = canvas.toDataURL('image/jpeg', quality);
          
          // Reduce quality until under limit (accounting for base64 overhead)
          const maxBase64Size = maxSizeMB * 1024 * 1024 * 1.4; // 1.4 factor for base64
          while (base64.length > maxBase64Size && quality > 0.3) {
            quality -= 0.1;
            base64 = canvas.toDataURL('image/jpeg', quality);
          }
          
          console.log(`Image compressed: ${(base64.length / 1024 / 1024).toFixed(2)}MB at quality ${quality.toFixed(1)}`);
          resolve(base64);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Veuillez sélectionner une image valide.");
      return;
    }

    // Validate file size (max 20MB raw - will be compressed)
    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage("L'image est trop volumineuse (max 20MB).");
      return;
    }

    setStatus("uploading");
    setErrorMessage(null);

    // Create preview
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    try {
      // Compress image before sending
      const compressedBase64 = await compressImage(file, 3); // Max 3MB after compression
      await verifyIdentity(compressedBase64);
    } catch (err) {
      console.error("Compression error:", err);
      setStatus("failed");
      setErrorMessage("Erreur lors du traitement de l'image. Veuillez réessayer.");
    }
  };

  const verifyIdentity = async (imageBase64: string) => {
    setStatus("verifying");

    try {
      const { data, error } = await supabase.functions.invoke("verify-identity", {
        body: {
          imageBase64,
          formName,
        },
      });

      if (error) throw error;

      if (data.verified) {
        setStatus("verified");
        setExtractedName(data.extractedName);
        onVerified(true, data.extractedName);
      } else {
        setStatus("failed");
        setErrorMessage(data.error || "La vérification a échoué.");
        setExtractedName(data.extractedName || null);
        onVerified(false);
      }
    } catch (err) {
      console.error("Verification failed:", err);
      setStatus("failed");
      setErrorMessage("Erreur lors de la vérification. Veuillez réessayer.");
      onVerified(false);
    }
  };

  const handleRetry = () => {
    setStatus("idle");
    setPreviewUrl(null);
    setErrorMessage(null);
    setExtractedName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-4 rounded-xl bg-secondary/50 border border-border">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-primary" />
        <h4 className="font-semibold text-foreground">Vérification d'identité</h4>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Pour votre sécurité, veuillez télécharger une photo de votre pièce d'identité (CNI, passeport ou permis).
        Le nom doit correspondre à celui du formulaire : <span className="font-semibold text-foreground">{formName}</span>
      </p>

      {/* Hidden file input - configured to show camera and gallery on mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      {/* Separate camera-specific input */}
      <input
        ref={(el) => {
          if (el) el.setAttribute("capture", "environment");
        }}
        id="camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {status === "idle" && (
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Télécharger
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => {
              const cameraInput = document.getElementById("camera-input") as HTMLInputElement;
              if (cameraInput) {
                cameraInput.click();
              }
            }}
          >
            <Camera className="w-4 h-4 mr-2" />
            Prendre photo
          </Button>
        </div>
      )}

      {(status === "uploading" || status === "verifying") && (
        <div className="flex flex-col items-center gap-4 py-4">
          {previewUrl && (
            <div className="w-full max-w-[200px] h-[130px] rounded-lg overflow-hidden border border-border">
              <img src={previewUrl} alt="ID Preview" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-muted-foreground">
              {status === "uploading" ? "Téléchargement..." : "Analyse en cours..."}
            </span>
          </div>
        </div>
      )}

      {status === "verified" && (
        <div className="flex flex-col items-center gap-4 py-4">
          {previewUrl && (
            <div className="w-full max-w-[200px] h-[130px] rounded-lg overflow-hidden border-2 border-green-500">
              <img src={previewUrl} alt="ID Preview" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Identité vérifiée</span>
          </div>
          {extractedName && (
            <p className="text-sm text-muted-foreground">
              Nom détecté : <span className="text-foreground">{extractedName}</span>
            </p>
          )}
        </div>
      )}

      {status === "failed" && (
        <div className="flex flex-col items-center gap-4 py-4">
          {previewUrl && (
            <div className="w-full max-w-[200px] h-[130px] rounded-lg overflow-hidden border-2 border-destructive">
              <img src={previewUrl} alt="ID Preview" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" />
            <span className="font-semibold">Vérification échouée</span>
          </div>
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}
          {extractedName && (
            <p className="text-sm text-muted-foreground">
              Nom détecté : <span className="text-foreground">{extractedName}</span>
            </p>
          )}
          <Button type="button" variant="outline" onClick={handleRetry}>
            Réessayer
          </Button>
        </div>
      )}
    </div>
  );
};

export default IdentityVerification;
