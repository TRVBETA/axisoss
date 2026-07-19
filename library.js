/* ==========================================
   AXIS // library.js
   Local-first PDF + EPUB library with server sync
   ========================================== */

let idbDatabase = null;

function initLibraryIndexedDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('AXIS_LIBRARY_DB', 1);
        req.onupgradeneeded = function (e) {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('books_binary')) {
                db.createObjectStore('books_binary', { keyPath: 'id' });
            }
        };
        req.onsuccess = function (e) {
            idbDatabase = e.target.result;
            resolve(idbDatabase);
        };
        req.onerror = function (e) {
            console.error('IDB init failed', e);
            reject(e);
        };
    });
}

function saveBookBinaryToIDB(bookId, content) {
    return new Promise((resolve, reject) => {
        if (!idbDatabase) return reject(new Error('IDB not ready'));
        const tx = idbDatabase.transaction(['books_binary'], 'readwrite');
        const store = tx.objectStore('books_binary');
        store.put({ id: bookId, content });
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e);
    });
}

function getBookBinaryFromIDB(bookId) {
    return new Promise((resolve, reject) => {
        if (!idbDatabase) return resolve(null);
        const tx = idbDatabase.transaction(['books_binary'], 'readonly');
        const store = tx.objectStore('books_binary');
        const req = store.get(bookId);
        req.onsuccess = () => resolve(req.result ? req.result.content : null);
        req.onerror = (e) => reject(e);
    });
}

function deleteBookBinaryFromIDB(bookId) {
    return new Promise((resolve, reject) => {
        if (!idbDatabase) return resolve(true);
        const tx = idbDatabase.transaction(['books_binary'], 'readwrite');
        const store = tx.objectStore('books_binary');
        store.delete(bookId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e);
    });
}

let tacticalLibraryState = {
    books: JSON.parse(localStorage.getItem('axis_library_meta') || '[]'),
    activeBookId: null,
    readerType: null,
    epubBookInstance: null,
    epubRendition: null,
    currentTheme: 'axis_dark',
    activeExtractedCover: null,
    readerStatus: 'READY',
    epubFontSize: 100,
    pdfDataUri: null,
    pdfBlobUrl: '',
    syncMode: 'local',
    lastError: '',
    idbReady: false,
    epubReady: false
};

let axisEpubReadyPromise = null;
function injectEPUBJSDependency() {
    if (typeof ePub !== 'undefined') {
        tacticalLibraryState.epubReady = true;
        return Promise.resolve(true);
    }
    if (axisEpubReadyPromise) return axisEpubReadyPromise;
    axisEpubReadyPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-axis-epub="1"]');
        if (existing) {
            existing.addEventListener('load', () => {
                tacticalLibraryState.epubReady = typeof ePub !== 'undefined';
                resolve(true);
            }, { once: true });
            existing.addEventListener('error', () => reject(new Error('EPUB script failed')), { once: true });
            return;
        }
        const script = document.createElement('script');
        script.src = 'vendor/epub.min.js';
        script.async = true;
        script.dataset.axisEpub = '1';
        script.onload = () => {
            tacticalLibraryState.epubReady = typeof ePub !== 'undefined';
            if (!tacticalLibraryState.epubReady) reject(new Error('EPUB engine missing after load'));
            else resolve(true);
        };
        script.onerror = () => reject(new Error('EPUB script failed'));
        document.head.appendChild(script);
    });
    return axisEpubReadyPromise;
}

async function initLibrary() {
    try {
        await initLibraryIndexedDB();
        tacticalLibraryState.idbReady = true;
    } catch (e) {
        tacticalLibraryState.idbReady = false;
        tacticalLibraryState.lastError = 'Local binary storage unavailable.';
    }

    injectEPUBJSDependency().catch((e) => {
        console.warn('EPUB engine preload failed:', e?.message || e);
    });

    renderLibraryView();
    await loadLibraryFromServer({ silent: false });

    document.addEventListener('keydown', (e) => {
        if (!tacticalLibraryState.activeBookId) return;
        if (e.key === 'Escape') {
            closeTrueInlineReader();
            return;
        }
        if (tacticalLibraryState.readerType !== 'epub') return;
        if (e.key === 'ArrowRight') navigateGenuineReader(1);
        if (e.key === 'ArrowLeft') navigateGenuineReader(-1);
    });
}

