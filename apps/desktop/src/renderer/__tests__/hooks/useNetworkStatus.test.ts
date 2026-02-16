import { renderHook, act } from '@testing-library/react';
import { useNetworkStatus, useCanRefresh } from '../../hooks/useNetworkStatus';

describe('useNetworkStatus', () => {
  it('returns initial online state', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current).toBe(true);
  });

  it('returns initial offline state', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current).toBe(false);
  });

  it('updates on online event', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current).toBe(false);

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true });
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current).toBe(true);
  });

  it('updates on offline event', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current).toBe(true);

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(false);
  });

  it('cleans up event listeners on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useNetworkStatus());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });
});

describe('useCanRefresh', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  it('returns true when online and not refreshing', () => {
    const { result } = renderHook(() => useCanRefresh(false));

    expect(result.current).toBe(true);
  });

  it('returns false when refreshing', () => {
    const { result } = renderHook(() => useCanRefresh(true));

    expect(result.current).toBe(false);
  });

  it('returns false when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const { result } = renderHook(() => useCanRefresh(false));

    expect(result.current).toBe(false);
  });

  it('returns false when offline and refreshing', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const { result } = renderHook(() => useCanRefresh(true));

    expect(result.current).toBe(false);
  });
});
