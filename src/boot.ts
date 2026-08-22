/** Force the static site chrome visible — used when WebGL/init fails or as a timeout. */
export function revealSite(reason: string): void {
  console.warn('[nutation] revealing site without intro:', reason);
  document.body.classList.remove('intro-running', 'boot-pending');
  document.body.classList.add('docked', 'boot-failed');
  document.getElementById('boot-hint')?.remove();
  const stage = document.getElementById('stage');
  if (stage) {
    stage.style.opacity = '0';
    stage.style.pointerEvents = 'none';
  }
  const fx = document.getElementById('fx') as HTMLElement | null;
  if (fx) fx.style.display = 'none';
  const headerMark = document.getElementById('header-mark') as HTMLElement | null;
  if (headerMark) headerMark.style.opacity = '';
}

