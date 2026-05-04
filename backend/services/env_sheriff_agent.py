"""
services/env_sheriff_agent.py

EnvSheriff — Secret Leak Detector Pipeline
  clone repo (git clone --depth=1)
  → walk all files concurrently (6 parallel scanner workers)
  → each file → regex scan + entropy scan → emit findings to asyncio.Queue
  → consumer: pop 8 findings at a time → batch LLM classification call
  → LLM generates .env.example from all found var names
  → LLM generates remediation checklist ordered by severity
  → return EnvSheriffReport
"""

import asyncio
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from typing import Optional

from models.schemas import RawFinding, SecretFinding, EnvSheriffReport
from services.ollama_client import get_completion


# ─── Constants: Performance Limits ────────────────────────────────────────────

MAX_FILE_SIZE_BYTES = 100_000   # 100KB — skip anything larger
MAX_FILES_TO_SCAN   = 500       # stop after 500 files
MAX_CONTEXT_LENGTH  = 120       # chars per finding context line
MAX_MATCH_LENGTH    = 60        # chars for the matched secret preview
BATCH_SIZE          = 8         # LLM classification batch size (was 3)
CONCURRENT_BATCHES  = 6         # concurrent LLM batch calls (was 3)
SCANNER_SEMAPHORE   = 6         # parallel scanner workers (was 2)


# ─── Secret Patterns ──────────────────────────────────────────────────────────

PATTERNS = {
    "aws_access_key":     r"AKIA[0-9A-Z]{16}",
    "aws_secret_key":     r"(?i)aws.{0,20}secret.{0,20}['\"][0-9a-zA-Z/+]{40}['\"]",
    "jwt_secret":         r"(?i)(jwt|secret).{0,10}['\"][a-zA-Z0-9_\-]{32,}['\"]",
    "github_token":       r"gh[pousr]_[A-Za-z0-9_]{36,}",
    "openai_key":         r"sk-[a-zA-Z0-9]{20,}",
    "stripe_key":         r"sk_(live|test)_[a-zA-Z0-9]{24,}",
    "google_api_key":     r"AIza[0-9A-Za-z\-_]{35}",
    "private_key_block":  r"-----BEGIN (RSA |EC )?PRIVATE KEY-----",
    "hardcoded_password": r"(?i)(password|passwd|pwd)\s*=\s*['\"][^'\"]{6,}['\"]",
    "hardcoded_token":    r"(?i)(token|api_key|apikey|secret)\s*=\s*['\"][^'\"]{8,}['\"]",
    "db_connection":      r"(?i)(mongodb|postgres|mysql|redis):\/\/[^\s'\"]+:[^\s'\"]+@",
}

# Compiled patterns for performance
COMPILED_PATTERNS = {name: re.compile(pat) for name, pat in PATTERNS.items()}

# ─── BUG 1 FIX: Expanded skip lists + whitelist approach ─────────────────────

# Directories to skip entirely (don't even walk into them)
SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".next", ".nuxt",
    "dist", "build", "out", ".cache", ".turbo", "coverage",
    ".pytest_cache", ".mypy_cache", "venv", ".venv", "env",
    ".env", "site-packages", ".tox", "eggs", ".eggs",
    "htmlcov", ".hypothesis", "target", "vendor", "bower_components",
}

# Skip files by name (exact match)
SKIP_FILENAMES = {
    "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "requirements.txt", "requirements-dev.txt", "Pipfile", "Pipfile.lock",
    "poetry.lock", "pyproject.toml", "setup.py", "setup.cfg",
    "Cargo.toml", "Cargo.lock", "go.sum", "go.mod", "composer.lock",
    "Gemfile", "Gemfile.lock", ".gitignore", ".gitattributes",
    ".eslintrc", ".prettierrc", ".editorconfig", ".browserslistrc",
    "tsconfig.json", "jsconfig.json", "babel.config.js", "jest.config.js",
    "webpack.config.js", "vite.config.ts", "vite.config.js",
    "tailwind.config.js", "postcss.config.js", "next.config.js",
    "README.md", "CHANGELOG.md", "LICENSE", "CONTRIBUTING.md",
}