function renderLibraryView() {
    const container = document.getElementById('module-library');
    if (!container) return;

    const totalBooks = tacticalLibraryState.books.length;
    const totalReadPages = tacticalLibraryState.books.reduce((sum, book) => sum + Number(book.currPage || 0), 0);
    const statusLabel = tacticalLibraryState.lastError
        ? `ISSUES // ${escapeLibraryHtml(tacticalLibraryState.lastError)}`
        : `${tacticalLibraryState.syncMode === 'server' ? 'SERVER' : 'LOCAL'}${tacticalLibraryState.idbReady ? ' • CACHE READY' : ' • CACHE LIMITED'}`;

    container.innerHTML = `
        <div class="cockpit-header">
            <span>LIBRARY</span>
            <span class="text-sm ${tacticalLibraryState.lastError ? 'text-warning' : 'text-cyan'}">${statusLabel}</span>
        </div>

        <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 24px; grid-template-columns: minmax(0, 1fr) clamp(320px, 34vw, 480px); align-items: start;">
            <div class="stack" style="gap: 20px; min-width: 0;">
                <div class="row flex-wrap" style="justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div class="font-mono text-base font-bold text-main">READING QUEUE</div>
                    <div class="axis-chip-row">
                        <span class="badge badge-muted">${totalBooks} books</span>
                        <span class="badge badge-muted">${totalReadPages} pages</span>
                    </div>
                </div>
                <div class="stack" style="gap: 16px; min-width: 0;">
                    ${totalBooks === 0 ? renderEmptyLibraryHTML() : tacticalLibraryState.books.map(renderBookCardHTML).join('')}
                </div>
            </div>

            <div class="stack" style="gap: 24px;">
                <div class="cockpit-card stack" style="padding: 28px;">
                    <div class="row flex-wrap" style="justify-content: space-between; gap: 12px;">
                        <span class="font-mono font-bold text-optimal">UPLOAD</span>
                        <span class="text-sm text-muted">PDF or EPUB</span>
                    </div>

                    <form onsubmit="handleAutonomousLibraryDeposit(event)" class="stack" style="gap: 20px;">
                        <div class="stack" style="gap: 8px;">
                            <label class="font-mono text-base font-bold text-main">SELECT FILE</label>
                            <input type="file" class="tactical-input w-full" id="lib-auto-file" accept=".epub,.pdf" required onchange="executeInstantMetadataExtraction(this)">
                            <span class="font-mono text-sm text-muted">Upload stores the file locally first, then syncs it to server when online.</span>
                        </div>

                        <div class="stack" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 16px; border-radius: 18px; gap: 8px;">
                            <div class="text-sm text-accent font-bold">PARSE PREVIEW</div>
                            <div class="font-bold text-main" style="font-size: 1.05rem;" id="parse-readout-title">PENDING SELECTION</div>
                            <div class="text-optimal" style="font-size: 0.84rem;" id="parse-readout-author">AUTHOR // PENDING</div>
                            <div class="text-sm text-muted" id="parse-readout-pages">PAGES // auto estimate</div>
                        </div>

                        <label class="font-mono row cursor-pointer" style="font-size: 0.9rem; gap: 10px;">
                            <input type="checkbox" id="lib-auto-carry" checked style="accent-color: var(--hud-optimal); width: 18px; height: 18px;">
                            Carry forward until finished
                        </label>

                        <button type="submit" class="tactical-btn tactical-btn-primary w-full text-center" style="height: 52px; font-size: 1rem;" id="lib-commit-btn">
                            SAVE TO LIBRARY
                        </button>
                    </form>
                </div>

                <div class="cockpit-card stack" style="padding: 24px;">
                    <div class="font-mono font-bold text-cyan">READER NOTES</div>
                    <div class="axis-quiet-note">PDF uses native in-app viewing. EPUB now loads from a local bundled engine instead of a blocked CDN, so it works inside the preview too.</div>
                </div>
            </div>
        </div>

        ${renderReaderModalHTML()}
    `;
}

