/**
 * "Apply to be our beta tester" form. Submits to a Formspree endpoint (no backend of our
 * own — this is a static site) so responses land in the Formspree dashboard AND get emailed
 * to whoever the form is configured to notify.
 *
 * SETUP: sign up at https://formspree.io (free tier is enough), create a form, and replace
 * BETA_FORM_ENDPOINT below with the endpoint it gives you (looks like
 * "https://formspree.io/f/abcdwxyz"). Until then the form shows a friendly "not connected
 * yet" message instead of silently failing.
 */

export const BETA_FORM_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID';

/** True once BETA_FORM_ENDPOINT has been replaced with a real Formspree endpoint. */
export function isConfigured(endpoint: string): boolean {
  return /^https:\/\/formspree\.io\/f\/[a-z0-9]+$/i.test(endpoint);
}

export type SubmitState = 'idle' | 'pending' | 'ok' | 'error';

export function statusText(state: SubmitState, configured: boolean): string {
  switch (state) {
    case 'pending':
      return 'Sending…';
    case 'ok':
      return "Thanks — we'll be in touch.";
    case 'error':
      return configured
        ? 'Something went wrong. Please try again, or email us directly.'
        : "This form isn't connected yet — email us directly in the meantime.";
    default:
      return '';
  }
}

export function mountBetaForm(
  form: HTMLFormElement | null,
  opts?: { endpoint?: string; fetchImpl?: typeof fetch },
): void {
  if (!form) return;
  const endpoint = opts?.endpoint ?? BETA_FORM_ENDPOINT;
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const submit = form.querySelector<HTMLButtonElement>('#beta-submit');
  const status = form.querySelector<HTMLElement>('#beta-status');
  const configured = isConfigured(endpoint);

  const setState = (state: SubmitState) => {
    if (!status) return;
    status.textContent = statusText(state, configured);
    status.dataset.state = state;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (!configured) {
      setState('error');
      return;
    }

    setState('pending');
    if (submit) submit.disabled = true;

    fetchImpl(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    })
      .then((res) => {
        setState(res.ok ? 'ok' : 'error');
        if (res.ok) form.reset();
      })
      .catch(() => setState('error'))
      .finally(() => {
        if (submit) submit.disabled = false;
      });
  });
}
