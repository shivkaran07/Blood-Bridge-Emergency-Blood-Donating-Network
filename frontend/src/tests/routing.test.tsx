import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('public routing', () => {
  it('renders the landing page with both primary call-to-action paths', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /every connection/i })).toBeInTheDocument();
    const header = within(screen.getByRole('banner'));
    expect(header.getByText('Blood donation')).toBeInTheDocument();
    expect(header.getByText('coordination network')).toBeInTheDocument();

    expect(screen.getAllByRole('link', { name: /request blood/i })[0]).toHaveAttribute(
      'href',
      '/register?type=REQUESTER',
    );
    expect(screen.getAllByRole('link', { name: /become a donor/i })[1]).toHaveAttribute(
      'href',
      '/register?type=DONOR',
    );
    expect(screen.getByText(/illustrative interface sample/i)).toBeInTheDocument();
  });

  it('serves the how-it-works page', async () => {
    renderAt('/how-it-works');
    expect(
      await screen.findByRole('heading', { name: /from an urgent request to a recorded decision/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: /2\. hospital review/i }),
    ).toBeInTheDocument();
  });

  it('serves the FAQ page without claiming blockchain verification', async () => {
    renderAt('/faq');
    expect(
      await screen.findByRole('heading', { name: /frequently asked questions/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/blockchain verified/i)).not.toBeInTheDocument();
  });

  it('serves the privacy and terms pages', async () => {
    const { unmount } = renderAt('/privacy');
    expect(await screen.findByRole('heading', { name: /privacy notice/i })).toBeInTheDocument();
    unmount();

    renderAt('/terms');
    expect(await screen.findByRole('heading', { name: /terms of use/i })).toBeInTheDocument();
  });

  it('renders a not-found page for an unknown public path', async () => {
    renderAt('/this-page-does-not-exist');
    expect(await screen.findByRole('heading', { name: /this page does not exist/i })).toBeInTheDocument();
    expect(screen.getByText('/this-page-does-not-exist')).toBeInTheDocument();
  });

  it('resolves the specification /dashboard alias to the protected workspace', async () => {
    renderAt('/dashboard');
    // Depending on whether Supabase credentials exist at build time, the guard
    // either shows setup instructions or sends an anonymous visitor to sign in.
    // In both cases the workspace must not be exposed.
    const heading = await screen.findByRole('heading', {
      name: /connect the frontend to supabase|sign in to bloodbridge|we could not open your workspace/i,
    });
    expect(heading).toBeInTheDocument();
    expect(screen.queryByText(/good to see you/i)).not.toBeInTheDocument();
  });
});
