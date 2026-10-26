import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { PublicLayout } from './components/layout/PublicLayout';
import {
  ProtectedRoute,
  RequireAdmin,
  RequireApprovedHospital,
} from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';

import { LandingPage } from './pages/public/LandingPage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { AboutPage } from './pages/public/AboutPage';
import { FaqPage } from './pages/public/FaqPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { PrivacyPage } from './pages/public/PrivacyPage';
import { TermsPage } from './pages/public/TermsPage';
import { UnauthorizedPage } from './pages/public/UnauthorizedPage';
import { NotFoundPage } from './pages/public/NotFoundPage';

import { DashboardPage } from './pages/app/DashboardPage';
import { ProfilePage } from './pages/app/ProfilePage';
import { DonorProfilePage } from './pages/app/DonorProfilePage';
import { RequestsFeedPage } from './pages/app/RequestsFeedPage';
import { NewRequestPage } from './pages/app/NewRequestPage';
import { RequestDetailPage } from './pages/app/RequestDetailPage';
import { MyRequestsPage } from './pages/app/MyRequestsPage';
import { MyResponsesPage } from './pages/app/MyResponsesPage';
import { NotificationsPage } from './pages/app/NotificationsPage';
import { BlockchainStatusPage } from './pages/app/BlockchainStatusPage';
import { HospitalApplicationPage } from './pages/app/HospitalApplicationPage';
import { HospitalDashboardPage } from './pages/app/HospitalDashboardPage';
import { HospitalQueuePage } from './pages/app/HospitalQueuePage';
import { HospitalAuditPage } from './pages/app/HospitalAuditPage';
import { AdminDashboardPage } from './pages/app/AdminDashboardPage';
import { AdminUsersPage } from './pages/app/AdminUsersPage';
import { AdminRequestsPage } from './pages/app/AdminRequestsPage';
import { AdminHospitalsPage } from './pages/app/AdminHospitalsPage';
import { AdminAuditPage } from './pages/app/AdminAuditPage';

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
    <Routes>
      {/* Public site */}
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
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
  );
}
