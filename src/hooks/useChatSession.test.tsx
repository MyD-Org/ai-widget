import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useChatSession } from './useChatSession';

describe('useChatSession', () => {
  it('uses a static token without calling fetchToken', async () => {
    const { result } = renderHook(() => useChatSession({ baseUrl: 'x', agentId: 'a', token: 'static-jwt' }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.getToken()).toBe('static-jwt');
  });

  it('calls fetchToken on mount and exposes the token', async () => {
    const fetchToken = vi.fn().mockResolvedValue('minted-jwt');
    const { result } = renderHook(() => useChatSession({ baseUrl: 'x', agentId: 'a', fetchToken }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(fetchToken).toHaveBeenCalledTimes(1);
    expect(result.current.getToken()).toBe('minted-jwt');
  });

  it('refresh() re-invokes fetchToken and updates the token', async () => {
    const fetchToken = vi.fn().mockResolvedValueOnce('jwt-1').mockResolvedValueOnce('jwt-2');
    const { result } = renderHook(() => useChatSession({ baseUrl: 'x', agentId: 'a', fetchToken }));
    await waitFor(() => expect(result.current.getToken()).toBe('jwt-1'));
    await act(async () => { await result.current.refresh(); });
    expect(fetchToken).toHaveBeenCalledTimes(2);
    expect(result.current.getToken()).toBe('jwt-2');
  });
});
