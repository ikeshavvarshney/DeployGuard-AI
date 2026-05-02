import hashlib
import json

# Simulated Redis and MongoDB stores for MVP
_redis_store = {}
_mongo_store = {}

def repo_fingerprint(url: str, commit_hash: str = "latest") -> str:
    """Returns SHA256[:16] fingerprint of repo and commit."""
    key = f"{url}:{commit_hash}".encode('utf-8')
    return hashlib.sha256(key).hexdigest()[:16]

async def get_cache(key: str):
    """Simulated async get from redis"""
    return _redis_store.get(key)

async def set_cache(key: str, value, ttl: int = 3600):
    """Simulated async set to redis with TTL"""
    _redis_store[key] = value

async def store_run(fingerprint: str, report: dict):
    """Simulated upsert to MongoDB"""
    _mongo_store[fingerprint] = report

async def get_past_run(fingerprint: str):
    """Simulated query from MongoDB"""
    return _mongo_store.get(fingerprint)
