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
import { supabase } from "@/integrations/supabase/client";

interface AdminPanelProps {
  inline?: boolean;
}

const SUPER_ADMIN_EMAILS = ["prod.makemusic@gmail.com", "romain.scheyvaerts@gmail.com"];

const AdminPanel = ({ inline = false }: AdminPanelProps) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-card border border-border rounded-lg shadow-xl overflow-hidden">
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

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-[calc(85vh-80px)]">
          <div className="border-b border-border bg-muted/30 px-2">
            <TabsList className="h-12 w-full justify-start gap-1 bg-transparent p-0">
              {isSuperAdmin && (
                <TabsTrigger 
                  value="super-admin" 
                  className="flex items-center gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300"
                >
                  <Crown className="w-4 h-4" />
                  <span className="hidden sm:inline">Super Admin</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="pricing" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span className="hidden sm:inline">Tarifs</span>
              </TabsTrigger>
              <TabsTrigger value="content" className="flex items-center gap-2">
                <Music className="w-4 h-4" />
                <span className="hidden sm:inline">Contenu</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Utilisateurs</span>
              </TabsTrigger>
              <TabsTrigger value="config" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Config</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Super Admin Tab */}
            {isSuperAdmin && (
              <TabsContent value="super-admin" className="mt-0 space-y-4">
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <h3 className="font-semibold text-amber-200">Zone Super Admin</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Gérez les rôles administrateurs et les accès privilégiés.
                  </p>
                </div>
                <AdminRoleManager />
              </TabsContent>
            )}

            {/* Pricing Tab */}
            <TabsContent value="pricing" className="mt-0 space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Tarification & Promotions</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Gérez les prix des services et les codes promo.
                </p>
              </div>
              <AdminPromoCodeManager />
              <AdminServicesPricing />
              <AdminServiceFeatures />
            </TabsContent>

            {/* Content Tab */}
            <TabsContent value="content" className="mt-0 space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Music className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Contenu & Médias</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Gérez les instrumentales et la galerie photos.
                </p>
              </div>
              <AdminInstrumentals />
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
                  Configurez le chatbot et autres paramètres.
                </p>
              </div>
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
