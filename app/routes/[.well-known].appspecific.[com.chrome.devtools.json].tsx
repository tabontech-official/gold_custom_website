/**
 * Chrome DevTools' "automatic workspace folders" probe.
 *
 * NOT a bug and not something a visitor or a crawler ever requests. Chrome asks
 * for this file whenever DevTools is open, to see whether the site declares a
 * local folder it can map for editing. A 404 is the correct answer and Chrome
 * handles it fine — it just gives up on the workspace feature.
 *
 * This route exists for one reason: without it the request falls through to the
 * `$` catch-all, which THROWS a 404 Response, which means the root
 * ErrorBoundary renders — and that renders the whole document shell, including
 * the ~155 KB stylesheet root.tsx inlines. That is why the probe showed up in
 * the dev log at 21–106 ms a go, several times a session. A resource route with
 * no component returns before any of that happens.
 *
 * 204 rather than 404 so the line stops being red in the dev log. The other
 * option was serving a real workspace descriptor, which would let DevTools
 * write edits straight to disk — but it needs a machine-specific absolute path
 * and a per-checkout UUID, so it is not something that can be committed.
 */
export function loader() {
  return new Response(null, {status: 204});
}
