/** Read-only diagnostics for real pointer/touch QA. Never installed in production. */
export function installCombatDiagnostics(snapshot: () => Record<string, unknown>): void {
  if (!import.meta.env.DEV || !new URLSearchParams(window.location.search).has('combatDebug')) return;
  Object.defineProperty(window, '__fruitTdCombatSnapshot', {
    value: () => Object.freeze(snapshot()),
    configurable: true,
    writable: false,
  });
}