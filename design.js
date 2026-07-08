/* ==========================================
   AXIS OS // design.js
   Active Projects Suite (Indomie Egypt next, Cadbury done),
   Sprint Tracker Task List with Progress Bars, Live Daily/Weekly Hours Telemetry,
   and Carry-Forward Task Flags
   ========================================== */

let designProjects = JSON.parse(localStorage.getItem('axis_design_projects') || '[]');

if (designProjects.length === 0) {
    designProjects = [
        {
            id: "dp-1",
            name: "CURRENT PROJECT",
            code: "AXIS-DESIGN-001",
            status: "ACTIVE",
            color: "var(--hud-optimal)",
            sprintProgress: 45,
            tasks: [
                { id: "dt-1", title: "Define visual direction", completed: false, carryForward: true },
                { id: "dt-2", title: "Build deliverable draft", completed: false, carryForward: true },
                { id: "dt-3", title: "Review and refine", completed: false, carryForward: true }
            ]
        },
        {
            id: "dp-2",
            name: "ARCHIVE PROJECT",
            code: "AXIS-DESIGN-000",
            status: "DONE",
            color: "var(--text-muted)",
            sprintProgress: 100,
            tasks: [
                { id: "dt-4", title: "Final export approved", completed: true, carryForward: false },
                { id: "dt-5", title: "Project archived", completed: true, carryForward: false }
            ]
        }
    ];
}

function initDesign() {
    renderDesignView();
}

