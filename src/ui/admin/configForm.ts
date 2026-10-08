/** Edit the actual configuration through labeled controls; no code editor required. */
export function renderConfigForm(root: HTMLElement, config: object, onChange: () => void = () => {}): void {
  root.replaceChildren();
  const label = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
  const bounds = (key: string, current: number) => {
    const name = key.toLowerCase();
    const integer = Number.isInteger(current);
    let min = current < 0 ? Math.min(current * 2, -100) : 0;
    let max = Math.max(current * 2, 100);
    const precision = String(current).split('.')[1]?.length ?? 0;
    let step = integer ? 1 : Math.pow(10, -Math.min(precision, 3));
    if (/percent|chance|rate$/.test(name) && /percent|chance/.test(name)) { min = 0; max = 100; step = 1; }
    else if (/cooldown|duration|seconds|timeout|grace/.test(name)) { min = 0; max = Math.max(current * 2, 60); step = integer ? 1 : 0.1; }
    else if (/speed|multiplier|scale|factor/.test(name)) { min = 0; max = Math.max(current * 2, 10); step = Math.pow(10, -Math.max(1, Math.min(precision, 3))); }
    else if (/width|height|size|count|pack|range|level|lives|health|damage|cost|reward|income|coins|fruts|points|score|start|cap|limit/.test(name)) { min = 0; max = Math.max(current * 2, 100); step = integer ? 1 : 0.1; }
    if (current < min) min = current;
    if (current > max) max = current;
    return { min, max, step };
  };
  function render(parent: HTMLElement, value: Record<string, unknown>, depth: number): void {
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== null && typeof entry === 'object') {
        const section = document.createElement('details');
        section.open = depth < 1;
        const title = document.createElement('summary'); title.textContent = label(key);
        section.append(title); parent.append(section);
        render(section, entry as Record<string, unknown>, depth + 1);
      } else {
        const row = document.createElement('label'); row.className = 'admin-config-field';
        const caption = document.createElement('span'); caption.textContent = label(key);
        const input = document.createElement('input'); input.className = 'admin-input';
        input.type = typeof entry === 'boolean' ? 'checkbox' : typeof entry === 'number' ? 'range' : 'text';
        if (input.type === 'checkbox') input.checked = Boolean(entry);
        else input.value = String(entry ?? '');
        let output: HTMLOutputElement | null = null;
        if (input.type === 'range') {
          const range = bounds(key, entry as number);
          input.min = String(range.min); input.max = String(range.max); input.step = String(range.step);
          input.value = String(entry);
          output = document.createElement('output'); output.className = 'admin-config-value'; output.value = String(entry);
          output.textContent = String(entry);
          input.setAttribute('aria-label', label(key));
          input.setAttribute('aria-valuetext', String(entry));
        }
        input.addEventListener('input', () => {
          if (!input.checkValidity()) return;
          value[key] = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
          if (output) { output.value = input.value; output.textContent = input.value; input.setAttribute('aria-valuetext', input.value); }
          onChange();
        });
        row.append(caption, input);
        if (output) row.append(output);
        parent.append(row);
      }
    }
  }
  render(root, config as Record<string, unknown>, 0);
}
