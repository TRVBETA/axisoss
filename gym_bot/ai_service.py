import json
import re
import asyncio
from .config import Config

def _build_prompt(movement_pattern: str, current_exercise: str, weak_point: str, stats: dict) -> str:
    return (f"You are a gym tracking assistant implementing the IP Method.\n"
            f"The user is rotating from '{current_exercise}' ({movement_pattern}).\n"
            f"Lifecycle stats: {stats['weeks']} weeks, start e1RM ~{stats['start_e1rm']}kg, current e1RM ~{stats['current_e1rm']}kg.\n"
            f"User reports the weak point: '{weak_point}'.\n\n"
            f"Suggest 2-3 specific exercise names that target this weak point for the {movement_pattern} pattern. "
            f"Return ONLY a JSON array of strings like [\"Exercise A\", \"Exercise B\"]. No explanation, no markdown.")

def _parse_json_array(text: str) -> list:
    try:
        text = re.sub(r"^```json\s*|\s*```$", "", text.strip())
        data = json.loads(text)
        if isinstance(data, list):
            return [str(x).strip() for x in data]
    except Exception:
        pass
    return []

def _call_groq(prompt: str) -> str:
    from groq import Groq
    client = Groq(api_key=Config.GROQ_API_KEY)
    resp = client.chat.completions.create(model="llama3-8b-8192", messages=[{"role": "user", "content": prompt}], max_tokens=256, temperature=0.5)
    return resp.choices[0].message.content

def _call_gemini(prompt: str) -> str:
    import google.generativeai as genai
    genai.configure(api_key=Config.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
    resp = model.generate_content(prompt)
    return resp.text

def _call_groq_with_system(system: str, prompt: str, max_tokens: int = 512) -> str:
    from groq import Groq
    client = Groq(api_key=Config.GROQ_API_KEY)
    resp = client.chat.completions.create(model="llama3-8b-8192", messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}], max_tokens=max_tokens, temperature=0.2)
    return resp.choices[0].message.content

async def parse_workout_groq(raw_text: str, exercise_list: list[str]) -> dict:
    if not Config.GROQ_API_KEY:
        return {}
    system = (f"You are a gym workout parser. The user sends a raw workout log with one or more exercises. "
              f"Each exercise has a name followed by sets in weight-reps pairs. "
              f"Weight and reps can be separated by spaces, slashes, or x (e.g., '15 10', '15/10', '15x10'). "
              f"Extract ALL exercises and ALL sets. Ignore DS, F, assisted, failure notes, and form cues. "
              f"Match exercise names to the closest entry in this list: {exercise_list}. "
              f"Return ONLY JSON in this format: "
              f'{{"exercises": [{{"exercise": "matched name", "sets": [{{"weight": 15, "reps": 10}}, ...]}}, ...]}} '
              f"If no close match exists, use the raw name as given.")
    try:
        raw = await asyncio.to_thread(_call_groq_with_system, system, raw_text, 1024)
        text = re.sub(r"^```json\s*|\s*```$", "", raw.strip())
        data = json.loads(text)
        if isinstance(data, dict) and "exercises" in data and isinstance(data["exercises"], list):
            return data
    except Exception as e:
        print(f"Workout Groq parse error: {e}")
    return {}

def _parse_workout_local(raw_text: str) -> dict:
    exercises = []
    lines = [l.strip() for l in raw_text.strip().splitlines() if l.strip()]
    for line in lines:
        pairs = []
        numbers = re.findall(r"\d+(?:\.\d+)?", line)
        if len(numbers) >= 2 and len(numbers) % 2 == 0:
            try:
                for i in range(0, len(numbers), 2):
                    w = float(numbers[i])
                    r = int(numbers[i + 1])
                    if 1 <= w < 500 and 1 <= r < 100:
                        pairs.append({"weight": w, "reps": r})
            except ValueError:
                pairs = []
        if not pairs:
            for m in re.finditer(r"(\d+(?:\.\d+)?)\s*[/x]\s*(\d+)", line):
                w = float(m.group(1))
                r = int(m.group(2))
                if 1 <= w < 500 and 1 <= r < 100:
                    pairs.append({"weight": w, "reps": r})
        if pairs:
            first_num = re.search(r"\d", line)
            if first_num:
                name = line[:first_num.start()].strip()
                name = re.sub(r"[,;:\-]+$", "", name).strip()
                if name and len(name) > 2:
                    exercises.append({"exercise": name, "sets": pairs})
    return {"exercises": exercises} if exercises else {}

async def parse_workout(raw_text: str, exercise_list: list[str]) -> dict:
    result = await parse_workout_groq(raw_text, exercise_list)
    if result and result.get("exercises"):
        return result
    return _parse_workout_local(raw_text)

async def parse_accessory_groq(raw_text: str, exercise_list: list[str]) -> dict:
    data = await parse_workout_groq(raw_text, exercise_list)
    if data and data.get("exercises"):
        ex = data["exercises"][0]
        return {"exercise": ex.get("exercise", ""), "sets": ex.get("sets", [])}
    return {}

async def match_accessory_name_groq(query: str, exercise_list: list[str]) -> str:
    if not Config.GROQ_API_KEY or not exercise_list:
        return query
    system = (f"You are a gym exercise name matcher. Given the list: {exercise_list}. "
              f'Return ONLY the closest match to "{query}" from the list, or the exact query if no match is close. '
              f"Return a single string with no quotes, no explanation.")
    try:
        raw = await asyncio.to_thread(_call_groq_with_system, system, query, 64)
        match = raw.strip().strip('"').strip("'")
        if match and match.lower() in [e.lower() for e in exercise_list]:
            for e in exercise_list:
                if e.lower() == match.lower():
                    return e
        return match or query
    except Exception:
        return query

async def suggest_exercises(movement_pattern: str, current_exercise: str, weak_point: str, stats: dict) -> list:
    if not Config.GROQ_API_KEY and not Config.GEMINI_API_KEY:
        return []
    prompt = _build_prompt(movement_pattern, current_exercise, weak_point, stats)
    try:
        if Config.AI_PROVIDER == "gemini" and Config.GEMINI_API_KEY:
            raw = _call_gemini(prompt)
        elif Config.GROQ_API_KEY:
            raw = _call_groq(prompt)
        else:
            return []
        suggestions = _parse_json_array(raw)
        return suggestions[:3]
    except Exception as e:
        print(f"AI suggestion error: {e}")
        return []