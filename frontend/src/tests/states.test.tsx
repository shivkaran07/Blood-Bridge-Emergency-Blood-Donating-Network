import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';

describe('shared async states', () => {
  it('announces a loading state', () => {
    render(<LoadingState label="Loading requests…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading requests…');
  });

  it('renders an error with a retry action', () => {
    const retry = vi.fn();
    render(<ErrorState message="The network is unavailable." onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The network is unavailable.');
  });

  it('renders an empty state with guidance', () => {
    render(
      <EmptyState
        title="No requests yet"
        description="Verified requests will appear here."
      />,
    );
    expect(screen.getByText('No requests yet')).toBeInTheDocument();
    expect(screen.getByText('Verified requests will appear here.')).toBeInTheDocument();
  });
});
