// ==UserScript==
// @name         TMA gallery downloader
// @description  Download photos from TouteMonAnnée galleries with one click.
// @author       Thijs Dickmans
// @license      MIT
// @homepage     https://github.com/Thijs5/toutemonannee-improvements
// @supportURL   https://github.com/Thijs5/toutemonannee-improvements/issues
// @namespace    tma-dl
// @match        https://www.toutemonannee.com/*
// @version      0.0.0
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @downloadURL https://update.greasyfork.org/scripts/596836/TMA%20gallery%20downloader.user.js
// @updateURL https://update.greasyfork.org/scripts/596836/TMA%20gallery%20downloader.meta.js
// ==/UserScript==

// Development placeholder: do not bump @version here. The release workflow
// fills it in from the Git tag (e.g. v1.5 -> 1.5) in the published release asset.

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

  function getCurrentImage() {
    const lightbox = document.querySelector(
      '[role="dialog"][aria-modal="true"][aria-label="Visionneuse"]'
    );
    if (!lightbox) return null;

    // The lightbox also contains neighboring slides. Use its selected thumbnail.
    let img = lightbox.querySelector('button[aria-current="true"] img');
    if (!img) {
      // Single-photo galleries have no thumbnail strip. Avoid choosing a
      // neighboring slide when multiple distinct photos are mounted.
      const photos = [...lightbox.querySelectorAll('img')].filter(el => !el.closest('button'));
      const urls = new Set(photos.map(el => el.currentSrc || el.src).filter(Boolean));
      if (urls.size === 1) img = photos[0];
    }
    const url = img && (img.currentSrc || img.src);
    return url ? toHd(url) : null;
  }

  function getAllGalleryImages() {
    const allImages = document.querySelectorAll('img[src*="toutemonannee"][src*="thumbs"]');
    const urls = new Set();
    allImages.forEach(img => {
      if (img.src) urls.add(toHd(img.src));
    });
    return [...urls];
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
        onload(r) {
          if (r.status >= 400) {
            rej(`HTTP ${r.status}: ${r.statusText || 'Request failed'}`);
            return;
          }
          try {
            const sizeKB = (r.response.size / 1024).toFixed(1);
            const b = URL.createObjectURL(r.response);
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
    const urls = getAllGalleryImages();
    if (!urls.length) {
      error('No gallery images found');
      alert('No gallery images found');
      return;
    }

    if (!confirm(`Download ${urls.length} photos?`)) return;

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

    if (failed === 0) {
      log(`Downloaded all ${success} photos`);
    } else {
      error(`Downloaded ${success}/${urls.length}. Failed items:\n${failures.join('\n')}`);
    }

    alert(`✓ Downloaded: ${success}\n✗ Failed: ${failed}`);
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
    const lightbox = document.querySelector(
      '[role="dialog"][aria-modal="true"][aria-label="Visionneuse"]'
    );
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

  setTimeout(inject, 500);
  new MutationObserver(() => {
    clearTimeout(inject._timeout);
    inject._timeout = setTimeout(inject, 500);
  }).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'd' && !/^(input|textarea)$/i.test(e.target.tagName)) {
      e.preventDefault();
      saveCurrent();
    }
  });
})();
