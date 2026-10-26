import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { AuthProvider } from '../context/AuthContext';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('public routing', () => {
  it('renders the landing page with both primary call-to-action paths', () => {
    renderAt('/');
    expect(
      screen.getByRole('heading', { name: /when minutes matter/i }),
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /request blood/i })).toHaveAttribute(
      'href',
      '/register?type=REQUESTER',
    );
    expect(screen.getByRole('link', { name: /become a donor/i })).toHaveAttribute(
      'href',
      '/register?type=DONOR',
    );
    expect(screen.getByText(/illustrative interface sample/i)).toBeInTheDocument();
  });

  it('serves the how-it-works page', () => {
    renderAt('/how-it-works');
    expect(
      screen.getByRole('heading', { name: /from an urgent request to a recorded decision/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/hospital review/i)).toBeInTheDocument();
  });

  it('serves the FAQ page without claiming blockchain verification', () => {
    renderAt('/faq');
    expect(
      screen.getByRole('heading', { name: /frequently asked questions/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/blockchain verified/i)).not.toBeInTheDocument();
  });

  it('serves the privacy and terms pages', () => {
    const { unmount } = renderAt('/privacy');
    expect(screen.getByRole('heading', { name: /privacy notice/i })).toBeInTheDocument();
    unmount();

    renderAt('/terms');
    expect(screen.getByRole('heading', { name: /terms of use/i })).toBeInTheDocument();
  });

  it('renders a not-found page for an unknown public path', () => {
    renderAt('/this-page-does-not-exist');
    expect(screen.getByRole('heading', { name: /this page does not exist/i })).toBeInTheDocument();
    expect(screen.getByText('/this-page-does-not-exist')).toBeInTheDocument();
  });

  it('resolves the specification /dashboard alias to the protected workspace', () => {
    renderAt('/dashboard');
    // With no Supabase configuration the guard shows setup instructions rather
    // than crashing or exposing the workspace.
    expect(
      screen.getByRole('heading', { name: /connect the frontend to supabase/i }),
    ).toBeInTheDocument();
  });
});
