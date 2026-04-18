import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider, useData } from "@/contexts/DataContext";
import { Layout } from "@/components/Layout";
import { RouteSeo } from "@/components/RouteSeo";
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
import ArchivedEvents from "./pages/ArchivedEvents";
import ForgotPassword from "./pages/ForgotPassword";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import ScannerInfo from "./pages/ScannerInfo";
import Forbidden from "./pages/Forbidden";
import NotFound from "./pages/NotFound";
import Unauthorized from "./pages/Unauthorized";
import { isScannerRole } from "@/lib/roles";

const queryClient = new QueryClient();

function HomeRoute() {
  const { currentRole, visibleEvents } = useData();

  if (isScannerRole(currentRole)) {
    return (
      <Navigate
        to={visibleEvents.length > 0 ? "/scanner" : "/scanner-info"}
        replace
      />
    );
  }

  return <Dashboard />;
}

function ScannerParticipantsRoute() {
  const { currentRole, visibleEvents } = useData();

  if (isScannerRole(currentRole) && visibleEvents.length === 0) {
    return <Navigate to="/scanner-info" replace />;
  }

  return <Participants />;
}

function ScannerRoute() {
  const { currentRole, visibleEvents } = useData();

  if (isScannerRole(currentRole) && visibleEvents.length === 0) {
    return <Navigate to="/scanner-info" replace />;
  }

  return <Scanner />;
}

function ScannerInfoRoute() {
  const { currentRole, visibleEvents } = useData();

  if (!isScannerRole(currentRole)) {
    return <Forbidden />;
  }

  if (visibleEvents.length > 0) {
    return <Navigate to="/scanner" replace />;
  }

  return <ScannerInfo />;
}

function ImportRedirect() {
  const { selectedEventId } = useData();

  if (!selectedEventId) {
    return <NotFound />;
  }

  return <Navigate to={`/events/${selectedEventId}/import`} replace />;
}

function EventAccessRoute({
  children,
  allowArchivedView = false,
}: {
  children: JSX.Element;
  allowArchivedView?: boolean;
}) {
  const { id } = useParams<{ id: string }>();
  const { events, archivedEvents, canAccessEvent, canViewEvent, isLoading } =
    useData();

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
        Sprawdzamy trasę do wydarzenia...
      </div>
    );
  }

  if (
    !id ||
    (!events.some((event) => event.id === id) &&
      !archivedEvents.some((event) => event.id === id))
  ) {
    return <NotFound />;
  }

  if (allowArchivedView ? !canViewEvent(id) : !canAccessEvent(id)) {
    return <Forbidden />;
  }

  return children;
}

function ParticipantAccessRoute({ children }: { children: JSX.Element }) {
  const { id } = useParams<{ id: string }>();
  const { participants, canAccessEvent, isLoading } = useData();

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
        Szukamy zawodnika na liście...
      </div>
    );
  }

  const participant = participants.find((entry) => entry.id === id);
  if (!participant) {
    return <NotFound />;
  }

  if (!participant.event_id || !canAccessEvent(participant.event_id)) {
    return <Forbidden />;
  }

  return children;
}

function OrganizationAccessRoute({ children }: { children: JSX.Element }) {
  const { id } = useParams<{ id: string }>();
  const { organizations, currentRole, currentUser, isLoading } = useData();

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
        Sprawdzamy organizację...
      </div>
    );
  }

  const organization = organizations.find((entry) => entry.id === id);
  if (!organization) {
    return <NotFound />;
  }

  const allowed =
    currentRole === "superadmin" ||
    currentRole === "admin" ||
    currentUser.organization_id === organization.id;

  if (!allowed) {
    return <Forbidden />;
  }

  return children;
}

function ProtectedAppRoutes() {
  return (
    <DataProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/events" element={<Events />} />
          <Route
            path="/events/:id"
            element={
              <EventAccessRoute allowArchivedView>
                <EventDetails />
              </EventAccessRoute>
            }
          />
          <Route
            path="/events/:id/import"
            element={
              <EventAccessRoute>
                <CsvImport />
              </EventAccessRoute>
            }
          />
          <Route path="/participants" element={<ScannerParticipantsRoute />} />
          <Route
            path="/participants/:id"
            element={
              <ParticipantAccessRoute>
                <ParticipantDetails />
              </ParticipantAccessRoute>
            }
          />
          <Route path="/scanner" element={<ScannerRoute />} />
          <Route path="/scanner-info" element={<ScannerInfoRoute />} />
          <Route path="/import" element={<ImportRedirect />} />
          <Route path="/emails" element={<EmailSending />} />
          <Route path="/organizations" element={<Organizations />} />
          <Route
            path="/organizations/:id"
            element={
              <OrganizationAccessRoute>
                <OrganizationDetails />
              </OrganizationAccessRoute>
            }
          />
          <Route
            path="/organizations/:id/archived-events"
            element={
              <OrganizationAccessRoute>
                <ArchivedEvents />
              </OrganizationAccessRoute>
            }
          />
          <Route path="/users" element={<Organizations />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/403" element={<Forbidden />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </DataProvider>
  );
}

function AppRoutes() {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Trwa weryfikacja sesji...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/401" element={<Unauthorized />} />
      <Route path="/403" element={<Forbidden />} />
      <Route path="/404" element={<NotFound />} />
      <Route
        path="/forgot-password"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <ForgotPassword />
        }
      />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
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
          <RouteSeo />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
