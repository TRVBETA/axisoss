import re
from datetime import date, datetime
from .db import (
    get_lifecycle_by_id, get_first_leading_set, get_most_recent_leading_set,
    get_previous_session_leading_before_date, get_last_n_sessions_with_leading, get_active_lifecycles,
)

def calculate_e1rm(weight: float, reps: int) -> float:
    if reps <= 0:
        return 0.0
    return round(weight * (1 + reps * 0.0333))

def parse_weight_reps(text: str) -> tuple | None:
    text = text.strip().lower().replace("kg", "")
    m = re.match(r"^(\d+(?:\.\d+)?)\s*x\s*(\d+)$", text)
    if m:
        return float(m.group(1)), int(m.group(2))
    m = re.match(r"^(\d+(?:\.\d+)?)\s+(\d+)$", text)
    if m:
        return float(m.group(1)), int(m.group(2))
    return None

def weeks_between(start: str, end: str = None) -> int:
    if end is None:
        end = date.today().isoformat()
    d1 = datetime.fromisoformat(start).date() if isinstance(start, str) else start
    d2 = datetime.fromisoformat(end).date() if isinstance(end, str) else end
    return max(1, (d2 - d1).days // 7)

async def get_lifecycle_health(lifecycle_id: int) -> dict:
    lifecycle = await get_lifecycle_by_id(lifecycle_id)
    if not lifecycle:
        return {"status": "unknown", "message": ""}
    lower = lifecycle["rep_range_lower"]
    sessions = await get_last_n_sessions_with_leading(lifecycle_id, n=3)
    if len(sessions) < 3:
        return {"status": "healthy", "message": "", "sessions": sessions}
    low_count = sum(1 for s in sessions if s.get("reps", 999) < lower)
    if low_count >= 2:
        msg = f"⚠️ *Lifecycle ending warning*\nLeading set has been under *{lower} reps* for *{low_count} of the last {len(sessions)} sessions*.\nConsider rotating or checking recovery."
        status = "critical" if low_count == 3 else "warning"
        return {"status": status, "message": msg, "sessions": sessions}
    return {"status": "healthy", "message": "", "sessions": sessions}

async def get_lifecycle_stats(lifecycle_id: int) -> dict:
    lifecycle = await get_lifecycle_by_id(lifecycle_id)
    if not lifecycle:
        return {}
    first = await get_first_leading_set(lifecycle_id)
    current = await get_most_recent_leading_set(lifecycle_id)
    start_e1rm = calculate_e1rm(first["weight"], first["reps"]) if first else 0
    current_e1rm = calculate_e1rm(current["weight"], current["reps"]) if current else 0
    gained = current_e1rm - start_e1rm
    weeks = weeks_between(lifecycle["start_date"], lifecycle.get("end_date") or date.today().isoformat())
    return {
        "exercise_name": lifecycle["exercise_name"],
        "movement_pattern": lifecycle["movement_pattern"],
        "rep_lower": lifecycle["rep_range_lower"],
        "rep_upper": lifecycle["rep_range_upper"],
        "start_date": lifecycle["start_date"],
        "end_date": lifecycle.get("end_date"),
        "weeks": weeks,
        "start_e1rm": start_e1rm,
        "current_e1rm": current_e1rm,
        "gained": gained,
        "first_leading": first,
        "current_leading": current,
    }

async def build_status_message(user_id: int) -> str:
    lifecycles = await get_active_lifecycles(user_id)
    if not lifecycles:
        return "No active lifecycles. Use /start to set up your 6 movements."
    lines = ["📊 *Active Lifecycles*\n"]
    for lc in lifecycles:
        stats = await get_lifecycle_stats(lc["id"])
        health = await get_lifecycle_health(lc["id"])
        icon = "🟡" if health["status"] == "warning" else ("🔴" if health["status"] == "critical" else "🟢")
        leading_text = "No leading set yet"
        if stats.get("current_leading"):
            cl = stats["current_leading"]
            leading_text = f"{cl['weight']}kg × {cl['reps']}"
        line = f"{icon} *{lc['movement_display']}* — {lc['exercise_name']}\n   Week {stats.get('weeks', 1)} | Leading: {leading_text} | e1RM: ~{stats.get('current_e1rm', 0)}kg\n   Rep range: {lc['rep_range_lower']}–{lc['rep_range_upper']} | Status: {health['status']}\n"
        if health["message"]:
            line += f"   {health['message']}\n"
        lines.append(line)
    return "\n".join(lines)

async def build_rotation_summary(lifecycle_id: int) -> str:
    stats = await get_lifecycle_stats(lifecycle_id)
    if not stats:
        return "Lifecycle not found."
    return f"📋 *Rotation Summary: {stats['exercise_name']}*\nDuration: {stats['weeks']} weeks\nStart e1RM: ~{stats['start_e1rm']}kg\nEnd e1RM: ~{stats['current_e1rm']}kg\nStrength gained: {stats['gained']:+d}kg\n"

async def build_history_message(user_id: int) -> str:
    from .db import get_dead_lifecycles
    rows = await get_dead_lifecycles(user_id)
    if not rows:
        return "No completed lifecycles yet. Finish some cycles with /rotate to see history here."
    lines = ["📜 *Lifecycle History*\n"]
    for r in rows:
        stats = await get_lifecycle_stats(r["id"])
        duration_weeks = weeks_between(r["start_date"], r["end_date"]) if r["end_date"] else 0
        gained = stats.get("gained", 0)
        weak = r.get("weak_point") or "Not recorded"
        lines.append(f"*{r['movement_display']}* — {r['exercise_name']}\n   {r['start_date']} → {r['end_date']} ({duration_weeks}w) | e1RM change: {gained:+d}kg\n   Weak point: {weak}\n")
    return "\n".join(lines)