function renderEmptyLibraryHTML() {
    return `
        <div class="cockpit-card stack text-center" style="padding: 60px 40px; justify-content: center; align-items: center; min-height: 280px;">
            <div class="font-mono text-muted uppercase tracking-wider" style="font-size: 1.2rem; letter-spacing: 4px;">LIBRARY EMPTY</div>
            <div class="font-mono text-muted" style="font-size: 0.9rem; max-width: 440px; margin-top: 14px; line-height: 1.7;">
                Upload a PDF or EPUB. AXIS will keep the queue, page progress, and the file itself available across devices when server sync is online.
            </div>
        </div>
    `;
}

function renderBookCardHTML(book) {
    const totalPages = Math.max(1, Number(book.totalPages || 1));
    const currentPage = Math.max(0, Number(book.currPage || 0));
    const progressWidth = Math.min(100, (currentPage / totalPages) * 100);
    const isResolved = currentPage >= totalPages || !book.carryForward;

    return `
        <div class="cockpit-card row flex-wrap" style="padding: 20px; gap: 20px; align-items: center; justify-content: space-between; border-left: 4px solid ${isResolved ? 'rgba(255,255,255,0.10)' : 'var(--hud-violet)'};">
            <div class="row flex-1" style="gap: 16px; overflow: hidden; min-width: 0; align-items: center;">
                <div style="width: 64px; height: 92px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; overflow: hidden; flex-shrink: 0; display: flex; justify-content: center; align-items: center;">
                    ${book.coverUrl ? `<img src="${book.coverUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Cover">` : `<span class="font-mono text-sm text-muted font-bold">${escapeLibraryHtml(String(book.type || '').toUpperCase())}</span>`}
                </div>

                <div class="font-mono flex-1" style="min-width: 0;">
                    <div class="axis-chip-row">
                        <span class="badge ${book.type === 'epub' ? 'badge-accent' : 'badge-cyan'}">${escapeLibraryHtml(String(book.type || '').toUpperCase())}</span>
                        <span class="badge badge-muted">${escapeLibraryHtml(book.author || 'Unknown')}</span>
                        <span class="badge ${isResolved ? 'badge-muted' : 'badge-optimal'}">${isResolved ? 'Resolved' : 'Carry-forward'}</span>
                    </div>

                    <div class="font-bold text-main text-truncate" style="font-size: clamp(1rem, 2vw, 1.18rem); margin: 10px 0 8px;">
                        ${escapeLibraryHtml(book.title || 'Untitled')}
                    </div>

                    <div class="text-sm text-muted" style="line-height: 1.6;">
                        ${currentPage} / ${totalPages} pages
                    </div>

                    <div class="progress-bar w-full" style="margin-top: 10px;">
                        <div class="progress-fill progress-fill-optimal" style="width: ${progressWidth}%;"></div>
                    </div>
                </div>
            </div>

            <div class="stack font-mono flex-shrink-0" style="align-items: flex-end; gap: 10px; width: clamp(160px, 30vw, 220px);">
                <div class="row flex-wrap" style="gap: 6px; justify-content: flex-end;">
                    <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.7rem;" onclick="stepTacticalBookPage('${book.id}', -1)">-1</button>
                    <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.7rem;" onclick="stepTacticalBookPage('${book.id}', 1)">+1</button>
                    <button class="tactical-btn cyan" style="padding: 4px 10px; font-size: 0.7rem;" onclick="stepTacticalBookPage('${book.id}', 10)">+10</button>
                </div>
                <div class="row flex-wrap" style="gap: 8px; justify-content: flex-end; align-items: center;">
                    <button class="tactical-btn tactical-btn-primary text-sm" style="padding: 6px 12px;" onclick="executeTrueInlineReader('${book.id}')">READ</button>
                    <button class="tactical-btn" style="padding: 6px 10px; border-color: var(--hud-critical); color: var(--hud-critical);" onclick="purgeTacticalBook('${book.id}')">DEL</button>
                </div>
            </div>
        </div>
    `;
}

