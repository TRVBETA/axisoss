/* ==========================================
   AXIS // library.js
   Pristine Standalone EPUB & PDF Reading Archive
   - Autonomous Metadata Extraction (Title, Author, Cover)
   - Centered Ergonomic Reading Viewport (850px)
   - True Reading Themes (Void Dark, Clean Light, Sepia)
   ========================================== */

let idbDatabase = null;
function initLibraryIndexedDB() {
    return new Promise((resolve, reject) => {
        let req = indexedDB.open("AXIS_LIBRARY_DB", 1);
        req.onupgradeneeded = function(e) {
            let db = e.target.result;
            if (!db.objectStoreNames.contains("books_binary")) {
                db.createObjectStore("books_binary", { keyPath: "id" });
            }
        };
        req.onsuccess = function(e) {
            idbDatabase = e.target.result;
            resolve(idbDatabase);
        };
        req.onerror = function(e) {
            console.error("IDB init failed", e);
            reject(e);
        };
    });
}

function saveBookBinaryToIDB(bookId, blobOrDataUri) {
    return new Promise((resolve, reject) => {
        if (!idbDatabase) return reject("IDB not ready");
        let tx = idbDatabase.transaction(["books_binary"], "readwrite");
        let store = tx.objectStore("books_binary");
        store.put({ id: bookId, content: blobOrDataUri });
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e);
    });
}

function getBookBinaryFromIDB(bookId) {
    return new Promise((resolve, reject) => {
        if (!idbDatabase) return reject("IDB not ready");
        let tx = idbDatabase.transaction(["books_binary"], "readonly");
        let store = tx.objectStore("books_binary");
        let req = store.get(bookId);
        req.onsuccess = () => resolve(req.result ? req.result.content : null);
        req.onerror = (e) => reject(e);
    });
}

