/**
 * Minimal DOM shim for node:test.
 *
 * Only implements what the FruitTD UI primitives touch — enough to assert
 * structure and behaviour (classes, children, events) without a browser.
 */

type Listener = (ev: any) => void;

class ClassList {
  private set = new Set<string>();
  constructor(private owner: StubElement) {}
  add(...names: string[]) {
    names.forEach((n) => n && this.set.add(n));
    this.sync();
  }
  remove(...names: string[]) {
    names.forEach((n) => this.set.delete(n));
    this.sync();
  }
  toggle(name: string, force?: boolean) {
    const on = force ?? !this.set.has(name);
    if (on) this.set.add(name);
    else this.set.delete(name);
    this.sync();
    return on;
  }
  contains(name: string) {
    return this.set.has(name);
  }
  get value() {
    return [...this.set].join(' ');
  }
  replaceAll(value: string) {
    this.set = new Set(value.split(/\s+/).filter(Boolean));
  }
  private sync() {
    this.owner.setAttributeRaw('class', this.value);
  }
}

export class StubElement {
  tagName: string;
  children: StubElement[] = [];
  parentElement: StubElement | null = null;
  attributes: Record<string, string> = {};
  dataset: Record<string, string> = {};
  style: Record<string, any> = { setProperty: (k: string, v: string) => { (this.style as any)[k] = v; } };
  classList = new ClassList(this);
  private text = '';
  private listeners = new Map<string, Listener[]>();
  files: any[] | null = null;
  value = '';
  checked = false;
  disabled = false;

  constructor(tag: string) {
    this.tagName = tag.toUpperCase();
  }

  get className() {
    return this.classList.value;
  }
  set className(v: string) {
    this.classList.replaceAll(v);
    this.setAttributeRaw('class', v);
  }
  get textContent(): string {
    if (this.children.length) return this.children.map((c) => c.textContent).join('');
    return this.text;
  }
  set textContent(v: string) {
    this.children = [];
    this.text = v;
  }
  get id(): string {
    return this.attributes.id ?? '';
  }
  set id(v: string) {
    this.attributes.id = v;
  }
  get href(): string {
    return this.attributes.href ?? '';
  }

  setAttributeRaw(name: string, value: string) {
    this.attributes[name] = value;
  }
  setAttribute(name: string, value: string) {
    if (name === 'class') this.className = value;
    else this.attributes[name] = value;
  }
  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }
  appendChild(node: StubElement) {
    node.parentElement = this;
    this.children.push(node);
    return node;
  }
  removeChild(node: StubElement) {
    this.children = this.children.filter((c) => c !== node);
    node.parentElement = null;
  }
  replaceChild(next: StubElement, prev: StubElement) {
    const idx = this.children.indexOf(prev);
    if (idx >= 0) {
      this.children[idx] = next;
      next.parentElement = this;
      prev.parentElement = null;
    }
  }
  replaceChildren(...nodes: StubElement[]) {
    this.children = [];
    nodes.forEach((n) => this.appendChild(n));
  }
  remove() {
    this.parentElement?.removeChild(this);
  }
  addEventListener(type: string, fn: Listener) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((f) => f !== fn));
  }
  dispatchEvent(ev: any) {
    ev.target = ev.target ?? this;
    (this.listeners.get(ev.type) ?? []).forEach((fn) => fn(ev));
    if (ev.bubbles && this.parentElement) this.parentElement.dispatchEvent(ev);
    return true;
  }
  click() {
    this.dispatchEvent({ type: 'click', target: this });
  }
  /** Depth-first descendants including self. */
  all(): StubElement[] {
    return [this, ...this.children.flatMap((c) => c.all())];
  }
  querySelectorAll(selector: string): StubElement[] {
    return this.all()
      .slice(1)
      .filter((n) => matches(n, selector));
  }
  querySelector(selector: string): StubElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  focus() {}
}

function matches(node: StubElement, selector: string): boolean {
  return selector
    .split(',')
    .map((s) => s.trim())
    .some((sel) => {
      if (sel.startsWith('.')) return node.classList.contains(sel.slice(1));
      if (sel.startsWith('#')) return node.id === sel.slice(1);
      if (sel.startsWith('[')) {
        const m = /^\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]$/.exec(sel);
        if (!m) return false;
        const val = node.getAttribute(m[1]);
        return m[2] === undefined ? val !== null : val === m[2];
      }
      return node.tagName === sel.toUpperCase();
    });
}

