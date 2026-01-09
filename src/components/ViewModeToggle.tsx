import { Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";

const ViewModeToggle = () => {
  const { viewMode, setViewMode, isMobileView } = useViewMode();

  const toggleMode = () => {
    if (viewMode === "auto") {
      setViewMode(isMobileView ? "desktop" : "mobile");
    } else if (viewMode === "mobile") {
      setViewMode("desktop");
    } else {
      setViewMode("mobile");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleMode}
      className={cn(
        "relative h-8 w-8 rounded-full",
        "bg-muted/50 hover:bg-muted border border-border/50"
      )}
      title={isMobileView ? "Passer en mode PC" : "Passer en mode Mobile"}
    >
      {isMobileView ? (
        <Monitor className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Smartphone className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
};

export default ViewModeToggle;
