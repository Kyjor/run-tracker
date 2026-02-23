import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

// Providers
import { DatabaseProvider, useDatabase } from './contexts/DatabaseContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import { PlanProvider } from './contexts/PlanContext';

// Layout
import { TabBar } from './components/navigation/TabBar';
import { ToastContainer } from './components/ui/ToastContainer';
import { Spinner } from './components/ui/Spinner';

// Screens
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AuthScreen } from './screens/AuthScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { LogRunScreen } from './screens/LogRunScreen';
import { StatsScreen } from './screens/StatsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { MyPlansScreen } from './screens/MyPlansScreen';
import { PlanDetailScreen } from './screens/PlanDetailScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { SocialScreen } from './screens/SocialScreen';

// ---------------------------------------------------------------------------
// Gate: show splash until DB is ready, redirect to onboarding if needed
// ---------------------------------------------------------------------------

function AppShell() {
  const { isReady, error } = useDatabase();
  const { settings, isLoaded } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoaded) return;
    const onboardingPaths = ['/onboarding', '/auth'];
    const isOnboarding = onboardingPaths.some(p => location.pathname.startsWith(p));
    if (!settings.onboarding_complete && !isOnboarding) {
      navigate('/onboarding', { replace: true });
    }
  }, [isLoaded, settings.onboarding_complete, location.pathname]);

  if (!isReady || !isLoaded) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center flex-col gap-4">
        {error ? (
          <p className="text-red-500 text-sm px-4 text-center">Database error: {error}</p>
        ) : (
          <>
            <span className="text-5xl">🏃</span>
            <Spinner size="lg" className="text-primary-500" />
          </>
        )}
      </div>
    );
  }

  const isTabRoute =
    location.pathname.startsWith('/home') ||
    location.pathname.startsWith('/calendar') ||
    location.pathname.startsWith('/log') ||
    location.pathname.startsWith('/stats') ||
    location.pathname.startsWith('/profile') ||
    location.pathname.startsWith('/social') ||
    location.pathname.startsWith('/community');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <div className="flex-1 overflow-hidden flex flex-col">
        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/home" replace />} />

          {/* Onboarding & Auth */}
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="/auth" element={<AuthScreen />} />

          {/* Main tabs */}
          <Route path="/home" element={<DashboardScreen />} />
          <Route path="/calendar" element={<CalendarScreen />} />
          <Route path="/log" element={<LogRunScreen />} />
          <Route path="/log/edit/:id" element={<LogRunScreen />} />
          <Route path="/stats" element={<StatsScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />

          {/* Profile sub-routes */}
          <Route path="/profile/plans" element={<MyPlansScreen />} />
          <Route path="/profile/plans/:id" element={<PlanDetailScreen />} />
          <Route path="/profile/goals" element={<GoalsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />

          {/* Social */}
          <Route path="/social" element={<SocialScreen />} />

          {/* Community */}
          <Route path="/community" element={<CommunityScreen />} />
        </Routes>
      </div>

      {/* Tab bar only on main routes */}
      {isTabRoute && <TabBar />}

      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DatabaseProvider>
        <SettingsProvider>
          <ToastProvider>
            <AuthProvider>
              <PlanProvider>
                <AppShell />
              </PlanProvider>
            </AuthProvider>
          </ToastProvider>
        </SettingsProvider>
      </DatabaseProvider>
    </BrowserRouter>
  );
}
