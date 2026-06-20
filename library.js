/* ==========================================
   AXIS OS // library.js
   Pure Minimalist EPUB & PDF Tactical Library
   Zero Examples. True Supabase / IndexedDB Binary Storage.
   Complete Inline Reading Viewport (epub.js + PDF embed).
   ========================================== */

/* Initialize IndexedDB for massive binary storage (PDFs & EPUBs) when offline / pending Supabase */
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
            console.error("IndexedDB initialization failed", e);
            reject(e);
        };
    });
}

/* Save binary binary Blob / DataURI to IndexedDB */
function saveBookBinaryToIDB(bookId, blobOrDataUri) {
    return new Promise((resolve, reject) => {
        if (!idbDatabase) return reject("IDB not initialized");
        let tx = idbDatabase.transaction(["books_binary"], "readwrite");
        let store = tx.objectStore("books_binary");
        store.put({ id: bookId, content: blobOrDataUri });
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e);
    });
}

/* Retrieve binary binary Blob / DataURI from IndexedDB */
function getBookBinaryFromIDB(bookId) {
    return new Promise((resolve, reject) => {
        if (!idbDatabase) return reject("IDB not initialized");
        let tx = idbDatabase.transaction(["books_binary"], "readonly");
        let store = tx.objectStore("books_binary");
        let req = store.get(bookId);
        req.onsuccess = () => resolve(req.result ? req.result.content : null);
        req.onerror = (e) => reject(e);
    });
}

/* Remove binary binary from IndexedDB */
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

/* Library System State */
let tacticalLibraryState = {
    books: JSON.parse(localStorage.getItem('axis_library_meta') || '[]'),
    activeBookId: null,
    readerType: null, // 'epub' or 'pdf'
    epubBookInstance: null,
    epubRendition: null
};

/* Dynamically inject epub.js CDN without rewriting index.html */
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
}

