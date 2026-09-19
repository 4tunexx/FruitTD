/**
 * Item card shared by the shop and the inventory.
 *
 * One renderer, two modes — so a blade looks identical wherever you see it and
 * there is no second card implementation to drift (§12). Slicers get a live
 * blade preview because they carry the game's identity (§8).
 */

import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import type { CatalogItem } from '../../game/catalog';

export type ItemCardMode = 'shop' | 'inventory';

export interface ItemCardActions {
  onBuy?: (id: string) => void;
  onEquip?: (id: string) => void;
  onSell?: (id: string) => void;
  onDetails?: (item: CatalogItem) => void;
}

export interface ItemCardState {
  mode: ItemCardMode;
  owned: boolean;
  equipped: boolean;
  affordable: boolean;
  /** Why selling is blocked, if it is. */
  sellBlockedReason?: string;
}

/**
 * Blade preview: shape, colour, trail, glow and glint come straight from the
 * slicer record so the card reflects what you actually swing (§8).
 */
export function slicerPreview(item: CatalogItem): HTMLElement {
  const preview = el('div', { class: 'ftd-blade-preview' });
  const slicer = item.slicer;
  preview.style.setProperty('--blade-color', item.color);
  preview.style.setProperty('--blade-glow', item.glowColor);
  if (slicer) {
    preview.style.setProperty('--blade-width', String(slicer.trailWidth));
    preview.style.setProperty('--blade-glow-strength', String(slicer.glow));
    preview.style.setProperty('--blade-glint', String(slicer.glint));
    preview.dataset.fx = slicer.fxStyle;
  }
  preview.appendChild(el('span', { class: 'ftd-blade-preview__trail' }));
  preview.appendChild(el('span', { class: 'ftd-blade-preview__edge' }));
  if (slicer && slicer.glint > 0.3) {
    preview.appendChild(el('span', { class: 'ftd-blade-preview__glint' }));
  }
  return preview;
}

function swatch(item: CatalogItem): HTMLElement {
  if (item.category === 'slicers') return slicerPreview(item);
  const node = el('div', { class: 'ftd-item-card__swatch' });
  node.style.background = `linear-gradient(135deg, ${item.color}, ${item.glowColor})`;
  return node;
}

export function renderItemCard(
  item: CatalogItem,
  state: ItemCardState,
  actions: ItemCardActions,
): HTMLElement {
  const card = el('article', {
    class: [
      'ftd-item-card',
      `ftd-item-card--${item.rarity}`,
      state.equipped ? 'is-equipped' : '',
      state.mode === 'shop' && !state.affordable ? 'is-unaffordable' : '',
    ].filter(Boolean).join(' '),
    'data-item-id': item.id,
  });

  card.appendChild(swatch(item));

  const info = el('div', { class: 'ftd-item-card__info' }, [
    el('p', { class: 'ftd-item-card__name', text: item.name }),
    el('p', { class: 'ftd-item-card__rarity', text: item.rarity.toUpperCase() }),
    el('p', { class: 'ftd-item-card__desc', text: item.description }),
  ]);

  if (item.stats.length) {
    const stats = el('ul', { class: 'ftd-item-card__stats' });
    for (const stat of item.stats) {
      stats.appendChild(
        el('li', { class: stat.positive ? 'is-positive' : '' }, [
          el('span', { class: 'ftd-item-card__stat-label', text: stat.label }),
          el('span', { class: 'ftd-item-card__stat-value', text: stat.value }),
        ]),
      );
    }
    info.appendChild(stats);
  }
  card.appendChild(info);

  const footer = el('div', { class: 'ftd-item-card__footer' });

  if (state.mode === 'shop') {
    footer.appendChild(
      el('p', { class: 'ftd-item-card__price' }, [
        el('span', { text: '🪙', 'aria-hidden': 'true' }),
        el('span', { text: item.price.toLocaleString() }),
      ]),
    );
    footer.appendChild(
      GameButton({
        label: state.affordable ? 'Buy' : 'Not enough',
        tone: state.affordable ? 'primary' : 'default',
        size: 'sm',
        disabled: !state.affordable,
        onClick: () => actions.onBuy?.(item.id),
      }),
    );
  } else {
    if (state.equipped) {
      footer.appendChild(el('span', { class: 'ftd-item-card__equipped', text: 'EQUIPPED' }));
    } else if (item.slot) {
      footer.appendChild(
        GameButton({
          label: 'Equip',
          tone: 'primary',
          size: 'sm',
          onClick: () => actions.onEquip?.(item.id),
        }),
      );
    }
    if (actions.onSell) {
      const blocked = Boolean(state.sellBlockedReason);
      const sell = GameButton({
        label: item.sellValue > 0 ? `Sell ${item.sellValue}` : 'Sell',
        variant: 'ghost',
        size: 'sm',
        disabled: blocked,
        onClick: () => actions.onSell?.(item.id),
      });
      if (blocked) sell.title = state.sellBlockedReason!;
      footer.appendChild(sell);
    }
  }

  card.appendChild(footer);

  if (actions.onDetails) {
    card.addEventListener('click', (ev) => {
      // Buttons handle their own actions; only bare-card clicks open details.
      if ((ev.target as HTMLElement).closest('button')) return;
      actions.onDetails?.(item);
    });
    card.classList.add('is-clickable');
  }

  return card;
}
