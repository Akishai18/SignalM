import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Index from "./pages/Index";
import PredictionsPageNew from "./pages/PredictionsPageNew";
import CorrelationPage from "./pages/CorrelationPage";
import VolatilityPage from "./pages/VolatilityPage";
import FactorsPage from "./pages/FactorsPage";
import UploadPage from "./pages/UploadPage";
import DatasetDashboardPage from "./pages/DatasetDashboardPage";
import SettingsPage from "./pages/SettingsPage";
import BacktesterPage from "./pages/BacktesterPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected — all dashboard routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Index />} />
              <Route path="/predictions" element={<PredictionsPageNew />} />
              <Route path="/correlation" element={<CorrelationPage />} />
              <Route path="/volatility" element={<VolatilityPage />} />
              <Route path="/factors" element={<FactorsPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/upload/:datasetId" element={<DatasetDashboardPage />} />
              <Route path="/backtester" element={<BacktesterPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AuthProvider>
);

export default App;
