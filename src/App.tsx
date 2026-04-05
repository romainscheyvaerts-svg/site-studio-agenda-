import { lazy, Suspense } from "react";
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
import { Loader2 } from "lucide-react";

// Loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

// Platform pages (lazy loaded)
const Landing = lazy(() => import("./pages/Landing"));
const RegisterStudio = lazy(() => import("./pages/RegisterStudio"));
const StudioPending = lazy(() => import("./pages/StudioPending"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const FeatureDetail = lazy(() => import("./pages/FeatureDetail"));

// Studio pages (lazy loaded)
const Index = lazy(() => import("./pages/Index"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancel = lazy(() => import("./pages/PaymentCancel"));
const Instrumentals = lazy(() => import("./pages/Instrumentals"));
const InstrumentalCheckout = lazy(() => import("./pages/InstrumentalCheckout"));
const Download = lazy(() => import("./pages/Download"));
const Studio = lazy(() => import("./pages/Studio"));
const StudioMusic = lazy(() => import("./pages/StudioMusic"));
const DawNova = lazy(() => import("./pages/DawNova"));
const StudioGalleryPage = lazy(() => import("./pages/StudioGallery"));
const BookingAction = lazy(() => import("./pages/BookingAction"));
const BookingStatus = lazy(() => import("./pages/BookingStatus"));
const Arsenal = lazy(() => import("./pages/Arsenal"));
const Offres = lazy(() => import("./pages/Offres"));
const Reservation = lazy(() => import("./pages/Reservation"));
const MyPurchases = lazy(() => import("./pages/MyPurchases"));
const MyAccount = lazy(() => import("./pages/MyAccount"));
const StudioSettings = lazy(() => import("./pages/StudioSettings"));
const StudioVisualEditor = lazy(() => import("./pages/StudioVisualEditor"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Wrapper for studio-scoped routes
const StudioLayout = () => (
  <StudioProvider>
    <ViewModeProvider>
      <BackgroundImage />
      <Suspense fallback={<PageLoader />}>
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
          <Route path="/visual-editor" element={<StudioVisualEditor />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Platform-level routes (no studio context) */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/register-studio" element={<RegisterStudio />} />
              <Route path="/studio-pending" element={<StudioPending />} />
              <Route path="/super-admin" element={<SuperAdmin />} />
              <Route path="/features/:featureId" element={<FeatureDetail />} />
              
              {/* Studio-scoped routes: /:studioSlug/* */}
              <Route path="/:studioSlug/*" element={<StudioLayout />} />
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