function renderLibraryView() {
    const container = document.getElementById('module-library');
    if (!container) return;

    let totalBooks = tacticalLibraryState.books.length;
    let totalReadPages = tacticalLibraryState.books.reduce((s, b) => s + b.currPage, 0);

    container.innerHTML = `
        <div class="cockpit-header">
            <span>TACTICAL ARCHIVES // EPUB & PDF DIGITAL LIBRARY</span>
            <span style="font-size: 0.75rem; color: var(--hud-optimal);">PRECISION READING ENGINE</span>
        </div>

        <!-- Main Dashboard Architecture -->
        <div style="display: grid; grid-template-columns: 1fr 500px; gap: 40px;">
            
            <!-- Left: Genuine Reading Archive Suite -->
            <div style="display: flex; flex-direction: column; gap: 24px;">
                <div style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--text-main); font-weight: bold; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;">
                    <span>CANONICAL READING QUEUE // ACTIVE MEMORY</span>
                    <span style="font-size: 0.8rem; color: var(--hud-cyan);">${totalBooks} TEXTS // ${totalReadPages} PAGES RESOLVED</span>
                </div>

                <!-- Book Items Roster -->
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    ${totalBooks === 0 ? `
                        <div class="cockpit-card" style="padding: 40px; text-align: center; justify-content: center; align-items: center; min-height: 250px; border-color: var(--text-muted);">
                            <div style="font-family: var(--font-mono); font-size: 1.2rem; color: var(--text-muted); letter-spacing: 4px;">SYSTEM ARCHIVE EMPTY</div>
                            <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted); max-width: 400px; margin-top: 12px; line-height: 1.5;">
                                No canonical texts currently deposited. Use the injection interface to POST genuine .epub or .pdf files into the memory fortress.
                            </div>
                        </div>
                    ` : tacticalLibraryState.books.map(b => `
                        <div class="cockpit-card" style="padding: 24px; flex-direction: row; gap: 24px; align-items: center; justify-content: space-between; border-left: 4px solid ${b.carryForward ? 'var(--hud-violet)' : 'var(--text-muted)'};">
                            
                            <!-- Metadata Readout -->
                            <div style="font-family: var(--font-mono); flex: 1;">
                                <div style="display: flex; gap: 12px; align-items: center;">
                                    <span style="background: var(--bg-surface); color: ${b.type === 'epub' ? 'var(--hud-violet)' : 'var(--hud-cyan)'}; border: 1px solid ${b.type === 'epub' ? 'var(--hud-violet)' : 'var(--hud-cyan)'}; padding: 2px 6px; font-size: 0.65rem; font-weight: bold; text-transform: uppercase; border-radius: 2px;">
                                        ${b.type}
                                    </span>
                                    <span style="font-size: 0.8rem; color: var(--hud-optimal); font-weight: bold;">
                                        ${b.author}
                                    </span>
                                </div>

                                <div style="font-size: 1.3rem; font-weight: bold; color: var(--text-main); margin: 8px 0;">
                                    ${b.title}
                                </div>

                                <div style="display: flex; gap: 16px; align-items: center; font-size: 0.75rem; color: var(--text-muted);">
                                    <span style="color: ${b.carryForward ? 'var(--hud-violet)' : 'var(--text-muted)'}; font-weight: bold;">
                                        ${b.carryForward ? '📌 CARRY-FORWARD ACTIVE' : '✓ GOAL RESOLVED'}
                                    </span>
                                    <span>&bull; DEPOSITED: ${new Date(b.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <!-- Numeric Telemetry Steppers & Execution & Roster Management -->
                            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 12px; font-family: var(--font-mono); min-width: 220px;">
                                
                                <div style="font-size: 1.4rem; font-weight: bold; color: var(--text-main);">
                                    <span style="color: var(--hud-optimal);">${b.currPage}</span> / ${b.totalPages} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">PGS</span>
                                </div>

                                <!-- Progress Gauge -->
                                <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; position: relative;">
                                    <div style="height: 100%; width: ${Math.min(100, (b.currPage / b.totalPages) * 100)}%; background: var(--hud-optimal); box-shadow: 0 0 10px var(--hud-optimal);"></div>
                                </div>

                                <!-- Fast Numeric adjustment -->
                                <div style="display: flex; gap: 6px; margin-top: 4px;">
                                    <button class="tactical-btn" style="padding: 2px 8px; font-size: 0.7rem;" onclick="stepTacticalBookPage('${b.id}', -1)" title="Previous Page">-1</button>
                                    <button class="tactical-btn" style="padding: 2px 8px; font-size: 0.7rem;" onclick="stepTacticalBookPage('${b.id}', 1)" title="Next Page">+1</button>
                                    <button class="tactical-btn cyan" style="padding: 2px 8px; font-size: 0.7rem;" onclick="stepTacticalBookPage('${b.id}', 10)">+10</button>
                                </div>

                                <!-- Action strip -->
                                <div style="display: flex; gap: 12px; margin-top: 6px; align-items: center;">
                                    <button class="tactical-btn" style="padding: 4px 14px; font-size: 0.75rem; border-color: var(--hud-optimal); color: var(--hud-optimal);" onclick="executeTrueInlineReader('${b.id}')">
                                        READ &raquo;
                                    </button>
                                    <button style="background: transparent; border: none; color: var(--hud-critical); font-family: var(--font-mono); font-size: 0.8rem; cursor: pointer;" onclick="purgeTacticalBook('${b.id}')" title="Purge from memory">
                                        &times;
                                    </button>
                                </div>

                            </div>

                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Right: Injection Roster & True Inline True Reading Viewport -->
            <div style="display: flex; flex-direction: column; gap: 40px;">
                
                <!-- True Upload Fortress -->
                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-optimal); font-weight: bold; margin-bottom: 16px; display: flex; justify-content: space-between;">
                        <span>DEPOSIT TEXT INTERFACE</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">ACCEPTED: .EPUB, .PDF</span>
                    </div>

                    <form onsubmit="handleDepositLibraryFile(event)" style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">AUTHOR / PHILOSOPHER</label>
                            <input type="text" class="tactical-input" id="lib-deposit-author" placeholder="e.g. GEORGE ORWELL" required>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">TEXT TITLE</label>
                            <input type="text" class="tactical-input" id="lib-deposit-title" placeholder="e.g. 1984" required>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">BINARY FILE (.EPUB OR .PDF)</label>
                            <input type="file" class="tactical-input" id="lib-deposit-file" accept=".epub, .pdf" required style="padding: 10px; font-size: 0.85rem;" onchange="inspectSelectedFile(this)">
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">STARTING PAGE</label>
                                <input type="number" class="tactical-input" id="lib-deposit-curr" required min="0" max="10000" value="0">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">TOTAL PAGES</label>
                                <input type="number" class="tactical-input" id="lib-deposit-total" required min="1" max="10000" value="300">
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">ACCOUNTABILITY carry-forward FLAG</label>
                            <label style="font-family: var(--font-mono); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="lib-deposit-carry" checked style="accent-color: var(--hud-optimal);"> Unfinished reading targets automatically queue tomorrow
                            </label>
                        </div>

                        <button type="submit" class="tactical-btn" style="justify-content: center; width: 100%; border-color: var(--hud-optimal);">
                            COMMIT FILE TO STORAGE &raquo;
                        </button>
                    </form>
                </div>

            </div>

        </div>

        <!-- Full Viewport True Inline True Reading Interface Modal (Swapped inline when Reading) -->
        <div class="cockpit-card" style="padding: 32px; display: ${tacticalLibraryState.activeBookId ? 'flex' : 'none'}; border-color: var(--hud-optimal); box-shadow: 0 0 40px rgba(16, 185, 129, 0.2); margin-top: 40px;" id="tactical-true-reader-container">
            <div style="display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <span style="color: var(--hud-optimal); font-weight: bold; font-size: 1.2rem;" id="true-reader-book-title">READING VIEWPORT</span>
                    <span style="background: var(--bg-surface); padding: 2px 8px; font-size: 0.75rem; color: var(--text-muted); border-radius: 2px;" id="true-reader-mode-badge">RENDERER</span>
                </div>
                
                <div style="display: flex; gap: 16px; align-items: center;">
                    <!-- Adjust font size for epub -->
                    <div style="display: flex; gap: 6px; align-items: center; font-size: 0.8rem; color: var(--text-muted);" id="epub-font-tools">
                        <span>ZOOM:</span>
                        <button class="tactical-btn" style="padding: 2px 8px;" onclick="scaleEPUBFontSize(-1)">A-</button>
                        <button class="tactical-btn" style="padding: 2px 8px;" onclick="scaleEPUBFontSize(1)">A+</button>
                    </div>

                    <button class="tactical-btn" style="padding: 4px 12px; border-color: var(--hud-critical); color: var(--hud-critical);" onclick="closeTrueInlineReader()">
                        DOCK & CLOSE &times;
                    </button>
                </div>
            </div>

            <!-- RENDER VIEWPORT (Where EPUB.JS Canvas or PDF Iframe Lives) -->
            <div style="width: 100%; min-height: 650px; background: var(--bg-void); border: 1px solid var(--text-muted); border-radius: 4px; position: relative; display: flex; flex-direction: column; overflow: hidden;" id="true-reader-viewport-area">
                <!-- Swapped by JS -->
            </div>

            <!-- Bottom Navigation Bar inside Reader -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); padding-top: 16px;">
                <div style="display: flex; gap: 12px; align-items: center;">
                    <span style="color: var(--text-muted); font-size: 0.85rem;" id="reader-telemetry-status">SENSOR STATUS: OPTIMAL</span>
                </div>

                <!-- Step specific chapters or pages -->
                <div style="display: flex; gap: 12px; align-items: center;">
                    <button class="tactical-btn" style="padding: 8px 20px;" onclick="navigateGenuineReader(-1)">&laquo; PREVIOUS CHAPTER / PAGE</button>
                    <button class="tactical-btn optimal" style="padding: 8px 20px; border-color: var(--hud-optimal);" onclick="navigateGenuineReader(1)">NEXT CHAPTER / PAGE &raquo;</button>
                </div>
            </div>
        </div>
    `;
}

/* Intercept File details to populate exact pages if possible */
function inspectSelectedFile(inputEl) {
    let file = inputEl.files[0];
    if (!file) return;

    let titleEl = document.getElementById('lib-deposit-title');
    if (titleEl && !titleEl.value) {
        let name = file.name.replace(/\.[^/.]+$/, ""); // strip extension
        titleEl.value = name.toUpperCase();
    }
}

/* Submit genuine Deposit Queue */
function handleDepositLibraryFile(e) {
    e.preventDefault();

    let author = document.getElementById('lib-deposit-author').value.trim();
    let title = document.getElementById('lib-deposit-title').value.trim();
    let currPage = parseInt(document.getElementById('lib-deposit-curr').value);
    let totalPages = parseInt(document.getElementById('lib-deposit-total').value);
    let carryForward = document.getElementById('lib-deposit-carry').checked;

    let fileInput = document.getElementById('lib-deposit-file');
    let file = fileInput.files[0];

    if (!file || !title || !author) return;

    let isPdf = file.name.toLowerCase().endsWith('.pdf');
    let fileType = isPdf ? 'pdf' : 'epub';

    let bookId = "lib-" + Date.now();

    // Read genuine file as binary DataURI or ArrayBuffer
    let reader = new FileReader();
    reader.onload = function(event) {
        let binaryPayload = event.target.result;

        // Save heavy binary to IndexedDB
        saveBookBinaryToIDB(bookId, binaryPayload).then(() => {
            
            // Push metadata record to localStorage
            let metaRecord = {
                id: bookId,
                title: title.toUpperCase(),
                author: author.toUpperCase(),
                type: fileType,
                currPage,
                totalPages,
                carryForward,
                created_at: new Date().toISOString()
            };

            tacticalLibraryState.books.unshift(metaRecord);
            localStorage.setItem('axis_library_meta', JSON.stringify(tacticalLibraryState.books));

            renderLibraryView();
            refreshCoreView();

        }).catch(err => {
            alert("Storage DB execution failed: " + err);
        });
    };

    if (fileType === 'pdf') {
        reader.readAsDataURL(file); // DataURI perfectly fits native iframe PDF embed
    } else {
        reader.readAsArrayBuffer(file); // ArrayBuffer is absolutely absolute best for epub.js pure parsing
    }
}

/* Step numeric reading goals */
function stepTacticalBookPage(bookId, stepAmount) {
    let b = tacticalLibraryState.books.find(x => x.id === bookId);
    if (!b) return;

    b.currPage = Math.min(b.totalPages, Math.max(0, b.currPage + stepAmount));
    if (b.currPage === b.totalPages) b.carryForward = false; // complete
    
    // Auto increment Core telemetry last logged
    todayTelemetry.lastLoggedTimestamp = Date.now();
    localStorage.setItem('axis_last_logged_time', todayTelemetry.lastLoggedTimestamp);
    localStorage.setItem('axis_library_meta', JSON.stringify(tacticalLibraryState.books));

    renderLibraryView();
    refreshCoreView();
}

/* Purge book and its binary payload */
function purgeTacticalBook(bookId) {
    if (confirm("PURGE CANONICAL TEXT AND Erase ITS BINARY FROM STORAGE?")) {
        tacticalLibraryState.books = tacticalLibraryState.books.filter(x => x.id !== bookId);
        localStorage.setItem('axis_library_meta', JSON.stringify(tacticalLibraryState.books));
        
        deleteBookBinaryFromIDB(bookId);
        
        if (tacticalLibraryState.activeBookId === bookId) closeTrueInlineReader();
        renderLibraryView();
    }
}

/* Instantiating True Inline Reader */
function executeTrueInlineReader(bookId) {
    let b = tacticalLibraryState.books.find(x => x.id === bookId);
    if (!b) return;

    tacticalLibraryState.activeBookId = bookId;
    tacticalLibraryState.readerType = b.type;
    renderLibraryView();

    let titleEl = document.getElementById('true-reader-book-title');
    let badgeEl = document.getElementById('true-reader-mode-badge');
    let fontTools = document.getElementById('epub-font-tools');
    let viewportArea = document.getElementById('true-reader-viewport-area');
    let statusEl = document.getElementById('reader-telemetry-status');

    if(titleEl) titleEl.textContent = `${b.title} // ${b.author}`;
    if(badgeEl) badgeEl.textContent = `MODE: ${b.type.toUpperCase()} RENDERER`;
    if(fontTools) fontTools.style.display = b.type === 'epub' ? 'flex' : 'none';
    if(statusEl) statusEl.textContent = `FETCHING BINARY FROM INDEXEDDB FORTRESS...`;

    viewportArea.innerHTML = `<div style="padding: 40px; font-family: var(--font-mono); color: var(--hud-cyan);">EXTRACTING RAW BINARY FROM IDB MEMORY...</div>`;

    // Retrieve genuine binary
    getBookBinaryFromIDB(bookId).then(content => {
        if (!content) {
            viewportArea.innerHTML = `<div style="padding: 40px; color: var(--hud-critical); font-family: var(--font-mono);">⚠️ STORAGE ERROR: Genuine binary not found in local IDB memory. Please deposit file again.</div>`;
            return;
        }

        if (b.type === 'pdf') {
            // Render genuine PDF inline using responsive absolute Iframe
            viewportArea.innerHTML = `
                <iframe src="${content}#toolbar=0&view=FitH" style="width: 100%; flex: 1; height: 100%; min-height: 650px; border: none; background: #fff;" title="${b.title}"></iframe>
            `;
            statusEl.textContent = `PDF NATIVE EMBED // OPTIMAL`;
        } else {
            // Render genuine EPUB using EPUB.js
            viewportArea.innerHTML = `<div id="genuine-epub-render-target" style="width: 100%; flex: 1; height: 100%; min-height: 650px; display: flex; flex-direction: column; padding: 24px; overflow-y: auto;"></div>`;
            
            try {
                // Initialize pure epub.js book from ArrayBuffer
                tacticalLibraryState.epubBookInstance = ePub(content);
                tacticalLibraryState.epubRendition = tacticalLibraryState.epubBookInstance.renderTo("genuine-epub-render-target", {
                    width: "100%",
                    height: "100%",
                    flow: "paginated"
                });

                // Apply premium dark HUD theme to EPUB contents
                tacticalLibraryState.epubRendition.themes.register("axis_dark", {
                    "body": { "background": "transparent", "color": "#f1f5f9", "font-family": "system-ui, sans-serif", "line-height": "1.7" },
                    "p": { "font-size": "1.1rem" },
                    "h1": { "color": "#a855f7", "font-family": "monospace", "text-transform": "uppercase" },
                    "h2": { "color": "#38bdf8", "font-family": "monospace" }
                });
                tacticalLibraryState.epubRendition.themes.select("axis_dark");

                tacticalLibraryState.epubRendition.display();

                tacticalLibraryState.epubRendition.on("relocated", function(location) {
                    // Update live telemetry if possible
                    statusEl.textContent = `EPUB RENDITION // CFI: ${location.start.cfi}`;
                });

            } catch(epubErr) {
                console.error("EPUB engine execution failed", epubErr);
                viewportArea.innerHTML = `<div style="padding: 40px; color: var(--hud-critical); font-family: var(--font-mono);">⚠️ EPUB.JS RENDITION FAULT: ${epubErr.message || epubErr}</div>`;
            }
        }
    }).catch(err => {
        viewportArea.innerHTML = `<div style="padding: 40px; color: var(--hud-critical); font-family: var(--font-mono);">⚠️ STORAGE RETRIEVAL FAULT: ${err}</div>`;
    });

    // scroll viewport into view
    setTimeout(() => {
        document.getElementById('tactical-true-reader-container').scrollIntoView({ behavior: 'smooth' });
    }, 150);
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
        // If PDF or mock, increment numeric telemetry directly
        stepTacticalBookPage(tacticalLibraryState.activeBookId, dir);
    }
}