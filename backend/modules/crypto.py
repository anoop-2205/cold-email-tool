"""Symmetric encryption for credentials we must store in reversible form.

Gmail uses OAuth (no password ever touches our DB). Naukri doesn't offer
OAuth -- automating login means storing the actual account password, so
this encrypts it at rest with a key derived from JWT_SECRET (already a
required server-side secret; no separate key to manage). Not a substitute
for a real secrets manager, but meaningfully better than plaintext, which
is the bar for a local, personal-use tool.
"""
import base64
import hashlib

from cryptography.fernet import Fernet

from config import settings


def _fernet() -> Fernet:
    key_material = hashlib.sha256(settings.jwt_secret.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key_material))


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode()).decode()
