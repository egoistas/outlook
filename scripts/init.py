#!/usr/bin/env python3
"""Initialize a fresh checkout without overwriting credentials or certificates."""
import argparse
import os
from pathlib import Path
import re
import secrets
import subprocess

root = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser()
p.add_argument('hostname', help='Internal DNS name, e.g. calendar.example.internal')
a = p.parse_args()
if not re.fullmatch(r'(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?', a.hostname):
    p.error('Supply a DNS hostname without scheme, port or path')
if (root / '.env').exists():
    p.error('.env already exists; initialization refused to preserve the existing deployment')
if any((root / 'certs' / n).exists() for n in ('calendar.key', 'calendar.crt')):
    p.error('Existing TLS files detected; initialization refused')
os.umask(0o077)
(root / 'secrets').mkdir(exist_ok=True, mode=0o700)
for name in ('db_password', 'admin_password'):
    path = root / 'secrets' / name
    if not path.exists():
        path.write_text(secrets.token_hex(32) + '\n')
# Files must be readable by container postgres/www-data; parent remains private.
    path.chmod(0o644)
(root / 'certs').mkdir(exist_ok=True)
subprocess.run(['openssl', 'req', '-x509', '-nodes', '-newkey', 'rsa:3072',
    '-days', '365', '-subj', '/CN=' + a.hostname,
    '-addext', 'subjectAltName=DNS:' + a.hostname,
    '-keyout', str(root / 'certs/calendar.key'),
    '-out', str(root / 'certs/calendar.crt')], check=True, capture_output=True)
(root / 'certs/calendar.crt').chmod(0o644)
(root / '.env').write_text((root / '.env.example').read_text().replace('calendar.example.internal', a.hostname))
print('Initialized. Replace the temporary TLS certificate with one from your internal CA.')
print('Local admin: calendar-admin. Password is in secrets/admin_password (not printed).')