function renderReaderModalHTML() {
    if (!tacticalLibraryState.activeBookId) return '';
    const activeBook = tacticalLibraryState.books.find(book => book.id === tacticalLibraryState.activeBookId);
    if (!activeBook) return '';
    const isEpub = tacticalLibraryState.readerType === 'epub';

    return `
        <div id="axis-reader-modal" onclick="handleReaderBackdropClick(event)" style="position: fixed; inset: 0; z-index: 9998; background: rgba(3,5,10,0.92); backdrop-filter: blur(12px); display: flex; justify-content: center; align-items: center; padding: clamp(12px, 3vw, 28px);">
            <div class="cockpit-card stack" style="width: min(1400px, 96vw); height: min(92vh, 980px); padding: clamp(16px, 3vw, 28px); gap: 16px;">
                <div class="row flex-wrap" style="justify-content: space-between; gap: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
                    <div class="stack flex-1" style="gap: 4px; min-width: 0;">
                        <span class="text-cyan font-bold text-truncate" style="font-size: clamp(1rem, 2vw, 1.15rem);">${escapeLibraryHtml(activeBook.title)} // ${escapeLibraryHtml(activeBook.author)}</span>
                        <span class="text-sm text-muted">${escapeLibraryHtml(String(activeBook.type || '').toUpperCase())} READER</span>
                    </div>

                    <div class="row flex-wrap" style="gap: 10px; justify-content: flex-end; align-items: center;">
                        <div id="epub-theme-tools" class="row" style="display: ${isEpub ? 'flex' : 'none'}; gap: 6px; align-items: center;">
                            <button data-axis-theme="axis_dark" onclick="applyGenuineEPUBTheme('axis_dark')" class="tactical-btn ${tacticalLibraryState.currentTheme === 'axis_dark' ? 'active' : ''}" style="padding: 4px 10px; font-size: 0.72rem;">VOID</button>
                            <button data-axis-theme="axis_light" onclick="applyGenuineEPUBTheme('axis_light')" class="tactical-btn ${tacticalLibraryState.currentTheme === 'axis_light' ? 'active' : ''}" style="padding: 4px 10px; font-size: 0.72rem;">LIGHT</button>
                            <button data-axis-theme="axis_sepia" onclick="applyGenuineEPUBTheme('axis_sepia')" class="tactical-btn ${tacticalLibraryState.currentTheme === 'axis_sepia' ? 'active' : ''}" style="padding: 4px 10px; font-size: 0.72rem;">SEPIA</button>
                        </div>

                        <div id="epub-font-tools" class="row" style="display: ${isEpub ? 'flex' : 'none'}; gap: 6px; align-items: center;">
                            <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.72rem;" onclick="scaleEPUBFontSize(-1)">A-</button>
                            <span id="axis-epub-font-label" class="badge badge-muted">${tacticalLibraryState.epubFontSize}%</span>
                            <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.72rem;" onclick="scaleEPUBFontSize(1)">A+</button>
                        </div>

                        <button id="pdf-open-new-tab-btn" onclick="openPdfInNewTab()" class="tactical-btn" style="display: ${isEpub ? 'none' : 'inline-flex'}; padding: 6px 12px; border-color: var(--hud-cyan); color: var(--hud-cyan);">OPEN PDF</button>
                        <button class="tactical-btn" style="padding: 6px 14px; border-color: var(--hud-critical); color: var(--hud-critical);" onclick="closeTrueInlineReader()">CLOSE</button>
                    </div>
                </div>

                <div id="reader-telemetry-status" class="font-mono text-sm text-muted">${escapeLibraryHtml(tacticalLibraryState.readerStatus)}</div>

                <div id="true-reader-viewport-area" class="flex-1 overflow-hidden" style="background: var(--bg-void); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; position: relative; display: flex; min-height: 0;">
                    <div class="font-mono text-cyan" style="padding: 40px;">LOADING READER...</div>
                </div>

                <div class="row flex-wrap" style="justify-content: space-between; gap: 16px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05);">
                    <div class="text-sm text-muted">
                        ${isEpub ? 'Arrow keys work for EPUB page turning.' : 'PDF uses native preview and scrolling.'}
                    </div>
                    <div id="reader-nav-controls" class="row" style="display: ${isEpub ? 'flex' : 'none'}; gap: 12px; align-items: center;">
                        <button class="tactical-btn" style="padding: 8px 18px;" onclick="navigateGenuineReader(-1)">&laquo; PREV</button>
                        <button class="tactical-btn optimal" style="padding: 8px 18px;" onclick="navigateGenuineReader(1)">NEXT &raquo;</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function executeInstantMetadataExtraction(inputEl) {
    const file = inputEl?.files?.[0];
    if (!file) return;

    const titleReadout = document.getElementById('parse-readout-title');
    const authorReadout = document.getElementById('parse-readout-author');
    const pagesReadout = document.getElementById('parse-readout-pages');
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_━-]/g, ' ').trim();

    if (titleReadout) titleReadout.textContent = cleanName.toUpperCase();
    if (authorReadout) authorReadout.textContent = isPdf ? 'AUTHOR // PDF DOCUMENT' : 'AUTHOR // EPUB';
    if (pagesReadout) pagesReadout.textContent = `PAGES // ${isPdf ? 'native PDF preview' : 'EPUB reader'}`;

    tacticalLibraryState.activeExtractedCover = null;

    if (!isPdf) {
        injectEPUBJSDependency().then(() => {
            if (typeof ePub === 'undefined') return;
            const reader = new FileReader();
            reader.onload = function (event) {
                try {
                    const tempBook = ePub(event.target.result);
                    tempBook.loaded.metadata.then(meta => {
                        if (meta?.title && titleReadout) titleReadout.textContent = String(meta.title).toUpperCase();
                        if (meta?.creator && authorReadout) authorReadout.textContent = `AUTHOR // ${String(meta.creator).toUpperCase()}`;
                    }).catch(() => {});
                    tempBook.coverUrl().then(url => {
                        if (url) tacticalLibraryState.activeExtractedCover = url;
                    }).catch(() => {});
                } catch {}
            };
            reader.readAsArrayBuffer(file);
        }).catch(() => {
            if (pagesReadout) pagesReadout.textContent = 'PAGES // EPUB engine not ready yet';
        });
    }
}

