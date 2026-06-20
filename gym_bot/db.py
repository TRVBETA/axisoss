import aiosqlite
from datetime import date, datetime
from .config import Config

INIT_SQL = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    movement_pattern TEXT NOT NULL,
    rep_range_lower INTEGER NOT NULL DEFAULT 3,
    rep_range_upper INTEGER NOT NULL DEFAULT 12,
    is_custom INTEGER DEFAULT 0,
    created_by_user_id INTEGER,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lifecycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT DEFAULT 'active',
    weak_point TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lifecycle_id INTEGER NOT NULL,
    session_date DATE NOT NULL,
    FOREIGN KEY (lifecycle_id) REFERENCES lifecycles(id)
);

CREATE TABLE IF NOT EXISTS sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    set_type TEXT NOT NULL CHECK(set_type IN ('leading', 'backoff')),
    weight REAL NOT NULL,
    reps INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_lif_user_status ON lifecycles(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ses_lifecycle_date ON sessions(lifecycle_id, session_date);
CREATE INDEX IF NOT EXISTS idx_sets_session ON sets(session_id);

CREATE TABLE IF NOT EXISTS accessory_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    exercise_name TEXT NOT NULL,
    weight REAL NOT NULL,
    reps INTEGER NOT NULL,
    logged_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_acc_user_exercise ON accessory_log(user_id, exercise_name);
CREATE INDEX IF NOT EXISTS idx_acc_logged_at ON accessory_log(logged_at);
"""

SEED_MOVEMENTS = [
    ("squat", "🦵 Squat"),
    ("hinge", "🏋️ Hinge"),
    ("horizontal_press", "🟦 H. Press"),
    ("vertical_press", "🟩 V. Press"),
    ("horizontal_pull", "⬅️ H. Pull"),
    ("vertical_pull", "⬇️ V. Pull"),
]

SEED_EXERCISES = [
    ("Back Squat", "squat", 3, 12),
    ("Hack Squat", "squat", 3, 12),
    ("Front Squat", "squat", 3, 10),
    ("Leg Press", "squat", 5, 15),
    ("Bulgarian Split Squat", "squat", 5, 12),
    ("Conventional Deadlift", "hinge", 3, 8),
    ("Romanian Deadlift", "hinge", 5, 12),
    ("Sumo Deadlift", "hinge", 3, 8),
    ("Hip Thrust", "hinge", 6, 15),
    ("Good Morning", "hinge", 5, 12),
    ("Flat Bench Press", "horizontal_press", 3, 12),
    ("Incline Bench Press", "horizontal_press", 3, 12),
    ("Dumbbell Bench Press", "horizontal_press", 5, 15),
    ("Dip", "horizontal_press", 5, 15),
    ("Push-Up", "horizontal_press", 5, 20),
    ("Overhead Press", "vertical_press", 3, 12),
    ("Dumbbell Shoulder Press", "vertical_press", 5, 12),
    ("Push Press", "vertical_press", 2, 8),
    ("Landmine Press", "vertical_press", 5, 12),
    ("Z-Press", "vertical_press", 3, 10),
    ("Barbell Row", "horizontal_pull", 5, 12),
    ("Cable Row", "horizontal_pull", 8, 15),
    ("Chest-Supported Row", "horizontal_pull", 8, 15),
    ("T-Bar Row", "horizontal_pull", 5, 12),
    ("Seal Row", "horizontal_pull", 5, 12),
    ("Pull-Up", "vertical_pull", 3, 15),
    ("Lat Pulldown", "vertical_pull", 8, 15),
    ("Chin-Up", "vertical_pull", 3, 12),
    ("Neutral Grip Pulldown", "vertical_pull", 8, 15),
    ("Meadows Row", "vertical_pull", 6, 12),
]

async def init_db():
    async with aiosqlite.connect(Config.DB_PATH) as db:
        await db.executescript(INIT_SQL)
        for pattern, display in SEED_MOVEMENTS:
            await db.execute("INSERT OR IGNORE INTO movements (pattern_name, display_name) VALUES (?, ?)", (pattern, display))
        for name, pattern, lower, upper in SEED_EXERCISES:
            await db.execute("INSERT OR IGNORE INTO exercises (name, movement_pattern, rep_range_lower, rep_range_upper) VALUES (?, ?, ?, ?)", (name, pattern, lower, upper))
        await db.commit()

async def get_or_create_user(chat_id: int, username: str = None) -> int:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        cursor = await db.execute("SELECT id FROM users WHERE chat_id = ?", (chat_id,))
        row = await cursor.fetchone()
        if row:
            return row[0]
        cursor = await db.execute("INSERT INTO users (chat_id, username) VALUES (?, ?)", (chat_id, username))
        await db.commit()
        return cursor.lastrowid

async def get_movements() -> list:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM movements ORDER BY id")
        return [dict(r) for r in await cursor.fetchall()]

async def get_exercises_for_movement(pattern: str) -> list:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM exercises WHERE movement_pattern = ? AND is_custom = 0 ORDER BY name", (pattern,))
        return [dict(r) for r in await cursor.fetchall()]

async def add_custom_exercise(name: str, pattern: str, lower: int, upper: int, user_id: int) -> int:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        cursor = await db.execute("INSERT INTO exercises (name, movement_pattern, rep_range_lower, rep_range_upper, is_custom, created_by_user_id) VALUES (?, ?, ?, ?, 1, ?)", (name, pattern, lower, upper, user_id))
        await db.commit()
        return cursor.lastrowid

async def create_lifecycle(user_id: int, exercise_id: int) -> int:
    today = date.today().isoformat()
    async with aiosqlite.connect(Config.DB_PATH) as db:
        cursor = await db.execute("INSERT INTO lifecycles (user_id, exercise_id, start_date, status) VALUES (?, ?, ?, 'active')", (user_id, exercise_id, today))
        await db.commit()
        return cursor.lastrowid

async def end_lifecycle(lifecycle_id: int, weak_point: str = None):
    today = date.today().isoformat()
    async with aiosqlite.connect(Config.DB_PATH) as db:
        await db.execute("UPDATE lifecycles SET end_date = ?, status = 'dead', weak_point = ? WHERE id = ?", (today, weak_point, lifecycle_id))
        await db.commit()

async def get_active_lifecycles(user_id: int) -> list:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT l.*, e.name as exercise_name, e.movement_pattern, e.rep_range_lower, e.rep_range_upper, m.display_name as movement_display
            FROM lifecycles l
            JOIN exercises e ON l.exercise_id = e.id
            JOIN movements m ON e.movement_pattern = m.pattern_name
            WHERE l.user_id = ? AND l.status = 'active'
            ORDER BY m.id
        """, (user_id,))
        return [dict(r) for r in await cursor.fetchall()]

