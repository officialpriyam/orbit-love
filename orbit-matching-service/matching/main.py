import hmac
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException
from . import config
from .db import transaction
from .worker import run_forever

@asynccontextmanager
async def lifespan(app):
    config.validate()
    stop = threading.Event()
    thread = threading.Thread(target=run_forever, args=(stop,), daemon=True)
    thread.start()
    yield
    stop.set()
    thread.join(timeout=5)

app = FastAPI(title='Orbit Matching Service', version='1.0.0', lifespan=lifespan,
              docs_url=None if config.PRODUCTION else '/docs', redoc_url=None,
              openapi_url=None if config.PRODUCTION else '/openapi.json')

@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'orbit-matching'}

@app.get('/v1/status')
def status(authorization: str = Header(default='')):
    if not config.SERVICE_TOKEN or not hmac.compare_digest(authorization.encode(), ('Bearer ' + config.SERVICE_TOKEN).encode()):
        raise HTTPException(401, 'Service authorization required')
    with transaction() as db:
        jobs = db.all('SELECT status,COUNT(*) AS count FROM jobs GROUP BY status')
    return {'jobs': jobs, 'email_configured': bool(config.RESEND_KEY and config.EMAIL_FROM),
            'explanation_engine': config.OPENROUTER_MODEL,
            'openrouter_configured': bool(config.OPENROUTER_API_KEY),
            'external_ai_requires_mutual_consent': True, 'fallback_engine': 'orbit-local-v1'}
