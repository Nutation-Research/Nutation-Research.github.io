export const DISPLAY_IDS = [
  'cormorant',
  'source',
  'fraunces',
  'instrument',
  'syne',
  'noto',
  'baskerville',
  'crimson',
  'lora',
  'playfair',
] as const;
export const LEAD_IDS = [
  'garamond',
  'epilogue',
  'instrument-sans',
  'chivo',
  'jost',
  'karla',
  'outfit',
  'hanken',
  'cabin',
  'chivo-mono',
] as const;
export const PILL_IDS = ['muted', 'rose', 'silver'] as const;

export type DisplayId = (typeof DISPLAY_IDS)[number];
export type LeadId = (typeof LEAD_IDS)[number];
export type PillId = (typeof PILL_IDS)[number];

export type TypeState = {
  display: DisplayId;
  lead: LeadId;
  pill: PillId;
};

export const DISPLAY_STORAGE_KEY = 'nutation-display';
export const LEAD_STORAGE_KEY = 'nutation-lead';
export const PILL_STORAGE_KEY = 'nutation-pill';

export const DEFAULT_DISPLAY: DisplayId = 'cormorant';
export const DEFAULT_LEAD: LeadId = 'garamond';
export const DEFAULT_PILL: PillId = 'muted';

function pick<T extends string>(ids: readonly T[], raw: string | null | undefined, fallback: T): T {
  return ids.includes(raw as T) ? (raw as T) : fallback;
}

export function parseDisplayId(raw: string | null | undefined): DisplayId {
  return pick(DISPLAY_IDS, raw, DEFAULT_DISPLAY);
}
export function parseLeadId(raw: string | null | undefined): LeadId {
  return pick(LEAD_IDS, raw, DEFAULT_LEAD);
}
export function parsePillId(raw: string | null | undefined): PillId {
  return pick(PILL_IDS, raw, DEFAULT_PILL);
}

export function applyType(state: TypeState, root: HTMLElement = document.documentElement): void {
  root.dataset.display = state.display;
  root.dataset.lead = state.lead;
  root.dataset.pill = state.pill;
  root.style.removeProperty('--display-weight');
  root.style.removeProperty('--lead-weight');
  root.style.removeProperty('--head-size');
  root.style.removeProperty('--lead-size');
}

export function mountTypePicker(el: HTMLElement, storage: Storage): void {
  const state: TypeState = {
    display: parseDisplayId(storage.getItem(DISPLAY_STORAGE_KEY)),
    lead: parseLeadId(storage.getItem(LEAD_STORAGE_KEY)),
    pill: parsePillId(storage.getItem(PILL_STORAGE_KEY)),
  };

  const persist = () => {
    applyType(state);
    storage.setItem(DISPLAY_STORAGE_KEY, state.display);
    storage.setItem(LEAD_STORAGE_KEY, state.lead);
    storage.setItem(PILL_STORAGE_KEY, state.pill);
  };

  const bindChoice = <K extends keyof TypeState>(
    attr: K,
    parse: (raw: string | null | undefined) => TypeState[K],
  ) => {
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>(`[data-${attr}]`));
    const paint = () => {
      for (const b of buttons) b.classList.toggle('is-on', b.dataset[attr] === state[attr]);
    };
    for (const b of buttons) {
      b.addEventListener('click', () => {
        state[attr] = parse(b.dataset[attr]);
        persist();
        paint();
      });
    }
    paint();
  };

  persist();
  bindChoice('display', parseDisplayId);
  bindChoice('lead', parseLeadId);
  bindChoice('pill', parsePillId);
}
