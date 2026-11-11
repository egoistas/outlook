import os, tempfile
os.environ.update(SESSION_SECRET='test-only',CHIEF_PASSWORD='chief-test-password',DIRECTOR_PASSWORD='reader-test-password',COOKIE_SECURE='0',DATABASE=tempfile.mktemp(suffix='.sqlite3'),AUTH_MODE='local')
import app as module
import pytest

@pytest.fixture(autouse=True)
def clean():
    with module.db() as c: c.execute('DELETE FROM events'); c.execute('DELETE FROM attempts')

@pytest.fixture
def client(): return module.app.test_client()

def login(client,role='chief'):
    result=client.post('/api/login',json={'username':role,'password':'chief-test-password' if role=='chief' else 'reader-test-password'})
    assert result.status_code==200
    return {'X-CSRF-Token':result.json['csrf']}

def event(**kwargs):
    return dict(title='Σύσκεψη',description='<script>alert(1)</script>',location='Γραφείο',start='2026-03-27T09:00:00+02:00',end='2026-03-27T10:00:00+02:00',all_day=False,category='blue',recurrence='none',**kwargs)

def test_access_and_csrf(client):
    assert client.get('/api/events').status_code==401
    headers=login(client,'director')
    assert client.post('/api/events',json=event(),headers=headers).status_code==403
    assert client.put('/api/events/1',json=event(),headers=headers).status_code==403
    assert client.delete('/api/events/1',json={'version':1},headers=headers).status_code==403
    login(client)
    assert client.post('/api/events',json=event()).status_code==403

def test_crud_and_stale_updates(client):
    headers=login(client)
    r=client.post('/api/events',json=event(),headers=headers);assert r.status_code==201
    id=r.json['id']
    assert client.put(f'/api/events/{id}',json={**event(),'version':1},headers=headers).status_code==200
    assert client.put(f'/api/events/{id}',json={**event(),'version':1},headers=headers).status_code==409
    assert client.delete(f'/api/events/{id}',json={'version':1},headers=headers).status_code==409
    assert client.delete(f'/api/events/{id}',json={'version':2},headers=headers).status_code==200

def test_recurrence_dst_and_reader_visibility(client):
    headers=login(client)
    data=event();data['recurrence']='daily';data['until_date']='2026-03-30'
    assert client.post('/api/events',json=data,headers=headers).status_code==201
    login(client,'director')
    r=client.get('/api/events?start=2026-03-27&end=2026-04-01')
    assert r.status_code==200 and len(r.json)==4
    assert r.json[0]['occurrence_start']=='2026-03-27T09:00:00+02:00'
    assert r.json[-1]['occurrence_start']=='2026-03-30T09:00:00+03:00'

def test_validation_and_login_throttle(client):
    headers=login(client)
    data=event(); data['end']=data['start']
    assert client.post('/api/events',json=data,headers=headers).status_code==400
    assert client.get('/api/events?start=2026-01-01&end=2027-01-01').status_code==400
    for _ in range(20): client.post('/api/login',json={'username':'chief','password':'wrong'})
    assert client.post('/api/login',json={'username':'chief','password':'wrong'}).status_code==429
