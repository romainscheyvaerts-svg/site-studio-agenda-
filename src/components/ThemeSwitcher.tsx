import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface ThemeSwitcherProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "default" | "lg";
}

const ThemeSwitcher = ({ className, iconOnly = true, size = "default" }: ThemeSwitcherProps) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const iconSize = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5";

  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          isDark 
            ? "hover:bg-primary/10 text-foreground" 
            : "hover:bg-primary/10 text-foreground",
          className
        )}
        title={isDark ? "Activer le mode clair" : "Activer le mode sombre"}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Sun icon - visible in dark mode */}
          <Sun 
            className={cn(
              iconSize,
              "absolute transition-all duration-300",
              isDark 
                ? "opacity-100 rotate-0 scale-100" 
                : "opacity-0 rotate-90 scale-0"
            )} 
          />
          {/* Moon icon - visible in light mode */}
          <Moon 
            className={cn(
              iconSize,
              "absolute transition-all duration-300",
              isDark 
                ? "opacity-0 -rotate-90 scale-0" 
                : "opacity-100 rotate-0 scale-100"
            )} 
          />
        </div>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={toggleTheme}
      className={cn(
        "flex items-center gap-2 transition-all duration-300",
        className
      )}
    >
      {isDark ? (
        <>
          <Sun className={iconSize} />
          <span>Mode clair</span>
        </>
      ) : (
        <>
          <Moon className={iconSize} />
          <span>Mode sombre</span>
        </>
      )}
    </Button>
  );
};

export default ThemeSwitcher;
