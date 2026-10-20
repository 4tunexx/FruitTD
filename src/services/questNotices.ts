import { GameToast } from '../ui/components/surface';

export type QuestNoticeKind = 'achievement' | 'main' | 'daily' | 'badge' | 'daily-login' | 'season';
const labels: Record<QuestNoticeKind, string> = {
  achievement: 'ACHIEVEMENT', main: 'MAIN MISSION', daily: 'DAILY MISSION', badge: 'BADGE',
  'daily-login': 'DAILY LOGIN', season: 'SEASON PRIZE',
};

export function questNotice(kind: QuestNoticeKind, phase: 'ready' | 'received', name: string, reward?: string) {
  const received = phase === 'received';
  const state = received ? 'REWARD RECEIVED' : kind === 'achievement' || kind === 'badge' ? 'UNLOCKED' : 'COMPLETE';
  const destination = kind === 'achievement' ? 'Achievements' : kind === 'badge' ? 'Badges' : 'Missions';
  return {
    title: `${labels[kind]} ${state} · ${name}`,
    message: received ? 'Reward added to your account.' : `Open ${destination} to claim your reward.`,
    meta: reward ? `${received ? '+' : 'Reward available: '}${reward}` : undefined,
  };
}

export function showQuestToast(kind: QuestNoticeKind, phase: 'ready' | 'received', name: string, icon: string, reward?: string): void {
  const notice = questNotice(kind, phase, name, reward);
  GameToast(notice.message, 'accent', 4500, { title: notice.title, icon, meta: notice.meta });
}

export function showStatusToast(title: string, message: string, icon = 'Info', reward?: string): void {
  GameToast(message, 'accent', 4500, { title, icon, meta: reward });
}
