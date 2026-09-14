function setupToggle(toggleId: string, panelId: string, storageKey: string): void {
  const toggle = document.getElementById(toggleId);
  const panel = document.getElementById(panelId);
  
  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      const hidden = panel.classList.contains('hidden');
      localStorage.setItem(storageKey, hidden ? '1' : '0');
    });
    
    if (localStorage.getItem(storageKey) === '1') {
      panel.classList.add('hidden');
    }
  }
}

export function installHudToggles(): void {
  setupToggle('juice-toggle', 'juice-panel', 'juice-panel-hidden');
  setupToggle('hp-toggle', 'hp-panel', 'hp-panel-hidden');
  setupToggle('wave-toggle', 'wave-panel', 'wave-panel-hidden');
}
