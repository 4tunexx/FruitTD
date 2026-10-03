import './src/style.css';
import './src/ui/screens/screens.css';
import './src/ui/screens/hub.css';
import './src/ui/screens/campaign.css';
import { installGameScreens } from './src/ui/screens';
import { navigation } from './src/game/navigation';
import { defaultSave } from './src/game/save';
const save = defaultSave();
save.nickname = '4ZUNE'; save.coins = 9466; save.gems = 25;
save.ownedSkins = ['blade-default', 'wall-brick', 'blade-gold'];
installGameScreens({
  getSave: () => save, onPlay: () => {}, onToggleSound: () => {}, onLogout: () => {}, onOpenDaily: () => {},
  onBuyItem: () => {}, onEquipItem: () => {}, onSellItem: () => {}, onEquipHero: () => {}, onBuyHero: () => {},
  showLobbyPage: (page) => {
    for (const node of document.querySelectorAll('.menu-page')) node.classList.add('hidden');
    document.getElementById(`page-${page}`)?.classList.remove('hidden');
  },
});
navigation.setState('MAIN_MENU');
