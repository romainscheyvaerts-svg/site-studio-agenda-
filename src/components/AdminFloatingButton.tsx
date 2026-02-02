import { useState } from "react";
import { Settings } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import AdminPanel from "./AdminPanel";
import { cn } from "@/lib/utils";

const AdminFloatingButton = () => {
  const { isAdmin } = useAdmin();
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Only show for admins
  if (!isAdmin) return null;

  return (
    <>
      {/* Floating Admin Button - Fixed position */}
      {!showAdminPanel && (
        <button
          onClick={() => setShowAdminPanel(true)}
          className={cn(
            "fixed bottom-6 right-6 z-40",
            "w-14 h-14 rounded-full",
            "bg-gradient-to-r from-primary to-purple-600",
            "shadow-lg shadow-primary/30",
            "flex items-center justify-center",
            "hover:scale-110 transition-transform duration-200",
            "border-2 border-primary/50"
          )}
          title="Admin Panel"
        >
          <Settings className="w-6 h-6 text-background" />
        </button>
      )}

      {/* Admin Panel Modal */}
      <AdminPanel 
        externalOpen={showAdminPanel} 
        onClose={() => setShowAdminPanel(false)} 
      />
    </>
  );
};

export default AdminFloatingButton;
