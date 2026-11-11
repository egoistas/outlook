import os, sqlite3, secrets, ssl, time
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from zoneinfo import ZoneInfo
from flask import Flask, request, session, jsonify, abort
from werkzeug.security import generate_password_hash, check_password_hash
from dateutil.rrule import rrule, DAILY, WEEKLY, MONTHLY, YEARLY

app = Flask(__name__, static_folder='static')
app.config.update(SECRET_KEY=os.environ['SESSION_SECRET'], SESSION_COOKIE_NAME='org_calendar_session', SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Lax', SESSION_COOKIE_SECURE=os.getenv('COOKIE_SECURE','1')=='1', PERMANENT_SESSION_LIFETIME=timedelta(hours=8), MAX_CONTENT_LENGTH=65536)
DB = os.getenv('DATABASE', '/data/calendar.sqlite3')
ZONE = ZoneInfo('Europe/Athens')
def db():
    c=sqlite3.connect(DB, timeout=20); c.row_factory=sqlite3.Row
    return c

def initialize():
    Path(DB).parent.mkdir(parents=True,exist_ok=True)
    with db() as c:
        c.executescript('''CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY,password TEXT,role TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, location TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL, all_day INTEGER NOT NULL, category TEXT NOT NULL, recurrence TEXT NOT NULL, until_date TEXT, version INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset REAL NOT NULL);''')
        if os.getenv('AUTH_MODE','local')=='local':
            for name,role,key in [('chief','writer','CHIEF_PASSWORD'),('director','reader','DIRECTOR_PASSWORD')]:
                password=os.environ.get(key)
                if not password: raise RuntimeError('Missing '+key)
                c.execute('INSERT OR IGNORE INTO users VALUES (?,?,?)',(name,generate_password_hash(password),role))
initialize()

def current_user():
    name=session.get('user')
    with db() as c: row=c.execute('SELECT name,role FROM users WHERE name=?',(name,)).fetchone()
    if not row: abort(401)
    return dict(row)

def protected(write=False):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args,**kwargs):
            user=current_user()
            if request.method not in ('GET','HEAD') and not secrets.compare_digest(request.headers.get('X-CSRF-Token',''),session.get('csrf','!')): abort(403)
            if write and user['role']!='writer': abort(403)
            return fn(*args,**kwargs)
        return wrapper
    return decorate

@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(403)
@app.errorhandler(404)
@app.errorhandler(409)
@app.errorhandler(429)
def error(e): return jsonify(error={400:'Μη έγκυρα δεδομένα',401:'Απαιτείται σύνδεση',403:'Δεν έχετε δικαίωμα επεξεργασίας',404:'Δεν βρέθηκε',409:'Το συμβάν άλλαξε. Ανανεώστε και δοκιμάστε ξανά.',429:'Πολλές προσπάθειες. Δοκιμάστε σε 5 λεπτά.'}[e.code]),e.code

@app.after_request
def headers(r):
    r.headers['X-Content-Type-Options']='nosniff'
    r.headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'"
    if request.path.startswith('/api/'): r.headers['Cache-Control']='no-store'
    return r

@app.get('/')
def index(): return app.send_static_file('index.html')
@app.get('/health')
def health(): return {'status':'ok'}

def ad_login(name,password):
    from ldap3 import Server, Connection, Tls, SUBTREE
    from ldap3.utils.conv import escape_filter_chars as escape
    if not password: return None
    server=Server(os.environ['AD_HOST'],port=636,use_ssl=True,tls=Tls(validate=ssl.CERT_REQUIRED,ca_certs_file=os.environ['AD_CA_FILE']))
    allowed=escape(os.environ['AD_ALLOWED_GROUP_DN'])
    filt=f'(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2))(memberOf={allowed})(|(sAMAccountName={escape(name)})(userPrincipalName={escape(name)})))'
    with Connection(server,user=os.environ['AD_BIND_DN'],password=os.environ['AD_BIND_PASSWORD'],auto_bind=True,receive_timeout=10) as conn:
        conn.search(os.environ['AD_BASE_DN'],filt,SUBTREE,attributes=['memberOf','sAMAccountName'],size_limit=2)
        if len(conn.entries)!=1: return None
        entry=conn.entries[0]; dn=entry.entry_dn
        groups=[str(v).casefold() for v in entry.memberOf.values]
        canonical=str(entry.sAMAccountName)
    with Connection(server,user=dn,password=password,auto_bind=True,receive_timeout=10): pass
    return canonical, 'writer' if os.environ['AD_WRITER_GROUP_DN'].casefold() in groups else 'reader'

