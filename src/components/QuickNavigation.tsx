import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Mic, Euro, Headphones, Music, AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/hooks/useViewMode";
import { useTranslation } from "react-i18next";

interface NavItem {
  path: string;
  labelKey: string;
  shortLabelKey: string;
  icon: React.ReactNode;
  color: string;
}

const navItems: NavItem[] = [
  { 
    path: "/reservation", 
    labelKey: "quick_nav.book", 
    shortLabelKey: "quick_nav.book",
    icon: <Mic className="w-3 h-3" />,
    color: "text-primary border-primary/50 hover:bg-primary/10"
  },
  { 
    path: "/offres", 
    labelKey: "quick_nav.offers", 
    shortLabelKey: "quick_nav.offers",
    icon: <Euro className="w-3 h-3" />,
    color: "text-primary border-primary/50 hover:bg-primary/10"
  },
  { 
    path: "/arsenal", 
    labelKey: "quick_nav.studio", 
    shortLabelKey: "quick_nav.studio",
    icon: <Headphones className="w-3 h-3" />,
    color: "text-muted-foreground border-border hover:bg-secondary/50"
  },
  { 
    path: "/instrumentals", 
    labelKey: "quick_nav.beats", 
    shortLabelKey: "quick_nav.beats",
    icon: <Music className="w-3 h-3" />,
    color: "text-accent border-accent/50 hover:bg-accent/10"
  },
  { 
    path: "/daw", 
    labelKey: "quick_nav.daw", 
    shortLabelKey: "quick_nav.daw",
    icon: <AudioLines className="w-3 h-3" />,
    color: "text-purple-400 border-purple-500/50 hover:bg-purple-500/10"
  },
];

const QuickNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobileView } = useViewMode();
  const { t } = useTranslation();

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
        <span className={isMobileView ? "sr-only" : ""}>{t("quick_nav.home")}</span>
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
            {t(item.shortLabelKey)}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default QuickNavigation;
