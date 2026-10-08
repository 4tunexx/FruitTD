/** Gentle shared motion for visible numeric values in menus and match HUD. */
type CountValue = { prefix: string; suffix: string; value: number; decimals: number; grouped: boolean };

const NUMBER = /^(\s*(?:(?:Wave|Level|Lv|Stage|Score|×|x|\+|-|FR)\s*)?)(\d[\d,]*(?:\.\d+)?)(\s*(?:%|XP|pts|coins|gems|COMBO)?)\s*$/i;
const EXCLUDED = 'script,style,noscript,svg,input,textarea,select,option,[contenteditable],[data-no-count],[aria-live],[class*="timer"],[class*="clock"],#fps';

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

function formatCount(parsed: CountValue, value: number): string {
  const rounded = Number(value.toFixed(parsed.decimals));
  const digits = parsed.grouped ? rounded.toLocaleString('en-US', { minimumFractionDigits: parsed.decimals, maximumFractionDigits: parsed.decimals }) : rounded.toFixed(parsed.decimals);
  return `${parsed.prefix}${digits}${parsed.suffix}`;
}

export function installNumberMotion(root: HTMLElement = document.body): () => void {
  const values = new WeakMap<Text, { target: number; rendered: string; frame: number }>();
  let stopped = false;
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.ftdMotion === 'reduced';

  function animate(node: Text, parsed: CountValue, from: number, bump: boolean): void {
    const current = values.get(node);
    if (current?.frame) cancelAnimationFrame(current.frame);
    const entry = { target: parsed.value, rendered: node.data, frame: 0 };
    values.set(node, entry);
    if (reduced() || from === parsed.value) return;

    if (bump) {
      const el = node.parentElement;
      el?.classList.remove('ftd-number-bump');
      // Restart the short pulse for consecutive rewards or score changes.
      void el?.offsetWidth;
      el?.classList.add('ftd-number-bump');
    }
    const start = performance.now();
    const duration = bump ? 470 : 670;
    const step = (now: number) => {
      if (stopped || !node.isConnected || values.get(node) !== entry) return;
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      entry.rendered = formatCount(parsed, from + (parsed.value - from) * eased);
      node.data = entry.rendered;
      if (progress < 1) entry.frame = requestAnimationFrame(step);
      else { entry.frame = 0; node.parentElement?.classList.remove('ftd-number-bump'); }
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
    const parsed = parseCountValue(text);
    if (!parsed) { if (previous?.frame) cancelAnimationFrame(previous.frame); values.delete(node); return; }
    animate(node, parsed, previous?.target ?? 0, !!previous && parsed.value > previous.target);
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
  return () => { stopped = true; observer.disconnect(); };
}
