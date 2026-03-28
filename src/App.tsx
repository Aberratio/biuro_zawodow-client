import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MockDataProvider, useMockData } from "@/contexts/MockDataContext";
import { Layout } from "@/components/Layout";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import EventDetails from "./pages/EventDetails";
import Participants from "./pages/Participants";
import ParticipantDetails from "./pages/ParticipantDetails";
import Scanner from "./pages/Scanner";
import CsvImport from "./pages/CsvImport";
import EmailSending from "./pages/EmailSending";
import Organizations from "./pages/Organizations";
import OrganizationDetails from "./pages/OrganizationDetails";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import ScannerInfo from "./pages/ScannerInfo";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function HomeRoute() {
  const { currentRole, visibleEvents } = useMockData();

  if (currentRole === "scanner") {
    return <Navigate to={visibleEvents.length > 0 ? "/scanner" : "/scanner-info"} replace />;
  }

  return <Dashboard />;
}

function ScannerParticipantsRoute() {
  const { currentRole, visibleEvents } = useMockData();

  if (currentRole === "scanner" && visibleEvents.length === 0) {
    return <Navigate to="/scanner-info" replace />;
  }

  return <Participants />;
}

function ScannerRoute() {
  const { currentRole, visibleEvents } = useMockData();

  if (currentRole === "scanner" && visibleEvents.length === 0) {
    return <Navigate to="/scanner-info" replace />;
  }

  return <Scanner />;
}

function ScannerInfoRoute() {
  const { currentRole, visibleEvents } = useMockData();

  if (currentRole !== "scanner") {
    return <Navigate to="/" replace />;
  }

  if (visibleEvents.length > 0) {
    return <Navigate to="/scanner" replace />;
  }

  return <ScannerInfo />;
}

function ImportRedirect() {
  const { selectedEventId } = useMockData();
  return <Navigate to={`/events/${selectedEventId}/import`} replace />;
}

function ProtectedAppRoutes() {
  return (
    <MockDataProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetails />} />
          <Route path="/events/:id/import" element={<CsvImport />} />
          <Route path="/participants" element={<ScannerParticipantsRoute />} />
          <Route path="/participants/:id" element={<ParticipantDetails />} />
          <Route path="/scanner" element={<ScannerRoute />} />
          <Route path="/scanner-info" element={<ScannerInfoRoute />} />
          <Route path="/import" element={<ImportRedirect />} />
          <Route path="/emails" element={<EmailSending />} />
          <Route path="/organizations" element={<Organizations />} />
          <Route path="/organizations/:id" element={<OrganizationDetails />} />
          <Route path="/users" element={<Organizations />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </MockDataProvider>
  );
}

function AppRoutes() {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Trwa weryfikacja sesji...</div>;
  }

  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      {isAuthenticated ? (
        <Route path="/*" element={<ProtectedAppRoutes />} />
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
