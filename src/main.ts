function hideBootLoader(): void {
  const boot = document.getElementById('boot-loader');
  if (!boot || boot.classList.contains('is-done')) return;
  boot.classList.add('is-done');
  window.setTimeout(() => boot.remove(), 500);
}
requestAnimationFrame(() => hideBootLoader());
window.addEventListener('error', () => hideBootLoader());
window.addEventListener('unhandledrejection', () => hideBootLoader());

void import('./mainApp');
