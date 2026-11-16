import json
from unittest.mock import patch
import httpx
import pytest
from matching import config
from matching.engine import Participant, eligible, explain

def person(identifier, **changes):
    profile = dict(age=25, gender='Non-binary', seeking=['Non-binary'], intention='Dating', min_age=18, max_age=40, country='India', city='Delhi', any_city=False, outside_country=False, openrouter_consent=False)
    profile.update(changes)
    return Participant(identifier, profile, {'3':'A'})

def test_location_switches_and_mutual_preferences():
    settings = dict(country_enabled=True, outside_country_enabled=False, city_enabled=False)
    a, b = person('a'), person('b', country='Canada', outside_country=True)
    assert not eligible(a, b, settings)
    settings['outside_country_enabled'] = True
    assert not eligible(a, b, settings)
    a = person('a', outside_country=True)
    assert eligible(a, b, settings)
    settings['city_enabled'] = True
    assert not eligible(a, b, settings)  # Identical city names in different countries.
    assert eligible(person('a', outside_country=True, any_city=True), person('b', country='Canada', outside_country=True, any_city=True), settings)
    assert not eligible(a, person('b', country=''), settings)
    assert eligible(person('a', city='', country=''), person('b', city='Other', country=''), dict(country_enabled=False, outside_country_enabled=False, city_enabled=False))

def test_explicit_mutual_consent_required(monkeypatch):
    monkeypatch.setattr(config, 'OPENROUTER_API_KEY', 'test-key')
    with patch('matching.openrouter.httpx.stream') as network:
        explain(person('a', openrouter_consent=True), person('b', llm_consent=True), ['3'])
        network.assert_not_called()

def test_provider_receives_only_fixed_themes(monkeypatch):
    monkeypatch.setattr(config, 'OPENROUTER_API_KEY', 'test-key')
    content = {'explanation':'You share communication themes, a conversation starting point.', 'icebreaker':'What makes you feel heard?'}
    response = httpx.Response(200, request=httpx.Request('POST', 'https://openrouter.ai'), json={'choices':[{'finish_reason':'stop','message':{'content':json.dumps(content)}}]})
    with patch('matching.openrouter.httpx.stream') as network:
        network.return_value.__enter__.return_value = response
        result = explain(person('private-a', openrouter_consent=True, bio='secret bio'), person('private-b', openrouter_consent=True), ['3'])
        payload = network.call_args.kwargs['json']
        assert payload['model'] == 'openrouter/free'
        assert payload['provider']['data_collection'] == 'deny'
        assert json.loads(payload['messages'][1]['content']) == {'shared_themes':['Conflict & communication']}
        assert 'private-a' not in str(payload) and 'secret bio' not in str(payload)
        assert result['explanation_source'] == 'openrouter/free'

@pytest.mark.parametrize('response', [httpx.Response(429), httpx.Response(200, json={'choices':[]}), httpx.Response(200, content=b'x'*33000)])
def test_provider_failure_falls_back(monkeypatch, response):
    monkeypatch.setattr(config, 'OPENROUTER_API_KEY', 'test-key')
    response.request = httpx.Request('POST', 'https://openrouter.ai')
    with patch('matching.openrouter.httpx.stream') as network:
        network.return_value.__enter__.return_value = response
        result = explain(person('a', openrouter_consent=True), person('b', openrouter_consent=True), ['3'])
        assert result['explanation_source'] == 'orbit-local-v1'