@app.post('/api/login')
def login():
    if not request.is_json: abort(400)
    payload=request.get_json(); name=str(payload.get('username',''))[:200]; password=str(payload.get('password',''))
    key=(request.remote_addr or 'unknown')+':'+name.casefold(); now=time.time()
    with db() as c:
        c.execute('DELETE FROM attempts WHERE reset<?',(now,))
        row=c.execute('SELECT count FROM attempts WHERE key=?',(key,)).fetchone()
        if row and row['count']>=20: abort(429)
        c.execute('INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',(key,now+300))
    user=None
    if os.getenv('AUTH_MODE','local')=='ad':
        try:
            result=ad_login(name,password)
            if result:
                name,role=result
                with db() as c: c.execute('INSERT INTO users VALUES (?,NULL,?) ON CONFLICT(name) DO UPDATE SET role=excluded.role,password=NULL',(name,role))
                user=True
        except Exception:
            app.logger.warning('AD authentication failed (credentials omitted)')
    else:
        with db() as c: row=c.execute('SELECT * FROM users WHERE name=?',(name,)).fetchone()
        if row and row['password'] and check_password_hash(row['password'],password): user=True
    if not user: abort(401)
    session.clear(); session['user']=name; session['csrf']=secrets.token_hex(32); session.permanent=True
    return {**current_user(),'csrf':session['csrf']}

@app.get('/api/me')
@protected()
def me(): return {**current_user(),'csrf':session['csrf']}
@app.post('/api/logout')
@protected()
def logout(): session.clear(); return {'ok':True}

def date(value):
    try:
        d=datetime.fromisoformat(value)
        return d.replace(tzinfo=ZONE) if d.tzinfo is None else d.astimezone(ZONE)
    except (ValueError,TypeError): abort(400)

def validated(data):
    if not isinstance(data,dict): abort(400)
    title=str(data.get('title','')).strip()
    start=date(data.get('start')); end=date(data.get('end'))
    if not title or len(title)>200 or end<=start or end-start>timedelta(days=366) or not 2000<=start.year<=2100: abort(400)
    recurrence=data.get('recurrence','none'); category=data.get('category','blue')
    if recurrence not in ['none','daily','weekly','monthly','yearly'] or category not in ['blue','purple','green','orange','red']: abort(400)
    until=data.get('until_date') or None
    if until and date(until).date()<start.date(): abort(400)
    return (title,str(data.get('description',''))[:10000],str(data.get('location',''))[:500],start.isoformat(),end.isoformat(),int(bool(data.get('all_day'))),category,recurrence,until)

@app.get('/api/events')
@protected()
def events():
    begin=date(request.args.get('start')); finish=date(request.args.get('end'))
    if not timedelta(0)<finish-begin<=timedelta(days=93): abort(400)
    with db() as c: rows=c.execute('SELECT * FROM events').fetchall()
    output=[]
    for row in rows:
        e=dict(row); start=date(e['start']); end=date(e['end']); duration=end-start
        if e['recurrence']=='none': occurrences=[start]
        else:
            until=date(e['until_date']).replace(hour=23,minute=59,second=59) if e['until_date'] else finish
            occurrences=rrule({'daily':DAILY,'weekly':WEEKLY,'monthly':MONTHLY,'yearly':YEARLY}[e['recurrence']],dtstart=start,until=min(until,finish)).between(begin-duration,finish,inc=True)
        for occurrence in occurrences:
            if occurrence<finish and occurrence+duration>begin:
                output.append({**e,'occurrence_start':occurrence.isoformat(),'occurrence_end':(occurrence+duration).isoformat()})
    return jsonify(output)

@app.post('/api/events')
@protected(write=True)
def create():
    values=validated(request.get_json())
    with db() as c:
        result=c.execute('INSERT INTO events(title,description,location,start,end,all_day,category,recurrence,until_date) VALUES (?,?,?,?,?,?,?,?,?)',values)
        return {'id':result.lastrowid},201

@app.put('/api/events/<int:identifier>')
@protected(write=True)
def update(identifier):
    data=request.get_json(); values=validated(data)
    with db() as c:
        result=c.execute('UPDATE events SET title=?,description=?,location=?,start=?,end=?,all_day=?,category=?,recurrence=?,until_date=?,version=version+1 WHERE id=? AND version=?',(*values,identifier,data.get('version')))
        if not result.rowcount: abort(409)
    return {'ok':True}

@app.delete('/api/events/<int:identifier>')
@protected(write=True)
def delete(identifier):
    with db() as c:
        result=c.execute('DELETE FROM events WHERE id=? AND version=?',(identifier,(request.get_json() or {}).get('version')))
        if not result.rowcount: abort(409)
    return {'ok':True}
