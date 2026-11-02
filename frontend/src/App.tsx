import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { PublicLayout } from './components/layout/PublicLayout';
import {
  ProtectedRoute,
  RequireAdmin,
  RequireApprovedHospital,
} from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { PageLoader } from './components/ui/States';

import { LandingPage } from './pages/public/LandingPage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { AboutPage } from './pages/public/AboutPage';
import { FaqPage } from './pages/public/FaqPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { ForgotPasswordPage } from './pages/public/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/public/ResetPasswordPage';
import { PrivacyPage } from './pages/public/PrivacyPage';
import { TermsPage } from './pages/public/TermsPage';
import { UnauthorizedPage } from './pages/public/UnauthorizedPage';
import { NotFoundPage } from './pages/public/NotFoundPage';

// Secondary authenticated routes are split out of the public bundle. The
// landing page, auth flow and public information pages stay eager so the first
// paint never waits on a workspace chunk.
const DashboardPage = lazy(() =>
  import('./pages/app/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const ProfilePage = lazy(() =>
  import('./pages/app/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const DonorProfilePage = lazy(() =>
  import('./pages/app/DonorProfilePage').then((module) => ({ default: module.DonorProfilePage })),
);
const RequestsFeedPage = lazy(() =>
  import('./pages/app/RequestsFeedPage').then((module) => ({ default: module.RequestsFeedPage })),
);
const NewRequestPage = lazy(() =>
  import('./pages/app/NewRequestPage').then((module) => ({ default: module.NewRequestPage })),
);
const RequestDetailPage = lazy(() =>
  import('./pages/app/RequestDetailPage').then((module) => ({ default: module.RequestDetailPage })),
);
const MyRequestsPage = lazy(() =>
  import('./pages/app/MyRequestsPage').then((module) => ({ default: module.MyRequestsPage })),
);
const MyResponsesPage = lazy(() =>
  import('./pages/app/MyResponsesPage').then((module) => ({ default: module.MyResponsesPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/app/NotificationsPage').then((module) => ({ default: module.NotificationsPage })),
);
const BlockchainStatusPage = lazy(() =>
  import('./pages/app/BlockchainStatusPage').then((module) => ({
    default: module.BlockchainStatusPage,
  })),
);
const HospitalApplicationPage = lazy(() =>
  import('./pages/app/HospitalApplicationPage').then((module) => ({
    default: module.HospitalApplicationPage,
  })),
);
const HospitalDashboardPage = lazy(() =>
  import('./pages/app/HospitalDashboardPage').then((module) => ({
    default: module.HospitalDashboardPage,
  })),
);
const HospitalQueuePage = lazy(() =>
  import('./pages/app/HospitalQueuePage').then((module) => ({ default: module.HospitalQueuePage })),
);
const HospitalAuditPage = lazy(() =>
  import('./pages/app/HospitalAuditPage').then((module) => ({ default: module.HospitalAuditPage })),
);
const AdminDashboardPage = lazy(() =>
  import('./pages/app/AdminDashboardPage').then((module) => ({
    default: module.AdminDashboardPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import('./pages/app/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })),
);
const AdminRequestsPage = lazy(() =>
  import('./pages/app/AdminRequestsPage').then((module) => ({ default: module.AdminRequestsPage })),
);
const AdminHospitalsPage = lazy(() =>
  import('./pages/app/AdminHospitalsPage').then((module) => ({
    default: module.AdminHospitalsPage,
  })),
);
const AdminAuditPage = lazy(() =>
  import('./pages/app/AdminAuditPage').then((module) => ({ default: module.AdminAuditPage })),
);

/**
 * Alias routes exist so the URLs named in the project specification resolve.
 * The canonical workspace lives under /app/*; aliases redirect rather than
 * duplicating the route tree, which would risk diverging authorization guards.
 */
function RequestAlias() {
  const { id } = useParams();
  return <Navigate to={id ? `/app/requests/${id}` : '/app/requests'} replace />;
}

export function App() {
  return (
    <Suspense fallback={<PageLoader label="Loading this section…" />}>
      <Routes>
      {/* Public site */}
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Authenticated workspace */}
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="donor" element={<DonorProfilePage />} />
          <Route path="requests" element={<RequestsFeedPage />} />
          <Route path="requests/new" element={<NewRequestPage />} />
          <Route path="requests/:id" element={<RequestDetailPage />} />
          <Route path="my-requests" element={<MyRequestsPage />} />
          <Route path="my-responses" element={<MyResponsesPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="blockchain" element={<BlockchainStatusPage />} />
          <Route path="hospital/application" element={<HospitalApplicationPage />} />

          <Route path="hospital" element={<RequireApprovedHospital />}>
            <Route index element={<HospitalDashboardPage />} />
            <Route path="queue" element={<HospitalQueuePage />} />
            <Route path="requests/:id" element={<RequestDetailPage />} />
            <Route path="audit" element={<HospitalAuditPage />} />
          </Route>

          <Route path="admin" element={<RequireAdmin />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="requests" element={<AdminRequestsPage />} />
            <Route path="requests/:id" element={<RequestDetailPage />} />
            <Route path="hospitals" element={<AdminHospitalsPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
          </Route>
        </Route>
      </Route>

      {/* Specification aliases */}
      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
      <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
      <Route path="/requests" element={<Navigate to="/app/requests" replace />} />
      <Route path="/requests/new" element={<Navigate to="/app/requests/new" replace />} />
      <Route path="/requests/:id" element={<RequestAlias />} />
      <Route path="/my-requests" element={<Navigate to="/app/my-requests" replace />} />
      <Route path="/my-responses" element={<Navigate to="/app/my-responses" replace />} />
      <Route path="/notifications" element={<Navigate to="/app/notifications" replace />} />
      <Route path="/blockchain" element={<Navigate to="/app/blockchain" replace />} />
      <Route path="/hospital/apply" element={<Navigate to="/app/hospital/application" replace />} />
      <Route path="/hospital/dashboard" element={<Navigate to="/app/hospital" replace />} />
      <Route
        path="/hospital/verification-queue"
        element={<Navigate to="/app/hospital/queue" replace />}
      />
      <Route path="/hospital/requests/:id" element={<RequestAlias />} />
      <Route path="/hospital/audit" element={<Navigate to="/app/hospital/audit" replace />} />
      <Route path="/admin/dashboard" element={<Navigate to="/app/admin" replace />} />
      <Route path="/admin/users" element={<Navigate to="/app/admin/users" replace />} />
      <Route path="/admin/requests" element={<Navigate to="/app/admin/requests" replace />} />
      <Route path="/admin/hospitals" element={<Navigate to="/app/admin/hospitals" replace />} />
      <Route path="/admin/audit" element={<Navigate to="/app/admin/audit" replace />} />
      </Routes>
    </Suspense>
  );
}