function renderDesignView() {
    const container = document.getElementById('module-design');
    if (!container) return;

    let dailyHours = todayTelemetry.designHours;
    let weeklyHours = parseFloat(localStorage.getItem('axis_weekly_design')) || (dailyHours + 14.5);

    container.innerHTML = `
        <div class="cockpit-header">
            <span>ARCHITECTURAL HUD & CREATIVE DESIGN STUDIO</span>
            <span class="text-sm text-optimal">CARRY-FORWARD SPRINT PROTOCOLS ACTIVE</span>
        </div>

        <!-- Top Overview Tier: Live Hours & Sprints -->
        <section class="grid grid-cols-1 md-grid-cols-3" style="gap: 20px;">

            <div class="cockpit-card cockpit-card-flat stack" style="padding: 24px; justify-content: space-between;">
                <div class="font-body text-sm text-muted">DESIGN HOURS LOGGED TODAY</div>
                <div class="font-body font-bold text-main" style="font-size: clamp(2.5rem, 8vw, 4.1rem); line-height: 1;">
                    ${dailyHours} <span style="font-size: 1.5rem; font-weight: normal;">HOURS</span>
                </div>
                <div class="row" style="justify-content: space-between;">
                    <span class="font-mono text-sm text-optimal">MINIMUM 1H = +30 SCORE</span>
                    <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.7rem;" onclick="logAdditionalDesignHour(1)">+1 HOUR</button>
                </div>
            </div>

            <div class="cockpit-card stack" style="padding: 24px; justify-content: space-between;">
                <div class="font-mono text-sm text-muted">WEEKLY STUDIO TOTAL</div>
                <div class="font-mono font-bold text-main" style="font-size: clamp(2rem, 7vw, 3.5rem); line-height: 1;">
                    ${weeklyHours.toFixed(1)} <span class="text-cyan" style="font-size: 1.5rem; font-weight: normal;">HOURS</span>
                </div>
                <div class="font-mono text-sm text-muted">
                    CREATIVE PIPELINE // OPTIMAL FORTRESS
                </div>
            </div>

            <div class="cockpit-card stack" style="padding: 24px; justify-content: space-between;">
                <div class="font-mono text-sm text-muted">ACTIVE COMMERCIAL ACCOUNT</div>
                <div>
                    <div class="font-mono font-bold text-optimal" style="font-size: clamp(1rem, 2.5vw, 1.3rem);">CURRENT PROJECT</div>
                    <div class="font-mono text-sm text-muted" style="margin-top: 4px;">REF: AXIS-DESIGN-001</div>
                </div>
                <div class="row font-mono text-sm text-muted" style="justify-content: space-between;">
                    <span>STATUS: ACTIVE</span>
                    <span class="text-optimal font-bold">45% SPRINT</span>
                </div>
            </div>

        </section>

        <!-- Middle Full Width: Active Projects Sprints & Tasks -->
        <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 24px; grid-template-columns: 1fr clamp(280px, 35vw, 400px);">

            <!-- Left: Commercial Projects & Sprint Tracker -->
            <div class="stack" style="gap: 20px;">
                <div class="font-mono font-bold text-main">
                    COMMERCIAL PROJECTS & SPRINT PIPELINE
                </div>

                <div class="stack" style="gap: 20px;">
                    ${designProjects.map((proj, pIdx) => `
                        <div class="cockpit-card stack" style="padding: 24px; border-left: 4px solid ${proj.color};">

                            <!-- Project Header -->
                            <div class="row flex-wrap font-mono" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
                                <div class="flex-1" style="min-width: 0;">
                                    <div class="font-bold text-main text-truncate" style="font-size: clamp(1rem, 2vw, 1.3rem);">${proj.name}</div>
                                    <div class="text-sm text-muted" style="margin-top: 4px;">REF: ${proj.code}</div>
                                </div>
                                <div class="badge" style="background: var(--bg-surface); border-color: ${proj.color}; color: ${proj.color};">
                                    ${proj.status}
                                </div>
                            </div>

                            <!-- Sprint Master Progress Track -->
                            <div class="stack" style="gap: 8px; margin: 8px 0;">
                                <div class="row font-mono text-sm text-muted" style="justify-content: space-between;">
                                    <span>SPRINT PROGRESSION MASTER</span>
                                    <span style="color: ${proj.color}; font-weight: bold;">${proj.sprintProgress}%</span>
                                </div>
                                <div class="progress-bar" style="height: 8px;">
                                    <div class="progress-fill" style="width: ${proj.sprintProgress}%; background: ${proj.color};"></div>
                                </div>
                            </div>

                            <!-- Tasks / Backlog items inside sprint -->
                            <div class="stack" style="gap: 10px;">
                                <div class="font-mono text-sm text-muted uppercase">SPRINT TASKS (CARRY-FORWARD UNTIL RESOLVED)</div>

                                ${proj.tasks.map((t, tIdx) => `
                                    <div onclick="toggleDesignTask(${pIdx}, ${tIdx})" class="cursor-pointer row font-mono" style="padding: 12px 16px; background: var(--bg-surface); border-left: 3px solid ${t.completed ? 'var(--hud-optimal)' : 'var(--hud-warning)'}; justify-content: space-between; gap: 12px; transition: all 0.2s;">

                                        <div class="row flex-1" style="gap: 12px; min-width: 0;">
                                            <div style="width: 20px; height: 20px; border: 2px solid ${t.completed ? 'var(--hud-optimal)' : 'var(--text-muted)'}; border-radius: 2px; display: flex; justify-content: center; align-items: center; color: var(--hud-optimal); font-weight: bold; font-size: 0.9rem; flex-shrink: 0;">
                                                ${t.completed ? '✓' : ''}
                                            </div>
                                            <span class="text-truncate" style="color: ${t.completed ? 'var(--text-muted)' : 'var(--text-main)'}; text-decoration: ${t.completed ? 'line-through' : 'none'}; font-size: 0.95rem;">
                                                ${t.title}
                                            </span>
                                        </div>

                                        <div class="text-sm flex-shrink-0" style="color: ${t.carryForward ? 'var(--hud-cyan)' : 'var(--text-muted)'};">
                                            ${t.carryForward ? '📌 CARRY-FORWARD' : 'RESOLVED'}
                                        </div>

                                    </div>
                                `).join('')}
                            </div>

                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Right: Inject New Sprint Task -->
            <div class="stack" style="gap: 24px;">

                <div class="cockpit-card stack" style="padding: 24px;">
                    <div class="font-mono font-bold text-accent">
                        INJECT NEW DESIGN SPRINT TASK
                    </div>

                    <form onsubmit="handleInjectDesignTask(event)" class="stack" style="gap: 16px;">
                        <div class="stack" style="gap: 6px;">
                            <label class="form-label">COMMERCIAL PROJECT</label>
                            <select class="tactical-select w-full" id="task-inj-proj">
                                ${designProjects.map((p, pIdx) => `<option value="${pIdx}">${p.name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="stack" style="gap: 6px;">
                            <label class="form-label">TASK TITLE</label>
                            <input type="text" class="tactical-input w-full" id="task-inj-title" placeholder="e.g. Design 3D Indomie Noodle Particle Shader" required>
                        </div>

                        <div class="stack" style="gap: 6px;">
                            <label class="form-label">CARRY-FORWARD MEMORY</label>
                            <label class="font-mono row cursor-pointer" style="font-size: 0.9rem; gap: 8px;">
                                <input type="checkbox" id="task-inj-carry" checked style="accent-color: var(--hud-violet);"> Automatically carry this task forward until marked checked
                            </label>
                        </div>

                        <button type="submit" class="tactical-btn w-full text-center">
                            DEPOSIT INTO SPRINT PIPELINE &raquo;
                        </button>
                    </form>
                </div>

            </div>

        </div>
    `;
}

async function logAdditionalDesignHour(amount) {
    todayTelemetry.designHours = Math.min(16, todayTelemetry.designHours + amount);
    todayTelemetry.lastLoggedTimestamp = Date.now();
    
    let weekly = parseFloat(localStorage.getItem('axis_weekly_design')) || (todayTelemetry.designHours + 14.5);
    weekly += amount;

    localStorage.setItem('axis_today_design', todayTelemetry.designHours);
    localStorage.setItem('axis_weekly_design', weekly);
    localStorage.setItem('axis_last_logged_time', todayTelemetry.lastLoggedTimestamp);

    if (window.axisAuthState?.authenticated && typeof supabaseClient !== 'undefined' && supabaseClient.mode === 'online') {
        try {
            await fetch('/api/daily', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'design-add', amount })
            });
        } catch {}
    }

    renderDesignView();
    refreshCoreView();
}

function toggleDesignTask(pIdx, tIdx) {
    let t = designProjects[pIdx].tasks[tIdx];
    t.completed = !t.completed;
    if(t.completed) t.carryForward = false; // resolved

    // compute updated sprint progress
    let proj = designProjects[pIdx];
    let compCount = proj.tasks.filter(x => x.completed).length;
    proj.sprintProgress = Math.round((compCount / proj.tasks.length) * 100);

    localStorage.setItem('axis_design_projects', JSON.stringify(designProjects));
    renderDesignView();
}

function handleInjectDesignTask(e) {
    e.preventDefault();
    let pIdx = parseInt(document.getElementById('task-inj-proj').value);
    let title = document.getElementById('task-inj-title').value.trim();
    let carryForward = document.getElementById('task-inj-carry').checked;

    if(!title) return;

    let newTask = {
        id: "dt-" + Date.now(),
        title,
        completed: false,
        carryForward
    };

    designProjects[pIdx].tasks.push(newTask);

    // compute updated sprint progress
    let proj = designProjects[pIdx];
    let compCount = proj.tasks.filter(x => x.completed).length;
    proj.sprintProgress = Math.round((compCount / proj.tasks.length) * 100);

    localStorage.setItem('axis_design_projects', JSON.stringify(designProjects));
    renderDesignView();
}

function refreshDesignView() {
    renderDesignView();
}