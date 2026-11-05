import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

const source = readFileSync(new URL('../tma-downloader.user.js', import.meta.url), 'utf8')
  .replace('  const xhr =', '  globalThis.api = { getLightbox, getCurrentImage, getGallery, galleryWarning, validateImage, save, saveAll };\n  const xhr =');
const url = (name, size = 'hd') => `https://photos.toutemonannee.com/gallery/${size}/${name}.jpg?lastmod=123`;
const slide = (name, extra = '') => `<img src="${url(name)}" ${extra}>`;
const thumb = (name, state = 'false', extra = '') => `<button aria-current="${state}" ${extra}><img src="${url(name, 'thumbs')}"></button>`;
const viewer = (body, { label = 'Visionneuse', counter = '1/1', attrs = '', toolbar = true } = {}) =>
  `<div role="dialog" aria-modal="true" aria-label="${label}" ${attrs}>
    ${body}
    ${counter === null ? '' : `<div aria-live="polite">${counter}</div>`}
    ${toolbar ? '<div role="toolbar"><button>Like</button></div>' : '<button><svg data-icon="xmark"></svg></button>'}
  </div>`;

function setup(html = '', { response, confirm = true } = {}) {
  const { document, HTMLElement } = parseHTML(`<html><head><base href="https://www.toutemonannee.com/"></head><body>${html}</body></html>`);
  const timers = [];
  const listeners = {};
  const requests = [];
  const downloads = [];
  const alerts = [];
  const confirmations = [];
  let mutation;
  HTMLElement.prototype.getClientRects = function () { return this.hasAttribute('hidden') ? [] : [{}]; };
  HTMLElement.prototype.getBoundingClientRect = function () {
    const left = this.hasAttribute('data-offscreen') ? 1000 : 0;
    return { left, right: left + 500, top: 0, bottom: 500, width: 500, height: 500 };
  };
  const createElement = document.createElement.bind(document);
  document.createElement = tag => {
    const el = createElement(tag);
    if (tag === 'a') el.click = () => downloads.push({ url: el.href, filename: el.download });
    return el;
  };
  document.addEventListener = (name, fn) => { listeners[name] = fn; };
  const context = {
    document, Blob,
    URL: class extends URL {
      static createObjectURL() { return 'blob:test-image'; }
      static revokeObjectURL() {}
    },
    innerWidth: 800, innerHeight: 600,
    getComputedStyle: el => ({ visibility: el.style.visibility || 'visible', display: el.hidden ? 'none' : 'block' }),
    GM: { xmlHttpRequest(options) {
      requests.push(options.url);
      options.onload(response ?? { status: 200, response: new Blob(['valid image'], { type: 'image/jpeg' }) });
    } },
    async createImageBitmap(blob) {
      if (await blob.text() !== 'valid image') throw new Error('Image decode failed');
      return { close() {} };
    },
    alert: msg => alerts.push(msg),
    confirm: msg => { confirmations.push(msg); return confirm; },
    console: { log() {}, error() {} },
    MutationObserver: class {
      constructor(fn) { mutation = fn; }
      observe() {}
    },
    setTimeout(fn, ms) { if (ms === 400) fn(); else timers.push(fn); },
  };
  runInNewContext(source, context);
  return { api: context.api, document, timers, listeners, requests, downloads, alerts, confirmations, mutate: () => mutation() };
}

const urls = api => Array.from(api.getGallery().urls);

test('viewer recognition ignores translations and generated CSS classes', () => {
  for (const label of ['Visionneuse', 'Photo viewer', 'Fotogalerij', '']) {
    const { api } = setup(viewer(slide('single'), { label, attrs: 'class="random-build-123"' }));
    assert.ok(api.getLightbox());
    assert.equal(api.getCurrentImage(), url('single'));
  }
});

test('hidden and unrelated dialogs are ignored, ambiguous viewers are rejected', () => {
  const one = viewer(slide('single'));
  assert.equal(setup(`${viewer(slide('hidden'), { attrs: 'hidden' })}${one}<div role="dialog"><img src="logo.png"></div>`).api.getCurrentImage(), url('single'));
  assert.equal(setup(one + viewer(slide('other'))).api.getLightbox(), null);
});

test('native dialog and close-icon fallback work without aria-modal or a toolbar', () => {
  const html = viewer(slide('single'), { toolbar: false }).replace('<div role="dialog" aria-modal="true"', '<dialog open').replace(/<\/div>$/, '</dialog>');
  assert.ok(setup(html).api.getLightbox());
});

test('a single-photo viewer without a readable counter is recognized but warns about completeness', async () => {
  const html = viewer(slide('single') + '<button><svg data-icon="xmark"></svg></button>', { counter: null });
  const state = setup(html);
  assert.equal(state.api.getCurrentImage(), url('single'));
  await state.api.saveAll();
  assert.match(state.confirmations[0], /total could not be verified/);
  assert.match(state.alerts[0], /Some photos may be missing/);
});

