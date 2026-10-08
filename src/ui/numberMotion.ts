/** Gentle shared motion for visible numeric values in menus and match HUD. */
type CountValue = { prefix: string; suffix: string; value: number; decimals: number; grouped: boolean };
type CountToken = { value: number; decimals: number; grouped: boolean };
type MotionEntry = { targets: number[]; rendered: string; frame: number; changedAt: number; bumpedAt: number };

const NUMBER = /^(\s*(?:(?:Wave|Level|Lv|Stage|Score|×|x|\+|-|FR)\s*)?)(\d[\d,]*(?:\.\d+)?)(\s*(?:%|XP|pts|coins|gems|COMBO)?)\s*$/i;
const EXCLUDED = 'script,style,noscript,svg,input,textarea,select,option,[contenteditable],[data-no-count],[class*="timer"],[class*="clock"],#fps,#modal-admin,#screen-admin,[data-admin-panel]';
let scanInstalledNumbers: ((root: Node) => void) | null = null;

/** Re-scan freshly rendered screen content so every page entry counts in visibly. */
export function animateNumbersIn(root: Node): void {
  if (!scanInstalledNumbers && typeof document !== 'undefined' && typeof document.createTreeWalker === 'function' && typeof MutationObserver !== 'undefined') {
    installNumberMotion();
  }
  requestAnimationFrame(() => scanInstalledNumbers?.(root));
}

export function parseCountValue(text: string): CountValue | null {
  if (text.length > 48) return null;
  const match = NUMBER.exec(text);
  if (!match) return null;
  const value = Number(match[2]!.replaceAll(',', ''));
  if (!Number.isFinite(value) || value > 1_000_000_000) return null;
  return {
    prefix: match[1]!, suffix: match[3]!, value,
    decimals: match[2]!.split('.')[1]?.length ?? 0,
    grouped: match[2]!.includes(','),
  };
}

/** Find every standalone number in a visible label, including values like 13/51 or Lv 11/100. */
export function parseCountValues(text: string): CountToken[] {
  if (text.length > 120 || /^\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/.test(text)) return [];
  const tokens: CountToken[] = [];
  const pattern = /(?<![A-Za-z0-9_])\d[\d,]*(?:\.\d+)?(?![A-Za-z0-9_])/g;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const value = Number(raw.replaceAll(',', ''));
    if (!Number.isFinite(value) || value > 1_000_000_000) continue;
    tokens.push({ value, decimals: raw.split('.')[1]?.length ?? 0, grouped: raw.includes(',') });
  }
  return tokens;
}

function formatCountTokens(text: string, tokens: CountToken[], values: number[]): string {
  let index = 0;
  return text.replace(/(?<![A-Za-z0-9_])\d[\d,]*(?:\.\d+)?(?![A-Za-z0-9_])/g, (raw) => {
    const token = tokens[index];
    const value = values[index++];
    if (!token || value === undefined) return raw;
    const rounded = Number(value.toFixed(token.decimals));
    return token.grouped
      ? rounded.toLocaleString('en-US', { minimumFractionDigits: token.decimals, maximumFractionDigits: token.decimals })
      : rounded.toFixed(token.decimals);
  });
}