export interface DomStub {
  document: any;
  window: any;
  restore(): void;
}

/** Installs the shim on globalThis; returns a restore handle. */
export function installDomStub(): DomStub {
  const docEl = new StubElement('html');
  const body = new StubElement('body');
  const head = new StubElement('head');
  const docListeners = new Map<string, Listener[]>();
  const winListeners = new Map<string, Listener[]>();

  const document: any = {
    documentElement: docEl,
    body,
    head,
    createElement: (tag: string) => new StubElement(tag),
    createTextNode: (text: string) => {
      const n = new StubElement('#text');
      n.textContent = text;
      return n;
    },
    getElementById: (id: string) => [docEl, body, head].flatMap((r) => r.all()).find((n) => n.id === id) ?? null,
    querySelector: (sel: string) => body.querySelector(sel) ?? head.querySelector(sel),
    querySelectorAll: (sel: string) => body.querySelectorAll(sel),
    addEventListener: (type: string, fn: Listener) => {
      docListeners.set(type, [...(docListeners.get(type) ?? []), fn]);
    },
    dispatchEvent: (ev: any) => {
      (docListeners.get(ev.type) ?? []).forEach((fn) => fn(ev));
      return true;
    },
  };

  const storage = new Map<string, string>();
  const window: any = {
    innerWidth: 1280,
    location: { search: '' },
    history: { state: null, pushState: () => {}, back: () => {} },
    addEventListener: (type: string, fn: Listener) => {
      winListeners.set(type, [...(winListeners.get(type) ?? []), fn]);
    },
    dispatchEvent: (ev: any) => {
      (winListeners.get(ev.type) ?? []).forEach((fn) => fn(ev));
      return true;
    },
    setTimeout: (fn: () => void) => {
      fn();
      return 0;
    },
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    },
  };

  const g = globalThis as any;
  g.HTMLElement = StubElement;
  g.Blob = class {
    constructor(public parts: unknown[], public opts: unknown) {}
  };
  // Augment the real URL (replacing it would break the module loader).
  if (!g.URL.createObjectURL) g.URL.createObjectURL = () => 'blob:stub';
  if (!g.URL.revokeObjectURL) g.URL.revokeObjectURL = () => {};
  g.FileReader = class {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    result: string | null = null;
    readAsDataURL(file: any) {
      this.result = file?.dataUrl ?? 'data:image/png;base64,iVBORw0KGgo=';
      this.onload?.();
    }
  };
  const saved = {
    document: g.document,
    window: g.window,
    localStorage: g.localStorage,
    requestAnimationFrame: g.requestAnimationFrame,
    getComputedStyle: g.getComputedStyle,
    history: g.history,
    CustomEvent: g.CustomEvent,
    HTMLElement: g.HTMLElement,
    Blob: g.Blob,
    FileReader: g.FileReader,
  };

  g.document = document;
  g.window = window;
  g.localStorage = window.localStorage;
  g.history = window.history;
  g.requestAnimationFrame = (fn: () => void) => {
    fn();
    return 0;
  };
  g.getComputedStyle = () => ({ getPropertyValue: () => '0' });
  g.CustomEvent = class {
    type: string;
    detail: unknown;
    bubbles: boolean;
    target: unknown = null;
    constructor(type: string, init: { detail?: unknown; bubbles?: boolean } = {}) {
      this.type = type;
      this.detail = init.detail;
      this.bubbles = !!init.bubbles;
    }
  };

  return {
    document,
    window,
    restore() {
      Object.assign(g, saved);
    },
  };
}


/** Clears mounted roots so surface/toast state starts clean per test. */
export function resetDom(): void {
  const doc = (globalThis as any).document;
  if (!doc) return;
  doc.body.replaceChildren();
  doc.head.replaceChildren();
  doc.documentElement.replaceChildren();
  doc.documentElement.style = { setProperty: (k: string, v: string) => { (doc.documentElement.style as any)[k] = v; } };
  doc.documentElement.dataset = {};
}