async function handleAutonomousLibraryDeposit(e) {
    e.preventDefault();

    const fileInput = document.getElementById('lib-auto-file');
    const file = fileInput?.files?.[0];
    const carryForward = !!document.getElementById('lib-auto-carry')?.checked;
    if (!file) return;

    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const fileType = isPdf ? 'pdf' : 'epub';
    const bookId = `lib-${Date.now()}`;
    const titleText = String(document.getElementById('parse-readout-title')?.textContent || file.name).trim();
    const authorText = String(document.getElementById('parse-readout-author')?.textContent || 'AUTHOR // AXIS').replace('AUTHOR // ', '').trim() || 'AXIS';
    const commitBtn = document.getElementById('lib-commit-btn');

    if (commitBtn) {
        commitBtn.textContent = 'WRITING...';
        commitBtn.disabled = true;
    }

    try {
        const binaryPayload = await readFileForLibrary(file, fileType);
        if (tacticalLibraryState.idbReady) {
            try { await saveBookBinaryToIDB(bookId, binaryPayload); } catch {}
        }

        const metaRecord = {
            id: bookId,
            title: titleText,
            author: authorText,
            type: fileType,
            currPage: 0,
            totalPages: fileType === 'pdf' ? 150 : 320,
            carryForward,
            coverUrl: tacticalLibraryState.activeExtractedCover,
            created_at: new Date().toISOString()
        };

        tacticalLibraryState.books.unshift(metaRecord);
        localStorage.setItem('axis_library_meta', JSON.stringify(tacticalLibraryState.books));

        if (shouldUseLibraryServer()) {
            try {
                const binaryBase64 = fileType === 'pdf' ? String(binaryPayload) : arrayBufferToBase64(binaryPayload);
                const mimeType = fileType === 'pdf' ? 'application/pdf' : 'application/epub+zip';
                const resp = await fetch('/api/library', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: bookId,
                        title: titleText,
                        author: authorText,
                        bookType: fileType,
                        currPage: 0,
                        totalPages: metaRecord.totalPages,
                        carryForward,
                        binaryBase64,
                        mimeType
                    })
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
                tacticalLibraryState.syncMode = 'server';
                tacticalLibraryState.lastError = '';
                await loadLibraryFromServer({ silent: true });
            } catch (err) {
                tacticalLibraryState.syncMode = 'local';
                tacticalLibraryState.lastError = err.message || 'Library sync failed';
            }
        }

        tacticalLibraryState.activeExtractedCover = null;
        if (fileInput) fileInput.value = '';
        renderLibraryView();
        if (typeof refreshCoreView === 'function') refreshCoreView();
    } catch (err) {
        tacticalLibraryState.lastError = err?.message || 'Library upload failed';
        renderLibraryView();
    } finally {
        if (commitBtn) {
            commitBtn.textContent = 'SAVE TO LIBRARY';
            commitBtn.disabled = false;
        }
    }
}

