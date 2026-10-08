import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';

export interface NotificationRecord extends Record<string, any> {
  notificationId: string;
  userId: string;
  actorId: string;
  actorName: string;
  type: string;
  title: string;
  body: string;
  eventKey?: string;
  createdAt: Date;
}

export interface NotificationInput {
  userId: string;
  actorId?: string;
  actorName?: string;
  type: string;
  title: string;
  body: string;
  eventKey?: string;
}

/** Notifications are a secondary signal: failed storage must not undo a reward or social action. */
export async function saveNotification(
  source: Collection<NotificationRecord> | (() => Promise<Collection<NotificationRecord>>),
  input: NotificationInput,
): Promise<void> {
  try {
    const collection = typeof source === 'function' ? await source() : source;
    await collection.insertOne({
      notificationId: randomUUID(),
      userId: input.userId,
      actorId: input.actorId ?? 'system',
      actorName: input.actorName ?? 'Fruit TD',
      type: input.type,
      title: input.title.slice(0, 100),
      body: input.body.slice(0, 240),
      ...(input.eventKey ? { eventKey: input.eventKey } : {}),
      createdAt: new Date(),
    });
  } catch (error) {
    // A unique event key intentionally collapses duplicate progress submissions.
    if ((error as { code?: number })?.code !== 11000) console.error('Could not save notification:', error);
  }
}
