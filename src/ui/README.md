# FruitTD UI / Theme Architecture (Phase 0)

The visual identity of FruitTD lives entirely in this folder. A developer can
redesign the Main Menu, Dashboard, Heroes, Shop, Inventory, Profile, Missions,
Popups and Admin UI **without touching gameplay, save, combat, progression or
networking code**.

```
GAME DATA  →  UI COMPONENT  →  THEME  →  LAYOUT  →  SCREEN
```

## Folders

| Path | Responsibility |
| --- | --- |
| `theme/types.ts` | Theme schema (colors, typography, shapes, effects, animation, spacing, surfaces, assets). |
| `theme/defaultTheme.ts` | **Single source of truth** for the default visual identity. |
| `theme/presets.ts` | Built-in visual presets (Default, Dark Arena, Clean Competitive, Neon, Classic). |
| `theme/cssVars.ts` | Flattens a theme into `--ftd-*` CSS variables and applies them to `<html>`. |
| `theme/validate.ts` | Validation, sanitisation, deep merge, JSON import/export. |
| `theme/themeStore.ts` | Runtime holder: boot, set, patch, preset, reset, import/export, subscribe. |
| `theme/layout.ts` | Layout configuration + screen presentation (fullscreen / overlay / modal / drawer / panel) + breakpoints. |
| `theme/themeAssets.ts` | Controlled asset slots (logo, background, hero art, favicon…). |
| `theme/theme.css` | The design-system stylesheet. Consumes `--ftd-*`, hardcodes nothing. |
| `components/primitives.ts` | `GameButton`, `GamePanel`, `GameCard`, `GameTabs`, `GameBadge`, `GameProgressBar`, `GameXPBar`, `GameCurrency`, `GameRankBadge`, `GameHeroCard`, `GameItemCard`, `GameAvatar`, `GameHeader`, `GameFooter`, `GameSection`, `GameTooltip`. |
| `components/surface.ts` | **One** modal/overlay/drawer/fullscreen system + `GameToast` + `confirmModal`. |
| `design/designMode.ts` | Design Preview Mode shell (screens + live editor + viewport switcher). |
| `design/themeEditor.ts` | Live Theme Editor (colours, shape, effects, typography, spacing, animation, layout, assets, import/export). |
| `design/screenPreviews.ts` | Sample-data mockups of every screen — no save/progression access. |
| `design/themePreview.ts` | Component playground showing every primitive at once. |

The project is **vanilla TypeScript + Vite** — the primitives are plain DOM
factories, not React components.

## Using it

```ts
import { initThemeSystem, themeStore } from './ui/theme';
import { GameButton, GamePanel } from './ui/components/primitives';
import { openSurface, GameToast } from './ui/components/surface';

initThemeSystem();                         // boot theme + layout (already done in main.ts)
themeStore.usePreset('neon');              // swap the whole visual identity
themeStore.patch({ colors: { primary: '#ff0055' } });  // live tweak, applies instantly

openSurface({ kind: 'overlay', size: 'lg', title: 'Inventory', content: [GamePanel({ title: 'Blades' })] });
```

## Design Mode

* `Ctrl+Shift+D` anywhere
* `?design=1` in the URL
* **Admin Control Center → Design → Open Design Mode**

It previews Main Menu, Dashboard, Heroes, Inventory, Shop, Profile, Missions,
Achievements, Settings, Game HUD, Popups and the component playground at
desktop / tablet / mobile widths, with the Theme Editor docked alongside.
Changes apply immediately — no rebuild.

## Rules

1. Gameplay code must not generate visual styling. No inline colours, no
   hardcoded panel dimensions, no ad-hoc HTML styling in `src/game/**`.
2. New colours/spacing/radii go into the theme, not into a component.
3. New popups use `openSurface` — never a bespoke modal implementation.
4. Themes are **data only**. `validateTheme` rejects anything that is not a safe
   colour / length / font / number, and asset URLs are limited to `https:`,
   root-relative paths and `data:image/*`. Imported theme files can never
   execute JavaScript.
5. Theme presets must never contain progression, coins, XP, hero ownership,
   rank or game rules.

## Migration status

`src/style.css` still holds the legacy screen CSS, but its `:root` design tokens
(`--bg`, `--lime`, `--radius`, `--font`, …) are now **aliases of `--ftd-*`**, so
changing the theme immediately restyles the existing HUD, menus and modals.
Screens can be migrated to the new primitives incrementally, one at a time,
without breaking gameplay.
