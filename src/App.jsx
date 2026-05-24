import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { WorkspaceProvider, useWorkspace } from '@/lib/workspace.jsx';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Pipeline from '@/pages/Pipeline';
import ContentDetail from '@/pages/ContentDetail';
import Tasks from '@/pages/Tasks';
import Team from '@/pages/Team';
import Settings from '@/pages/Settings';
import Onboarding from '@/pages/Onboarding';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import GoogleOAuthCallback from '@/pages/GoogleOAuthCallback';

const AppRoutes = () => {
  const { loading, workspaceReady, needsOnboarding } = useWorkspace();

  if (loading || !workspaceReady) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-[hsl(222,47%,6%)]">
        <div className="w-8 h-8 border-4 border-[hsl(262,83%,58%)]/30 border-t-[hsl(262,83%,58%)] rounded-full animate-spin" />
        <p className="text-sm text-[hsl(215,20%,55%)]">Loading workspace...</p>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <Routes>
        <Route path="/login" element={<Navigate to="/onboarding" replace />} />
        <Route path="/signup" element={<Navigate to="/onboarding" replace />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/signup" element={<Navigate to="/" replace />} />
      <Route path="/onboarding" element={<Navigate to="/" replace />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/content/:id" element={<ContentDetail />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/team" element={<Team />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, isAuthenticated, authError } = useAuth();
  const location = useLocation();

  // Must run before auth gates — otherwise Google redirects here while loading and the code is lost
  if (location.pathname === '/integrations/google/callback') {
    return <GoogleOAuthCallback />;
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-[hsl(222,47%,6%)]">
        <div className="w-8 h-8 border-4 border-[hsl(262,83%,58%)]/30 border-t-[hsl(262,83%,58%)] rounded-full animate-spin" />
        <p className="text-sm text-[hsl(215,20%,55%)]">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return (
    <WorkspaceProvider>
      <AppRoutes />
    </WorkspaceProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <Sonner position="bottom-right" theme="dark" richColors closeButton />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
