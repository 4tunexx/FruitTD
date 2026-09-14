export function installHudToggles(): void {
  const juiceToggle = document.getElementById('juice-toggle');
  const juicePanel = document.getElementById('juice-panel');
  
  if (juiceToggle && juicePanel) {
    juiceToggle.addEventListener('click', () => {
      juicePanel.classList.toggle('hidden');
      const hidden = juicePanel.classList.contains('hidden');
      localStorage.setItem('juice-panel-hidden', hidden ? '1' : '0');
    });
    
    if (localStorage.getItem('juice-panel-hidden') === '1') {
      juicePanel.classList.add('hidden');
    }
  }
}
