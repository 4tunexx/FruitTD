/** Tiny dependency-free signal so the Creator UI can invalidate live runtime caches. */
const invalidationListeners = new Set<() => void>();

export function subscribeStudioRuntimeInvalidation(listener: () => void): () => void {
  invalidationListeners.add(listener);
  return () => invalidationListeners.delete(listener);
}

export function notifyStudioRuntimeChanged(): void {
  for (const listener of invalidationListeners) listener();
}