test('batch uses only the open viewer, preserving order and deduplicating resolutions', () => {
  const { api } = setup(thumb('unrelated') + viewer(
    slide('first') + thumb('first') + thumb('second', 'true') + thumb('first'), { counter: '2/2' },
  ));
  assert.deepEqual(urls(api), [url('first'), url('second')]);
  assert.equal(api.getCurrentImage(), url('second'));
  assert.equal(api.galleryWarning(api.getGallery()), '');
});

test('selected thumbnail wrappers support aria-selected and other aria-current values', () => {
  for (const marker of ['aria-selected="true"', 'aria-current="page"']) {
    const { api } = setup(viewer(slide('first', 'data-offscreen') + slide('second') +
      `<div ${marker}><a><img src="${url('second', 'thumbs')}"></a></div>`, { counter: '2/2' }));
    assert.equal(api.getCurrentImage(), url('second'));
  }
});

test('mounted full-image URLs take priority and preserve signed query parameters', () => {
  const full = `${url('first')}&token=original-signature`;
  const { api } = setup(viewer(`<img src="${full}">` + thumb('first', 'true')));
  assert.equal(api.getCurrentImage(), full);
  assert.deepEqual(urls(api), [full]);
});

test('single-photo galleries use the visible full image without rewriting its URL', () => {
  const full = 'https://new-cdn.example/original/photo?size=original&signature=abc';
  const { api } = setup(viewer(`<img src="${full}">`));
  assert.equal(api.getCurrentImage(), full);
  assert.deepEqual(urls(api), [full]);
});

test('offscreen neighbors are ignored; ambiguous visible slides are rejected', () => {
  assert.equal(setup(viewer(slide('first') + slide('second', 'data-offscreen'), { counter: '1/2' })).api.getCurrentImage(), url('first'));
  assert.equal(setup(viewer(slide('first') + slide('second'), { counter: '1/2' })).api.getCurrentImage(), null);
});

test('partial galleries warn before downloading and in the final summary', async () => {
  const state = setup(viewer(slide('first') + thumb('first', 'true') + thumb('second'), { counter: '1/11' }));
  await state.api.saveAll();
  assert.match(state.confirmations[0], /Only 2 of 11 photos were found/);
  assert.match(state.alerts[0], /Downloaded: 2 of 11/);
  assert.match(state.alerts[0], /9 photos are missing/);
  assert.equal(state.downloads.length, 2);
});

test('partial batch warnings can be cancelled before any request', async () => {
  const state = setup(viewer(slide('first'), { counter: '1/11' }), { confirm: false });
  await state.api.saveAll();
  assert.match(state.confirmations[0], /Only 1 of 11/);
  assert.equal(state.requests.length, 0);
});

test('unknown, conflicting and inconsistent totals are never reported as complete', async () => {
  for (const counter of [null, 'Photo 1', '1/1']) {
    const state = setup(viewer(slide('first') + thumb('first', 'true') + thumb('second'), { counter }));
    await state.api.saveAll();
    assert.match(state.confirmations[0], /Warning:/);
    assert.match(state.alerts[0], /Warning:/);
  }
  const { api } = setup(viewer(slide('first') + '<div role="status">1/2</div>'));
  assert.equal(api.getGallery().total, null);
});

test('failed requests are included in the final gallery total', async () => {
  const state = setup(viewer(slide('first')), { response: { status: 403, statusText: 'Forbidden' } });
  await state.api.saveAll();
  assert.match(state.alerts[0], /Downloaded: 0 of 1/);
  assert.match(state.alerts[0], /Failed requests: 1/);
  assert.equal(state.downloads.length, 0);
});

test('HTTP errors, empty images and HTML responses cannot be saved as photos', async () => {
  const { api } = setup();
  for (const response of [
    { status: 0 }, { status: 302 }, { status: 404 },
    { status: 200, response: new Blob([]) },
    { status: 200, response: new Blob(['<html>Login</html>'], { type: 'text/html' }) },
    { status: 200, response: new Blob(['<html>Error</html>'], { type: 'image/jpeg' }) },
  ]) await assert.rejects(api.validateImage(response));
  for (const type of ['image/jpeg', 'application/octet-stream', '']) {
    await assert.doesNotReject(api.validateImage({ status: 200, response: new Blob(['valid image'], { type }) }));
  }
});

test('closed viewers do not collect unrelated photos or consume D', () => {
  const { api, listeners } = setup(thumb('unrelated'));
  assert.deepEqual(urls(api), []);
  let prevented = false;
  listeners.keydown({ key: 'd', target: { closest: () => null }, preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
});

test('D ignores editable targets, modifiers, held keys and handled events', () => {
  const { listeners } = setup(viewer(slide('current')));
  for (const overrides of [
    { target: { closest: () => ({}) } },
    { ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true },
    { repeat: true }, { defaultPrevented: true },
  ]) {
    let prevented = false;
    listeners.keydown({ key: 'd', target: { closest: () => null }, preventDefault() { prevented = true; }, ...overrides });
    assert.equal(prevented, false);
  }
});

test('frequent page mutations cannot postpone button injection indefinitely', () => {
  const { timers, mutate } = setup();
  for (let i = 0; i < 100; i++) mutate();
  assert.equal(timers.length, 1);
  timers.shift()();
  mutate();
  assert.equal(timers.length, 1);
});
