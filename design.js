/* ==========================================
   AXIS OS // design.js
   Active Projects Suite (Indomie Egypt next, Cadbury done),
   Sprint Tracker Task List with Progress Bars, Live Daily/Weekly Hours Telemetry,
   and Carry-Forward Task Flags
   ========================================== */

let designProjects = JSON.parse(localStorage.getItem('axis_design_projects') || '[]');

if (designProjects.length === 0) {
    // Seed initial locked Master Plan projects
    designProjects = [
        {
            id: "dp-1",
            name: "INDOMIE EGYPT // COMMERCIAL CAMPAIGN",
            code: "AXIS-COMM-901",
            status: "ACTIVE // NEXT",
            color: "var(--hud-optimal)",
            sprintProgress: 65,
            tasks: [
                { id: "dt-1", title: "Storyboard Indomie Crisp Noodles Action Sequence", completed: false, carryForward: true },
                { id: "dt-2", title: "Render Vector Hologram Seasoning Shaders", completed: false, carryForward: true },
                { id: "dt-3", title: "Finalize Color Grading and Commercial Master", completed: false, carryForward: true }
            ]
        },
        {
            id: "dp-2",
            name: "CADBURY EGYPT // BRANDING PIPELINE",
            code: "AXIS-COMM-804",
            status: "DEPLOYED // DONE",
            color: "var(--text-muted)",
            sprintProgress: 100,
            tasks: [
                { id: "dt-4", title: "Deploy Cadbury Velvet Visual Identity Master", completed: true, carryForward: false },
                { id: "dt-5", title: "Synchronize Client Guidelines Suite", completed: true, carryForward: false }
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
            <span style="font-size: 0.75rem; color: var(--hud-optimal);">CARRY-FORWARD SPRINT PROTOCOLS ACTIVE</span>
        </div>

        <!-- Top Overview Tier: Live Hours & Sprints -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px;">
            
            <div class="cockpit-card" style="padding: 28px; justify-content: space-between; border-color: var(--hud-violet); box-shadow: 0 0 20px var(--hud-violet-subtle);">
                <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">DESIGN HOURS LOGGED TODAY</div>
                <div style="font-family: var(--font-mono); font-size: 4.5rem; font-weight: bold; color: var(--hud-violet); line-height: 1; text-shadow: 0 0 15px var(--hud-violet-glow);">
                    ${dailyHours} <span style="font-size: 1.5rem; color: var(--text-main); font-weight: normal;">HOURS</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--hud-optimal);">MINIMUM 1H = +30 SCORE</span>
                    <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.7rem;" onclick="logAdditionalDesignHour(1)">+1 HOUR</button>
                </div>
            </div>

            <div class="cockpit-card" style="padding: 28px; justify-content: space-between;">
                <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">WEEKLY STUDIO TOTAL</div>
                <div style="font-family: var(--font-mono); font-size: 3.5rem; font-weight: bold; color: var(--text-main); line-height: 1;">
                    ${weeklyHours.toFixed(1)} <span style="font-size: 1.5rem; color: var(--hud-cyan); font-weight: normal;">HOURS</span>
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">
                    CREATIVE PIPELINE // OPTIMAL FORTRESS
                </div>
            </div>

            <div class="cockpit-card" style="padding: 28px; justify-content: space-between;">
                <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">ACTIVE COMMERCIAL ACCOUNT</div>
                <div>
                    <div style="font-family: var(--font-mono); font-size: 1.3rem; font-weight: bold; color: var(--hud-optimal);">INDOMIE EGYPT</div>
                    <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">REF: AXIS-COMM-901 // ACTION SPRINT</div>
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
                    <span>STATUS: ACTIVE // NEXT</span>
                    <span style="color: var(--hud-optimal); font-weight: bold;">65% SPRINT</span>
                </div>
            </div>

        </div>

        <!-- Middle Full Width: Active Projects Sprints & Tasks -->
        <div style="display: grid; grid-template-columns: 1fr 400px; gap: 40px;">
            
            <!-- Left: Commercial Projects & Sprint Tracker -->
            <div style="display: flex; flex-direction: column; gap: 24px;">
                <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--text-main); font-weight: bold;">
                    COMMERCIAL PROJECTS & SPRINT PIPELINE
                </div>

                <div style="display: flex; flex-direction: column; gap: 24px;">
                    ${designProjects.map((proj, pIdx) => `
                        <div class="cockpit-card" style="padding: 28px; border-left: 4px solid ${proj.color};">
                            
                            <!-- Project Header -->
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; font-family: var(--font-mono);">
                                <div>
                                    <div style="font-size: 1.3rem; font-weight: bold; color: var(--text-main);">${proj.name}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">REF: ${proj.code}</div>
                                </div>
                                <div style="background: var(--bg-surface); border: 1px solid ${proj.color}; padding: 4px 10px; font-size: 0.7rem; font-weight: bold; color: ${proj.color}; border-radius: 2px;">
                                    ${proj.status}
                                </div>
                            </div>

                            <!-- Sprint Master Progress Track -->
                            <div style="display: flex; flex-direction: column; gap: 8px; margin: 12px 0;">
                                <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">
                                    <span>SPRINT PROGRESSION MASTER</span>
                                    <span style="color: ${proj.color}; font-weight: bold;">${proj.sprintProgress}%</span>
                                </div>
                                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; position: relative;">
                                    <div style="height: 100%; width: ${proj.sprintProgress}%; background: ${proj.color}; box-shadow: 0 0 10px ${proj.color};"></div>
                                </div>
                            </div>

                            <!-- Tasks / Backlog items inside sprint -->
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">SPRINT TASKS (CARRY-FORWARD UNTIL RESOLVED)</div>
                                
                                ${proj.tasks.map((t, tIdx) => `
                                    <div onclick="toggleDesignTask(${pIdx}, ${tIdx})" style="padding: 12px 16px; background: var(--bg-surface); border-left: 3px solid ${t.completed ? 'var(--hud-optimal)' : 'var(--hud-warning)'}; display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono); cursor: pointer; transition: all 0.2s;">
                                        
                                        <div style="display: flex; gap: 16px; align-items: center;">
                                            <div style="width: 20px; height: 20px; border: 2px solid ${t.completed ? 'var(--hud-optimal)' : 'var(--text-muted)'}; border-radius: 2px; display: flex; justify-content: center; align-items: center; color: var(--hud-optimal); font-weight: bold; font-size: 0.9rem;">
                                                ${t.completed ? '✓' : ''}
                                            </div>
                                            <span style="color: ${t.completed ? 'var(--text-muted)' : 'var(--text-main)'}; text-decoration: ${t.completed ? 'line-through' : 'none'}; font-size: 0.95rem;">
                                                ${t.title}
                                            </span>
                                        </div>

                                        <div style="display: flex; gap: 12px; align-items: center; font-size: 0.75rem;">
                                            <span style="color: ${t.carryForward ? 'var(--hud-cyan)' : 'var(--text-muted)'};">
                                                ${t.carryForward ? '📌 CARRY-FORWARD' : 'RESOLVED'}
                                            </span>
                                        </div>

                                    </div>
                                `).join('')}
                            </div>

                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Right: Inject New Sprint Task -->
            <div style="display: flex; flex-direction: column; gap: 40px;">
                
                <div class="cockpit-card" style="padding: 28px;">
                    <div style="font-family: var(--font-mono); font-size: 1rem; color: var(--hud-violet); font-weight: bold; margin-bottom: 16px;">
                        INJECT NEW DESIGN SPRINT TASK
                    </div>

                    <form onsubmit="handleInjectDesignTask(event)" style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">COMMERCIAL PROJECT</label>
                            <select class="tactical-select" id="task-inj-proj">
                                ${designProjects.map((p, pIdx) => `<option value="${pIdx}">${p.name}</option>`).join('')}
                            </select>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">TASK TITLE</label>
                            <input type="text" class="tactical-input" id="task-inj-title" placeholder="e.g. Design 3D Indomie Noodle Particle Shader" required>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">CARRY-FORWARD MEMORY</label>
                            <label style="font-family: var(--font-mono); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="task-inj-carry" checked style="accent-color: var(--hud-violet);"> Automatically carry this task forward until marked checked
                            </label>
                        </div>

                        <button type="submit" class="tactical-btn" style="justify-content: center; width: 100%;">
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