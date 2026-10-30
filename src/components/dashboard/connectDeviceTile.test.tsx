// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
const impact = vi.fn();

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../platform', () => ({
  useHaptic: () => ({ impact }),
}));

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ isDark: true }),
}));

vi.mock('../../hooks/useTrafficZone', () => ({
  useTrafficZone: () => ({
    mainHex: '#000000',
    mainVar: '#000000',
    mainVarRaw: '0,0,0',
  }),
}));

vi.mock('../ui/hover-border-gradient', () => ({
  HoverBorderGradient: ({
    children,
    accentColor: _accentColor,
    ...props
  }: React.ComponentProps<'button'> & { accentColor?: string }) => (
    <button {...props}>{children}</button>
  ),
}));

import ConnectDeviceTile from './ConnectDeviceTile';

afterEach(() => {
  cleanup();
  navigate.mockReset();
  impact.mockReset();
});

describe('ConnectDeviceTile', () => {
  it('заполненный лимит предупреждает, но не закрывает саб-страницу', () => {
    render(
      <MemoryRouter>
        <ConnectDeviceTile
          subscription={{
            id: 42,
            device_limit: 1,
            subscription_url: 'https://example.invalid/sub',
          }}
          connectedDevices={1}
        />
      </MemoryRouter>,
    );

    const connect = screen.getByRole('button');
    expect(connect.hasAttribute('disabled')).toBe(false);
    expect(screen.getByText('dashboard.deviceLimitReached')).toBeTruthy();

    fireEvent.click(connect);
    expect(navigate).toHaveBeenCalledWith('/connection?sub=42');
  });
});
