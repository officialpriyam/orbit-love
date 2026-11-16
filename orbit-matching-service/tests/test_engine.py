from unittest.mock import patch, Mock
from matching.engine import Participant, eligible, compatibility, select_pairs, explain

def person(id, **changes):
    p = dict(age=25, city='Bengaluru', gender='Non-binary', intention='Dating', seeking=['Non-binary'], min_age=18, max_age=40, any_city=False, llm_consent=False)
    p.update(changes)
    return Participant(id, p, {str(i): 'A' for i in range(1, 41)})

def test_mutual_preferences_not_orientation_labels():
    a, b = person('a', orientation='Bi'), person('b', orientation='Gay')
    assert eligible(a, b)
    assert not eligible(a, person('b', seeking=['Woman']))
    assert not eligible(a, person('b', age=17))
    assert not eligible(a, person('b', min_age=30))
    assert not eligible(a, person('b', intention='Friendship'))
    assert not eligible(a, person('b', city='Mumbai', any_city=True))
    assert eligible(person('a', any_city=True), person('b', city='Mumbai', any_city=True))

def test_symmetric_stable_degree_cap():
    people = [person(str(i)) for i in range(8)]
    pairs = select_pairs(people)
    assert pairs == select_pairs(list(reversed(people)))
    degree = {p.id: 0 for p in people}
    for score, a, b, shared in pairs:
        assert score == 100
        assert len(shared) == 40
        degree[a] += 1
        degree[b] += 1
    assert max(degree.values()) <= 3
    assert len({(a, b) for _, a, b, _ in pairs}) == len(pairs)

def test_no_fabricated_fit_when_nothing_matches():
    a, b = person('a'), person('b')
    b = Participant(b.id, b.profile, {str(i): 'H' for i in range(1, 41)})
    assert compatibility(a, b)[0] == 0
    assert select_pairs([a, b]) == []

def test_explanations_are_private_deterministic_and_grounded():
    a, b = person('a'), person('b')
    with patch('httpx.post', side_effect=AssertionError('Network not allowed')) as network:
        first = explain(a, b, ['3', '7'])
        assert first == explain(a, b, ['3', '7'])
        assert first['explanation_source'] == 'orbit-local-v1'
        assert first['shared'] == ['Conflict & communication', 'Honest communication']
        assert 'heard' in first['icebreaker']
        network.assert_not_called()
    assert 'Non-binary' not in str(first)
    assert 'private-id' not in str(first)

def test_empty_evidence_does_not_invent_shared_interests():
    result=explain(person('a'),person('b'),[])
    assert result['shared']==[]
    assert 'limited' in result['explanation']

def test_explanation_discards_inconsistent_answer_evidence():
    a,b=person('a'),person('b')
    b.answers['3']='H'
    result=explain(a,b,['3','7','999'])
    assert result['shared']==['Honest communication']
