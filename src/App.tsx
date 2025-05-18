import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ImageViewer from "./pages/ImageViewer"; // Import the new ImageViewer page

const queryClient = new QueryClient();

import { useTranslation } from 'react-i18next';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"; // Import ToggleGroup and ToggleGroupItem

const App = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner expand={true} />
        <BrowserRouter>
          <div className="p-4 flex justify-end"> {/* Add some padding and align to the right */}
            <ToggleGroup type="single" value={i18n.language} onValueChange={changeLanguage}>
              <ToggleGroupItem value="en" aria-label="Toggle English">
                English
              </ToggleGroupItem>
              <ToggleGroupItem value="zh" aria-label="Toggle Chinese">
                中文
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/view" element={<ImageViewer />} /> {/* ADDED ImageViewer route */}
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