async function stepTacticalBookPage(bookId, stepAmount) {
    const book = tacticalLibraryState.books.find(item => item.id === bookId);
    if (!book) return;

    book.currPage = Math.min(Math.max(1, Number(book.totalPages || 1)), Math.max(0, Number(book.currPage || 0) + Number(stepAmount || 0)));
    if (book.currPage >= Number(book.totalPages || 1)) book.carryForward = false;

    todayTelemetry.lastLoggedTimestamp = Date.now();
    localStorage.setItem('axis_last_logged_time', String(todayTelemetry.lastLoggedTimestamp));
    localStorage.setItem('axis_library_meta', JSON.stringify(tacticalLibraryState.books));

    if (shouldUseLibraryServer()) {
        try {
            const resp = await fetch('/api/library', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'progress', id: book.id, currPage: book.currPage, carryForward: book.carryForward })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
            tacticalLibraryState.syncMode = 'server';
            tacticalLibraryState.lastError = '';
        } catch (err) {
            tacticalLibraryState.syncMode = 'local';
            tacticalLibraryState.lastError = err.message || 'Progress sync failed';
        }
    }

    renderLibraryView();
    if (typeof refreshCoreView === 'function') refreshCoreView();
}

async function purgeTacticalBook(bookId) {
    if (!confirm('PURGE BOOK AND ERASE BINARY FROM STORAGE?')) return;

    tacticalLibraryState.books = tacticalLibraryState.books.filter(item => item.id !== bookId);
    localStorage.setItem('axis_library_meta', JSON.stringify(tacticalLibraryState.books));
    try { await deleteBookBinaryFromIDB(bookId); } catch {}

    if (shouldUseLibraryServer()) {
        try {
            const resp = await fetch('/api/library', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id: bookId })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
            tacticalLibraryState.syncMode = 'server';
            tacticalLibraryState.lastError = '';
        } catch (err) {
            tacticalLibraryState.syncMode = 'local';
            tacticalLibraryState.lastError = err.message || 'Delete sync failed';
        }
    }

    if (tacticalLibraryState.activeBookId === bookId) closeTrueInlineReader();
    renderLibraryView();
}

async function executeTrueInlineReader(bookId) {
    const book = tacticalLibraryState.books.find(item => item.id === bookId);
    if (!book) return;

    tacticalLibraryState.activeBookId = bookId;
    tacticalLibraryState.readerType = book.type;
    tacticalLibraryState.readerStatus = 'Loading file...';
    renderLibraryView();
    document.body.style.overflow = 'hidden';

    const viewportArea = document.getElementById('true-reader-viewport-area');
    if (viewportArea) {
        viewportArea.innerHTML = `<div style="padding: 40px; font-family: var(--font-mono); color: var(--hud-cyan);">EXTRACTING FILE...</div>`;
    }
    updateLibraryReaderStatus('Loading file...');

    try {
        let content = await getBookBinaryFromIDB(bookId);
        if (!content && shouldUseLibraryServer()) {
            const fileData = await fetchLibraryBinaryFromServer(bookId);
            if (fileData) {
                content = book.type === 'pdf'
                    ? `data:${fileData.contentType || 'application/pdf'};base64,${fileData.binaryBase64}`
                    : base64ToArrayBuffer(fileData.binaryBase64 || '');
                if (tacticalLibraryState.idbReady) {
                    try { await saveBookBinaryToIDB(bookId, content); } catch {}
                }
            }
        }

        if (!content) {
            throw new Error('Binary not found. Reupload the file.');
        }

        if (book.type === 'pdf') {
            await openPdfReader(content, book);
            return;
        }

        await openEpubReader(content, book);
    } catch (err) {
        if (viewportArea) {
            viewportArea.innerHTML = `<div style="padding: 40px; color: var(--hud-critical); font-family: var(--font-mono); line-height: 1.7;">⚠️ ${escapeLibraryHtml(err?.message || 'Reader failed')}</div>`;
        }
        updateLibraryReaderStatus(err?.message || 'Reader failed');
    }
}