async def get_active_lifecycle_for_movement(user_id: int, pattern: str) -> dict | None:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT l.*, e.name as exercise_name, e.rep_range_lower, e.rep_range_upper
            FROM lifecycles l
            JOIN exercises e ON l.exercise_id = e.id
            WHERE l.user_id = ? AND e.movement_pattern = ? AND l.status = 'active'
            LIMIT 1
        """, (user_id, pattern))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def get_lifecycle_by_id(lifecycle_id: int) -> dict | None:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT l.*, e.name as exercise_name, e.movement_pattern, e.rep_range_lower, e.rep_range_upper
            FROM lifecycles l
            JOIN exercises e ON l.exercise_id = e.id
            WHERE l.id = ?
        """, (lifecycle_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def get_or_create_session(lifecycle_id: int, session_date: str = None) -> int:
    if session_date is None:
        session_date = date.today().isoformat()
    async with aiosqlite.connect(Config.DB_PATH) as db:
        cursor = await db.execute("SELECT id FROM sessions WHERE lifecycle_id = ? AND session_date = ?", (lifecycle_id, session_date))
        row = await cursor.fetchone()
        if row:
            return row[0]
        cursor = await db.execute("INSERT INTO sessions (lifecycle_id, session_date) VALUES (?, ?)", (lifecycle_id, session_date))
        await db.commit()
        return cursor.lastrowid

async def log_set(session_id: int, set_type: str, weight: float, reps: int) -> int:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        cursor = await db.execute("INSERT INTO sets (session_id, set_type, weight, reps) VALUES (?, ?, ?, ?)", (session_id, set_type, weight, reps))
        await db.commit()
        return cursor.lastrowid

async def get_last_n_sessions_with_leading(lifecycle_id: int, n: int = 3) -> list:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT DISTINCT s.id, s.session_date
            FROM sessions s
            JOIN sets st ON s.id = st.session_id
            WHERE s.lifecycle_id = ? AND st.set_type = 'leading'
            ORDER BY s.session_date DESC
            LIMIT ?
        """, (lifecycle_id, n))
        sessions = [dict(r) for r in await cursor.fetchall()]
        for ses in sessions:
            cur = await db.execute("SELECT weight, reps FROM sets WHERE session_id = ? AND set_type = 'leading' ORDER BY weight DESC, reps DESC LIMIT 1", (ses["id"],))
            row = await cur.fetchone()
            if row:
                ses["weight"] = row[0]
                ses["reps"] = row[1]
        return sessions

async def get_first_leading_set(lifecycle_id: int) -> dict | None:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT st.weight, st.reps, s.session_date
            FROM sessions s JOIN sets st ON s.id = st.session_id
            WHERE s.lifecycle_id = ? AND st.set_type = 'leading'
            ORDER BY s.session_date ASC, st.id ASC LIMIT 1
        """, (lifecycle_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def get_most_recent_leading_set(lifecycle_id: int) -> dict | None:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT st.weight, st.reps, s.session_date
            FROM sessions s JOIN sets st ON s.id = st.session_id
            WHERE s.lifecycle_id = ? AND st.set_type = 'leading'
            ORDER BY s.session_date DESC, st.id DESC LIMIT 1
        """, (lifecycle_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def get_previous_session_leading_before_date(lifecycle_id: int, before_date: str) -> dict | None:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT st.weight, st.reps, s.session_date
            FROM sessions s JOIN sets st ON s.id = st.session_id
            WHERE s.lifecycle_id = ? AND st.set_type = 'leading' AND s.session_date < ?
            ORDER BY s.session_date DESC LIMIT 1
        """, (lifecycle_id, before_date))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def get_exercise_by_id(exercise_id: int) -> dict | None:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM exercises WHERE id = ?", (exercise_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def log_accessory(user_id: int, exercise_name: str, weight: float, reps: int, logged_at: str) -> int:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        cursor = await db.execute("INSERT INTO accessory_log (user_id, exercise_name, weight, reps, logged_at) VALUES (?, ?, ?, ?, ?)", (user_id, exercise_name, weight, reps, logged_at))
        await db.commit()
        return cursor.lastrowid

async def get_accessory_exercises(user_id: int) -> list:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        cursor = await db.execute("SELECT DISTINCT exercise_name FROM accessory_log WHERE user_id = ? ORDER BY exercise_name", (user_id,))
        return [r[0] for r in await cursor.fetchall()]

async def get_accessory_history(user_id: int, exercise_name: str) -> list:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM accessory_log WHERE user_id = ? AND exercise_name = ? ORDER BY logged_at DESC", (user_id, exercise_name))
        return [dict(r) for r in await cursor.fetchall()]

async def get_dead_lifecycles(user_id: int) -> list:
    async with aiosqlite.connect(Config.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT l.*, e.name as exercise_name, e.movement_pattern, m.display_name as movement_display
            FROM lifecycles l
            JOIN exercises e ON l.exercise_id = e.id
            JOIN movements m ON e.movement_pattern = m.pattern_name
            WHERE l.user_id = ? AND l.status = 'dead'
            ORDER BY l.end_date DESC
        """, (user_id,))
        return [dict(r) for r in await cursor.fetchall()]
