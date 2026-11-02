import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from '../components/ui/CopyButton';
import { PasswordInput, Switch } from '../components/ui/Field';
import { Pagination } from '../components/ui/Pagination';

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

function stubClipboard(writeText: (...args: unknown[]) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
}

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, 'clipboard');
  }
});

describe('Switch', () => {
  it('exposes switch semantics and reports the next value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Switch
        checked={false}
        onChange={onChange}
        label="Available to donate"
        description="Pause this at any time."
      />,
    );

    const toggle = screen.getByRole('switch', { name: 'Available to donate' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await user.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not fire when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked onChange={onChange} label="Notifications" disabled />);

    await user.click(screen.getByRole('switch', { name: 'Notifications' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('PasswordInput', () => {
  it('toggles between hidden and visible text with an accessible control', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Password" defaultValue="correct horse" />);

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input).toHaveAttribute('type', 'password');
  });
});

describe('CopyButton', () => {
  it('copies the value and confirms success', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    render(<CopyButton value="0xabc123" label="Copy hash" copiedLabel="Hash copied" />);

    await user.click(screen.getByRole('button', { name: 'Copy hash' }));

    expect(writeText).toHaveBeenCalledWith('0xabc123');
    expect(screen.getByRole('button', { name: 'Hash copied' })).toBeInTheDocument();
  });

  it('never claims success when the clipboard is unavailable', async () => {
    const user = userEvent.setup();
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));

    render(<CopyButton value="0xabc123" label="Copy hash" />);

    await user.click(screen.getByRole('button', { name: 'Copy hash' }));
    expect(screen.getByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('hides pagination controls when all items fit on one page', () => {
    const { container } = render(
      <Pagination total={10} limit={10} offset={0} onChange={vi.fn()} itemLabel="requests" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows navigation controls when multiple pages are available', () => {
    render(<Pagination total={11} limit={10} offset={0} onChange={vi.fn()} itemLabel="requests" />);

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' && element.textContent === 'Showing 1–10 of 11 requests',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });
});
