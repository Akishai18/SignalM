import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import PredictionsPageNew from "./pages/PredictionsPageNew";
import CorrelationPage from "./pages/CorrelationPage";
import VolatilityPage from "./pages/VolatilityPage";
import FactorsPage from "./pages/FactorsPage";
import UploadPage from "./pages/UploadPage";
import DatasetDashboardPage from "./pages/DatasetDashboardPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/predictions" element={<PredictionsPageNew />} />
          <Route path="/correlation" element={<CorrelationPage />} />
          <Route path="/volatility" element={<VolatilityPage />} />
          <Route path="/factors" element={<FactorsPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/upload/:datasetId" element={<DatasetDashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