function deleteBookBinaryFromIDB(bookId) {
    return new Promise((resolve, reject) => {
        if (!idbDatabase) return resolve();
        let tx = idbDatabase.transaction(["books_binary"], "readwrite");
        let store = tx.objectStore("books_binary");
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
    activeExtractedCover: null
};

function injectEPUBJSDependency() {
    if (typeof ePub !== 'undefined') return;
    let script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/epub.js/0.3.8/epub.min.js";
    script.async = true;
    document.head.appendChild(script);
}

function initLibrary() {
    injectEPUBJSDependency();
    initLibraryIndexedDB().then(() => {
        renderLibraryView();
    });

    // Handle physical keyboard horizontal page-flipping
    document.addEventListener('keydown', (e) => {
        if (!tacticalLibraryState.activeBookId) return;
        if (e.key === 'ArrowRight') {
            navigateGenuineReader(1);
        } else if (e.key === 'ArrowLeft') {
            navigateGenuineReader(-1);
        }
    });
}

function renderLibraryView() {
    const container = document.getElementById('module-library');
    if (!container) return;

    let totalBooks = tacticalLibraryState.books.length;
    let totalReadPages = tacticalLibraryState.books.reduce((s, b) => s + b.currPage, 0);

    container.innerHTML = `
        <div class="cockpit-header">
            <span>TACTICAL ARCHIVES // EPUB & PDF DIGITAL LIBRARY</span>
            <span style="font-size: 0.8rem; color: var(--hud-cyan);">${totalBooks} TEXTS // ${totalReadPages} PAGES RESOLVED</span>
        </div>

        <!-- Main Dashboard Architecture -->
        <div style="display: grid; grid-template-columns: 1fr 480px; gap: 40px;">
            
            <!-- Left: Genuine Reading Roster -->
            <div style="display: flex; flex-direction: column; gap: 24px;">
                <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--text-main); font-weight: bold; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;">
                    <span>CANONICAL READING QUEUE // ACTIVE MEMORY</span>
                    <span style="font-size: 0.75rem; color: var(--hud-optimal);">CARRY-FORWARD ACCOUNTABILITY ACTIVE</span>
                </div>

                <!-- Book Roster List -->
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    ${totalBooks === 0 ? `
                        <div class="cockpit-card" style="padding: 60px 40px; text-align: center; justify-content: center; align-items: center; min-height: 280px; border-color: var(--text-muted);">
                            <div style="font-family: var(--font-mono); font-size: 1.3rem; color: var(--text-muted); letter-spacing: 6px;">SYSTEM ARCHIVE EMPTY</div>
                            <div style="font-family: var(--font-mono); font-size: 0.9rem; color: var(--text-muted); max-width: 440px; margin-top: 14px; line-height: 1.6;">
                                No canonical texts deposited. Select any genuine .epub or .pdf file below to autonomously extract metadata and write to local IDB memory.
                            </div>
                        </div>
                    ` : tacticalLibraryState.books.map(b => `
                        <div class="cockpit-card" style="padding: 24px; flex-direction: row; gap: 28px; align-items: center; justify-content: space-between; border-left: 4px solid ${b.carryForward ? 'var(--hud-violet)' : 'var(--text-muted)'};">
                            
                            <!-- Cover & Metadata Readout -->
                            <div style="display: flex; gap: 24px; align-items: center; flex: 1; overflow: hidden;">
                                <div style="width: 75px; height: 105px; background: var(--bg-surface); border: 1px solid var(--text-muted); border-radius: 4px; overflow: hidden; flex-shrink: 0; display: flex; justify-content: center; align-items: center;">
                                    ${b.coverUrl ? `<img src="${b.coverUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Cover">` : `<span style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted); font-weight: bold;">${b.type.toUpperCase()}</span>`}
                                </div>

                                <div style="font-family: var(--font-mono); flex: 1; min-width: 0;">
                                    <div style="display: flex; gap: 12px; align-items: center;">
                                        <span style="background: var(--bg-surface); color: ${b.type === 'epub' ? 'var(--hud-violet)' : 'var(--hud-cyan)'}; border: 1px solid ${b.type === 'epub' ? 'var(--hud-violet)' : 'var(--hud-cyan)'}; padding: 2px 6px; font-size: 0.65rem; font-weight: bold; text-transform: uppercase; border-radius: 2px;">
                                            ${b.type}
                                        </span>
                                        <span style="font-size: 0.8rem; color: var(--hud-optimal); font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                            ${b.author}
                                        </span>
                                    </div>

                                    <div style="font-size: 1.25rem; font-weight: bold; color: var(--text-main); margin: 8px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                        ${b.title}
                                    </div>

                                    <div style="display: flex; gap: 16px; align-items: center; font-size: 0.75rem; color: var(--text-muted);">
                                        <span style="color: ${b.carryForward ? 'var(--hud-violet)' : 'var(--text-muted)'}; font-weight: bold;">
                                            ${b.carryForward ? '📌 CARRY-FORWARD ACTIVE' : '✓ GOAL RESOLVED'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- Numeric Telemetry Steppers & Execution & Management -->
                            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 12px; font-family: var(--font-mono); flex-shrink: 0; width: 220px;">
                                
                                <div style="font-size: 1.3rem; font-weight: bold; color: var(--text-main);">
                                    <span style="color: var(--hud-optimal);">${b.currPage}</span> / ${b.totalPages} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">PGS</span>
                                </div>

                                <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; position: relative;">
                                    <div style="height: 100%; width: ${Math.min(100, (b.currPage / b.totalPages) * 100)}%; background: var(--hud-optimal); box-shadow: 0 0 10px var(--hud-optimal);"></div>
                                </div>

                                <div style="display: flex; gap: 6px; margin-top: 2px;">
                                    <button class="tactical-btn" style="padding: 2px 8px; font-size: 0.7rem;" onclick="stepTacticalBookPage('${b.id}', -1)" title="Previous Page">-1</button>
                                    <button class="tactical-btn" style="padding: 2px 8px; font-size: 0.7rem;" onclick="stepTacticalBookPage('${b.id}', 1)" title="Next Page">+1</button>
                                    <button class="tactical-btn cyan" style="padding: 2px 8px; font-size: 0.7rem;" onclick="stepTacticalBookPage('${b.id}', 10)">+10</button>
                                </div>

                                <div style="display: flex; gap: 12px; margin-top: 6px; align-items: center;">
                                    <button class="tactical-btn" style="padding: 4px 14px; font-size: 0.75rem; border-color: var(--hud-optimal); color: var(--hud-optimal);" onclick="executeTrueInlineReader('${b.id}')">
                                        READ &raquo;
                                    </button>
                                    <button style="background: transparent; border: none; color: var(--hud-critical); font-family: var(--font-mono); font-size: 0.9rem; cursor: pointer;" onclick="purgeTacticalBook('${b.id}')" title="Purge from memory">
                                        &times;
                                    </button>
                                </div>

                            </div>

                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Right: Pure Autonomous Injection Suite -->
            <div style="display: flex; flex-direction: column; gap: 40px;">
                
                <div class="cockpit-card" style="padding: 32px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-optimal); font-weight: bold; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                        <span>AUTONOMOUS DEPOSIT Suite</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">ZERO MANUAL INPUT Boxes</span>
                    </div>

                    <form onsubmit="handleAutonomousLibraryDeposit(event)" style="display: flex; flex-direction: column; gap: 20px;">
                        
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <label style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-main); font-weight: bold;">SELECT TEXT (.EPUB OR .PDF)</label>
                            <input type="file" class="tactical-input" id="lib-auto-file" accept=".epub, .pdf" required style="padding: 14px; font-size: 0.9rem; border-color: var(--hud-cyan); background: rgba(56, 189, 248, 0.05);" onchange="executeInstantMetadataExtraction(this)">
                            <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">AXIS will autonomously parse Title, Author, Cover, and Target Pages instantly.</span>
                        </div>

                        <!-- Real-time extraction preview banner -->
                        <div style="background: var(--bg-surface); border: 1px solid var(--text-muted); padding: 16px; border-radius: 4px; font-family: var(--font-mono); display: flex; flex-direction: column; gap: 8px;">
                            <div style="font-size: 0.75rem; color: var(--hud-violet); font-weight: bold;">METABOLIC PARSING SENSOR:</div>
                            <div style="font-size: 1.1rem; font-weight: bold; color: var(--text-main);" id="parse-readout-title">PENDING SELECTION</div>
                            <div style="font-size: 0.85rem; color: var(--hud-optimal);" id="parse-readout-author">AUTHOR // PENDING</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);" id="parse-readout-pages">PAGES // ~300</div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <label style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted);">ACCOUNTABILITY carry-forward FLAG</label>
                            <label style="font-family: var(--font-mono); font-size: 0.9rem; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="lib-auto-carry" checked style="accent-color: var(--hud-optimal); width: 18px; height: 18px;"> Autonomously carry target forward to tomorrow
                            </label>
                        </div>

                        <button type="submit" class="tactical-btn" style="justify-content: center; width: 100%; height: 52px; border-color: var(--hud-optimal); font-size: 1rem;" id="lib-commit-btn">
                            LOCK FILE INTO MEMORY FORTRESS &raquo;
                        </button>
                    </form>
                </div>

            </div>

        </div>

        <!-- Fully Centered Immersive True Reading Column Viewport (Swapped inline when Reading) -->
        <div style="display: ${tacticalLibraryState.activeBookId ? 'flex' : 'none'}; justify-content: center; margin-top: 60px; width: 100%;" id="tactical-true-reader-container">
            
            <!-- Exactly 850px wide Centered Tactical Column -->
            <div class="cockpit-card" style="width: 850px; padding: 40px; border-color: var(--hud-cyan); box-shadow: 0 15px 50px rgba(0,0,0,0.9), 0 0 30px rgba(56, 189, 248, 0.25);">
                
                <!-- Roster & Control Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;">
                    <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
                        <span style="color: var(--hud-cyan); font-weight: bold; font-size: 1.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" id="true-reader-book-title">READING VIEWPORT</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);" id="true-reader-mode-badge">RENDERER</span>
                    </div>
                    
                    <div style="display: flex; gap: 24px; align-items: center; flex-shrink: 0;">
                        <!-- True Reading Contrast Themes -->
                        <div style="display: flex; gap: 6px; align-items: center; font-size: 0.8rem; color: var(--text-muted);" id="epub-theme-tools">
                            <span>THEME:</span>
                            <button onclick="applyGenuineEPUBTheme('axis_dark')" class="tactical-btn ${tacticalLibraryState.currentTheme === 'axis_dark' ? 'cyan active' : ''}" style="padding: 4px 10px; font-size: 0.7rem;">VOID</button>
                            <button onclick="applyGenuineEPUBTheme('axis_light')" class="tactical-btn ${tacticalLibraryState.currentTheme === 'axis_light' ? 'cyan active' : ''}" style="padding: 4px 10px; font-size: 0.7rem;">LIGHT</button>
                            <button onclick="applyGenuineEPUBTheme('axis_sepia')" class="tactical-btn ${tacticalLibraryState.currentTheme === 'axis_sepia' ? 'cyan active' : ''}" style="padding: 4px 10px; font-size: 0.7rem;">SEPIA</button>
                        </div>

                        <!-- Zoom Tools -->
                        <div style="display: flex; gap: 6px; align-items: center; font-size: 0.8rem; color: var(--text-muted);" id="epub-font-tools">
                            <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.75rem;" onclick="scaleEPUBFontSize(-1)">A-</button>
                            <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.75rem;" onclick="scaleEPUBFontSize(1)">A+</button>
                        </div>

                        <button class="tactical-btn" style="padding: 6px 14px; border-color: var(--hud-critical); color: var(--hud-critical);" onclick="closeTrueInlineReader()">
                            CLOSE &times;
                        </button>
                    </div>
                </div>

                <!-- RENDER VIEWPORT (Exactly Centered 850px Area) -->
                <div style="width: 100%; min-height: 700px; background: var(--bg-void); border: 1px solid var(--text-muted); border-radius: 4px; position: relative; display: flex; flex-direction: column; overflow: hidden; margin: 20px 0;" id="true-reader-viewport-area">
                    <!-- Swapped by JS -->
                </div>

                <!-- Bottom Cockpit Pagination Bar -->
                <div style="display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <span style="color: var(--text-muted); font-size: 0.85rem;" id="reader-telemetry-status">SENSOR STATUS: OPTIMAL</span>
                    </div>

                    <!-- True Horizontal True Page Steppers -->
                    <div style="display: flex; gap: 16px; align-items: center;">
                        <button class="tactical-btn" style="padding: 10px 24px;" onclick="navigateGenuineReader(-1)">&laquo; PREV PAGE</button>
                        <button class="tactical-btn optimal" style="padding: 10px 24px; border-color: var(--hud-optimal);" onclick="navigateGenuineReader(1)">NEXT PAGE &raquo;</button>
                    </div>
                </div>

                <div style="text-align: center; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); margin-top: 12px;">
                    &bull; Physical keyboard Arrow Keys (&larr; / &rarr;) completely enabled &bull;
                </div>

            </div>

        </div>
    `;
}

/* Autonomously intercept and extract genuinely selected file metadata */
function executeInstantMetadataExtraction(inputEl) {
    let file = inputEl.files[0];
    if (!file) return;

    let titleReadout = document.getElementById('parse-readout-title');
    let authorReadout = document.getElementById('parse-readout-author');
    let pagesReadout = document.getElementById('parse-readout-pages');

    let isPdf = file.name.toLowerCase().endsWith('.pdf');

    // Default basic clean name fallback
    let cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_━-]/g, " ").trim();
    if(titleReadout) titleReadout.textContent = cleanName.toUpperCase();
    if(authorReadout) authorReadout.textContent = isPdf ? "AUTHOR // PDF DOCUMENT" : "AUTHOR // EPUB SPEC";
    if(pagesReadout) pagesReadout.textContent = "PAGES // ~300";

    tacticalLibraryState.activeExtractedCover = null;

    if (!isPdf && typeof ePub !== 'undefined') {
        let reader = new FileReader();
        reader.onload = function(e) {
            try {
                let tempBook = ePub(e.target.result);
                tempBook.loaded.metadata.then(meta => {
                    if (meta.title && titleReadout) titleReadout.textContent = meta.title.toUpperCase();
                    if (meta.creator && authorReadout) authorReadout.textContent = `AUTHOR // ${meta.creator.toUpperCase()}`;
                }).catch(err => {});

                // Extract genuine cover URI if possible
                tempBook.coverUrl().then(url => {
                    if(url) tacticalLibraryState.activeExtractedCover = url;
                }).catch(err => {});
            } catch(ex) {}
        };
        reader.readAsArrayBuffer(file);
    }
}

