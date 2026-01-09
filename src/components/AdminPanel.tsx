import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, X } from "lucide-react";
import AdminInstrumentals from "./AdminInstrumentals";
import AdminServicesPricing from "./AdminServicesPricing";
import AdminServiceFeatures from "./AdminServiceFeatures";
import AdminUserManagement from "./AdminUserManagement";
import AdminChatbotConfig from "./AdminChatbotConfig";
import AdminActivitySecurity from "./AdminActivitySecurity";
import AdminGallery from "./AdminGallery";
import AdminPromoCodeManager from "./AdminPromoCodeManager";
import AdminRoleManager from "./AdminRoleManager";

interface AdminPanelProps {
  inline?: boolean;
}

const AdminPanel = ({ inline = false }: AdminPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Inline mode - renders nothing (removed from admin banner)
  if (inline) {
    return null;
  }

  // Floating panel mode
  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-primary/20 border-primary hover:bg-primary/30"
        title="Panneau Admin"
      >
        <Settings className="w-5 h-5 text-primary" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-card border border-border rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Panneau Admin</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)] space-y-6">
          {/* Super Admin - Role Manager (only visible to super admins) */}
          <AdminRoleManager />

          {/* Promo Codes Management */}
          <AdminPromoCodeManager />

          {/* Instrumentals Management */}
          <AdminInstrumentals />

          {/* Services Pricing Management */}
          <AdminServicesPricing />

          {/* Service Features Management */}
          <AdminServiceFeatures />

          {/* User Management */}
          <AdminUserManagement />

          {/* Activity & Security */}
          <AdminActivitySecurity />

          {/* Gallery Management */}
          <AdminGallery />

          {/* Chatbot Configuration */}
          <AdminChatbotConfig />

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Panneau réservé aux administrateurs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

