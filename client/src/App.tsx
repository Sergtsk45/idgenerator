import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TelegramThemeProvider } from "@/components/TelegramThemeProvider";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Works from "@/pages/Works";
import WorkLog from "@/pages/WorkLog";
import Acts from "@/pages/Acts";
import Schedule from "@/pages/Schedule";
import Settings from "@/pages/Settings";
import SourceData from "@/pages/SourceData";
import SourceMaterials from "@/pages/SourceMaterials";
import SourceMaterialDetail from "@/pages/SourceMaterialDetail";
import SourceDocuments from "@/pages/SourceDocuments";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/works" component={Works} />
      <Route path="/worklog" component={WorkLog} />
      <Route path="/acts" component={Acts} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/source-data" component={SourceData} />
      <Route path="/source/materials" component={SourceMaterials} />
      <Route path="/source/materials/:id" component={SourceMaterialDetail} />
      <Route path="/source/documents" component={SourceDocuments} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TelegramThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </TelegramThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