# Skip files by extension (blacklist)
SKIP_EXTENSIONS = {
    ".lock", ".log", ".map", ".min.js", ".min.css",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
    ".mp4", ".mp3", ".avi", ".mov", ".wav",
    ".pyc", ".pyo", ".pyd", ".so", ".dylib", ".dll", ".exe",
    ".bin", ".dat", ".db", ".sqlite", ".sqlite3",
    ".parquet", ".csv", ".xlsx", ".xls",
}

# Whitelist: only scan these extensions (more reliable than blacklist alone)
SCAN_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
    ".java", ".kt", ".go", ".rb", ".php", ".cs", ".cpp", ".c", ".h",
    ".rs", ".swift", ".scala", ".sh", ".bash", ".zsh",
    ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
    ".env.example", ".env.sample", ".env.template",
    ".tf", ".hcl",   # terraform
}

# Entropy: only extract string tokens inside quotes on assignment-like lines
ENTROPY_TOKEN_RE = re.compile(r"""[\"']([A-Za-z0-9+/=_\-]{20,200})[\"']""")


# ─── Shannon Entropy ──────────────────────────────────────────────────────────

def shannon_entropy(s: str) -> float:
    """Compute Shannon entropy of a string."""
    if not s:
        return 0
    length = len(s)
    freq = {c: s.count(c) / length for c in set(s)}
    return -sum(p * math.log2(p) for p in freq.values())


# ─── File Filtering ──────────────────────────────────────────────────────────

def should_skip(path: str, filename: str) -> bool:
    """Check if a file should be skipped based on name and extension."""
    ext = os.path.splitext(filename)[1].lower()
    # check multi-part extensions like .min.js
    if filename.endswith((".min.js", ".min.css", ".d.ts")):
        return True
    return (
        filename in SKIP_FILENAMES
        or ext in SKIP_EXTENSIONS
        or filename.startswith(".")   # hidden files like .DS_Store
    )


def _is_scannable_ext(filename: str) -> bool:
    """Check if file extension is in the scan whitelist."""
    ext = os.path.splitext(filename)[1].lower()
    if ext in SCAN_EXTENSIONS:
        return True
    # Handle compound extensions like .env.example
    for scan_ext in SCAN_EXTENSIONS:
        if filename.endswith(scan_ext):
            return True
    return False


# ─── File Walking ─────────────────────────────────────────────────────────────

def collect_files(repo_path: str) -> list[str]:
    """Walk repo and collect scannable file paths with all guards applied."""
    files = []
    scanned = 0

    for root, dirs, filenames in os.walk(repo_path):
        # BUG 1 FIX: Prune skip dirs in-place so os.walk never descends
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]

        for fname in filenames:
            if scanned >= MAX_FILES_TO_SCAN:
                break

            # Skip by name/extension (blacklist)
            if should_skip(root, fname):
                continue

            # Skip if extension not in whitelist
            if not _is_scannable_ext(fname):
                continue

            full = os.path.join(root, fname)

            # BUG 2 FIX: Hard file size limit
            try:
                if os.path.getsize(full) > MAX_FILE_SIZE_BYTES:
                    continue
            except OSError:
                continue

            files.append(full)
            scanned += 1

        if scanned >= MAX_FILES_TO_SCAN:
            break

    return files


# ─── Git Clone ────────────────────────────────────────────────────────────────

