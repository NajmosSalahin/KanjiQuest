import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));

vi.mock('../lib/api.js', () => ({ api: mockApi, ApiError: class ApiError extends Error {} }));

function clearHint() {
  document.cookie = 'kg_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

beforeEach(() => {
  vi.resetModules();
  mockApi.mockReset();
  clearHint();
});

describe('auth bootstrap (D28)', () => {
  it('starts as guest and skips /users/me when no session hint exists', async () => {
    const { useAuth } = await import('./auth.js');

    expect(useAuth.getState().status).toBe('guest');
    await useAuth.getState().hydrate();

    expect(mockApi).not.toHaveBeenCalled();
    expect(useAuth.getState().status).toBe('guest');
  });

  it('hydrates the session when the hint cookie is present', async () => {
    document.cookie = 'kg_session=1; path=/';
    mockApi.mockResolvedValue({
      user: { id: 'user-1', displayName: 'Rina' },
      gamification: { totalXP: 0 },
    });
    const { useAuth } = await import('./auth.js');

    expect(useAuth.getState().status).toBe('loading');
    await useAuth.getState().hydrate();

    expect(mockApi).toHaveBeenCalledWith('/users/me');
    expect(useAuth.getState()).toMatchObject({
      status: 'authed',
      user: { id: 'user-1' },
      gamification: { totalXP: 0 },
    });
  });
});
