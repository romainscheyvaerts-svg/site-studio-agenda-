import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ViewModeProvider } from "@/hooks/useViewMode";
import { StudioProvider } from "@/hooks/useStudio";
import ProtectedRoute from "@/components/ProtectedRoute";
import BackgroundImage from "@/components/BackgroundImage";

// Platform pages (no studio context)
import Landing from "./pages/Landing";
import RegisterStudio from "./pages/RegisterStudio";
import StudioPending from "./pages/StudioPending";
import SuperAdmin from "./pages/SuperAdmin";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Studio pages (inside StudioProvider)
import Index from "./pages/Index";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import Instrumentals from "./pages/Instrumentals";
import InstrumentalCheckout from "./pages/InstrumentalCheckout";
import Download from "./pages/Download";
import Studio from "./pages/Studio";
import StudioMusic from "./pages/StudioMusic";
import DawNova from "./pages/DawNova";
import StudioGalleryPage from "./pages/StudioGallery";
import BookingAction from "./pages/BookingAction";
import BookingStatus from "./pages/BookingStatus";
import Arsenal from "./pages/Arsenal";
import Offres from "./pages/Offres";
import Reservation from "./pages/Reservation";
import MyPurchases from "./pages/MyPurchases";
import MyAccount from "./pages/MyAccount";
import StudioSettings from "./pages/StudioSettings";
import AdminFloatingButton from "./components/AdminFloatingButton";

const queryClient = new QueryClient();

// Wrapper for studio-scoped routes
const StudioLayout = () => (
  <StudioProvider>
    <ViewModeProvider>
      <BackgroundImage />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/arsenal" element={<Arsenal />} />
        <Route path="/offres" element={<Offres />} />
        <Route path="/reservation" element={<Reservation />} />
        <Route path="/instrumentals" element={<Instrumentals />} />
        <Route path="/mes-achats" element={<MyPurchases />} />
        <Route path="/mon-compte" element={<MyAccount />} />
        <Route path="/checkout/instrumental/:instrumentalId/:licenseId" element={<InstrumentalCheckout />} />
        <Route path="/download/:token" element={<Download />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/studiomusic" element={<StudioMusic />} />
        <Route path="/daw" element={<DawNova />} />
        <Route path="/gallery" element={<StudioGalleryPage />} />
        <Route path="/success" element={<PaymentSuccess />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/cancel" element={<PaymentCancel />} />
        <Route path="/booking-action" element={<BookingAction />} />
        <Route path="/booking-status" element={<BookingStatus />} />
        <Route path="/settings" element={<StudioSettings />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <AdminFloatingButton />
    </ViewModeProvider>
  </StudioProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Platform-level routes (no studio context) */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/register-studio" element={<RegisterStudio />} />
            <Route path="/studio-pending" element={<StudioPending />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
            
            {/* Studio-scoped routes: /s/:studioSlug/* */}
            <Route path="/s/:studioSlug/*" element={<StudioLayout />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
