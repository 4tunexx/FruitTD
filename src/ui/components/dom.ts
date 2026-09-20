/** Tiny DOM helpers shared by every FruitTD UI primitive. */

export type Attrs = Record<string, string | number | boolean | undefined | null>;
export type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (key.startsWith('data-') || key.startsWith('aria-')) node.setAttribute(key, String(value));
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  append(node, children);
  return node;
}

export function append(parent: HTMLElement, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

export function classNames(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** Escapes text for safe insertion into innerHTML templates. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Removes every child of a node. */
export function clear(node: HTMLElement): void {
  // replaceChildren() is the reliable one-shot clear; fall back to manual
  // removal for environments (and test stubs) that do not implement it.
  const anyNode = node as unknown as { replaceChildren?: () => void };
  if (typeof anyNode.replaceChildren === 'function') {
    anyNode.replaceChildren();
    return;
  }
  while (node.lastChild) node.removeChild(node.lastChild);
  node.innerHTML = '';
}
