// ==UserScript==
// @name         TMA gallery downloader
// @description  Download photos from TouteMonAnnée galleries with one click.
// @author       Thijs Dickmans
// @license      MIT
// @homepage     https://github.com/Thijs5/toutemonannee-improvements
// @supportURL   https://github.com/Thijs5/toutemonannee-improvements/issues
// @namespace    tma-dl
// @match        https://www.toutemonannee.com/*
// @version      1.2
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==
 
(function () {
  'use strict';
 
  const xhr = (typeof GM !== 'undefined' && GM.xmlHttpRequest) || GM_xmlhttpRequest;
 
  const log = (msg) => console.log(`%c[TMA-DL] ✓ ${msg}`, 'color: #00aa00; font-weight: bold;');
  const error = (msg) => console.error(`%c[TMA-DL] ✗ ${msg}`, 'color: #ff0000; font-weight: bold;');
 
  const toHd = u => u.replace('/thumbs/', '/hd/');
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
    const allImages = document.querySelectorAll('img[src*="toutemonannee"]');
    for (const img of allImages) {
      const style = getComputedStyle(img);
      const rect = img.getBoundingClientRect();
      if (style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 100 && rect.height > 100) {
        if (img.src) return toHd(img.src);
      }
    }
    return null;
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
    b.className = 'Nr tma-dl-btn';
    b.title = title;
    b.type = 'button';
    b.style.display = 'flex';
    b.style.alignItems = 'center';
    b.style.gap = '0.3em';
    
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
    // Look ONLY inside the lightbox
    const lightbox = document.querySelector('[role="dialog"][aria-modal="true"]') || 
                     document.querySelector('.Vu');
    
    if (!lightbox) return null; // Silent fail - lightbox not open yet
 
    const selectors = [
      '[role="toolbar"]',
      '.Uu',
    ];
 
    for (const sel of selectors) {
      const el = lightbox.querySelector(sel);
      if (el) return el;
    }
 
    error('Toolbar not found inside lightbox');
    return null;
  }
 
  function inject() {
    // Check if buttons already exist in DOM - if so, skip
    if (document.querySelector('.tma-dl-btn')) return;
 
    const bar = findToolbar();
    
    if (!bar) return; // Silent fail - lightbox or toolbar not found
 
    try {
      const btn1 = mkBtn('Download', 'Download this photo (D)', downloadSvg, saveCurrent);
      const btn2 = mkBtn('Download All', 'Download all photos', downloadSvg, saveAll);
      
      bar.appendChild(btn1);
      bar.appendChild(btn2);
      
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
