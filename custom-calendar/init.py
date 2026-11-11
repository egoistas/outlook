"""Create local trial credentials and TLS certificate; never overwrite settings."""
from pathlib import Path
import os, secrets, subprocess
root=Path(__file__).resolve().parent
os.umask(0o077)
if (root/'.env').exists(): raise SystemExit('.env exists; refusing to overwrite credentials.')
(root/'certs').mkdir(exist_ok=True)
if any((root/'certs'/f).exists() for f in ['calendar.key','calendar.crt']): raise SystemExit('Certificate exists; refusing to overwrite.')
subprocess.run(['openssl','req','-x509','-nodes','-newkey','rsa:3072','-days','365','-subj','/CN=calendar.test','-addext','subjectAltName=DNS:calendar.test','-keyout',str(root/'certs/calendar.key'),'-out',str(root/'certs/calendar.crt')],check=True,capture_output=True)
(root/'certs/calendar.crt').chmod(0o644)
(root/'.env').write_text('AUTH_MODE=local\nCOOKIE_SECURE=1\nSESSION_SECRET='+secrets.token_hex(32)+'\nCHIEF_PASSWORD='+secrets.token_hex(12)+'\nDIRECTOR_PASSWORD='+secrets.token_hex(12)+'\n')
print('Created .env with credentials for chief and director. URL: https://calendar.test:9443')