async function openPdfReader(content, book) {
    revokeLibraryPdfBlobUrl();
    tacticalLibraryState.pdfDataUri = String(content || '');

    const blob = base64ToPdfBlob(tacticalLibraryState.pdfDataUri);
    tacticalLibraryState.pdfBlobUrl = URL.createObjectURL(blob);
    const viewportArea = document.getElementById('true-reader-viewport-area');
    if (!viewportArea) return;

    viewportArea.innerHTML = `
        <iframe src="${tacticalLibraryState.pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH" style="width: 100%; height: 100%; border: none; background: #111; flex: 1;" title="${escapeLibraryHtml(book.title || 'PDF')}"></iframe>
    `;
    updateLibraryReaderStatus('PDF ready');
}

async function openEpubReader(content, book) {
    await injectEPUBJSDependency();
    if (typeof ePub === 'undefined') throw new Error('EPUB engine unavailable');

    const viewportArea = document.getElementById('true-reader-viewport-area');
    if (!viewportArea) return;
    viewportArea.innerHTML = `<div id="genuine-epub-render-target" style="width: 100%; height: 100%; min-height: 0; flex: 1; overflow: hidden;"></div>`;

    if (tacticalLibraryState.epubBookInstance) {
        try { tacticalLibraryState.epubBookInstance.destroy(); } catch {}
    }

    tacticalLibraryState.epubBookInstance = ePub(content);
    tacticalLibraryState.epubRendition = tacticalLibraryState.epubBookInstance.renderTo('genuine-epub-render-target', {
        width: '100%',
        height: '100%',
        flow: 'paginated'
    });

    tacticalLibraryState.epubRendition.themes.register('axis_dark', {
        body: { background: '#03050a', color: '#f1f5f9', 'font-family': 'system-ui, sans-serif', 'line-height': '1.8' },
        p: { 'font-size': '1.05rem' },
        'h1, h2, h3': { color: '#d79a52' }
    });
    tacticalLibraryState.epubRendition.themes.register('axis_light', {
        body: { background: '#f5f1ea', color: '#161616', 'font-family': 'system-ui, sans-serif', 'line-height': '1.8' },
        p: { 'font-size': '1.05rem' },
        'h1, h2, h3': { color: '#7c5b2e' }
    });
    tacticalLibraryState.epubRendition.themes.register('axis_sepia', {
        body: { background: '#f3e6cb', color: '#342515', 'font-family': 'Georgia, serif', 'line-height': '1.85' },
        p: { 'font-size': '1.08rem' },
        'h1, h2, h3': { color: '#87572f' }
    });

    tacticalLibraryState.epubRendition.themes.select(tacticalLibraryState.currentTheme);
    tacticalLibraryState.epubRendition.themes.fontSize(`${tacticalLibraryState.epubFontSize}%`);
    await tacticalLibraryState.epubRendition.display();

    tacticalLibraryState.epubRendition.on('relocated', (location) => {
        const page = location?.start?.displayed?.page || '?';
        const total = location?.start?.displayed?.total || '?';
        updateLibraryReaderStatus(`EPUB active // ${page} / ${total}`);
    });

    refreshReaderControlStates();
    updateLibraryReaderStatus(`EPUB ready // ${escapeLibraryHtml(book.title || '')}`);
}

function handleReaderBackdropClick(e) {
    if (e.target && e.target.id === 'axis-reader-modal') closeTrueInlineReader();
}

function openPdfInNewTab() {
    const target = tacticalLibraryState.pdfBlobUrl || tacticalLibraryState.pdfDataUri;
    if (!target) return;
    window.open(target, '_blank', 'noopener,noreferrer');
}

function applyGenuineEPUBTheme(themeName) {
    tacticalLibraryState.currentTheme = themeName;
    if (tacticalLibraryState.epubRendition) {
        tacticalLibraryState.epubRendition.themes.select(themeName);
    }
    refreshReaderControlStates();
}

function scaleEPUBFontSize(dir) {
    tacticalLibraryState.epubFontSize = Math.max(80, Math.min(180, tacticalLibraryState.epubFontSize + (Number(dir || 0) * 10)));
    if (tacticalLibraryState.epubRendition) {
        tacticalLibraryState.epubRendition.themes.fontSize(`${tacticalLibraryState.epubFontSize}%`);
    }
    const label = document.getElementById('axis-epub-font-label');
    if (label) label.textContent = `${tacticalLibraryState.epubFontSize}%`;
}