def clone_repo(url: str) -> str:
    """Clone a git repo with depth=1 into a temp directory."""
    tmp = tempfile.mkdtemp(prefix="envsheriff_")
    print(f"[SHERIFF] Cloning {url} → {tmp}")
    result = subprocess.run(
        ["git", "clone", "--depth=1", url, tmp],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Git clone failed: {result.stderr.strip()}")
    return tmp


# ─── Scanner Workers ──────────────────────────────────────────────────────────

def _truncate_context(line: str) -> str:
    """Truncate context line at creation time for memory efficiency."""
    if len(line) > MAX_CONTEXT_LENGTH:
        return line[:MAX_CONTEXT_LENGTH] + "..."
    return line


def _truncate_match(match: str) -> str:
    """Truncate matched string at creation time for memory efficiency."""
    if len(match) > MAX_MATCH_LENGTH:
        return match[:MAX_MATCH_LENGTH] + "..."
    return match


def _read_file_sync(filepath: str) -> str:
    """Read file content synchronously (for use in thread pool)."""
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


async def regex_scanner(
    files: list[str],
    repo_path: str,
    queue: asyncio.Queue,
    semaphore: asyncio.Semaphore,
):
    """Regex Scanner: match known secret patterns with concurrent file reads."""

    async def scan_one(filepath: str):
        async with semaphore:
            try:
                rel = os.path.relpath(filepath, repo_path).replace("\\", "/")
                # BUG 2 FIX: Read file in thread pool, not main event loop
                content = await asyncio.to_thread(_read_file_sync, filepath)
                for line_num, line in enumerate(content.splitlines(), start=1):
                    if len(line) > 2000:   # skip minified lines
                        continue
                    for pattern_name, compiled in COMPILED_PATTERNS.items():
                        for m in compiled.finditer(line):
                            matched = m.group(0)
                            col = m.start() + 1
                            finding = RawFinding(
                                file=rel,
                                line=line_num,
                                column=col,
                                match=_truncate_match(matched),
                                pattern_name=pattern_name,
                                entropy=shannon_entropy(matched),
                                context=_truncate_context(line.rstrip()),
                            )
                            await queue.put(finding)
                del content   # BUG 3 FIX: explicit free
            except Exception as e:
                print(f"[SHERIFF REGEX] Error scanning {filepath}: {e}")

    tasks = [scan_one(fp) for fp in files]
    await asyncio.gather(*tasks)


def _extract_entropy_tokens(line: str) -> list[str]:
    """
    BUG 2 FIX: Tighten entropy scan scope.
    Only extract quoted string tokens on assignment-like lines.
    Skip comment lines entirely.
    """
    stripped = line.lstrip()
    # Skip comments
    if stripped.startswith("#") or stripped.startswith("//"):
        return []
    # Only run on lines with assignment/mapping operators or quotes
    if not any(c in line for c in ("=", ":", '"', "'")):
        return []
    return ENTROPY_TOKEN_RE.findall(line)


async def entropy_scanner(
    files: list[str],
    repo_path: str,
    queue: asyncio.Queue,
    semaphore: asyncio.Semaphore,
):
    """Entropy Scanner: flag high-entropy quoted strings with concurrent reads."""

    async def scan_one(filepath: str):
        async with semaphore:
            try:
                rel = os.path.relpath(filepath, repo_path).replace("\\", "/")
                # BUG 2 FIX: Read file in thread pool
                content = await asyncio.to_thread(_read_file_sync, filepath)
                for line_num, line in enumerate(content.splitlines(), start=1):
                    if len(line) > 2000:   # skip minified lines
                        continue
                    # BUG 2 FIX: Only extract quoted tokens on relevant lines
                    tokens = _extract_entropy_tokens(line)
                    for token in tokens:
                        if len(token) < 20:
                            continue
                        ent = shannon_entropy(token)
                        if ent > 4.5:
                            # Skip non-secret URLs without credentials
                            if token.startswith(("http://", "https://")):
                                if "@" not in token:
                                    continue
                            finding = RawFinding(
                                file=rel,
                                line=line_num,
                                column=line.find(token) + 1,
                                match=_truncate_match(token),
                                pattern_name="high_entropy",
                                entropy=ent,
                                context=_truncate_context(line.rstrip()),
                            )
                            await queue.put(finding)
                del content   # BUG 3 FIX: explicit free
            except Exception as e:
                print(f"[SHERIFF ENTROPY] Error scanning {filepath}: {e}")

    tasks = [scan_one(fp) for fp in files]
    await asyncio.gather(*tasks)


# ─── LLM Classification ──────────────────────────────────────────────────────

async def classify_batch(findings: list[RawFinding]) -> list[dict]:
    """Classify a batch of findings via LLM."""
    batch_data = [
        {
            "index": i,
            "file": f.file,
            "line": f.line,
            "match": f.match,
            "pattern_name": f.pattern_name,
            "entropy": round(f.entropy, 2),
        }
        for i, f in enumerate(findings)
    ]

    prompt = f"""Classify each finding as: REAL_SECRET | FALSE_POSITIVE | NEEDS_REVIEW

Rules:
- REAL_SECRET: actual credential, key, or password that would grant access
- FALSE_POSITIVE: example value, placeholder, test fixture, documentation
- NEEDS_REVIEW: ambiguous — could be real or example

Findings:
{json.dumps(batch_data, indent=2)}

Respond ONLY with JSON array:
[{{"index": 0, "classification": "REAL_SECRET", "reason": "one sentence", "rotate_immediately": true}}]"""

    try:
        response = await get_completion(
            prompt,
            model_key="reasoning",
            max_tokens=256,       # BUG 2 FIX: reduced from 1024 — classification output is tiny
            temperature=0.1,
        )
        # Clean response
        clean = re.sub(r"```[a-z]*\n?", "", response).strip().strip("`").strip()
        match = re.search(r'\[.*\]', clean, re.DOTALL)
        if match:
            return json.loads(match.group(0))
    except Exception as e:
        print(f"[SHERIFF LLM] Classification failed: {e}")

    # Fallback: mark all as NEEDS_REVIEW
    return [
        {
            "index": i,
            "classification": "NEEDS_REVIEW",
            "reason": "LLM classification unavailable",
            "rotate_immediately": False,
        }
        for i in range(len(findings))
    ]


async def classify_all_findings(findings: list[RawFinding]) -> list[SecretFinding]:
    """Batch-classify all findings, 8 at a time with concurrent LLM calls."""
    if not findings:
        return []

    # BUG 2 FIX: Split into batches of 8 (was 3)
    batches = [findings[i:i + BATCH_SIZE] for i in range(0, len(findings), BATCH_SIZE)]

    results: list[SecretFinding] = []

    async def process_batch(batch: list[RawFinding]):
        classifications = await classify_batch(batch)
        batch_results = []
        for i, finding in enumerate(batch):
            # Find matching classification
            cls = next(
                (c for c in classifications if c.get("index") == i),
                {
                    "classification": "NEEDS_REVIEW",
                    "reason": "No classification returned",
                    "rotate_immediately": False,
                }
            )
            # Truncate match preview for frontend safety
            preview = finding.match[:20] + "..." if len(finding.match) > 20 else finding.match
            batch_results.append(SecretFinding(
                file=finding.file,
                line=finding.line,
                column=finding.column,
                match_preview=preview,
                pattern_name=finding.pattern_name,
                entropy=round(finding.entropy, 2),
                classification=cls.get("classification", "NEEDS_REVIEW"),
                reason=cls.get("reason", ""),
                rotate_immediately=cls.get("rotate_immediately", False),
            ))
        return batch_results

    # BUG 2 FIX: Process CONCURRENT_BATCHES concurrent batch calls at a time
    for chunk_start in range(0, len(batches), CONCURRENT_BATCHES):
        chunk = batches[chunk_start:chunk_start + CONCURRENT_BATCHES]
        batch_tasks = [process_batch(b) for b in chunk]
        chunk_results = await asyncio.gather(*batch_tasks)
        for br in chunk_results:
            results.extend(br)

    return results


# ─── .env.example Generation ─────────────────────────────────────────────────

async def generate_env_example(findings: list[SecretFinding]) -> str:
    """Generate a .env.example from found env var names."""
    # Extract env var names from hardcoded_token / hardcoded_password patterns
    var_names = set()
    for f in findings:
        if f.pattern_name in ("hardcoded_token", "hardcoded_password"):
            # Try to extract the variable name from context or match
            m = re.match(r"(?i)([\w]+)\s*=", f.match_preview)
            if m:
                var_names.add(m.group(1).upper())
        # Also extract from other pattern names
        if f.pattern_name == "aws_access_key":
            var_names.add("AWS_ACCESS_KEY_ID")
        elif f.pattern_name == "aws_secret_key":
            var_names.add("AWS_SECRET_ACCESS_KEY")
        elif f.pattern_name == "openai_key":
            var_names.add("OPENAI_API_KEY")
        elif f.pattern_name == "stripe_key":
            var_names.add("STRIPE_SECRET_KEY")
        elif f.pattern_name == "google_api_key":
            var_names.add("GOOGLE_API_KEY")
        elif f.pattern_name == "github_token":
            var_names.add("GITHUB_TOKEN")
        elif f.pattern_name == "jwt_secret":
            var_names.add("JWT_SECRET")
        elif f.pattern_name == "db_connection":
            var_names.add("DATABASE_URL")

    if not var_names:
        return "# No environment variables detected\n"

    var_list = ", ".join(sorted(var_names))
    prompt = f"""Given these environment variable names found in a codebase: [{var_list}]
Generate a clean .env.example file with placeholder values and inline comments describing what each variable is for.
Format: KEY=your_value_here  # description

Respond with ONLY the .env.example content, no explanations or markdown fences."""

    try:
        response = await get_completion(
            prompt,
            model_key="reasoning",
            max_tokens=512,
            temperature=0.2,
        )
        clean = re.sub(r"```[a-z]*\n?", "", response).strip().strip("`").strip()
        if clean:
            return clean
    except Exception as e:
        print(f"[SHERIFF] .env.example generation failed: {e}")

    # Fallback: generate manually
    lines = []
    for var in sorted(var_names):
        lines.append(f"{var}=your_value_here  # TODO: set this")
    return "\n".join(lines) + "\n"


# ─── Remediation Plan Generation ─────────────────────────────────────────────

async def generate_remediation(real_secrets: list[SecretFinding]) -> str:
    """Generate a remediation checklist from confirmed secrets."""
    if not real_secrets:
        return "✅ No confirmed secrets found. Your codebase looks clean!"

    findings_data = json.dumps([
        {
            "file": s.file,
            "line": s.line,
            "pattern_name": s.pattern_name,
            "match_truncated": s.match_preview,
        }
        for s in real_secrets
    ], indent=2)

    prompt = f"""Given these confirmed secret leaks in a git repository:
{findings_data}

Generate a numbered remediation checklist ordered by severity. For each:
1. What to rotate/revoke immediately
2. How to move it to environment variables
3. How to add to .gitignore

Also estimate exposure window if possible (check if file was ever committed).
Be concise. Max 3 sentences per item.

Respond with ONLY the checklist, no explanations."""

    try:
        response = await get_completion(
            prompt,
            model_key="reasoning",
            max_tokens=1024,
            temperature=0.2,
        )
        clean = re.sub(r"```[a-z]*\n?", "", response).strip().strip("`").strip()
        if clean:
            return clean
    except Exception as e:
        print(f"[SHERIFF] Remediation generation failed: {e}")

    # Fallback
    lines = []
    for i, s in enumerate(real_secrets, 1):
        lines.append(
            f"{i}. [{s.pattern_name}] {s.file}:{s.line} — "
            f"Rotate this credential immediately. Move to .env file. "
            f"Add .env to .gitignore."
        )
    return "\n".join(lines)


# ─── Exposure Risk Calculator ────────────────────────────────────────────────

def calculate_exposure_risk(findings: list[SecretFinding]) -> str:
    """Calculate overall exposure risk level."""
    real = sum(1 for f in findings if f.classification == "REAL_SECRET")
    review = sum(1 for f in findings if f.classification == "NEEDS_REVIEW")

    has_private_key = any(
        f.pattern_name == "private_key_block" and f.classification == "REAL_SECRET"
        for f in findings
    )
    has_db_connection = any(
        f.pattern_name == "db_connection" and f.classification == "REAL_SECRET"
        for f in findings
    )

    if real >= 5 or has_private_key or has_db_connection:
        return "CRITICAL"
    elif real >= 3:
        return "HIGH"
    elif real >= 1 or review >= 3:
        return "MEDIUM"
    else:
        return "LOW"


# ─── Status Callback Type ────────────────────────────────────────────────────

# The job runner passes a status_callback so the router can update status
StatusCallback = Optional[callable]


# ─── Main Pipeline ────────────────────────────────────────────────────────────

async def run_sheriff_pipeline(
    repo_url: str,
    status_cb=None,
) -> EnvSheriffReport:
    """
    Full EnvSheriff pipeline:
      clone → scan → classify → generate → report
    """
    repo_path = None

    def _update_status(status: str):
        if status_cb:
            status_cb(status)

    try:
        # 1. Clone
        _update_status("scanning")
        repo_path = await asyncio.to_thread(clone_repo, repo_url)

        # 2. Collect scannable files (with all guards applied)
        all_files = await asyncio.to_thread(collect_files, repo_path)
        total_files = len(all_files)
        print(f"[SHERIFF] Found {total_files} scannable files (max {MAX_FILES_TO_SCAN})")

        # 3. BUG 2 FIX: Semaphore for 6 concurrent scanner workers (was 2)
        semaphore = asyncio.Semaphore(SCANNER_SEMAPHORE)

        # 4. BUG 3 FIX: Queue with backpressure — scanner blocks if consumer too slow
        findings_queue: asyncio.Queue = asyncio.Queue(maxsize=200)

        # 5. Run both scanners concurrently with shared semaphore
        # BUG 3 FIX: Use producer/consumer pattern instead of gather-all
        raw_findings: list[RawFinding] = []
        scan_done = asyncio.Event()

        async def run_scanners():
            """Producer: run regex + entropy scanners concurrently."""
            await asyncio.gather(
                regex_scanner(all_files, repo_path, findings_queue, semaphore),
                entropy_scanner(all_files, repo_path, findings_queue, semaphore),
            )
            scan_done.set()

        async def consume_findings():
            """Consumer: drain queue as scanners produce findings."""
            while True:
                try:
                    finding = await asyncio.wait_for(findings_queue.get(), timeout=0.5)
                    raw_findings.append(finding)
                except asyncio.TimeoutError:
                    if scan_done.is_set() and findings_queue.empty():
                        break

        await asyncio.gather(run_scanners(), consume_findings())

        # Deduplicate by (file, line, match)
        seen = set()
        deduped: list[RawFinding] = []
        for f in raw_findings:
            key = (f.file, f.line, f.match)
            if key not in seen:
                seen.add(key)
                deduped.append(f)
        raw_findings = deduped
        del seen, deduped   # free memory

        print(f"[SHERIFF] Found {len(raw_findings)} raw findings (deduped)")

        # 6. LLM Classification
        _update_status("classifying")
        classified = await classify_all_findings(raw_findings)
        del raw_findings   # free memory — no longer needed

        # 7. Generate .env.example
        _update_status("generating")
        env_example = await generate_env_example(classified)

        # 8. Generate remediation plan
        real_secrets = [f for f in classified if f.classification == "REAL_SECRET"]
        remediation = await generate_remediation(real_secrets)

        # 9. Calculate stats
        real_count = sum(1 for f in classified if f.classification == "REAL_SECRET")
        fp_count = sum(1 for f in classified if f.classification == "FALSE_POSITIVE")
        review_count = sum(1 for f in classified if f.classification == "NEEDS_REVIEW")
        exposure_risk = calculate_exposure_risk(classified)

        # 10. Build report
        return EnvSheriffReport(
            repo_url=repo_url,
            scanned_files=total_files,
            total_findings=len(classified),
            real_secrets=real_count,
            false_positives=fp_count,
            needs_review=review_count,
            findings=classified,
            env_example=env_example,
            remediation_checklist=remediation,
            analyzed_at=datetime.now(timezone.utc).isoformat(),
            exposure_risk=exposure_risk,
        )

    finally:
        if repo_path and os.path.exists(repo_path):
            shutil.rmtree(repo_path, ignore_errors=True)
