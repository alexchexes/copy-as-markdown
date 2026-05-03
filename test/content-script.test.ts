import { afterEach, describe, expect, it, vi } from 'vitest';
import copy from '../src/content-script.js';

describe('content script clipboard copy', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it('tries navigator.clipboard.writeText when clipboard-write permission state is prompt', async () => {
    const queryMock = vi.fn(async () => ({ state: 'prompt' } as PermissionStatus));
    const writeTextMock = vi.fn(async () => undefined);

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        permissions: {
          query: queryMock,
        },
        clipboard: {
          writeText: writeTextMock,
        },
      },
      configurable: true,
      writable: true,
    });

    await expect(copy('hello', 'chrome-extension://id/dist/static/iframe-copy.html')).resolves.toEqual({
      ok: true,
      method: 'navigator_api',
    });

    expect(queryMock).toHaveBeenCalledExactlyOnceWith({
      name: 'clipboard-write',
      allowWithoutGesture: true,
    });
    expect(writeTextMock).toHaveBeenCalledExactlyOnceWith('hello');
  });
});
