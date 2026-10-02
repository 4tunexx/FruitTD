import { getAuthToken } from './auth';

export interface CoopLobby {
  lobbyId: string; code: string; hostId: string; visibility: 'friends' | 'public';
  members: { userId: string; name: string; ready: boolean }[];
}

async function request<T>(path: string, method = 'GET', payload?: Record<string, unknown>): Promise<T> {
  const token = getAuthToken();
  if (!token) throw new Error('Sign in to use online lobbies');
  const response = await fetch(`/api/lobbies${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Lobby request failed (${response.status})`);
  return data;
}

export const lobbyApi = {
  mine: () => request<{ userId: string; lobby: CoopLobby | null }>('/mine'),
  public: () => request<{ lobbies: CoopLobby[] }>('/public'),
  create: (visibility: 'friends' | 'public') => request<{ lobby: CoopLobby }>('/', 'POST', { visibility }),
  join: (code?: string) => request<{ lobby: CoopLobby }>('/join', 'POST', { code }),
  ready: (ready: boolean) => request<{ lobby: CoopLobby }>('/ready', 'POST', { ready }),
  leave: () => request('/leave', 'POST'),
  invite: (friend: { username?: string; friendId?: string }) => request('/invite', 'POST', friend),
};
