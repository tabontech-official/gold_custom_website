/**
 * Session gate for the first-load intro, kept out of root.tsx so it can be
 * asserted directly — Node strips types from `.ts` but cannot transform
 * `.tsx`.
 *
 * This ships as a source string rather than a normal module because it has to
 * run synchronously inside `<head>`, ahead of the first paint and long before
 * React hydrates. Anything that waits for hydration is too late: the overlay
 * would already have painted for a frame on every page of the session.
 */

export const INTRO_SESSION_KEY = 'gc-intro';

/**
 * Stamps `<html data-intro="seen">` when the intro should be SKIPPED.
 *
 * Deliberately a skip-flag rather than a show-flag. Every failure path —
 * storage disabled, private mode, a sandboxed iframe, a quota error — lands in
 * the catch and marks it seen, so the bad outcome is "no intro" instead of
 * "intro on every single navigation".
 */
export function introGateScript(key: string = INTRO_SESSION_KEY): string {
  return `try{if(sessionStorage.getItem('${key}'))document.documentElement.dataset.intro='seen';else sessionStorage.setItem('${key}','1')}catch(e){document.documentElement.dataset.intro='seen'}`;
}
