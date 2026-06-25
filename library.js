/* ==========================================
   AXIS // library.js
   EPUB & PDF library with popup reader modal
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

function saveBookBinaryToIDB(bookId, blobOrDataUri) {
    return new Promise((resolve, reject) => {
        if (!idbDatabase) return reject('IDB not ready');
        const tx = idbDatabase.transaction(['books_binary'], 'readwrite');
        const store = tx.objectStore('books_binary');
        store.put({ id: bookId, content: blobOrDataUri });
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e);
    });
}

function getBookBinaryFromIDB(bookId) {
    return new Promise((resolve, reject) => {
        if (!idbDatabase) return reject('IDB not ready');
        const tx = idbDatabase.transaction(['books_binary'], 'readonly');
        const store = tx.objectStore('books_binary');
        const req = store.get(bookId);
        req.onsuccess = () => resolve(req.result ? req.result.content : null);
        req.onerror = (e) => reject(e);
    });
}

function deleteBookBinaryFromIDB(bookId) {
    return new Promise((resolve, reject) => {
        if (!idbDatabase) return resolve();
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
    syncMode: 'local',
    lastError: ''
};

function injectEPUBJSDependency() {
    if (typeof ePub !== 'undefined') return;
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/epub.js/0.3.8/epub.min.js';
    script.async = true;
    document.head.appendChild(script);
}

function initLibrary() {
    injectEPUBJSDependency();
    initLibraryIndexedDB().then(async () => {
        renderLibraryView();
        await loadLibraryFromServer({ silent: false });
    });

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

    const isMobile = window.innerWidth <= 900;
    const totalBooks = tacticalLibraryState.books.length;
    const totalReadPages = tacticalLibraryState.books.reduce((s, b) => s + (b.currPage || 0), 0);

    container.innerHTML = `
        <div class="cockpit-header">
            <span>LIBRARY</span>
            <span style="font-size: 0.8rem; color: var(--hud-cyan);">${totalBooks} BOOKS • ${totalReadPages} PAGES • ${tacticalLibraryState.syncMode === 'server' ? 'SERVER' : 'LOCAL'}</span>
        </div>

        <div style="display: grid; grid-template-columns: ${isMobile ? '1fr' : '1fr 480px'}; gap: 40px; align-items: start;">
            <div style="display: flex; flex-direction: column; gap: 24px;">
                <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--text-main); font-weight: bold; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;">
                    <span>READING QUEUE</span>
                    <span style="font-size: 0.75rem; color: var(--hud-optimal);">CARRY-FORWARD ACTIVE</span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 20px;">
                    ${totalBooks === 0 ? renderEmptyLibraryHTML() : tacticalLibraryState.books.map(renderBookCardHTML).join('')}
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 32px;">
                <div class="cockpit-card" style="padding: 32px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-optimal); font-weight: bold; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <span>UPLOAD</span>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                            <span style="font-size: 0.75rem; color: var(--text-muted);">EPUB OR PDF</span>
                        </div>
                    </div>

                    <form onsubmit="handleAutonomousLibraryDeposit(event)" style="display: flex; flex-direction: column; gap: 20px;">
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <label style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-main); font-weight: bold;">SELECT FILE</label>
                            <input type="file" class="tactical-input" id="lib-auto-file" accept=".epub,.pdf" required style="padding: 14px; font-size: 0.9rem; border-color: var(--hud-cyan); background: rgba(56, 189, 248, 0.05);" onchange="executeInstantMetadataExtraction(this)">
                            <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">AXIS extracts title, author, cover, and basic page estimate.</span>
                        </div>

                        <div style="background: var(--bg-surface); border: 1px solid var(--text-muted); padding: 16px; border-radius: 4px; font-family: var(--font-mono); display: flex; flex-direction: column; gap: 8px;">
                            <div style="font-size: 0.75rem; color: var(--hud-violet); font-weight: bold;">PARSE PREVIEW</div>
                            <div style="font-size: 1.05rem; font-weight: bold; color: var(--text-main);" id="parse-readout-title">PENDING SELECTION</div>
                            <div style="font-size: 0.84rem; color: var(--hud-optimal);" id="parse-readout-author">AUTHOR // PENDING</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);" id="parse-readout-pages">PAGES // ~300</div>
                        </div>

                        <label style="font-family: var(--font-mono); font-size: 0.9rem; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="lib-auto-carry" checked style="accent-color: var(--hud-optimal); width: 18px; height: 18px;">
                            Carry forward until finished
                        </label>

                        <button type="submit" class="tactical-btn" style="justify-content: center; width: 100%; height: 52px; border-color: var(--hud-optimal); font-size: 1rem;" id="lib-commit-btn">
                            SAVE TO LIBRARY
                        </button>
                    </form>
                </div>
            </div>
        </div>

        ${renderReaderModalHTML()}
    `;
}

function renderEmptyLibraryHTML() {
    return `
        <div class="cockpit-card" style="padding: 60px 40px; text-align: center; justify-content: center; align-items: center; min-height: 280px; border-color: var(--text-muted);">
            <div style="font-family: var(--font-mono); font-size: 1.3rem; color: var(--text-muted); letter-spacing: 6px;">LIBRARY EMPTY</div>
            <div style="font-family: var(--font-mono); font-size: 0.9rem; color: var(--text-muted); max-width: 440px; margin-top: 14px; line-height: 1.6;">
                Upload any EPUB or PDF and AXIS will save it into local memory with popup reading.
            </div>
        </div>
    `;
}

function renderBookCardHTML(b) {
    const progressWidth = Math.min(100, ((b.currPage || 0) / Math.max(1, b.totalPages || 1)) * 100);
    return `
        <div class="cockpit-card" style="padding: 24px; flex-direction: ${window.innerWidth <= 900 ? 'column' : 'row'}; gap: 20px; align-items: ${window.innerWidth <= 900 ? 'stretch' : 'center'}; justify-content: space-between; border-left: 4px solid ${b.carryForward ? 'var(--hud-violet)' : 'var(--text-muted)'};">
            <div style="display: flex; gap: 24px; align-items: center; flex: 1; overflow: hidden; min-width: 0;">
                <div style="width: 75px; height: 105px; background: var(--bg-surface); border: 1px solid var(--text-muted); border-radius: 4px; overflow: hidden; flex-shrink: 0; display: flex; justify-content: center; align-items: center;">
                    ${b.coverUrl ? `<img src="${b.coverUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Cover">` : `<span style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted); font-weight: bold;">${b.type.toUpperCase()}</span>`}
                </div>

                <div style="font-family: var(--font-mono); flex: 1; min-width: 0;">
                    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                        <span style="background: var(--bg-surface); color: ${b.type === 'epub' ? 'var(--hud-violet)' : 'var(--hud-cyan)'}; border: 1px solid ${b.type === 'epub' ? 'var(--hud-violet)' : 'var(--hud-cyan)'}; padding: 2px 6px; font-size: 0.65rem; font-weight: bold; text-transform: uppercase; border-radius: 2px;">
                            ${b.type}
                        </span>
                        <span style="font-size: 0.8rem; color: var(--hud-optimal); font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${b.author}
                        </span>
                    </div>

                    <div style="font-size: 1.2rem; font-weight: bold; color: var(--text-main); margin: 8px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${b.title}
                    </div>

                    <div style="display: flex; gap: 16px; align-items: center; font-size: 0.75rem; color: var(--text-muted); flex-wrap: wrap;">
                        <span style="color: ${b.carryForward ? 'var(--hud-violet)' : 'var(--text-muted)'}; font-weight: bold;">
                            ${b.carryForward ? '📌 CARRY-FORWARD ACTIVE' : '✓ GOAL RESOLVED'}
                        </span>
                    </div>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: ${window.innerWidth <= 900 ? 'stretch' : 'flex-end'}; gap: 12px; font-family: var(--font-mono); flex-shrink: 0; width: ${window.innerWidth <= 900 ? '100%' : '220px'};">
                <div style="font-size: 1.2rem; font-weight: bold; color: var(--text-main);">
                    <span style="color: var(--hud-optimal);">${b.currPage || 0}</span> / ${b.totalPages || 0} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">PGS</span>
                </div>

                <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${progressWidth}%; background: var(--hud-optimal); box-shadow: 0 0 10px var(--hud-optimal);"></div>
                </div>

                <div style="display: flex; gap: 6px; margin-top: 2px;">
                    <button class="tactical-btn" style="padding: 2px 8px; font-size: 0.7rem;" onclick="stepTacticalBookPage('${b.id}', -1)">-1</button>
                    <button class="tactical-btn" style="padding: 2px 8px; font-size: 0.7rem;" onclick="stepTacticalBookPage('${b.id}', 1)">+1</button>
                    <button class="tactical-btn cyan" style="padding: 2px 8px; font-size: 0.7rem;" onclick="stepTacticalBookPage('${b.id}', 10)">+10</button>
                </div>

                <div style="display: flex; gap: 12px; margin-top: 6px; align-items: center;">
                    <button class="tactical-btn" style="padding: 4px 14px; font-size: 0.75rem; border-color: var(--hud-optimal); color: var(--hud-optimal);" onclick="executeTrueInlineReader('${b.id}')">
                        READ
                    </button>
                    <button style="background: transparent; border: none; color: var(--hud-critical); font-family: var(--font-mono); font-size: 0.9rem; cursor: pointer;" onclick="purgeTacticalBook('${b.id}')" title="Purge from memory">
                        &times;
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderReaderModalHTML() {
    if (!tacticalLibraryState.activeBookId) return '';
    const activeBook = tacticalLibraryState.books.find(b => b.id === tacticalLibraryState.activeBookId);
    if (!activeBook) return '';
    const isEpub = tacticalLibraryState.readerType === 'epub';

    return `
        <div id="axis-reader-modal" onclick="handleReaderBackdropClick(event)" style="position: fixed; inset: 0; z-index: 9998; background: rgba(3,5,10,0.92); backdrop-filter: blur(10px); display: flex; justify-content: center; align-items: center; padding: 28px;">
            <div class="cockpit-card" style="width: min(1400px, 96vw); height: min(92vh, 980px); padding: 28px; border-color: var(--hud-cyan); box-shadow: 0 20px 70px rgba(0,0,0,0.9), 0 0 30px rgba(56, 189, 248, 0.18); gap: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; font-family: var(--font-mono); border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 14px;">
                    <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
                        <span style="color: var(--hud-cyan); font-weight: bold; font-size: 1.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" id="true-reader-book-title">${activeBook.title} // ${activeBook.author}</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);" id="true-reader-mode-badge">${activeBook.type.toUpperCase()} READER</span>
                    </div>

                    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: flex-end;">
                        <div id="epub-theme-tools" style="display: ${isEpub ? 'flex' : 'none'}; gap: 6px; align-items: center; font-size: 0.8rem; color: var(--text-muted);">
                            <span>THEME</span>
                            <button onclick="applyGenuineEPUBTheme('axis_dark')" class="tactical-btn ${tacticalLibraryState.currentTheme === 'axis_dark' ? 'cyan active' : ''}" style="padding: 4px 10px; font-size: 0.7rem;">VOID</button>
                            <button onclick="applyGenuineEPUBTheme('axis_light')" class="tactical-btn ${tacticalLibraryState.currentTheme === 'axis_light' ? 'cyan active' : ''}" style="padding: 4px 10px; font-size: 0.7rem;">LIGHT</button>
                            <button onclick="applyGenuineEPUBTheme('axis_sepia')" class="tactical-btn ${tacticalLibraryState.currentTheme === 'axis_sepia' ? 'cyan active' : ''}" style="padding: 4px 10px; font-size: 0.7rem;">SEPIA</button>
                        </div>

                        <div id="epub-font-tools" style="display: ${isEpub ? 'flex' : 'none'}; gap: 6px; align-items: center; font-size: 0.8rem; color: var(--text-muted);">
                            <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.75rem;" onclick="scaleEPUBFontSize(-1)">A-</button>
                            <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.75rem;" onclick="scaleEPUBFontSize(1)">A+</button>
                        </div>

                        <button id="pdf-open-new-tab-btn" onclick="openPdfInNewTab()" class="tactical-btn" style="display: ${isEpub ? 'none' : 'inline-flex'}; padding: 6px 12px; border-color: var(--hud-cyan); color: var(--hud-cyan);">
                            OPEN PDF
                        </button>
                        <button class="tactical-btn" style="padding: 6px 14px; border-color: var(--hud-critical); color: var(--hud-critical);" onclick="closeTrueInlineReader()">
                            CLOSE &times;
                        </button>
                    </div>
                </div>

                <div id="reader-telemetry-status" style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">${tacticalLibraryState.readerStatus}</div>

                <div id="true-reader-viewport-area" style="width: 100%; flex: 1; min-height: 0; background: var(--bg-void); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; position: relative; overflow: hidden; display: flex;">
                    <div style="padding: 40px; font-family: var(--font-mono); color: var(--hud-cyan);">LOADING READER...</div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; font-family: var(--font-mono); padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap;">
                    <div style="font-size: 0.75rem; color: var(--text-muted);">
                        ${isEpub ? 'ARROW KEYS ACTIVE FOR EPUB PAGE TURNING' : 'PDF NAVIGATION BUTTONS REMOVED FOR NOW — USE SCROLL OR OPEN PDF'}
                    </div>
                    <div id="reader-nav-controls" style="display: ${isEpub ? 'flex' : 'none'}; gap: 12px; align-items: center;">
                        <button class="tactical-btn" style="padding: 8px 18px;" onclick="navigateGenuineReader(-1)">&laquo; PREV</button>
                        <button class="tactical-btn optimal" style="padding: 8px 18px; border-color: var(--hud-optimal);" onclick="navigateGenuineReader(1)">NEXT &raquo;</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function executeInstantMetadataExtraction(inputEl) {
    const file = inputEl.files[0];
    if (!file) return;

    const titleReadout = document.getElementById('parse-readout-title');
    const authorReadout = document.getElementById('parse-readout-author');
    const pagesReadout = document.getElementById('parse-readout-pages');
    const isPdf = file.name.toLowerCase().endsWith('.pdf');

    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_━-]/g, ' ').trim();
    if (titleReadout) titleReadout.textContent = cleanName.toUpperCase();
    if (authorReadout) authorReadout.textContent = isPdf ? 'AUTHOR // PDF DOCUMENT' : 'AUTHOR // EPUB SPEC';
    if (pagesReadout) pagesReadout.textContent = 'PAGES // ~300';

    tacticalLibraryState.activeExtractedCover = null;

    if (!isPdf && typeof ePub !== 'undefined') {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const tempBook = ePub(e.target.result);
                tempBook.loaded.metadata.then(meta => {
                    if (meta.title && titleReadout) titleReadout.textContent = meta.title.toUpperCase();
                    if (meta.creator && authorReadout) authorReadout.textContent = `AUTHOR // ${meta.creator.toUpperCase()}`;
                }).catch(() => {});
                tempBook.coverUrl().then(url => {
                    if (url) tacticalLibraryState.activeExtractedCover = url;
                }).catch(() => {});
            } catch {}
        };
        reader.readAsArrayBuffer(file);
    }
}

function handleAutonomousLibraryDeposit(e) {
    e.preventDefault();

    const fileInput = document.getElementById('lib-auto-file');
    const file = fileInput.files[0];
    const carryForward = document.getElementById('lib-auto-carry').checked;
    if (!file) return;

    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const fileType = isPdf ? 'pdf' : 'epub';
    const bookId = 'lib-' + Date.now();

    const titleText = document.getElementById('parse-readout-title').textContent || file.name.toUpperCase();
    const authorText = (document.getElementById('parse-readout-author').textContent || 'AUTHOR // AXIS ACTUAL').replace('AUTHOR // ', '');

    const btn = document.getElementById('lib-commit-btn');
    if (btn) {
        btn.textContent = 'WRITING TO MEMORY...';
        btn.style.color = 'var(--hud-optimal)';
    }

    const reader = new FileReader();
    reader.onload = async function (event) {
        const binaryPayload = event.target.result;
        try {
            await saveBookBinaryToIDB(bookId, binaryPayload);
            const metaRecord = {
                id: bookId,
                title: titleText,
                author: authorText,
                type: fileType,
                currPage: 0,
                totalPages: isPdf ? 150 : 320,
                carryForward,
                coverUrl: tacticalLibraryState.activeExtractedCover,
                created_at: new Date().toISOString()
            };

            tacticalLibraryState.books.unshift(metaRecord);
            localStorage.setItem('axis_library_meta', JSON.stringify(tacticalLibraryState.books));

            if (shouldUseLibraryServer()) {
                try {
                    const binaryBase64 = fileType === 'pdf'
                        ? String(binaryPayload)
                        : arrayBufferToBase64(binaryPayload);
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
                    tacticalLibraryState.lastError = err.message || 'FAILED TO SYNC LIBRARY';
                }
            }

            renderLibraryView();
            refreshCoreView();
        } catch (err) {
            alert('Library save failed: ' + err);
        }
    };

    if (fileType === 'pdf') reader.readAsDataURL(file);
    else reader.readAsArrayBuffer(file);
}

async function stepTacticalBookPage(bookId, stepAmount) {
    const b = tacticalLibraryState.books.find(x => x.id === bookId);
    if (!b) return;
    b.currPage = Math.min(b.totalPages, Math.max(0, (b.currPage || 0) + stepAmount));
    if (b.currPage === b.totalPages) b.carryForward = false;

    todayTelemetry.lastLoggedTimestamp = Date.now();
    localStorage.setItem('axis_last_logged_time', todayTelemetry.lastLoggedTimestamp);
    localStorage.setItem('axis_library_meta', JSON.stringify(tacticalLibraryState.books));

    if (shouldUseLibraryServer()) {
        try {
            const resp = await fetch('/api/library', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'progress', id: b.id, currPage: b.currPage, carryForward: b.carryForward })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
            tacticalLibraryState.syncMode = 'server';
            tacticalLibraryState.lastError = '';
        } catch (err) {
            tacticalLibraryState.syncMode = 'local';
            tacticalLibraryState.lastError = err.message || 'FAILED TO SYNC PROGRESS';
        }
    }

    renderLibraryView();
    refreshCoreView();
}

async function purgeTacticalBook(bookId) {
    if (!confirm('PURGE BOOK AND ERASE BINARY FROM STORAGE?')) return;
    tacticalLibraryState.books = tacticalLibraryState.books.filter(x => x.id !== bookId);
    localStorage.setItem('axis_library_meta', JSON.stringify(tacticalLibraryState.books));
    deleteBookBinaryFromIDB(bookId);

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
            tacticalLibraryState.lastError = err.message || 'FAILED TO DELETE BOOK';
        }
    }

    if (tacticalLibraryState.activeBookId === bookId) closeTrueInlineReader();
    renderLibraryView();
}

function executeTrueInlineReader(bookId) {
    const b = tacticalLibraryState.books.find(x => x.id === bookId);
    if (!b) return;

    tacticalLibraryState.activeBookId = bookId;
    tacticalLibraryState.readerType = b.type;
    tacticalLibraryState.readerStatus = 'FETCHING BINARY FROM LOCAL MEMORY...';
    renderLibraryView();
    document.body.style.overflow = 'hidden';

    const viewportArea = document.getElementById('true-reader-viewport-area');
    const statusEl = document.getElementById('reader-telemetry-status');
    if (viewportArea) viewportArea.innerHTML = `<div style="padding: 40px; font-family: var(--font-mono); color: var(--hud-cyan);">EXTRACTING FILE...</div>`;
    if (statusEl) statusEl.textContent = tacticalLibraryState.readerStatus;

    getBookBinaryFromIDB(bookId).then(async content => {
        if (!content && shouldUseLibraryServer()) {
            try {
                const resp = await fetch(`/api/library?action=file&id=${encodeURIComponent(bookId)}`, {
                    method: 'GET',
                    credentials: 'same-origin',
                    cache: 'no-store'
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
                content = b.type === 'pdf'
                    ? `data:${data.contentType || 'application/pdf'};base64,${data.binaryBase64}`
                    : base64ToArrayBuffer(data.binaryBase64 || '');
                await saveBookBinaryToIDB(bookId, content);
                tacticalLibraryState.syncMode = 'server';
                tacticalLibraryState.lastError = '';
            } catch (err) {
                tacticalLibraryState.syncMode = 'local';
                tacticalLibraryState.lastError = err.message || 'FAILED TO FETCH BOOK FILE';
            }
        }

        if (!content) {
            tacticalLibraryState.readerStatus = 'STORAGE FAULT // REUPLOAD REQUIRED';
            if (viewportArea) viewportArea.innerHTML = `<div style="padding: 40px; color: var(--hud-critical); font-family: var(--font-mono);">⚠️ Binary not found in local memory or server. Please upload the file again.</div>`;
            if (statusEl) statusEl.textContent = tacticalLibraryState.readerStatus;
            return;
        }

        if (b.type === 'pdf') {
            tacticalLibraryState.pdfDataUri = content;
            tacticalLibraryState.readerStatus = 'PDF VIEWER READY // SCROLL OR OPEN PDF';
            if (viewportArea) {
                viewportArea.innerHTML = `
                    <iframe src="${content}#toolbar=0&navpanes=0&scrollbar=1&view=FitH" style="width: 100%; height: 100%; border: none; background: #fff; flex: 1;" title="${b.title}"></iframe>
                `;
            }
            if (statusEl) statusEl.textContent = tacticalLibraryState.readerStatus;
        } else {
            tacticalLibraryState.readerStatus = 'EPUB RENDERER LOADING';
            if (statusEl) statusEl.textContent = tacticalLibraryState.readerStatus;
            if (viewportArea) {
                viewportArea.innerHTML = `<div id="genuine-epub-render-target" style="width: 100%; height: 100%; min-height: 0; flex: 1; overflow: hidden;"></div>`;
            }

            try {
                tacticalLibraryState.epubBookInstance = ePub(content);
                tacticalLibraryState.epubRendition = tacticalLibraryState.epubBookInstance.renderTo('genuine-epub-render-target', {
                    width: '100%',
                    height: '100%',
                    flow: 'paginated'
                });

                tacticalLibraryState.epubRendition.themes.register('axis_dark', {
                    body: { background: '#03050a', color: '#f1f5f9', 'font-family': 'system-ui, sans-serif', 'line-height': '1.7' },
                    p: { 'font-size': '1.15rem' },
                    'h1, h2, h3': { color: '#38bdf8', 'font-family': 'monospace', 'text-transform': 'uppercase' }
                });
                tacticalLibraryState.epubRendition.themes.register('axis_light', {
                    body: { background: '#f8fafc', color: '#0f172a', 'font-family': 'system-ui, sans-serif', 'line-height': '1.7' },
                    p: { 'font-size': '1.15rem' },
                    'h1, h2, h3': { color: '#7e22ce', 'font-family': 'monospace', 'text-transform': 'uppercase' }
                });
                tacticalLibraryState.epubRendition.themes.register('axis_sepia', {
                    body: { background: '#fef3c7', color: '#451a03', 'font-family': 'Georgia, serif', 'line-height': '1.7' },
                    p: { 'font-size': '1.15rem' },
                    'h1, h2, h3': { color: '#9a3412', 'font-family': 'monospace', 'text-transform': 'uppercase' }
                });

                tacticalLibraryState.epubRendition.themes.select(tacticalLibraryState.currentTheme);
                tacticalLibraryState.epubRendition.themes.fontSize(`${tacticalLibraryState.epubFontSize}%`);
                tacticalLibraryState.epubRendition.display();

                tacticalLibraryState.epubRendition.on('relocated', (location) => {
                    tacticalLibraryState.readerStatus = `EPUB ACTIVE // ${location.start.displayed.page || '?'} / ${location.start.displayed.total || '?'}`;
                    const status = document.getElementById('reader-telemetry-status');
                    if (status) status.textContent = tacticalLibraryState.readerStatus;
                });
            } catch (epubErr) {
                tacticalLibraryState.readerStatus = 'EPUB ENGINE FAULT';
                if (viewportArea) viewportArea.innerHTML = `<div style="padding: 40px; color: var(--hud-critical); font-family: var(--font-mono);">⚠️ EPUB fault: ${epubErr.message || epubErr}</div>`;
                if (statusEl) statusEl.textContent = tacticalLibraryState.readerStatus;
            }
        }
    }).catch(err => {
        tacticalLibraryState.readerStatus = 'IDB FAULT';
        if (viewportArea) viewportArea.innerHTML = `<div style="padding: 40px; color: var(--hud-critical); font-family: var(--font-mono);">⚠️ IDB fault: ${err}</div>`;
        if (statusEl) statusEl.textContent = tacticalLibraryState.readerStatus;
    });
}

function handleReaderBackdropClick(e) {
    if (e.target && e.target.id === 'axis-reader-modal') closeTrueInlineReader();
}

function openPdfInNewTab() {
    if (tacticalLibraryState.readerType !== 'pdf' || !tacticalLibraryState.pdfDataUri) return;
    window.open(tacticalLibraryState.pdfDataUri, '_blank');
}

function applyGenuineEPUBTheme(themeName) {
    tacticalLibraryState.currentTheme = themeName;
    if (tacticalLibraryState.epubRendition) tacticalLibraryState.epubRendition.themes.select(themeName);
    renderLibraryView();
    if (tacticalLibraryState.activeBookId) executeTrueInlineReader(tacticalLibraryState.activeBookId);
}

function closeTrueInlineReader() {
    tacticalLibraryState.activeBookId = null;
    tacticalLibraryState.readerType = null;
    tacticalLibraryState.readerStatus = 'READY';
    tacticalLibraryState.pdfDataUri = null;
    document.body.style.overflow = '';
    if (tacticalLibraryState.epubBookInstance) {
        try { tacticalLibraryState.epubBookInstance.destroy(); } catch {}
        tacticalLibraryState.epubBookInstance = null;
        tacticalLibraryState.epubRendition = null;
    }
    renderLibraryView();
}

function scaleEPUBFontSize(dir) {
    tacticalLibraryState.epubFontSize = Math.max(80, Math.min(180, tacticalLibraryState.epubFontSize + (dir * 10)));
    if (tacticalLibraryState.epubRendition) {
        tacticalLibraryState.epubRendition.themes.fontSize(`${tacticalLibraryState.epubFontSize}%`);
    }
}

function shouldUseLibraryServer() {
    return !!(window.axisAuthState?.authenticated && typeof supabaseClient !== 'undefined' && supabaseClient.mode === 'online');
}

async function loadLibraryFromServer({ silent = false } = {}) {
    if (!shouldUseLibraryServer()) return false;
    try {
        const resp = await fetch('/api/library', {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store'
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        tacticalLibraryState.books = (data.rows || []).map(row => ({
            id: row.id,
            title: row.title,
            author: row.author,
            type: row.book_type,
            currPage: row.curr_page || 0,
            totalPages: row.total_pages || (row.book_type === 'pdf' ? 150 : 320),
            carryForward: !!row.carry_forward,
            storagePath: row.storage_path || '',
            coverUrl: null,
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
        tacticalLibraryState.lastError = e.message || 'FAILED TO LOAD LIBRARY';
        return false;
    }
}

async function manualLibrarySync() {
    const ok = await loadLibraryFromServer({ silent: false });
    if (!ok) alert(`Library sync failed: ${tacticalLibraryState.lastError || 'Unknown error'}`);
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
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
}

function navigateGenuineReader(dir) {
    if (!tacticalLibraryState.activeBookId || tacticalLibraryState.readerType !== 'epub' || !tacticalLibraryState.epubRendition) return;
    if (dir > 0) tacticalLibraryState.epubRendition.next();
    else tacticalLibraryState.epubRendition.prev();
}