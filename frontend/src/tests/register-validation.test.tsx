import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../context/AuthContext';
import { RegisterPage } from '../pages/public/RegisterPage';

vi.mock('../lib/env', () => ({
  supabaseConfigured: true,
  configProblems: [],
  env: {
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'public-anon-key',
    apiBaseUrl: 'http://localhost:4000/api/v1',
  },
}));

const auth: AuthContextValue = {
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

function renderRegister(path = '/register') {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <RegisterPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('registration form validation', () => {
  it('rejects an empty submission with field-level messages', async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Enter your full name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(screen.getByText('Confirm your password.')).toBeInTheDocument();
    expect(
      screen.getByText('Confirm that you understand how BloodBridge works.'),
    ).toBeInTheDocument();
  });

  it('preselects the donor account type from the landing-page CTA', () => {
    renderRegister('/register?type=DONOR');
    expect(screen.getByRole('radio', { name: /donor/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /requester/i })).not.toBeChecked();
  });

  it('does not offer administrator or hospital roles at registration', () => {
    renderRegister();
    expect(screen.getByRole('radio', { name: /donor/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /requester/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /administrator/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /hospital/i })).not.toBeInTheDocument();
  });
});