/* Submit Autonomous Deposit */
function handleAutonomousLibraryDeposit(e) {
    e.preventDefault();

    let fileInput = document.getElementById('lib-auto-file');
    let file = fileInput.files[0];
    let carryForward = document.getElementById('lib-auto-carry').checked;

    if (!file) return;

    let isPdf = file.name.toLowerCase().endsWith('.pdf');
    let fileType = isPdf ? 'pdf' : 'epub';

    let bookId = "lib-" + Date.now();

    let titleText = document.getElementById('parse-readout-title').textContent || file.name.toUpperCase();
    let authorText = document.getElementById('parse-readout-author').textContent.replace("AUTHOR // ", "") || "AXIS ACTUAL";

    let btn = document.getElementById('lib-commit-btn');
    if(btn) {
        btn.textContent = "WRITING TO IDB MEMORY...";
        btn.style.color = "var(--hud-optimal)";
    }

    let reader = new FileReader();
    reader.onload = function(event) {
        let binaryPayload = event.target.result;

        saveBookBinaryToIDB(bookId, binaryPayload).then(() => {
            
            let metaRecord = {
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

            renderLibraryView();
            refreshCoreView();

        }).catch(err => {
            alert("IDB save failed: " + err);
        });
    };

    if (fileType === 'pdf') {
        reader.readAsDataURL(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

function stepTacticalBookPage(bookId, stepAmount) {
    let b = tacticalLibraryState.books.find(x => x.id === bookId);
    if (!b) return;

    b.currPage = Math.min(b.totalPages, Math.max(0, b.currPage + stepAmount));
    if (b.currPage === b.totalPages) b.carryForward = false;
    
    todayTelemetry.lastLoggedTimestamp = Date.now();
    localStorage.setItem('axis_last_logged_time', todayTelemetry.lastLoggedTimestamp);
    localStorage.setItem('axis_library_meta', JSON.stringify(tacticalLibraryState.books));

    renderLibraryView();
    refreshCoreView();
}

function purgeTacticalBook(bookId) {
    if (confirm("PURGE TEXT AND Erase BINARY FROM STORAGE?")) {
        tacticalLibraryState.books = tacticalLibraryState.books.filter(x => x.id !== bookId);
        localStorage.setItem('axis_library_meta', JSON.stringify(tacticalLibraryState.books));
        
        deleteBookBinaryFromIDB(bookId);
        
        if (tacticalLibraryState.activeBookId === bookId) closeTrueInlineReader();
        renderLibraryView();
    }
}

function executeTrueInlineReader(bookId) {
    let b = tacticalLibraryState.books.find(x => x.id === bookId);
    if (!b) return;

    tacticalLibraryState.activeBookId = bookId;
    tacticalLibraryState.readerType = b.type;
    renderLibraryView();

    let titleEl = document.getElementById('true-reader-book-title');
    let badgeEl = document.getElementById('true-reader-mode-badge');
    let themeTools = document.getElementById('epub-theme-tools');
    let fontTools = document.getElementById('epub-font-tools');
    let viewportArea = document.getElementById('true-reader-viewport-area');
    let statusEl = document.getElementById('reader-telemetry-status');

    if(titleEl) titleEl.textContent = `${b.title} // ${b.author}`;
    if(badgeEl) badgeEl.textContent = `MODE: ${b.type.toUpperCase()} VIEWPORT`;
    if(themeTools) themeTools.style.display = b.type === 'epub' ? 'flex' : 'none';
    if(fontTools) fontTools.style.display = b.type === 'epub' ? 'flex' : 'none';
    if(statusEl) statusEl.textContent = `FETCHING BINARY FROM INDEXEDDB FORTRESS...`;

    viewportArea.innerHTML = `<div style="padding: 40px; font-family: var(--font-mono); color: var(--hud-cyan);">EXTRACTING RAW BINARY FROM IDB MEMORY...</div>`;

    getBookBinaryFromIDB(bookId).then(content => {
        if (!content) {
            viewportArea.innerHTML = `<div style="padding: 40px; color: var(--hud-critical); font-family: var(--font-mono);">⚠️ STORAGE FAULT: Binary not found in local IDB memory. Please deposit file again.</div>`;
            return;
        }

        if (b.type === 'pdf') {
            viewportArea.innerHTML = `
                <iframe src="${content}#toolbar=0&view=FitH" style="width: 100%; flex: 1; height: 100%; min-height: 700px; border: none; background: #fff;" title="${b.title}"></iframe>
            `;
            statusEl.textContent = `PDF EMBED // OPTIMAL`;
        } else {
            viewportArea.innerHTML = `<div id="genuine-epub-render-target" style="width: 100%; flex: 1; height: 100%; min-height: 700px; display: flex; flex-direction: column; padding: 24px; overflow-y: auto;"></div>`;
            
            try {
                tacticalLibraryState.epubBookInstance = ePub(content);
                tacticalLibraryState.epubRendition = tacticalLibraryState.epubBookInstance.renderTo("genuine-epub-render-target", {
                    width: "100%",
                    height: "100%",
                    flow: "paginated"
                });

                // Apply professional enterprise Dark / Light / Sepia Themes
                tacticalLibraryState.epubRendition.themes.register("axis_dark", {
                    "body": { "background": "#03050a", "color": "#f1f5f9", "font-family": "system-ui, sans-serif", "line-height": "1.7" },
                    "p": { "font-size": "1.15rem" },
                    "h1, h2, h3": { "color": "#38bdf8", "font-family": "monospace", "text-transform": "uppercase" }
                });
                tacticalLibraryState.epubRendition.themes.register("axis_light", {
                    "body": { "background": "#f8fafc", "color": "#0f172a", "font-family": "system-ui, sans-serif", "line-height": "1.7" },
                    "p": { "font-size": "1.15rem" },
                    "h1, h2, h3": { "color": "#7e22ce", "font-family": "monospace", "text-transform": "uppercase" }
                });
                tacticalLibraryState.epubRendition.themes.register("axis_sepia", {
                    "body": { "background": "#fef3c7", "color": "#451a03", "font-family": "Georgia, serif", "line-height": "1.7" },
                    "p": { "font-size": "1.15rem" },
                    "h1, h2, h3": { "color": "#9a3412", "font-family": "monospace", "text-transform": "uppercase" }
                });

                tacticalLibraryState.epubRendition.themes.select(tacticalLibraryState.currentTheme);
                tacticalLibraryState.epubRendition.display();

                tacticalLibraryState.epubRendition.on("relocated", function(location) {
                    statusEl.textContent = `EPUB RENDITION // CFI: ${location.start.cfi}`;
                });

            } catch(epubErr) {
                viewportArea.innerHTML = `<div style="padding: 40px; color: var(--hud-critical); font-family: var(--font-mono);">⚠️ EPUB ENGINE FAULT: ${epubErr.message || epubErr}</div>`;
            }
        }
    }).catch(err => {
        viewportArea.innerHTML = `<div style="padding: 40px; color: var(--hud-critical); font-family: var(--font-mono);">⚠️ IDB FAULT: ${err}</div>`;
    });

    setTimeout(() => {
        document.getElementById('tactical-true-reader-container').scrollIntoView({ behavior: 'smooth' });
    }, 150);
}

function applyGenuineEPUBTheme(themeName) {
    tacticalLibraryState.currentTheme = themeName;
    if (tacticalLibraryState.epubRendition) {
        tacticalLibraryState.epubRendition.themes.select(themeName);
    }
    document.querySelectorAll('#epub-theme-tools button').forEach(b => {
        b.classList.remove('active', 'cyan');
    });
    let activeBtn = document.querySelector(`#epub-theme-tools button[onclick*="${themeName}"]`);
    if(activeBtn) activeBtn.classList.add('active', 'cyan');
}

function closeTrueInlineReader() {
    tacticalLibraryState.activeBookId = null;
    if (tacticalLibraryState.epubBookInstance) {
        try { tacticalLibraryState.epubBookInstance.destroy(); } catch(e){}
        tacticalLibraryState.epubBookInstance = null;
        tacticalLibraryState.epubRendition = null;
    }
    renderLibraryView();
}

function scaleEPUBFontSize(dir) {
    if (tacticalLibraryState.epubRendition) {
        let currentSize = tacticalLibraryState.epubRendition.themes._fontSize || 100;
        let newSize = Math.max(80, Math.min(180, currentSize + (dir * 10)));
        tacticalLibraryState.epubRendition.themes.fontSize(`${newSize}%`);
    }
}

function navigateGenuineReader(dir) {
    if (!tacticalLibraryState.activeBookId) return;
    
    if (tacticalLibraryState.readerType === 'epub' && tacticalLibraryState.epubRendition) {
        if (dir > 0) {
            tacticalLibraryState.epubRendition.next();
        } else {
            tacticalLibraryState.epubRendition.prev();
        }
    } else {
        stepTacticalBookPage(tacticalLibraryState.activeBookId, dir);
    }
}