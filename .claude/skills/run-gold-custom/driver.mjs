#!/usr/bin/env node
// Headless-Chrome driver for the Gold Custom Hydrogen storefront.
// Raw CDP over Node's built-in WebSocket/fetch — no npm deps, no Playwright download.
// ponytail: CDP by hand because Node 24 already ships WebSocket+fetch; swap for
// Playwright only if you need multi-browser or auto-waiting selectors.
import {spawn} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));

const SHOTS = process.env.SHOT_DIR || 'shots';
const VIEWPORT = (process.env.VIEWPORT || '1440x900').split('x').map(Number);

// ---------------------------------------------------------------- dev server
async function findBase() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const found = [];
  for (let port = 3000; port <= 3010; port++) {
    try {
      const r = await fetch(`http://localhost:${port}/`, {
        signal: AbortSignal.timeout(2500),
      });
      const html = await r.text();
      // Hydrogen/React-Router SSR marker — skips unrelated servers on these ports.
      if (html.includes('data-discover') || html.includes('__reactRouter'))
        found.push(port);
    } catch {}
  }
  if (!found.length)
    throw new Error(
      'No Hydrogen dev server found on ports 3000-3010. Run `npm run dev` first.',
    );
  if (found.length > 1)
    console.warn(
      `WARNING: ${found.length} dev servers responding (ports ${found.join(', ')}).\n` +
        `  Stale servers serve stale code. Using ${found[0]} — kill the others, or set BASE_URL.`,
    );
  return `http://localhost:${found[0]}`;
}

// ---------------------------------------------------------------------- CDP
let msgId = 0;
const pending = new Map();
const events = [];
let ws;

function send(method, params = {}, sessionId) {
  const id = ++msgId;
  ws.send(JSON.stringify({id, method, params, sessionId}));
  return new Promise((res, rej) => {
    pending.set(id, {res, rej});
    setTimeout(() => pending.has(id) && rej(new Error(`${method} timed out`)), 30000);
  });
}

async function connect() {
  const dir = mkdtempSync(join(tmpdir(), 'gold-cdp-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${dir}`,
      `--window-size=${VIEWPORT[0]},${VIEWPORT[1]}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      'about:blank',
    ],
    {stdio: 'ignore'},
  );

  // Chrome writes the real port here once the debug socket is listening.
  const portFile = join(dir, 'DevToolsActivePort');
  let port;
  for (let i = 0; i < 100; i++) {
    if (existsSync(portFile)) {
      const p = readFileSync(portFile, 'utf8').split('\n')[0].trim();
      if (p) {
        port = p;
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!port) throw new Error('Chrome never opened a debug port');

  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = ({data}) => {
    const m = JSON.parse(data);
    if (m.id && pending.has(m.id)) {
      const {res, rej} = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    } else if (m.method) {
      events.push(m);
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT[0],
    height: VIEWPORT[1],
    deviceScaleFactor: 1,
    mobile: false,
  });
  return chrome;
}

// ------------------------------------------------------------------ helpers
const evaluate = async (expr) => {
  const {result, exceptionDetails} = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails)
    throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
};

async function goto(path) {
  const url = path.startsWith('http') ? path : BASE + (path.startsWith('/') ? path : '/' + path);
  const loaded = new Promise((r) => {
    const t = setInterval(() => {
      if (events.some((e) => e.method === 'Page.loadEventFired')) {
        clearInterval(t);
        r();
      }
    }, 50);
    setTimeout(() => (clearInterval(t), r()), 20000);
  });
  events.length = 0;
  await send('Page.navigate', {url});
  await loaded;
  // React Router hydrates after load; give the client render a beat.
  await evaluate('new Promise(r=>requestAnimationFrame(()=>setTimeout(r,600)))');
  console.log(`goto ${url}`);
}

// Element centre in CSS pixels, for real mouse events (hover menus need these).
async function centre(sel) {
  const box = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(
    sel,
  )});if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  if (!box) throw new Error(`selector not found: ${sel}`);
  return box;
}

async function mouse(sel, click) {
  const {x, y} = await centre(sel);
  await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y, buttons: 0});
  if (click) {
    const base = {x, y, button: 'left', buttons: 1, clickCount: 1};
    await send('Input.dispatchMouseEvent', {type: 'mousePressed', ...base});
    await send('Input.dispatchMouseEvent', {type: 'mouseReleased', ...base});
  }
  await evaluate('new Promise(r=>setTimeout(r,400))');
  console.log(`${click ? 'click' : 'hover'} ${sel}`);
}

async function shot(name) {
  mkdirSync(SHOTS, {recursive: true});
  const {contentSize} = await send('Page.getLayoutMetrics');
  const {data} = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: VIEWPORT[0],
      height: Math.min(contentSize.height, 12000),
      scale: 1,
    },
  });
  const file = join(SHOTS, `${name}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`shot ${file}`);
}

// Console errors + failed requests — the payload that makes this worth running.
function report() {
  const errs = events
    .filter((e) => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
    .map((e) => e.params.args.map((a) => a.description || a.value).join(' '));
  const ex = events
    .filter((e) => e.method === 'Runtime.exceptionThrown')
    .map((e) => e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text);
  const fails = events
    .filter((e) => e.method === 'Network.loadingFailed')
    .map((e) => `${e.params.errorText} ${e.params.type}`);
  const all = [...ex, ...errs, ...fails];
  console.log(all.length ? `\nPAGE ERRORS (${all.length}):\n  ` + all.join('\n  ') : '\nno page errors');
  return ex.length;
}

// --------------------------------------------------------------------- main
const BASE = await findBase();
console.log(`base ${BASE}`);
const chrome = await connect();
let bad = 0;
try {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const cmd = argv[i];
    if (cmd === 'goto') await goto(argv[++i]);
    else if (cmd === 'shot') await shot(argv[++i]);
    else if (cmd === 'click') await mouse(argv[++i], true);
    else if (cmd === 'hover') await mouse(argv[++i], false);
    else if (cmd === 'type')
      await evaluate(
        `(()=>{const e=document.querySelector(${JSON.stringify(argv[i + 1])});
         e.focus();e.value=${JSON.stringify(argv[i + 2])};
         e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
      ), (i += 2);
    else if (cmd === 'text')
      console.log(
        `text ${argv[i + 1]} => ` +
          JSON.stringify(
            await evaluate(
              `document.querySelector(${JSON.stringify(argv[++i])})?.innerText?.slice(0,400) ?? null`,
            ),
          ),
      );
    else if (cmd === 'count')
      console.log(
        `count ${argv[i + 1]} => ` +
          (await evaluate(`document.querySelectorAll(${JSON.stringify(argv[++i])}).length`)),
      );
    else if (cmd === 'eval') console.log('eval => ' + JSON.stringify(await evaluate(argv[++i])));
    else if (cmd === 'wait') await evaluate(`new Promise(r=>setTimeout(r,${+argv[++i]}))`);
    else throw new Error(`unknown command: ${cmd}`);
  }
  bad = report();
} finally {
  // ponytail: close over CDP before killing. SIGKILL mid-request resets the
  // socket, and mini-oxygen's vite middleware answers an aborted request by
  // writing headers twice — which takes the whole dev server down.
  await send('Browser.close').catch(() => {});
  await new Promise((r) => setTimeout(r, 250));
  chrome.kill();
}
process.exit(bad ? 1 : 0);
