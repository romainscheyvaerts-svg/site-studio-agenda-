import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type ViewMode = "auto" | "mobile" | "desktop";

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isMobileView: boolean;
  isActuallyMobile: boolean;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export const ViewModeProvider = ({ children }: { children: ReactNode }) => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("viewMode");
    return (saved as ViewMode) || "auto";
  });
  const [isActuallyMobile, setIsActuallyMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsActuallyMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    localStorage.setItem("viewMode", viewMode);
  }, [viewMode]);

  const isMobileView = viewMode === "mobile" || (viewMode === "auto" && isActuallyMobile);

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, isMobileView, isActuallyMobile }}>
      {children}
    </ViewModeContext.Provider>
  );
};

export const useViewMode = () => {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return context;
};
