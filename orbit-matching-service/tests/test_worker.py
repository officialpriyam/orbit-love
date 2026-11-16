import sqlite3
import time
from unittest.mock import patch, Mock
import httpx
import pytest
from matching import config
from matching.worker import claim_job, send_one_email

@pytest.fixture
def database(tmp_path, monkeypatch):
    target = tmp_path / 'worker.db'
    monkeypatch.setattr(config, 'DATABASE_URL', '')
    monkeypatch.setattr(config, 'SQLITE_PATH', str(target))
    con = sqlite3.connect(target)
    con.executescript('''
      CREATE TABLE rounds(id TEXT PRIMARY KEY,status TEXT);
      CREATE TABLE jobs(id TEXT PRIMARY KEY,round_id TEXT,status TEXT,attempts INTEGER,lease_until REAL,lease_token TEXT,error TEXT,created_at REAL);
      CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT);
      CREATE TABLE outbox(id TEXT PRIMARY KEY,user_id TEXT,status TEXT,attempts INTEGER,next_attempt REAL,error TEXT);
      INSERT INTO rounds VALUES('r','matching');
      INSERT INTO users VALUES('u','sample@example.com');
      INSERT INTO outbox VALUES('mail','u','pending',0,0,NULL);
    ''')
    con.commit()
    yield con
    con.close()

def test_expired_job_is_reclaimed_but_active_lease_is_not(database):
    database.execute("INSERT INTO jobs VALUES('j','r','running',1,?,'old',NULL,0)", (time.time()-1,))
    database.commit()
    claimed=claim_job()
    assert claimed['id']=='j'
    assert claimed['lease_token']!='old'
    assert claim_job() is None
    row=database.execute("SELECT attempts,status FROM jobs WHERE id='j'").fetchone()
    assert row==(2,'running')

def test_exhausted_job_fails_round(database):
    database.execute("INSERT INTO jobs VALUES('j','r','queued',3,0,NULL,NULL,0)")
    database.commit()
    assert claim_job() is None
    assert database.execute('SELECT status FROM rounds').fetchone()[0]=='failed'

def test_missing_email_config_does_not_fake_delivery(database):
    with patch.object(config,'RESEND_KEY',''):
        assert send_one_email() is False
    assert database.execute('SELECT status FROM outbox').fetchone()[0]=='pending'

def test_delivery_uses_stable_idempotency_key_and_private_link(database):
    with patch.object(config,'RESEND_KEY','test'),patch.object(config,'EMAIL_FROM','hello@example.com'),patch('matching.worker.httpx.post') as post:
        post.return_value=Mock()
        assert send_one_email()
        call=post.call_args.kwargs
        assert call['headers']['Idempotency-Key']=='orbit-result-mail'
        assert '/#dashboard' in call['json']['text']
        assert 'score' not in call['json']['text']
        assert database.execute('SELECT status FROM outbox').fetchone()[0]=='sent'
        assert send_one_email() is False
        assert post.call_count==1

def test_email_failure_is_retryable(database):
    with patch.object(config,'RESEND_KEY','test'),patch.object(config,'EMAIL_FROM','hello@example.com'),patch('matching.worker.httpx.post',side_effect=httpx.ConnectError('offline')):
        assert send_one_email()
    status,attempts,next_attempt=database.execute('SELECT status,attempts,next_attempt FROM outbox').fetchone()
    assert status=='pending' and attempts==1 and next_attempt>time.time()
