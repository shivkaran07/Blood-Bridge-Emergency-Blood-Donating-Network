import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, ThemeProvider } from '../context/ThemeContext';
import { ProfilePage } from '../pages/app/ProfilePage';

vi.mock('../context/AuthContext', () => {
  const me = {
    user: { id: 'user-1', email: 'donor@example.com' },
    profile: {
      id: 'profile-1',
      fullName: 'Ada Donor',
      phoneNumber: '+15550100',
      city: 'Manchester',
      area: 'Central',
      postalCode: 'M1 1AA',
      accountStatus: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    roles: ['DONOR'],
    permissions: {
      isAdmin: false,
      isDonor: true,
      isHospital: false,
      isApprovedVerifier: false,
    },
    profileComplete: true,
    emailNotificationsEnabled: false,
    emailNotificationsAvailable: false,
    donorProfile: null,
    hospitalProfile: null,
    unreadNotifications: 0,
  };

  return {
    useAuth: () => ({
      me,
      refreshMe: vi.fn(),
      updatePassword: vi.fn(),
      reauthenticate: vi.fn(),
      signOut: vi.fn(),
    }),
    useAuthToken: () => 'test-token',
  };
});

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('profile appearance settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  it('renders the appearance control and applies a chosen theme', () => {
    renderPage();

    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('explains unavailable email delivery and requires explicit account-closure confirmation', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText(/email delivery is not configured/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close my account/i }));
    expect(screen.getByRole('dialog', { name: /close your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type delete to confirm/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^close account$/i })).toBeDisabled();
  });
});
