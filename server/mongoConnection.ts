import type { MongoClientOptions } from 'mongodb';

/** Each Vercel worker owns a pool; Render runs the same short API operations in one server. */
export function mongoClientOptions(serverless: boolean): MongoClientOptions {
  return {
    // Small per-worker pools prevent serverless fan-out exhausting the M0 cluster.
    // The long-lived API has more shared request/authority concurrency, so gets ten.
    maxPoolSize: serverless ? 5 : 10,
    // Do not reserve unused sockets between requests or scale-out events.
    minPoolSize: 0,
    // Release idle application sockets, keeping a little more reuse time on Render.
    maxIdleTimeMS: serverless ? 30_000 : 60_000,
    appName: serverless ? 'FruitTD-Vercel' : 'FruitTD-Server',
  };
}

interface ConnectionClient<T> {
  connect(): Promise<unknown>;
  db(name: string): T;
  close(): Promise<void>;
}
interface ConnectionEntry<T> {
  client: ConnectionClient<T>;
  ready: Promise<T>;
  closing?: Promise<void>;
}

/** All requests share both connection establishment and one-time initialization. */
export class SharedMongoConnection<T> {
  private current: ConnectionEntry<T> | undefined;
  private closing: Promise<void> | undefined;
  constructor(
    private readonly createClient: () => ConnectionClient<T>,
    private readonly databaseName: string,
    private readonly initialize: (database: T) => Promise<void>,
  ) {}

  get(): Promise<T> {
    if (this.closing) return this.closing.then(() => this.get());
    if (!this.current) {
      let client: ConnectionClient<T>;
      try { client = this.createClient(); } catch (error) { return Promise.reject(error); }
      const entry = { client } as ConnectionEntry<T>;
      this.current = entry;
      entry.ready = this.open(entry);
    }
    return this.current.ready;
  }

  private async open(entry: ConnectionEntry<T>): Promise<T> {
    try {
      await entry.client.connect();
      const database = entry.client.db(this.databaseName);
      await this.initialize(database);
      return database;
    } catch (error) {
      // A failed connection must not poison all subsequent logins and saves.
      try { await this.closeEntry(entry); } catch { /* Preserve the original error. */ }
      if (this.current === entry) this.current = undefined;
      throw error;
    }
  }

  private closeEntry(entry: ConnectionEntry<T>): Promise<void> {
    return entry.closing ??= Promise.resolve().then(() => entry.client.close());
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    const entry = this.current;
    if (!entry) return Promise.resolve();
    this.current = undefined;
    // Let pending initialization finish before closing; new requests wait for the
    // close rather than receiving a database owned by the retiring client.
    this.closing = (async () => {
      try { await entry.ready; } catch { /* open() already cleans up on failure. */ }
      await this.closeEntry(entry);
    })().finally(() => { this.closing = undefined; });
    return this.closing;
  }
}