function navigateGenuineReader(dir) {
    if (!tacticalLibraryState.activeBookId || tacticalLibraryState.readerType !== 'epub' || !tacticalLibraryState.epubRendition) return;
    if (dir > 0) tacticalLibraryState.epubRendition.next();
    else tacticalLibraryState.epubRendition.prev();
}

function closeTrueInlineReader() {
    tacticalLibraryState.activeBookId = null;
    tacticalLibraryState.readerType = null;
    tacticalLibraryState.readerStatus = 'READY';
    tacticalLibraryState.pdfDataUri = null;
    revokeLibraryPdfBlobUrl();
    document.body.style.overflow = '';

    if (tacticalLibraryState.epubBookInstance) {
        try { tacticalLibraryState.epubBookInstance.destroy(); } catch {}
    }
    tacticalLibraryState.epubBookInstance = null;
    tacticalLibraryState.epubRendition = null;
    renderLibraryView();
}

function revokeLibraryPdfBlobUrl() {
    if (!tacticalLibraryState.pdfBlobUrl) return;
    try { URL.revokeObjectURL(tacticalLibraryState.pdfBlobUrl); } catch {}
    tacticalLibraryState.pdfBlobUrl = '';
}

function refreshReaderControlStates() {
    document.querySelectorAll('[data-axis-theme]').forEach(btn => {
        const active = btn.getAttribute('data-axis-theme') === tacticalLibraryState.currentTheme;
        btn.classList.toggle('active', !!active);
    });
    const label = document.getElementById('axis-epub-font-label');
    if (label) label.textContent = `${tacticalLibraryState.epubFontSize}%`;
}

function updateLibraryReaderStatus(text) {
    tacticalLibraryState.readerStatus = String(text || 'READY');
    const statusEl = document.getElementById('reader-telemetry-status');
    if (statusEl) statusEl.textContent = tacticalLibraryState.readerStatus;
}

function shouldUseLibraryServer() {
    return !!(window.axisAuthState?.authenticated && typeof supabaseClient !== 'undefined' && supabaseClient.mode === 'online');
}

async function loadLibraryFromServer({ silent = false } = {}) {
    if (!shouldUseLibraryServer()) {
        renderLibraryView();
        return false;
    }

    try {
        const resp = await fetch('/api/library', {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store'
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);

        tacticalLibraryState.books = (Array.isArray(data.rows) ? data.rows : []).map(row => ({
            id: row.id,
            title: row.title,
            author: row.author,
            type: row.book_type,
            currPage: Number(row.curr_page || 0),
            totalPages: Number(row.total_pages || (row.book_type === 'pdf' ? 150 : 320)),
            carryForward: !!row.carry_forward,
            storagePath: row.storage_path || '',
            coverUrl: row.cover_url || null,
            created_at: row.created_at
        }));

        localStorage.setItem('axis_library_meta', JSON.stringify(tacticalLibraryState.books));
        tacticalLibraryState.syncMode = 'server';
        tacticalLibraryState.lastError = '';
        if (!silent) renderLibraryView();
        else renderLibraryView();
        return true;
    } catch (e) {
        tacticalLibraryState.syncMode = 'local';
        tacticalLibraryState.lastError = e.message || 'Failed to load library';
        renderLibraryView();
        return false;
    }
}

async function manualLibrarySync() {
    const ok = await loadLibraryFromServer({ silent: false });
    if (!ok) console.warn(`Library sync failed: ${tacticalLibraryState.lastError || 'Unknown error'}`);
}

async function fetchLibraryBinaryFromServer(bookId) {
    const resp = await fetch(`/api/library?action=file&id=${encodeURIComponent(bookId)}`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${resp.status}`);
    }
    tacticalLibraryState.syncMode = 'server';
    tacticalLibraryState.lastError = '';
    return data;
}

function readFileForLibrary(file, fileType) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = (event) => resolve(event.target.result);
        if (fileType === 'pdf') reader.readAsDataURL(file);
        else reader.readAsArrayBuffer(file);
    });
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
}

function base64ToPdfBlob(dataUrlOrBase64) {
    const match = String(dataUrlOrBase64 || '').match(/^data:([^;]+);base64,(.+)$/);
    const base64 = match ? match[2] : String(dataUrlOrBase64 || '');
    const mime = match ? match[1] : 'application/pdf';
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return new Blob([bytes], { type: mime });
}

function escapeLibraryHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
