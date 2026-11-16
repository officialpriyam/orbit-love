"""Deterministic mutual filtering and interpretable categorical similarity.

Matching is local Python; explanations can optionally use consent-gated OpenRouter.
"""
import json
import heapq
from dataclasses import dataclass
from pathlib import Path

QUESTIONS = {str(q['id']): q for q in json.loads(Path(__file__).with_name('questions.json').read_text(encoding='utf-8-sig'))}
WEIGHTS = {str(i): 3 if i in {3, 7, 25, 28, 29, 30, 31, 40} else 2 if i in {1, 2, 8, 11, 20, 32, 35, 38} else 1 for i in range(1, 41)}
THEMES = {3:'Conflict & communication',7:'Honest communication',25:'Showing affection',28:'Shared green flags',29:'Common boundaries',30:'A similar pace',31:'Time together',40:'Shared expectations',1:'Social energy',2:'Decision making',8:'What drives you',11:'Money habits',20:'Staying in touch',32:'Privacy preferences',35:'Everyday values',38:'Good conversations'}

@dataclass(frozen=True)
class Participant:
    id: str
    profile: dict
    answers: dict

DEFAULT_LOCATION = dict(country_enabled=False, outside_country_enabled=False, city_enabled=True)

def location_eligible(x, y, settings):
    country_x, country_y = (p.get('country', '').strip().casefold() for p in (x, y))
    if settings['country_enabled']:
        if not country_x or not country_y:
            return False
        if country_x != country_y and not (settings['outside_country_enabled'] and x.get('outside_country') and y.get('outside_country')):
            return False
    if settings['city_enabled']:
        city_x, city_y = (p.get('city', '').strip().casefold() for p in (x, y))
        if not city_x or not city_y:
            return False
        same_city = city_x == city_y and (not settings['country_enabled'] or country_x == country_y)
        if not same_city and not (x.get('any_city') and y.get('any_city')):
            return False
    return True

def eligible(a: Participant, b: Participant, settings=None) -> bool:
    x, y = a.profile, b.profile
    return bool(
        a.id != b.id and x['age'] >= 18 and y['age'] >= 18
        and x['intention'] == y['intention']
        and y['gender'] in x['seeking'] and x['gender'] in y['seeking']
        and x['min_age'] <= y['age'] <= x['max_age']
        and y['min_age'] <= x['age'] <= y['max_age']
        and location_eligible(x, y, settings if settings is not None else DEFAULT_LOCATION)
    )

def compatibility(a: Participant, b: Participant):
    shared = [q for q in WEIGHTS if a.answers.get(q) and a.answers.get(q) == b.answers.get(q)]
    score = round(100 * sum(WEIGHTS[q] for q in shared) / sum(WEIGHTS.values()))
    return score, sorted(shared, key=lambda q: (-WEIGHTS[q], int(q)))

def select_pairs(people: list[Participant], max_matches=3, threshold=25, settings=None):
    """Greedy symmetric degree-capped recommendations, stable for retries.

    O(n²) within intention groups; capped by MAX_PARTICIPANTS operationally.
    This is not a claim of globally optimal pairing or romantic success.
    """
    ordered = sorted(people, key=lambda p: p.id)
    # Keep a bounded candidate set per person instead of storing O(n²) edges.
    candidates = {p.id: [] for p in ordered}
    candidate_limit = max(24, max_matches * 8)
    for i, a in enumerate(ordered):
        for b in ordered[i + 1:]:
            if eligible(a, b, settings):
                score, shared = compatibility(a, b)
                if score >= threshold:
                    for first, second in [(a.id,b.id),(b.id,a.id)]:
                        heap = candidates[first]
                        item = (score, second)
                        if len(heap) < candidate_limit:
                            heapq.heappush(heap,item)
                        elif item > heap[0]:
                            heapq.heapreplace(heap,item)
    by_id={p.id:p for p in ordered}
    unique={tuple(sorted((a,b))) for a,heap in candidates.items() for _,b in heap}
    edges=[]
    for a,b in unique:
        score,shared=compatibility(by_id[a],by_id[b])
        edges.append((score,a,b,shared))
    edges.sort(key=lambda e: (-e[0], e[1], e[2]))
    degree = {p.id: 0 for p in people}
    selected = []
    for score, a, b, shared in edges:
        if degree[a] < max_matches and degree[b] < max_matches:
            selected.append((score, a, b, shared))
            degree[a] += 1
            degree[b] += 1
    return selected

def explain_local(a: Participant, b: Participant, shared: list[str]):
    """Grounded language from audited templates; deliberately not an LLM.

    Only coarse common themes are disclosed, never raw answers or profile text.
    """
    known = [q for q in shared if q in QUESTIONS and a.answers.get(q) == b.answers.get(q)]
    themes = list(dict.fromkeys(THEMES.get(int(q), 'Everyday interests') for q in known))[:3]
    if not themes:
        return {'shared': [], 'explanation': 'Your preferences align, but there is limited shared survey evidence. Take time to get to know each other.', 'icebreaker': 'What is something you enjoy talking about?', 'explanation_source': 'orbit-local-v1'}
    topic = themes[0]
    prompts = {
        'Conflict & communication': 'What helps you feel heard during a difficult conversation?',
        'Honest communication': 'What does a good conversation feel like to you?',
        'Showing affection': 'What is a small gesture that makes your day better?',
        'Shared green flags': 'What quality do you most appreciate in the people close to you?',
        'Common boundaries': 'What helps you feel comfortable when meeting someone new?',
        'A similar pace': 'What does getting to know someone at your own pace look like?',
        'Time together': 'What would your ideal unhurried afternoon look like?',
        'Shared expectations': 'What kind of connection would you like to build?',
        'Social energy': 'How do you like to recharge after a busy week?',
        'Good conversations': 'Which conversation topic makes you lose track of time?',
    }
    if len(themes) == 1:
        summary = themes[0].lower()
    else:
        summary = ', '.join(t.lower() for t in themes[:-1]) + ' and ' + themes[-1].lower()
    return {'shared': themes, 'explanation': 'Your answers share common ground around ' + summary + '. This is a conversation starting point, not a prediction of chemistry.', 'icebreaker': prompts.get(topic, 'What is a small everyday ritual you would love to share with someone?'), 'explanation_source': 'orbit-local-v1'}

def explain(a: Participant, b: Participant, shared: list[str]):
    from .openrouter import enhance
    local = explain_local(a, b, shared)
    if a.profile.get('openrouter_consent') is True and b.profile.get('openrouter_consent') is True:
        return enhance(local)
    return local
