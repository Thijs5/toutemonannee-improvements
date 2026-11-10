// ==UserScript==
// @name         TMA gallery downloader
// @description  Download photos from TouteMonAnnée galleries with one click.
// @author       Thijs Dickmans
// @license      MIT
// @homepage     https://github.com/Thijs5/toutemonannee-improvements
// @supportURL   https://github.com/Thijs5/toutemonannee-improvements/issues
// @namespace    tma-dl
// @match        https://*.toutemonannee.com/*
// @version      1.4.3
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @downloadURL https://update.greasyfork.org/scripts/596836/TMA%20gallery%20downloader.user.js
// @updateURL https://update.greasyfork.org/scripts/596836/TMA%20gallery%20downloader.meta.js
// ==/UserScript==

// Development placeholder: do not bump @version here. The release workflow
// fills it in from the Git tag (e.g. v1.5.0 -> 1.5.0) in the release asset and
// a generated release commit. Only the release tag moves to that commit; main
// keeps this placeholder so Greasy Fork receives the correct tagged version.

(function () {
  'use strict';

  const xhr = (typeof GM !== 'undefined' && GM.xmlHttpRequest) || GM_xmlhttpRequest;

  const log = (msg) => console.log(`%c[TMA-DL] ✓ ${msg}`, 'color: #00aa00; font-weight: bold;');
  const error = (msg) => console.error(`%c[TMA-DL] ✗ ${msg}`, 'color: #ff0000; font-weight: bold;');

  const toHd = u => u.replace(/\/(thumbs|web)\//, '/hd/');
  const baseName = u => u.split('/').pop().split('?')[0];
  const lastmod = u => (u.match(/[?&]lastmod=(\d+)/) || [])[1];

  function stamp(u) {
    const s = lastmod(u);
    if (!s) return '';
    const d = new Date(+s * 1000);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  function nameOf(u, seq) {
    const parts = [];
    const st = stamp(u);
    if (st) parts.push(st);
    if (seq != null) parts.push(String(seq).padStart(3, '0'));
    parts.push(baseName(u));
    return parts.join('_');
  }

  const imageUrl = img => img && (img.currentSrc || img.src);
  const controlSelector = 'button, [role="button"], [role="tab"]';
  const thumbnailSelector = '[aria-current] img, [aria-selected] img, img[aria-current], img[aria-selected]';

  function getCounter(lightbox) {
    const counters = [...lightbox.querySelectorAll('[aria-live], [role="status"]')]
      .map(el => el.textContent.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/))
      .filter(Boolean)
      .map(match => ({ current: Number(match[1]), total: Number(match[2]) }))
      .filter(({ current, total }) => current > 0 && total >= current && Number.isSafeInteger(total));
    if (!counters.length) return null;
    const first = counters[0];
    return counters.every(c => c.current === first.current && c.total === first.total) ? first : null;
  }

  function getSlideImages(lightbox) {
    return [...lightbox.querySelectorAll('img')].filter(img =>
      !img.closest(`${controlSelector}, [aria-current], [aria-selected]`) && imageUrl(img));
  }

  function getLightbox() {
    // Accessible names are translated copy, not identifiers. Require multiple
    // viewer signals and refuse ambiguous matches instead of guessing a dialog.
    const candidates = [...document.querySelectorAll('[role="dialog"], dialog[open]')].filter(el => {
      if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') return false;
      if (!el.querySelector('img')) return false;
      const toolbar = el.querySelector('[role="toolbar"]');
      const close = el.querySelector('button svg[data-icon="xmark"]');
      return (toolbar || close) && (getCounter(el) || el.querySelector(thumbnailSelector) || (toolbar && close));
    });
    return candidates.length === 1 ? candidates[0] : null;
  }

  function imageKey(url) {
    // Keep the original download URL (including signed query parameters).
    // Only normalize its path for matching a preview to a mounted full image.
    try {
      return toHd(new URL(url, document.baseURI).pathname);
    } catch {
      return url;
    }
  }

  function fullImageUrl(img, lightbox) {
    const url = imageUrl(img);
    if (!url) return null;
    const full = getSlideImages(lightbox).find(slide => imageKey(imageUrl(slide)) === imageKey(url));
    return full ? imageUrl(full) : toHd(url);
  }

  function getCurrentImage(lightbox = getLightbox()) {
    if (!lightbox) return null;
    const selected = [...lightbox.querySelectorAll(thumbnailSelector)].filter(img => {
      const marker = img.closest('[aria-current], [aria-selected]');
      const current = marker.getAttribute('aria-current');
      return (current && current !== 'false') || marker.getAttribute('aria-selected') === 'true';
    });
    const urls = [...new Set(selected.map(img => fullImageUrl(img, lightbox)).filter(Boolean))];
    if (urls.length === 1) return urls[0];
    if (urls.length > 1) return null;

    // Without selection markers, accept only one visible slide. Neighboring
    // slides are also mounted; during an animation more than one may be visible.
    const box = lightbox.getBoundingClientRect();
    const visible = getSlideImages(lightbox).filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 &&
        Math.min(rect.right, box.right, innerWidth) > Math.max(rect.left, box.left, 0) &&
        Math.min(rect.bottom, box.bottom, innerHeight) > Math.max(rect.top, box.top, 0) &&
        getComputedStyle(img).visibility !== 'hidden' && getComputedStyle(img).display !== 'none';
    });
    const visibleUrls = [...new Set(visible.map(imageUrl))];
    return visibleUrls.length === 1 ? visibleUrls[0] : null;
  }

  function getGallery(lightbox = getLightbox()) {
    if (!lightbox) return { urls: [], total: null };
    const urls = [...new Set([...lightbox.querySelectorAll(thumbnailSelector)]
      .map(img => fullImageUrl(img, lightbox)).filter(Boolean))];
    if (!urls.length) {
      const current = getCurrentImage(lightbox);
      if (current) urls.push(current);
    }
    return { urls, total: getCounter(lightbox)?.total ?? null };
  }

  function galleryWarning({ urls, total }) {
    if (total === null) return 'The gallery total could not be verified. Some photos may be missing.';
    if (urls.length < total) return `Only ${urls.length} of ${total} photos were found. ${total - urls.length} photos are missing from this download.`;
    if (urls.length > total) return `Found ${urls.length} photos, but the viewer reports ${total}. The gallery contents could not be verified.`;
    return '';
  }

  async function validateImage(response) {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${response.statusText || 'Request failed'}`);
    }
    const blob = response.response;
    if (!(blob instanceof Blob) || !blob.size) throw new Error('The server returned an empty or invalid image');
    const type = blob.type.toLowerCase().split(';')[0].trim();
    if (type && !type.startsWith('image/') && type !== 'application/octet-stream' && type !== 'binary/octet-stream') {
      throw new Error(`Expected a photo, but the server returned ${type}`);
    }
    // MIME types alone cannot detect a login/error page mislabeled as an image.
    const bitmap = await createImageBitmap(blob);
    bitmap.close();
    return blob;
  }

  function save(url, filename) {
    return new Promise((res, rej) => {
      if (!url) {
        rej('No URL provided');
        return;
      }

      xhr({
        method: 'GET',
        url,
        responseType: 'blob',
        timeout: 30000,
        async onload(r) {
          try {
            const blob = await validateImage(r);
            const sizeKB = (blob.size / 1024).toFixed(1);
            const b = URL.createObjectURL(blob);
            const a = Object.assign(document.createElement('a'), { href: b, download: filename });
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(b), 10000);
            res({ filename, size: sizeKB });
          } catch (e) {
            rej(`Failed to save: ${e.message}`);
          }
        },
        onerror() {
          rej('Network error - check your connection');
        },
        ontimeout() {
          rej('Request timeout - server took too long to respond');
        },
      });
    });
  }

  async function saveCurrent() {
    const u = getCurrentImage();
    if (!u) {
      error('No image found in lightbox');
      return;
    }

    const filename = nameOf(u, null);
    try {
      const result = await save(u, filename);
      log(`Downloaded ${filename} (${result.size} KB)`);
    } catch (e) {
      error(`Failed to download ${filename}: ${e}`);
      alert(`Download failed:\n${e}`);
    }
  }

  async function saveAll() {
    const gallery = getGallery();
    const { urls, total } = gallery;
    const warning = galleryWarning(gallery);
    if (!urls.length) {
      error('No gallery images found');
      alert(`No gallery images found.\n${warning}`);
      return;
    }

    if (!confirm(`${warning ? `Warning: ${warning}\n\n` : ''}Download ${urls.length} photos?`)) return;

    let success = 0;
    let failed = 0;
    const failures = [];

    for (let i = 0; i < urls.length; i++) {
      const filename = nameOf(urls[i], i + 1);
      try {
        await save(urls[i], filename);
        success++;
      } catch (e) {
        failed++;
        failures.push(`  • ${filename}: ${e}`);
      }
      await new Promise(r => setTimeout(r, 400));
    }

    if (failed === 0 && !warning) {
      log(`Downloaded all ${success} photos`);
    } else {
      error(`Downloaded ${success}/${total ?? urls.length}. ${warning}\n${failures.join('\n')}`);
    }

    alert(`✓ Downloaded: ${success}${total !== null ? ` of ${total}` : ''}\n✗ Failed requests: ${failed}${warning ? `\n\nWarning: ${warning}` : ''}`);
  }

  // SVG icon
  const downloadSvg = `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="download" class="svg-inline--fa fa-download" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="width:1em;height:1em;margin-right:0.3em;"><path fill="currentColor" d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64v-32c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"></path></svg>`;

  const mkBtn = (label, title, icon, fn) => {
    const b = document.createElement('button');
    b.className = 'tma-dl-btn';
    b.title = title;
    b.type = 'button';
    b.style.display = 'flex';
    b.style.alignItems = 'center';
    b.style.gap = '0.3em';
    b.style.width = 'auto';
    b.style.flexShrink = '0';
    b.style.padding = '0 0.6em';
    
    const iconSpan = document.createElement('span');
    iconSpan.innerHTML = icon;
    iconSpan.style.display = 'flex';
    iconSpan.style.alignItems = 'center';
    b.appendChild(iconSpan);

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    b.appendChild(labelSpan);

    b.addEventListener('click', e => { 
      e.stopPropagation(); 
      e.preventDefault();
      fn(); 
    });
    return b;
  };

  function findToolbar() {
    const lightbox = getLightbox();
    if (!lightbox) return null;

    const toolbar = lightbox.querySelector('[role="toolbar"]');
    if (toolbar) return toolbar;

    // CSS module class names change on site releases. The close icon is a
    // stable, language-independent anchor in the viewer's control group.
    const close = lightbox.querySelector('button svg[data-icon="xmark"]');
    return close ? close.closest('button').parentElement : null;
  }

  function inject() {
    const bar = findToolbar();
    if (!bar || bar.querySelector('.tma-dl-btn')) return;

    try {
      const btn1 = mkBtn('Download', 'Download this photo (D)', downloadSvg, saveCurrent);
      const btn2 = mkBtn('Download All', 'Download all photos', downloadSvg, saveAll);
      
      const nativeButton = bar.querySelector('button:has(svg[data-icon="xmark"])') || bar.querySelector('button');
      for (const button of [btn1, btn2]) {
        if (nativeButton) button.className = `${nativeButton.className} tma-dl-btn`;
        bar.appendChild(button);
      }
      
      log('Buttons added to toolbar');
    } catch (e) {
      error(`Failed to add buttons to toolbar: ${e.message}`);
    }
  }

  let injectionPending = false;
  function scheduleInject() {
    if (injectionPending) return;
    injectionPending = true;
    setTimeout(() => {
      injectionPending = false;
      inject();
    }, 100);
  }
  scheduleInject();
  new MutationObserver(scheduleInject).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'd' && !e.repeat && !e.defaultPrevented &&
        !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey &&
        !e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]') &&
        getCurrentImage()) {
      e.preventDefault();
      saveCurrent();
    }
  });
})();
