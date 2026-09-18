import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeopoliticalWorkspace } from './geopolitical-workspace';

describe('GeopoliticalWorkspace branding', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the light and dark Polity Atlas logo assets instead of the text wordmark', () => {
    render(<GeopoliticalWorkspace />);

    const logo = screen.getByAltText('Polity Atlas');
    expect(logo).toHaveAttribute('src', expect.stringContaining('Logo-Light'));

    expect(screen.queryByText('Geopolitical research desk')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Use dark mode' }));

    expect(logo).toHaveAttribute('src', expect.stringContaining('Logo-Dark'));
  });
});
