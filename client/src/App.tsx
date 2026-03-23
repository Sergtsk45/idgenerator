import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TelegramThemeProvider } from "@/components/TelegramThemeProvider";
import { AuthGuard } from "@/components/AuthGuard";
import { AdminGuard } from "@/components/AdminGuard";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Works from "@/pages/Works";
import WorkLog from "@/pages/WorkLog";
import Acts from "@/pages/Acts";
import ActDetail from "@/pages/ActDetail";
import Schedule from "@/pages/Schedule";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import SourceData from "@/pages/SourceData";
import SourceMaterials from "@/pages/SourceMaterials";
import SourceMaterialDetail from "@/pages/SourceMaterialDetail";
import SourceDocuments from "@/pages/SourceDocuments";
import SelectActTemplate from "@/pages/SelectActTemplate";
import SelectTaskMaterials from "@/pages/SelectTaskMaterials";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminMessages from "@/pages/admin/AdminMessages";
import AdminMaterials from "@/pages/admin/AdminMaterials";
import { Objects } from "@/pages/Objects";

function Router() {
  return (
    <Switch>
      {/* Публичные роуты */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Защищённые роуты */}
      <Route path="/">
        <AuthGuard>
          <Home />
        </AuthGuard>
      </Route>
      <Route path="/works">
        <AuthGuard>
          <Works />
        </AuthGuard>
      </Route>
      <Route path="/worklog">
        <AuthGuard>
          <WorkLog />
        </AuthGuard>
      </Route>
      <Route path="/acts">
        <AuthGuard>
          <Acts />
        </AuthGuard>
      </Route>
      <Route path="/acts/:id">
        {(params) => (
          <AuthGuard>
            <ActDetail params={params} />
          </AuthGuard>
        )}
      </Route>
      <Route path="/schedule">
        <AuthGuard>
          <Schedule />
        </AuthGuard>
      </Route>
      <Route path="/source-data">
        <AuthGuard>
          <SourceData />
        </AuthGuard>
      </Route>
      <Route path="/source/materials">
        <AuthGuard>
          <SourceMaterials />
        </AuthGuard>
      </Route>
      <Route path="/source/materials/:id">
        {(params) => (
          <AuthGuard>
            <SourceMaterialDetail params={params} />
          </AuthGuard>
        )}
      </Route>
      <Route path="/source/documents">
        <AuthGuard>
          <SourceDocuments />
        </AuthGuard>
      </Route>
      <Route path="/select-act-template">
        <AuthGuard>
          <SelectActTemplate />
        </AuthGuard>
      </Route>
      <Route path="/select-task-materials">
        <AuthGuard>
          <SelectTaskMaterials />
        </AuthGuard>
      </Route>
      <Route path="/objects">
        <AuthGuard>
          <Objects />
        </AuthGuard>
      </Route>
      <Route path="/settings">
        <AuthGuard>
          <Settings />
        </AuthGuard>
      </Route>
      
      {/* Admin Panel - защищённые роуты с RBAC-проверкой */}
      <Route path="/admin">
        <AdminGuard>
          <AdminDashboard />
        </AdminGuard>
      </Route>
      <Route path="/admin/users">
        <AdminGuard>
          <AdminUsers />
        </AdminGuard>
      </Route>
      <Route path="/admin/messages">
        <AdminGuard>
          <AdminMessages />
        </AdminGuard>
      </Route>
      <Route path="/admin/materials">
        <AdminGuard>
          <AdminMaterials />
        </AdminGuard>
      </Route>
      
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
