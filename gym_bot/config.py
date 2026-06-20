import os

class Config:
    BOT_TOKEN = os.getenv("BOT_TOKEN", "dummy_token_for_testing")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    AI_PROVIDER = os.getenv("AI_PROVIDER", "groq")  # 'groq' or 'gemini'
    DB_PATH = os.getenv("DB_PATH", "test_gym_tracker.db")
    WEBHOOK_URL = os.getenv("WEBHOOK_URL", "")
    PORT = int(os.getenv("PORT", "8080"))

    @classmethod
    def validate(cls):
        if not cls.BOT_TOKEN:
            raise ValueError("BOT_TOKEN is required")
        return True