import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')
DATABASE_URL = os.getenv('DATABASE_URL', '')
SQLITE_PATH = os.getenv('SQLITE_PATH', str(ROOT.parent / 'orbit' / '.local' / 'orbit.db'))
PRODUCTION = os.getenv('APP_ENV') == 'production'
REDIS_URL = os.getenv('UPSTASH_REDIS_REST_URL', '').rstrip('/')
REDIS_TOKEN = os.getenv('UPSTASH_REDIS_REST_TOKEN', '')
APP_URL = os.getenv('APP_URL', 'http://localhost:3000').rstrip('/')
RESEND_KEY = os.getenv('RESEND_API_KEY', '')
EMAIL_FROM = os.getenv('EMAIL_FROM', '')
SERVICE_TOKEN = os.getenv('SERVICE_TOKEN', '')
POLL_SECONDS = float(os.getenv('WORKER_POLL_SECONDS', '5'))
MAX_PARTICIPANTS = int(os.getenv('MAX_PARTICIPANTS', '3000'))
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY', '')
OPENROUTER_MODEL = os.getenv('OPENROUTER_MODEL', 'openrouter/free')

def validate():
    if OPENROUTER_MODEL != 'openrouter/free':
        raise RuntimeError('This integration requires OPENROUTER_MODEL=openrouter/free')
    if PRODUCTION and not all([DATABASE_URL, REDIS_URL, REDIS_TOKEN, SERVICE_TOKEN]):
        raise RuntimeError('Production requires Neon, Upstash, and SERVICE_TOKEN')
    if PRODUCTION and not APP_URL.startswith('https://'):
        raise RuntimeError('APP_URL must use HTTPS in production')