export function installNumberMotion(root: HTMLElement = document.body): () => void {
  const values = new WeakMap<Text, MotionEntry>();
  let stopped = false;
  // The in-game motion preference is authoritative. This lets players who
  // explicitly chose full game motion see the count-up even when their OS has
  // its global reduced-motion preference enabled.
  const reduced = () => document.documentElement.dataset.ftdMotion === 'reduced';

  function animate(node: Text, original: string, tokens: CountToken[], from: number[], bump: boolean, changedAt: number, bumpedAt: number): void {
    const current = values.get(node);
    if (current?.frame) {
      cancelAnimationFrame(current.frame);
      node.parentElement?.classList.remove('ftd-number-counting', 'ftd-number-bump');
    }
    const targets = tokens.map((token) => token.value);
    const entry: MotionEntry = { targets, rendered: node.data, frame: 0, changedAt, bumpedAt };
    values.set(node, entry);
    if (reduced() || targets.every((target, index) => target === from[index])) return;

    if (bump) {
      const el = node.parentElement;
      el?.classList.remove('ftd-number-bump');
      // Restart the short pulse for consecutive rewards or score changes.
      void el?.offsetWidth;
      el?.classList.add('ftd-number-bump');
    }
    const countElement = node.parentElement;
    countElement?.classList.add('ftd-number-counting');
    const start = performance.now();
    const duration = bump ? 520 : 1050;
    const step = (now: number) => {
      if (stopped || !node.isConnected || values.get(node) !== entry) {
        if (values.get(node) === entry) countElement?.classList.remove('ftd-number-counting');
        return;
      }
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      entry.rendered = formatCountTokens(original, tokens, targets.map((target, index) => (from[index] ?? 0) + (target - (from[index] ?? 0)) * eased));
      node.data = entry.rendered;
      if (progress < 1) entry.frame = requestAnimationFrame(step);
      else {
        entry.frame = 0;
        node.parentElement?.classList.remove('ftd-number-bump');
        countElement?.classList.remove('ftd-number-counting');
      }
    };
    entry.frame = requestAnimationFrame(step);
  }

  function visit(node: Text): void {
    const parent = node.parentElement;
    if (!parent || parent.closest(EXCLUDED) || !parent.isConnected) return;
    if (parent.closest('[hidden],[aria-hidden="true"],.hidden')) return;
    const text = node.data;
    const previous = values.get(node);
    if (previous?.rendered === text) return;
    const tokens = parseCountValues(text);
    if (!tokens.length) {
      if (previous?.frame) cancelAnimationFrame(previous.frame);
      parent.classList.remove('ftd-number-counting', 'ftd-number-bump');
      values.delete(node);
      return;
    }
    const now = performance.now();
    const targets = tokens.map((token) => token.value);
    if (previous && previous.targets.length === targets.length && previous.targets.every((target, index) => target === targets[index])) {
      values.set(node, { ...previous, rendered: text, frame: previous.frame });
      return;
    }
    const increase = !!previous && targets.some((target, index) => target > (previous.targets[index] ?? 0));
    const bump = increase && (!previous?.bumpedAt || now - previous.bumpedAt > 300);
    // The game HUD replaces its text on every frame. Keep those fast updates
    // live instead of restarting a count-up that can never finish.
    if (previous && now - previous.changedAt < 120) {
      if (previous.frame) cancelAnimationFrame(previous.frame);
      parent.classList.remove('ftd-number-counting');
      values.set(node, { targets, rendered: text, frame: 0, changedAt: now, bumpedAt: bump ? now : previous.bumpedAt });
      if (bump && !reduced()) {
        parent.classList.remove('ftd-number-bump');
        void parent.offsetWidth;
        parent.classList.add('ftd-number-bump');
      }
      return;
    }
    animate(node, text, tokens, previous?.targets ?? targets.map(() => 0), bump, now, bump ? now : previous?.bumpedAt ?? 0);
  }

  function scan(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) { visit(node as Text); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (el.matches(EXCLUDED) || el.closest('[hidden],[aria-hidden="true"],.hidden')) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let text: Node | null;
    while ((text = walker.nextNode())) visit(text as Text);
  }

  scanInstalledNumbers = scan;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') scan(mutation.target);
      else if (mutation.type === 'attributes') {
        const el = mutation.target as Element;
        if (!el.classList.contains('ftd-number-bump')) scan(el);
      } else mutation.addedNodes.forEach(scan);
    }
  });
  observer.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden'] });
  requestAnimationFrame(() => { if (!stopped) scan(root); });
  return () => {
    stopped = true;
    observer.disconnect();
    if (scanInstalledNumbers === scan) scanInstalledNumbers = null;
  };
}
