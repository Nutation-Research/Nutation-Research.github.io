export const CONTACT_EMAIL = 'contact@nutationresearch.com';

export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}

export function copyLabel(copied: boolean): string {
  return copied ? 'copied' : 'copy';
}

export function mountContact(
  roots: Iterable<HTMLDetailsElement>,
  opts?: { write?: (text: string) => Promise<void> },
): void {
  const write =
    opts?.write ??
    (async (text: string) => {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      throw new Error('clipboard unavailable');
    });

  const items = Array.from(roots);
  for (const root of items) {
    const copyBtn = root.querySelector<HTMLButtonElement>('[data-copy]');
    if (!copyBtn) continue;

    let reset = 0;
    copyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await write(CONTACT_EMAIL);
        copyBtn.textContent = copyLabel(true);
        window.clearTimeout(reset);
        reset = window.setTimeout(() => {
          copyBtn.textContent = copyLabel(false);
        }, 1400);
      } catch {
        copyBtn.textContent = 'copy failed';
        window.clearTimeout(reset);
        reset = window.setTimeout(() => {
          copyBtn.textContent = copyLabel(false);
        }, 1400);
      }
    });
  }

  // Opening one Contact panel closes the other so they never stack.
  for (const root of items) {
    root.addEventListener('toggle', () => {
      if (!root.open) return;
      for (const other of items) {
        if (other !== root) other.open = false;
      }
    });
  }

  const closeAll = () => {
    for (const root of items) root.open = false;
  };
  document.addEventListener('pointerdown', (e) => {
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (items.some((root) => root.contains(target))) return;
    closeAll();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });
}
