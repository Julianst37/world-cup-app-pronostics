import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy } from 'react';

import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import PrivateRoute from './components/auth/PrivateRoute';
import Layout from './components/layout/Layout';
import Loading from './components/common/Loading';

// Lazy-loaded pages
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./components/auth/Login'));
const ResetPassword = lazy(() => import('./components/auth/ResetPassword'));
const SignUp = lazy(() => import('./components/auth/SignUp'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const Notifications = lazy(() => import('./pages/Notifications'));
const NotFound = lazy(() => import('./pages/NotFound'));


// Tournament components
const CreateTournament = lazy(() => import('./components/tournaments/CreateTournament'));
const TournamentDetail = lazy(() => import('./components/tournaments/TournamentDetail'));
const TournamentHome = lazy(() => import('./components/tournaments/TournamentHome'));
const TournamentSettings = lazy(() => import('./components/tournaments/TournamentSettings'));
const PredictionsList = lazy(() => import('./components/tournaments/PredictionsList'));
const Standings = lazy(() => import('./components/tournaments/Standings'));
const Participants = lazy(() => import('./components/tournaments/Participants'));
const MatchDetail = lazy(() => import('./components/tournaments/MatchDetail'));
const AdminTournament = lazy(() => import('./components/tournaments/AdminTournament'));
const SuperAdminPanel = lazy(() => import('./pages/SuperAdminPanel'));

function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/auth/signup" element={<SignUp />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Layout>
                <ProfilePage />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <PrivateRoute>
              <Layout>
                <Notifications />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/matches"
          element={
            <PrivateRoute>
              <Layout>
                <AdminTournament />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/panel"
          element={
            <PrivateRoute>
              <Layout>
                <SuperAdminPanel />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/tournaments/create"
          element={
            <PrivateRoute>
              <Layout>
                <CreateTournament />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* Tournament routes with nested tabs */}
        <Route
          path="/tournaments/:tournamentId"
          element={
            <PrivateRoute>
              <Layout>
                <TournamentDetail />
              </Layout>
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<TournamentHome />} />
          <Route path="predictions" element={<PredictionsList />} />
          <Route path="standings" element={<Standings />} />
          <Route path="participants" element={<Participants />} />
          <Route path="settings" element={<TournamentSettings />} />
        </Route>

        {/* Match detail */}
        <Route
          path="/matches/:matchId"
          element={
            <PrivateRoute>
              <Layout>
                <MatchDetail />
              </Layout>
            </PrivateRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: '12px',
                fontFamily: 'Inter, sans-serif',
              },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
