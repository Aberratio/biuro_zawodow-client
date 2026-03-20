import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MockDataProvider } from "@/contexts/MockDataContext";
import { Layout } from "@/components/Layout";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import EventDetails from "./pages/EventDetails";
import Participants from "./pages/Participants";
import ParticipantDetails from "./pages/ParticipantDetails";
import Scanner from "./pages/Scanner";
import CsvImport from "./pages/CsvImport";
import UserManagement from "./pages/UserManagement";
import EmailSending from "./pages/EmailSending";
import Organizations from "./pages/Organizations";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Login />;

  return (
    <MockDataProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetails />} />
            <Route path="/participants" element={<Participants />} />
            <Route path="/participants/:id" element={<ParticipantDetails />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/import" element={<CsvImport />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/emails" element={<EmailSending />} />
            <Route path="/organizations" element={<Organizations />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </MockDataProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
