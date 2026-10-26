import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../context/AuthContext';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import type { Me } from '../types/api';

const baseAuth: AuthContextValue = {
  status: 'unauthenticated',
  session: null,
  token: null,
  me: null,
  error: null,
  refreshMe: vi.fn(async () => undefined),
  signIn: vi.fn(async () => undefined),
  signUp: vi.fn(async () => ({ needsConfirmation: false })),
  signOut: vi.fn(async () => undefined),
};

function makeMe(): Me {
  return {
    user: { id: '22222222-2222-4222-8222-222222222222', email: 'requester@example.test' },
    profile: {
      id: '22222222-2222-4222-8222-222222222222',
      fullName: 'Test Requester',
      phoneNumber: '+910000000000',
      city: 'Pune',
      area: 'Central district',
      postalCode: null,
      accountStatus: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    roles: ['REQUESTER'],
    permissions: {
      isAdmin: false,
      isDonor: false,
      isHospital: false,
      isApprovedVerifier: false,
    },
    profileComplete: true,
    donorProfile: null,
    hospitalProfile: null,
    unreadNotifications: 0,
  };
}

function renderGuard(auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/app" element={<ProtectedRoute />}>
            <Route index element={<div>protected workspace</div>} />
          </Route>
          <Route path="/login" element={<div>login screen</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects an unauthenticated visitor to the login screen', () => {
    renderGuard(baseAuth);
    expect(screen.getByText('login screen')).toBeInTheDocument();
    expect(screen.queryByText('protected workspace')).not.toBeInTheDocument();
  });

  it('renders the workspace for an authenticated account', () => {
    renderGuard({ ...baseAuth, status: 'authenticated', me: makeMe() });
    expect(screen.getByText('protected workspace')).toBeInTheDocument();
  });

  it('shows configuration instructions instead of a blank screen', () => {
    renderGuard({ ...baseAuth, status: 'unconfigured' });
    expect(
      screen.getByRole('heading', { name: /connect the frontend to supabase/i }),
    ).toBeInTheDocument();
  });

  it('shows a recoverable error state when the API fails', () => {
    renderGuard({
      ...baseAuth,
      status: 'error',
      error: 'The API could not be reached.',
    });
    expect(
      screen.getByRole('heading', { name: /we could not open your workspace/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('The API could not be reached.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
