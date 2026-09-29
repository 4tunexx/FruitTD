import { getAuthToken } from './auth';

export interface SocialFriend {
  userId: string;
  username: string;
  nickname?: string;
  avatar?: string;
  state: 'pending' | 'accepted' | 'blocked';
  direction: 'incoming' | 'outgoing';
}

export interface SocialNotification {
  notificationId: string;
  actorName: string;
  type: string;
  title: string;
  body: string;
  readAt?: string;
  createdAt: string;
}

export interface PublicPlayerProfile {
  username: string;
  nickname: string;
  avatar: string;
  hero: string;
  highScore: number;
  rankedScore: number;
  rank: string;
  bestWave: number;
  games: number;
  badges: string[];
}

export interface SocialMessage {
  messageId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`/api/social${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export const socialApi = {
  friends: () => request<{ friends: SocialFriend[] }>('/friends'),
  notifications: () => request<{ unread: number; notifications: SocialNotification[] }>('/notifications'),
  profile: (username: string) => request<{ profile: PublicPlayerProfile }>(`/profiles/${encodeURIComponent(username)}`),
  messages: (username: string) => request<{ messages: SocialMessage[]; friend: { username: string; nickname?: string } }>(`/messages/${encodeURIComponent(username)}`),
  requestFriend: (username: string) => request('/friends/request', { method: 'POST', body: JSON.stringify({ username }) }),
  respondFriend: (friendId: string, accept: boolean) => request('/friends/respond', { method: 'POST', body: JSON.stringify({ friendId, accept }) }),
  markRead: (ids: string[]) => request('/notifications/read', { method: 'POST', body: JSON.stringify({ ids }) }),
  sendMessage: (username: string, body: string) => request(`/messages/${encodeURIComponent(username)}`, { method: 'POST', body: JSON.stringify({ body }) }),
};
