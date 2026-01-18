import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  X, 
  Crown, 
  DollarSign, 
  Music, 
  Users, 
  MessageSquare,
  Image
} from "lucide-react";
import AdminInstrumentals from "./AdminInstrumentals";
import AdminServicesPricing from "./AdminServicesPricing";
import AdminServiceFeatures from "./AdminServiceFeatures";
import AdminUserManagement from "./AdminUserManagement";
import AdminChatbotConfig from "./AdminChatbotConfig";
import AdminActivitySecurity from "./AdminActivitySecurity";
import AdminGallery from "./AdminGallery";
import AdminPromoCodeManager from "./AdminPromoCodeManager";
import AdminRoleManager from "./AdminRoleManager";
import AdminDawConfig from "./AdminDawConfig";
import AdminPaymentConfig from "./AdminPaymentConfig";
import { supabase } from "@/integrations/supabase/client";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";

interface AdminPanelProps {
  inline?: boolean;
}

const SUPER_ADMIN_EMAILS = ["prod.makemusic@gmail.com", "romain.scheyvaerts@gmail.com"];

const AdminPanel = ({ inline = false }: AdminPanelProps) => {
  const { isMobileView } = useViewMode();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("pricing");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const checkSuperAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        setIsSuperAdmin(true);
        setActiveTab("super-admin");
      }
    };
    if (isOpen) {
      checkSuperAdmin();
    }
  }, [isOpen]);

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
        className="fixed bottom-6 right-24 z-50 bg-primary/20 border-primary hover:bg-primary/30"
        title="Panneau Admin"
      >
        <Settings className="w-5 h-5 text-primary" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-2">
      <div className={cn(
        "relative w-full bg-card border border-border rounded-lg shadow-xl overflow-hidden",
        isMobileView ? "max-w-full max-h-[95vh]" : "max-w-3xl max-h-[85vh]"
      )}>
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between border-b border-border bg-muted/50",
          isMobileView ? "p-3" : "p-4"
        )}>
          <div className="flex items-center gap-2">
            <Settings className={cn("text-primary", isMobileView ? "w-4 h-4" : "w-5 h-5")} />
            <h2 className={cn("font-semibold", isMobileView ? "text-sm" : "text-lg")}>Admin</h2>
          </div>
          <Button variant="ghost" size="icon" className={isMobileView ? "h-8 w-8" : ""} onClick={() => setIsOpen(false)}>
            <X className={isMobileView ? "w-4 h-4" : "w-5 h-5"} />
          </Button>
        </div>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className={cn("flex flex-col", isMobileView ? "h-[calc(95vh-60px)]" : "h-[calc(85vh-80px)]")}>
          <div className="border-b border-border bg-muted/30 px-2 overflow-x-auto">
            <TabsList className={cn("w-full justify-start gap-1 bg-transparent p-0", isMobileView ? "h-10" : "h-12")}>
              {isSuperAdmin && (
                <TabsTrigger 
                  value="super-admin" 
                  className={cn(
                    "flex items-center gap-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300",
                    isMobileView ? "text-xs px-2" : "gap-2"
                  )}
                >
                  <Crown className={isMobileView ? "w-3 h-3" : "w-4 h-4"} />
                  <span className={isMobileView ? "" : "hidden sm:inline"}>Super</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="pricing" className={cn("flex items-center", isMobileView ? "gap-1 text-xs px-2" : "gap-2")}>
                <DollarSign className={isMobileView ? "w-3 h-3" : "w-4 h-4"} />
                <span className={isMobileView ? "" : "hidden sm:inline"}>Tarifs</span>
              </TabsTrigger>
              <TabsTrigger value="content" className={cn("flex items-center", isMobileView ? "gap-1 text-xs px-2" : "gap-2")}>
                <Image className={isMobileView ? "w-3 h-3" : "w-4 h-4"} />
                <span className={isMobileView ? "" : "hidden sm:inline"}>Contenu</span>
              </TabsTrigger>
              <TabsTrigger value="users" className={cn("flex items-center", isMobileView ? "gap-1 text-xs px-2" : "gap-2")}>
                <Users className={isMobileView ? "w-3 h-3" : "w-4 h-4"} />
                <span className={isMobileView ? "" : "hidden sm:inline"}>Users</span>
              </TabsTrigger>
              <TabsTrigger value="config" className={cn("flex items-center", isMobileView ? "gap-1 text-xs px-2" : "gap-2")}>
                <MessageSquare className={isMobileView ? "w-3 h-3" : "w-4 h-4"} />
                <span className={isMobileView ? "" : "hidden sm:inline"}>Config</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className={cn("flex-1 overflow-y-auto", isMobileView ? "p-3" : "p-4")}>
            {/* Super Admin Tab */}
            {isSuperAdmin && (
              <TabsContent value="super-admin" className="mt-0 space-y-4">
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <h3 className="font-semibold text-amber-200">Zone Super Admin</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Gérez les rôles, tarifs des services, le catalogue d'instrumentales et le DAW.
                  </p>
                </div>
                <AdminDawConfig />
                <AdminRoleManager />
                <AdminServicesPricing />
                <AdminInstrumentals />
              </TabsContent>
            )}

            {/* Pricing Tab */}
            <TabsContent value="pricing" className="mt-0 space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Promotions & Fonctionnalités</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Gérez les codes promo et les fonctionnalités des services.
                </p>
              </div>
              <AdminPromoCodeManager />
              <AdminServiceFeatures />
            </TabsContent>

            {/* Content Tab */}
            <TabsContent value="content" className="mt-0 space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Image className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Galerie Photos</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Gérez la galerie photos du studio.
                </p>
              </div>
              <AdminGallery />
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="mt-0 space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Utilisateurs & Sécurité</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Gérez les utilisateurs inscrits et la sécurité.
                </p>
              </div>
              <AdminUserManagement />
              <AdminActivitySecurity />
            </TabsContent>

            {/* Config Tab */}
            <TabsContent value="config" className="mt-0 space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Configuration</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Configurez les paiements, le chatbot et autres paramètres.
                </p>
              </div>
              <AdminPaymentConfig />
              <AdminChatbotConfig />
            </TabsContent>

            <div className="pt-4 mt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Panneau réservé aux administrateurs
              </p>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;
