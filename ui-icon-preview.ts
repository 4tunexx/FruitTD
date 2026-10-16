import './src/style.css';
import './src/ui/screens/screens.css';
import './src/ui/screens/hub.css';
import './src/ui/screens/gameSkin.css';
import { GameButton } from './src/ui/components/primitives';
import { openInsigniaVault } from './src/ui/insigniaVault';
const examples = document.getElementById('examples')!;
for (const label of ['BATTLE!', 'Build turret', 'Attack', 'Shop', 'Inventory', 'Missions', 'Rankings', 'Achievements', 'Settings', 'Claim reward', 'Back']) {
  examples.appendChild(GameButton({ label, tone: 'primary' }));
}
document.getElementById('vault')!.addEventListener('click', openInsigniaVault);
