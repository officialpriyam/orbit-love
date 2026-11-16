import json
import logging
import threading
import time
import uuid
import httpx
from . import config
from .db import transaction, lock_round
from .engine import Participant, select_pairs, explain, DEFAULT_LOCATION

log = logging.getLogger('orbit.worker')

def redis_command(*args):
    response = httpx.post(config.REDIS_URL, headers={'Authorization': 'Bearer ' + config.REDIS_TOKEN}, json=list(args), timeout=5)
    response.raise_for_status()
    return response.json().get('result')

def claim_job():
    with transaction() as db:
        suffix = ' FOR UPDATE SKIP LOCKED' if config.DATABASE_URL else ''
        job = db.one("SELECT * FROM jobs WHERE (status='queued' OR (status='running' AND lease_until<?)) ORDER BY created_at LIMIT 1" + suffix, (time.time(),))
        if not job:
            return None
        if job['attempts'] >= 3:
            db.execute("UPDATE jobs SET status='failed',error='Retry limit reached' WHERE id=?", (job['id'],))
            db.execute("UPDATE rounds SET status='failed' WHERE id=? AND status='matching'", (job['round_id'],))
            return None
        job['lease_token'] = str(uuid.uuid4())
        db.execute("UPDATE jobs SET status='running',attempts=attempts+1,lease_until=?,lease_token=? WHERE id=?", (time.time()+120, job['lease_token'], job['id']))
        return job

def heartbeat(job, stop):
    while not stop.wait(20):
        try:
            with transaction() as db:
                db.execute("UPDATE jobs SET lease_until=? WHERE id=? AND lease_token=? AND status='running'", (time.time()+120, job['id'], job['lease_token']))
        except Exception:
            log.warning('Job heartbeat unavailable')

def process_job(job):
    stop = threading.Event()
    thread = threading.Thread(target=heartbeat, args=(job, stop), daemon=True)
    thread.start()
    try:
        with transaction() as db:
            rows = db.all('SELECT r.user_id,r.answers,p.data FROM responses r JOIN profiles p ON p.user_id=r.user_id WHERE r.round_id=? AND r.submitted=1 ORDER BY r.user_id', (job['round_id'],))
            setting_row = db.one('SELECT data FROM round_settings WHERE round_id=?', (job['round_id'],))
            settings = json.loads(setting_row['data']) if setting_row else DEFAULT_LOCATION
        if len(rows) > config.MAX_PARTICIPANTS:
            raise RuntimeError('Participant capacity exceeded')
        people = [Participant(r['user_id'], json.loads(r['data']), json.loads(r['answers'])) for r in rows]
        by_id = {p.id: p for p in people}
        results = []
        for score, a, b, shared in select_pairs(people, settings=settings):
            details = explain(by_id[a], by_id[b], shared)
            results.append((a, b, score, json.dumps(details)))
        with transaction() as db:
            round_row = lock_round(db, job['round_id'])
            lease = db.one("SELECT * FROM jobs WHERE id=? AND lease_token=? AND status='running'", (job['id'], job['lease_token']))
            if not lease or lease['lease_until'] < time.time() or round_row['status'] != 'matching':
                return
            # Account deletions during computation must not resurrect data.
            active = {r['user_id'] for r in db.all('SELECT user_id FROM responses WHERE round_id=? AND submitted=1', (job['round_id'],))}
            db.execute('DELETE FROM matches WHERE round_id=?', (job['round_id'],))
            for a, b, score, details in results:
                if a not in active or b not in active:
                    continue
                for first, second in [(a, b), (b, a)]:
                    db.execute('INSERT INTO matches(round_id,user_id,other_id,score,details) VALUES(?,?,?,?,?)', (job['round_id'], first, second, score, details))
            db.execute("UPDATE jobs SET status='complete',lease_until=0,error=NULL WHERE id=? AND lease_token=?", (job['id'], job['lease_token']))
            db.execute("UPDATE rounds SET status='ready' WHERE id=?", (job['round_id'],))
            db.execute('INSERT INTO events(id,action,created_at) VALUES(?,?,?)', (str(uuid.uuid4()), 'Matching complete. Results are ready to reveal.', time.time()))
        log.info('Matching job completed')
    except Exception as error:
        # Do not log profile text, secrets, provider response bodies, or emails.
        log.warning('Matching attempt failed: %s', type(error).__name__)
        with transaction() as db:
            current = db.one('SELECT attempts FROM jobs WHERE id=? AND lease_token=?', (job['id'], job['lease_token']))
            if current:
                failed = current['attempts'] >= 3
                db.execute('UPDATE jobs SET status=?,error=?,lease_until=0 WHERE id=? AND lease_token=?', ('failed' if failed else 'queued', type(error).__name__, job['id'], job['lease_token']))
                if failed:
                    db.execute("UPDATE rounds SET status='failed' WHERE id=? AND status='matching'", (job['round_id'],))
    finally:
        stop.set()
        thread.join(timeout=2)

def send_one_email():
    if not config.RESEND_KEY or not config.EMAIL_FROM:
        return False  # Remains pending until an operator configures delivery.
    with transaction() as db:
        suffix = ' FOR UPDATE SKIP LOCKED' if config.DATABASE_URL else ''
        item = db.one("SELECT * FROM outbox WHERE status IN ('pending','delivering') AND next_attempt<? ORDER BY id LIMIT 1" + suffix, (time.time(),))
        if not item:
            return False
        user = db.one('SELECT email FROM users WHERE id=?', (item['user_id'],))
        if not user:
            return False
        db.execute("UPDATE outbox SET status='delivering',attempts=attempts+1,next_attempt=? WHERE id=?", (time.time()+120, item['id']))
    try:
        response = httpx.post('https://api.resend.com/emails', timeout=25,
            headers={'Authorization': 'Bearer ' + config.RESEND_KEY, 'Idempotency-Key': 'orbit-result-' + item['id']},
            json={'from': config.EMAIL_FROM, 'to': [user['email']], 'subject': 'Your Orbit results are ready',
                  'text': 'Your matching round has been revealed. Sign in to see your private results: ' + config.APP_URL + '/#dashboard\n\nDeveloped by priyx.'})
        response.raise_for_status()
        with transaction() as db:
            db.execute("UPDATE outbox SET status='sent',error=NULL WHERE id=?", (item['id'],))
    except httpx.HTTPError:
        attempts = item['attempts'] + 1
        with transaction() as db:
            db.execute('UPDATE outbox SET status=?,next_attempt=?,error=? WHERE id=?',
                       ('failed' if attempts >= 5 else 'pending', time.time()+min(3600, 30*2**attempts), 'Email provider request failed', item['id']))
    return True

def run_once():
    if config.REDIS_URL:
        try:
            redis_command('RPOP', 'orbit:matching:jobs')
        except Exception:
            log.warning('Redis unavailable; checking durable queue')
    job = claim_job()
    if job:
        process_job(job)
    sent = send_one_email()
    return bool(job or sent)

def run_forever(stop):
    config.validate()
    while not stop.is_set():
        try:
            work = run_once()
        except Exception as error:
            log.warning('Worker waiting for database: %s', type(error).__name__)
            work = False
        stop.wait(0.2 if work else config.POLL_SECONDS)

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    if '--once' in __import__('sys').argv:
        config.validate()
        run_once()
    else:
        run_forever(threading.Event())
