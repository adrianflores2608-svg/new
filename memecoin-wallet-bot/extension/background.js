// Service workers aren't subject to the visited page's Content-Security-Policy,
// so the fetch to the local bot happens here rather than in content.js —
// content scripts share enough of the page's context that a direct fetch can
// be blocked by a strict CSP on some sites.
const LOCAL_SERVER_BASE = "http://127.0.0.1:4756";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GET_SIGNAL" || !message.mint) return undefined;

  fetch(`${LOCAL_SERVER_BASE}/api/signal/${encodeURIComponent(message.mint)}`)
    .then((res) => res.json())
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));

  return true; // keep the message channel open for the async sendResponse above
});
