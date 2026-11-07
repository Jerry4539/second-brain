// Second Brain Native Bridge for Canvas (Mochiboard Engine)
// Connects the Canvas UI & Mochi AI directly to Second Brain's local LLM, Stable Diffusion Image Engine, Live Web Search, and SQLite storage.
(() => {
  const LS = 'mochiboard:';
  const getHost = () => {
    try {
      return window.parent && window.parent !== window ? window.parent.__SECOND_BRAIN_CANVAS_HOST__ : window.__SECOND_BRAIN_CANVAS_HOST__;
    } catch {
      return null;
    }
  };

  // IndexedDB media store for audio/video cards
  const idb = () =>
    new Promise((res, rej) => {
      const r = indexedDB.open('mochiboard-media', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('media');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  const blobURLs = new Map();

  async function saveMediaBrowser(blob) {
    const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const db = await idb();
    await new Promise((res, rej) => {
      const t = db.transaction('media', 'readwrite');
      t.objectStore('media').put(blob, id);
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
    });
    blobURLs.set('idbmedia:' + id, URL.createObjectURL(blob));
    return 'idbmedia:' + id;
  }

  async function mediaURL(src) {
    if (!src || !String(src).startsWith('idbmedia:')) return src;
    if (blobURLs.has(src)) return blobURLs.get(src);
    const db = await idb();
    const blob = await new Promise((res) => {
      const r = db.transaction('media').objectStore('media').get(src.slice(9));
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    });
    if (!blob) return '';
    const u = URL.createObjectURL(blob);
    blobURLs.set(src, u);
    return u;
  }

  // Pure-JS single-page PDF 1.4 generator wrapping a high-DPI JPEG data URL
  function buildPdfFromJpegDataUrl(jpegDataUrl, widthPt, heightPt, pxWidth, pxHeight) {
    const b64 = jpegDataUrl.split(',')[1] || '';
    const binStr = atob(b64);
    const imgBytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) imgBytes[i] = binStr.charCodeAt(i);

    const enc = new TextEncoder();
    const chunks = [];
    const offsets = [0];
    let byteLen = 0;

    const pushStr = (s) => {
      const b = enc.encode(s);
      chunks.push(b);
      byteLen += b.byteLength;
    };
    const pushBytes = (b) => {
      chunks.push(b);
      byteLen += b.byteLength;
    };
    const startObj = (id) => {
      offsets[id] = byteLen;
      pushStr(`${id} 0 obj\n`);
    };
    const endObj = () => pushStr('\nendobj\n');

    pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

    startObj(1);
    pushStr('<< /Type /Catalog /Pages 2 0 R >>');
    endObj();

    startObj(2);
    pushStr('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    endObj();

    const wPt = Math.max(72, Math.round(widthPt));
    const hPt = Math.max(72, Math.round(heightPt));

    startObj(3);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im0 4 0 R >> >> /MediaBox [0 0 ${wPt} ${hPt}] /Contents 5 0 R >>`,
    );
    endObj();

    startObj(4);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${pxWidth} /Height ${pxHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.byteLength} >>\nstream\n`,
    );
    pushBytes(imgBytes);
    pushStr('\nendstream');
    endObj();

    const contentStream = `q\n${wPt} 0 0 ${hPt} 0 0 cm\n/Im0 Do\nQ\n`;
    const contentBytes = enc.encode(contentStream);
    startObj(5);
    pushStr(`<< /Length ${contentBytes.byteLength} >>\nstream\n`);
    pushBytes(contentBytes);
    pushStr('endstream');
    endObj();

    const xrefOffset = byteLen;
    pushStr('xref\n0 6\n0000000000 65535 f \n');
    for (let i = 1; i <= 5; i++) {
      pushStr(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
    }
    pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    const out = new Uint8Array(byteLen);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.byteLength;
    }
    return new Blob([out], { type: 'application/pdf' });
  }

  const CARD_PALETTE = {
    white: '#ffffff',
    pink: '#ffe0ec',
    butter: '#fff3bf',
    mint: '#d8f7e6',
    lilac: '#ece3ff',
    sky: '#dceeff',
    peach: '#ffe5d4',
  };

  function roundRectPath(ctx, x, y, w, h, r) {
    const rad = Math.max(0, Math.min(r || 0, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 12) {
    const rawLines = String(text || '').split('\n');
    let lineCount = 0;
    for (const raw of rawLines) {
      const words = raw.split(/\s+/);
      let line = '';
      for (let n = 0; n < words.length; n++) {
        const testLine = line ? line + ' ' + words[n] : words[n];
        if (ctx.measureText(testLine).width > maxWidth && line) {
          ctx.fillText(line, x, y + lineCount * lineHeight);
          line = words[n];
          lineCount++;
          if (lineCount >= maxLines) return;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, y + lineCount * lineHeight);
      lineCount++;
      if (lineCount >= maxLines) return;
    }
  }

  // High-DPI 2x Canvas Renderer for exporting cards, wireframes, shapes, notes, and connectors to PNG or PDF
  async function renderExportCanvas(o) {
    const bbox = o.bbox || { x0: 0, y0: 0, bw: Math.max(400, o.w || 800), bh: Math.max(300, o.h || 600) };
    const bw = Math.max(160, Math.ceil(bbox.bw));
    const bh = Math.max(120, Math.ceil(bbox.bh));
    const scale = 2;
    const cv = document.createElement('canvas');
    cv.width = bw * scale;
    cv.height = bh * scale;
    const ctx = cv.getContext('2d');
    ctx.scale(scale, scale);

    // Background (transparent for PNG selection unless PDF or whole board)
    const isPdf = !!o.pdf;
    const bgHex = o.bg || (o.dark ? '#1c1920' : '#fbf8fc');
    if (isPdf || !o.alpha || !(o.cards && o.cards.length)) {
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, bw, bh);
      // Subtle dot grid
      ctx.fillStyle = o.dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)';
      const step = 26;
      for (let gx = step / 2; gx < bw; gx += step) {
        for (let gy = step / 2; gy < bh; gy += step) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.save();
    ctx.translate(-bbox.x0, -bbox.y0);

    const cards = Array.isArray(o.cards) ? o.cards : [];
    const cardMap = new Map(cards.map((c) => [c.id, c]));

    // 1. Draw connectors/wires first
    const links = Array.isArray(o.links) ? o.links : [];
    for (const l of links) {
      const a = cardMap.get(l.a);
      const b = cardMap.get(l.b);
      if (!a || !b) continue;
      const ax = a.x + a.w / 2;
      const ay = a.y + a.h / 2;
      const bx = b.x + b.w / 2;
      const by = b.y + b.h / 2;
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2 - 24;
      ctx.save();
      ctx.strokeStyle = l.color || (o.dark ? '#a39bb0' : '#6e6678');
      ctx.lineWidth = 2.2;
      if (l.dash) ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(mx, my, bx, by);
      ctx.stroke();
      ctx.restore();
    }

    // Preload any images on cards
    const imgCache = new Map();
    await Promise.all(
      cards
        .filter((c) => c.src)
        .map(
          (c) =>
            new Promise((resolve) => {
              const im = new Image();
              im.crossOrigin = 'anonymous';
              im.onload = () => {
                imgCache.set(c.id, im);
                resolve();
              };
              im.onerror = () => resolve();
              im.src = c.src;
            }),
        ),
    );

    // 2. Draw cards in layer order
    for (const c of cards) {
      if (c.maskLayer) continue;
      ctx.save();
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      const rot = ((c.rot != null ? c.rot : c.r || 0) * Math.PI) / 180;
      ctx.translate(cx, cy);
      if (rot) ctx.rotate(rot);
      ctx.translate(-c.w / 2, -c.h / 2);

      const type = c.type;
      if (type === 'title') {
        ctx.fillStyle = c.tc || (o.dark ? '#f5f2f8' : '#27272a');
        ctx.font = `800 ${Math.round((c.fs || 1) * 28)}px "DM Sans", -apple-system, sans-serif`;
        ctx.textBaseline = 'top';
        wrapCanvasText(ctx, c.text || 'Title', 4, 6, c.w - 8, Math.round((c.fs || 1) * 34), 4);
      } else if (type === 'text') {
        ctx.fillStyle = c.color || (o.dark ? '#f5f2f8' : '#27272a');
        ctx.font = `${c.weight || 500} ${c.size || 16}px "${c.font || 'DM Sans'}", -apple-system, sans-serif`;
        ctx.textBaseline = 'top';
        wrapCanvasText(ctx, c.text || '', 0, 2, c.w, (c.size || 16) * (c.lh || 1.3), 10);
      } else if (type === 'icon') {
        ctx.fillStyle = c.color || '#27272a';
        ctx.beginPath();
        ctx.arc(c.w / 2, c.h / 2, Math.min(c.w, c.h) * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 'section') {
        ctx.fillStyle = o.dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
        ctx.strokeStyle = o.dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)';
        ctx.lineWidth = 1.5;
        roundRectPath(ctx, 0, 0, c.w, c.h, 22);
        ctx.fill();
        ctx.stroke();
        if (c.text) {
          ctx.fillStyle = o.dark ? '#e5e0ec' : '#3f3a45';
          ctx.font = '700 14px "DM Sans", -apple-system, sans-serif';
          ctx.fillText(c.text, 16, -10);
        }
      } else if (type === 'frame') {
        ctx.shadowColor = 'rgba(0,0,0,0.18)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = c.fill || '#ffffff';
        roundRectPath(ctx, 0, 0, c.w, c.h, c.radius ?? 28);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#d4d4d8';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = o.dark ? '#a199ad' : '#71717a';
        ctx.font = '600 12px "DM Sans", -apple-system, sans-serif';
        ctx.fillText(c.name || c.device || 'Screen', 8, -8);
      } else if (type === 'box') {
        if (c.fill !== 'none') {
          ctx.fillStyle = c.fill || '#ffffff';
          roundRectPath(ctx, 0, 0, c.w, c.h, c.radius ?? 8);
          ctx.fill();
        }
        if (c.sw > 0 || c.stroke) {
          ctx.strokeStyle = c.stroke || '#a1a1aa';
          ctx.lineWidth = c.sw || 1.5;
          roundRectPath(ctx, 0, 0, c.w, c.h, c.radius ?? 8);
          ctx.stroke();
        }
        if (imgCache.has(c.id)) {
          ctx.save();
          roundRectPath(ctx, 0, 0, c.w, c.h, c.radius ?? 8);
          ctx.clip();
          ctx.drawImage(imgCache.get(c.id), 0, 0, c.w, c.h);
          ctx.restore();
        } else if (c.img) {
          ctx.fillStyle = '#71717a';
          ctx.font = '500 12px "DM Sans", -apple-system, sans-serif';
          ctx.textBaseline = 'middle';
          ctx.fillText('🖼 ' + String(c.img).slice(0, 28), 12, c.h / 2);
        }
      } else if (type === 'image' && imgCache.has(c.id)) {
        ctx.shadowColor = 'rgba(0,0,0,0.22)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = '#ffffff';
        const pad = c.noframe ? 0 : 8;
        roundRectPath(ctx, 0, 0, c.w, c.h, c.radius ?? 16);
        if (!c.noframe) ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.save();
        roundRectPath(ctx, pad, pad, c.w - pad * 2, c.h - pad * 2, Math.max(0, (c.radius ?? 16) - pad / 2));
        ctx.clip();
        ctx.drawImage(imgCache.get(c.id), pad, pad, c.w - pad * 2, c.h - pad * 2);
        ctx.restore();
      } else if (type === 'swatch') {
        ctx.shadowColor = 'rgba(0,0,0,0.16)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = '#ffffff';
        roundRectPath(ctx, 0, 0, c.w, c.h, 16);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = c.hex || '#ff9ec4';
        roundRectPath(ctx, 8, 8, c.w - 16, c.h - 46, 10);
        ctx.fill();
        ctx.fillStyle = '#27272a';
        ctx.font = '700 12px "DM Sans", -apple-system, sans-serif';
        ctx.fillText(c.label || c.hex || 'Color', 10, c.h - 22);
      } else {
        // Note, todo, coll, doc, link, shape, table
        ctx.shadowColor = 'rgba(0,0,0,0.16)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = CARD_PALETTE[c.color] || c.fill || '#ffffff';
        roundRectPath(ctx, 0, 0, c.w, c.h, 16);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#27272a';
        let ty = 18;
        if (c.name || c.title) {
          ctx.font = '700 13px "DM Sans", -apple-system, sans-serif';
          ctx.textBaseline = 'top';
          ctx.fillText(String(c.name || c.title).slice(0, 40), 16, ty);
          ty += 22;
        }
        if (c.text) {
          ctx.font = '500 14px "DM Sans", -apple-system, sans-serif';
          ctx.textBaseline = 'top';
          wrapCanvasText(ctx, c.text, 16, ty, c.w - 32, 19, 7);
          ty += 24;
        }
        if (Array.isArray(c.items)) {
          ctx.font = '500 13px "DM Sans", -apple-system, sans-serif';
          ctx.textBaseline = 'top';
          for (const it of c.items.slice(0, 8)) {
            ctx.fillText((it.done ? '☑ ' : '☐ ') + String(it.t || ''), 16, ty);
            ty += 20;
          }
        }
      }
      ctx.restore();
    }

    ctx.restore();
    return { canvas: cv, widthPt: bw, heightPt: bh, pxWidth: cv.width, pxHeight: cv.height };
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 4000);
  }

  const syncToHost = () => {
    try {
      const host = getHost();
      if (host && typeof host.syncStorage === 'function') {
        const index = localStorage.getItem(LS + 'index') || '[]';
        const folders = localStorage.getItem(LS + 'folders') || '{}';
        host.syncStorage({ index, folders });
      }
    } catch {
      // ignore
    }
  };

  window.MB = {
    native: true,
    web: false,
    platform: 'mac',

    async list() {
      return JSON.parse(localStorage.getItem(LS + 'index') || '[]');
    },

    async load(id) {
      const s = localStorage.getItem(LS + 'board:' + id);
      return s ? JSON.parse(s) : null;
    },

    async save(board) {
      localStorage.setItem(LS + 'board:' + board.id, JSON.stringify(board));
      const idx = JSON.parse(localStorage.getItem(LS + 'index') || '[]').filter((b) => b.id !== board.id);
      idx.unshift({
        id: board.id,
        name: board.name,
        color: board.color,
        folder: board.folder || null,
        parent: board.parent || null,
        updated: Date.now() / 1000,
      });
      localStorage.setItem(LS + 'index', JSON.stringify(idx));
      syncToHost();
      return true;
    },

    async folders() {
      return JSON.parse(localStorage.getItem(LS + 'folders') || '[]');
    },

    async saveFolders(folders) {
      localStorage.setItem(LS + 'folders', JSON.stringify(folders));
      syncToHost();
      return true;
    },

    async remove(id) {
      localStorage.removeItem(LS + 'board:' + id);
      const next = JSON.parse(localStorage.getItem(LS + 'index') || '[]').filter((b) => b.id !== id);
      localStorage.setItem(LS + 'index', JSON.stringify(next));
      syncToHost();
      return true;
    },

    async connections() {
      return { claude: true, mobbin: true, higgsfield: true, browser: false, web: false };
    },

    async usage() {
      return {
        today: { asks: 1, tokensIn: 400, tokensOut: 250, cost: 0 },
        week: { asks: 5, tokensIn: 2000, tokensOut: 1200, cost: 0 },
        all: { asks: 12, tokensIn: 5000, tokensOut: 3000, cost: 0 },
      };
    },
    async resetUsage() {
      return true;
    },
    async version() {
      return '2.0';
    },

    async fetchImage(url) {
      return url;
    },

    saveMedia: (blob) => saveMediaBrowser(blob),
    mediaURL,

    async openURL(url) {
      window.open(url, '_blank');
    },

    async speechAuth() {
      return 'ok';
    },

    async fonts() {
      return [
        'DM Sans',
        'Caveat',
        'Inter',
        'Helvetica Neue',
        'Arial',
        'Georgia',
        'Times New Roman',
        'Courier New',
        'SF Pro Display',
        'Avenir Next',
        'Futura',
        'Menlo',
      ];
    },

    async exportRect(o) {
      const safeName =
        String(o.name || 'Canvas')
          .slice(0, 60)
          .replace(/[^\w\- ]+/g, ' ')
          .trim() || 'Canvas';
      const { canvas, widthPt, heightPt, pxWidth, pxHeight } = await renderExportCanvas(o);
      if (o.pdf) {
        const jpegUrl = canvas.toDataURL('image/jpeg', 0.94);
        const pdfBlob = buildPdfFromJpegDataUrl(jpegUrl, widthPt, heightPt, pxWidth, pxHeight);
        const fileName = `${safeName}.pdf`;
        triggerBlobDownload(pdfBlob, fileName);
        return fileName;
      } else {
        const pngBlob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        const fileName = `${safeName}.png`;
        if (pngBlob) triggerBlobDownload(pngBlob, fileName);
        return fileName;
      }
    },

    async saveFile(data, name, ext) {
      const bin = atob(data);
      const u8 = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const mime =
        ext === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : ext === 'png'
            ? 'image/png'
            : ext === 'jpg' || ext === 'jpeg'
              ? 'image/jpeg'
              : 'application/octet-stream';
      const fileName = `${name}.${ext}`;
      triggerBlobDownload(new Blob([u8], { type: mime }), fileName);
      return fileName;
    },

    async docPDF(html) {
      const f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
      document.body.appendChild(f);
      f.srcdoc = html.replace(/__WEB__\//g, location.href.replace(/[^/]*$/, ''));
      await new Promise((r) => (f.onload = r));
      await f.contentDocument.fonts?.ready;
      f.contentWindow.focus();
      f.contentWindow.print();
      setTimeout(() => f.remove(), 60000);
      return '';
    },

    async reveal() {
      const host = getHost();
      if (host && typeof host.notify === 'function') {
        host.notify('All your boards and projects are automatically saved inside Second Brain.');
      }
    },

    async linkShot() {
      return '';
    },

    async linkPreview(url) {
      const host = getHost();
      if (host && typeof host.linkPreview === 'function') {
        try {
          return await host.linkPreview(url);
        } catch {
          // fallback below
        }
      }
      let hostname = url;
      try {
        hostname = new URL(url).hostname.replace(/^www\./, '');
      } catch {
        // ignore
      }
      return { title: hostname, desc: url, image: '' };
    },

    async higgsQuote() {
      return JSON.stringify({ perImage: 0, balance: 9999 });
    },

    async higgsMake(o) {
      const host = getHost();
      if (host && typeof host.higgsMake === 'function') {
        return await host.higgsMake(o);
      }
      return await this.drawFill(o);
    },

    async drawFill(o) {
      const host = getHost();
      if (host && typeof host.drawFill === 'function') {
        return await host.drawFill(o);
      }
      const palettes = [
        ['#ffe0ec', '#ff8fc2', '#3d3640'],
        ['#dceeff', '#4f9dff', '#1e293b'],
        ['#d8f7e6', '#2fae73', '#1e293b'],
        ['#ece3ff', '#8a6cf0', '#27272a'],
      ];
      const images = (o.images || []).map((im, idx) => {
        const [bg, fg, ink] = palettes[idx % palettes.length];
        const w = im.w || 320;
        const h = im.h || 200;
        const label = String(im.label || 'Illustration')
          .replace(/[<>&"]/g, '')
          .slice(0, 36);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="16" fill="${bg}"/><circle cx="${w * 0.32}" cy="${h * 0.42}" r="${Math.min(w, h) * 0.22}" fill="${fg}" opacity="0.85"/><rect x="${w * 0.46}" y="${h * 0.28}" width="${w * 0.34}" height="${h * 0.32}" rx="12" fill="#ffffff" opacity="0.9"/><text x="${w / 2}" y="${h - 22}" text-anchor="middle" font-family="DM Sans, sans-serif" font-weight="700" font-size="13" fill="${ink}">${label}</text></svg>`;
        return { id: im.id, svg, url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) };
      });
      return JSON.stringify({ images });
    },

    async rewrite(text, how, title, around) {
      const host = getHost();
      if (host && typeof host.rewrite === 'function') {
        return await host.rewrite(text, how, title, around);
      }
      return text;
    },

    async transcribe(audio) {
      const host = getHost();
      if (host && typeof host.transcribe === 'function') {
        return await host.transcribe(audio);
      }
      return 'Voice memo recorded on Canvas.';
    },

    async updateCheck() {
      return { upToDate: true };
    },
    async updatePrepare() {},
    async updateNow() {},

    async ask(prompt, board, confirmed = false, opts = {}) {
      const host = getHost();
      if (host && typeof host.ask === 'function') {
        return await host.ask(prompt, board, confirmed, opts);
      }
      // Built-in local fallback if host isn't attached
      const notes = (board.cards || []).filter((c) => c.type === 'note');
      if (/group|sort|organi[sz]e|tidy/i.test(prompt) && notes.length) {
        const cx = Math.min(...board.cards.map((c) => c.x));
        const cy = Math.min(...board.cards.map((c) => c.y));
        return JSON.stringify({
          say: `I lined up your ${notes.length} notes into tidy columns ✦`,
          titles: [{ text: 'Organized Notes', x: cx, y: cy - 90 }],
          move: notes.map((n, i) => ({
            id: n.id,
            x: cx + (i % 3) * 250,
            y: cy + Math.floor(i / 3) * 170,
          })),
        });
      }
      return JSON.stringify({
        say: "Here's a starter set of ideas for your board ✦",
        add: [
          { type: 'note', text: 'Core Goal & Vision', color: 'butter' },
          { type: 'note', text: 'Target Audience & Needs', color: 'mint' },
          { type: 'note', text: 'Action Steps & Milestones', color: 'lilac' },
        ],
      });
    },
  };
})();
