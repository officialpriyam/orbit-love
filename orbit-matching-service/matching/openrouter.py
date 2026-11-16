"""Optional explanation wording. Never sends identifiers, profiles or raw answers."""
import json
import logging
import httpx
from . import config

log = logging.getLogger('orbit.openrouter')
URL = 'https://openrouter.ai/api/v1/chat/completions'

def enhance(local):
    if not config.OPENROUTER_API_KEY or not local['shared']:
        return local
    try:
        # Coarse themes originate from fixed server templates, never user text.
        with httpx.stream('POST', URL, timeout=httpx.Timeout(15, connect=5),
            headers={'Authorization': 'Bearer ' + config.OPENROUTER_API_KEY},
            json={
                'model': config.OPENROUTER_MODEL,
                'provider': {'data_collection': 'deny', 'require_parameters': True},
                'response_format': {'type': 'json_object'},
                'max_tokens': 250,
                'messages': [
                    {'role': 'system', 'content': 'Return only a JSON object with explanation (one or two brief sentences) and icebreaker (one kind question). Describe only the supplied shared themes. Do not invent facts, identities, scores, attraction, diagnoses or relationship predictions. No links, markup or sexual content. Mention that shared themes are a conversation starting point.'},
                    {'role': 'user', 'content': json.dumps({'shared_themes': local['shared']})},
                ],
            }) as response:
            response.raise_for_status()
            payload = bytearray()
            for chunk in response.iter_bytes():
                payload.extend(chunk)
                if len(payload) > 32768:
                    raise ValueError('Response exceeds limit')
        result = json.loads(payload)
        choice = result['choices'][0]
        if choice.get('finish_reason') != 'stop':
            raise ValueError('Incomplete completion')
        content = json.loads(choice['message']['content'])
        for key, limit in [('explanation', 650), ('icebreaker', 220)]:
            value = content.get(key)
            if not isinstance(value, str) or not 10 <= len(value.strip()) <= limit or any(t in value.lower() for t in ('<', '>', 'http:', 'https:', 'www.')):
                raise ValueError('Invalid explanation')
        return {**local, 'explanation': content['explanation'].strip(), 'icebreaker': content['icebreaker'].strip(), 'explanation_source': 'openrouter/free'}
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
        log.warning('OpenRouter unavailable or invalid; using local explanation')
        return local
