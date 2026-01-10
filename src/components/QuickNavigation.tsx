import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Mic, Euro, Headphones, Music, AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/hooks/useViewMode";

interface NavItem {
  path: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  color: string;
}

const navItems: NavItem[] = [
  { 
    path: "/reservation", 
    label: "Réserver", 
    shortLabel: "Réserver",
    icon: <Mic className="w-3 h-3" />,
    color: "text-primary border-primary/50 hover:bg-primary/10"
  },
  { 
    path: "/offres", 
    label: "Offres", 
    shortLabel: "Offres",
    icon: <Euro className="w-3 h-3" />,
    color: "text-primary border-primary/50 hover:bg-primary/10"
  },
  { 
    path: "/arsenal", 
    label: "Studio", 
    shortLabel: "Studio",
    icon: <Headphones className="w-3 h-3" />,
    color: "text-muted-foreground border-border hover:bg-secondary/50"
  },
  { 
    path: "/instrumentals", 
    label: "Beats", 
    shortLabel: "Beats",
    icon: <Music className="w-3 h-3" />,
    color: "text-accent border-accent/50 hover:bg-accent/10"
  },
  { 
    path: "/daw", 
    label: "DAW", 
    shortLabel: "DAW",
    icon: <AudioLines className="w-3 h-3" />,
    color: "text-purple-400 border-purple-500/50 hover:bg-purple-500/10"
  },
];

const QuickNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobileView } = useViewMode();

  // Filter out current page from navigation
  const filteredNavItems = navItems.filter(item => item.path !== location.pathname);

  return (
    <div className={cn(
      "flex items-center gap-2 flex-wrap",
      isMobileView ? "mb-4" : "mb-8"
    )}>
      {/* Back to home button */}
      <Button 
        variant="ghost" 
        onClick={() => navigate('/')}
        size="sm"
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className={isMobileView ? "sr-only" : ""}>Accueil</span>
      </Button>

      {/* Separator */}
      <div className="h-4 w-px bg-border" />

      {/* Quick nav buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {filteredNavItems.map((item) => (
          <Button
            key={item.path}
            variant="outline"
            size="sm"
            onClick={() => navigate(item.path)}
            className={cn(
              "h-7 px-2 text-xs gap-1 border",
              item.color
            )}
          >
            {item.icon}
            {item.shortLabel}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default QuickNavigation;