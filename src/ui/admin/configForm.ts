/** Edit the actual configuration through labeled controls; no code editor required. */
export function renderConfigForm(root: HTMLElement, config: object, onChange: () => void = () => {}): void {
  root.replaceChildren();
  const label = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
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
        input.type = typeof entry === 'boolean' ? 'checkbox' : typeof entry === 'number' ? 'number' : 'text';
        if (input.type === 'checkbox') input.checked = Boolean(entry);
        else input.value = String(entry ?? '');
        if (input.type === 'number') input.step = 'any';
        input.addEventListener('input', () => {
          if (!input.checkValidity()) return;
          value[key] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
          onChange();
        });
        row.append(caption, input); parent.append(row);
      }
    }
  }
  render(root, config as Record<string, unknown>, 0);
}
