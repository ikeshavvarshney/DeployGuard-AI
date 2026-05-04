from pydantic import BaseModel
from typing import Optional, List, Dict
from enum import Enum

class JobStatus(str, Enum):
    QUEUED = "queued"
    ANALYZING = "analyzing"
    DEPLOYING = "deploying"
    MUTATING = "mutating"
    GENERATING_TESTS = "generating_tests"
    VERIFYING = "verifying"
    FIXING = "fixing"
    REDEPLOYING = "redeploying"
    COMPLETE = "complete"
    FAILED = "failed"

class RepoInput(BaseModel):
    github_url: str
    branch: str = "main"

class RepoAnalysis(BaseModel):
    framework: str
    test_framework: str
    entry_point: str
    package_manager: str
    has_tests: bool
    test_files: List[str]
    source_files: List[str]
    repo_path: str = ""

class Mutant(BaseModel):
    id: str
    file: str
    line: int
    original: str
    mutated: str
    status: str
    mutation_type: str

class GeneratedTest(BaseModel):
    mutant_id: str
    test_code: str
    confidence: float
    verified: bool = False
    kills_mutant: bool = False

class VerificationResult(BaseModel):
    test_id: str
    agent_votes: List[bool]
    majority_vote: bool
    confidence: float

class ReliabilityReport(BaseModel):
    job_id: str
    repo_url: str
    deployment_url: Optional[str]
    initial_mutation_score: float
    final_mutation_score: float
    total_mutants: int
    survived_before: int
    survived_after: int
    tests_generated: int
    tests_verified: int
    confidence: str
    issues_fixed: List[str]

class PipelineEvent(BaseModel):
    job_id: str
    stage: JobStatus
    message: str
    data: Optional[dict] = None
    timestamp: float

# ─── Dependency Analyzer ──────────────────────────────────────────────────────

class Dependency(BaseModel):
    name: str
    installed_version: str
    declared_version: str
    latest_version: str
    is_outdated: bool
    ecosystem: str          # "npm" | "pip"
    is_dev: bool
    sub_dependencies: List[str] = []   # names only at this stage

class DependencyResult(BaseModel):
    name: str
    installed_version: str
    declared_version: str
    latest_version: str
    is_outdated: bool
    ecosystem: str
    is_dev: bool
    sub_dependencies: List["DependencyResult"] = []
    urgency: str            # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
    reason: str
    update_command: Optional[str] = None

class UpdateCommand(BaseModel):
    name: str
    ecosystem: str
    command: str

class DependencyReport(BaseModel):
    repo_url: str
    frontend_deps: List[DependencyResult]
    backend_deps: List[DependencyResult]
    total_outdated: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    update_commands: List[UpdateCommand]
    analyzed_at: str

# ─── EnvSheriff — Secret Leak Detector ─────────────────────────────────────────

class RawFinding(BaseModel):
    file: str           # relative path
    line: int
    column: int
    match: str          # the actual matched string (truncated to 60 chars for safety)
    pattern_name: str   # "aws_access_key" | "high_entropy" | "hardcoded_password" etc
    entropy: float      # shannon entropy of the matched value
    context: str        # surrounding line (sanitized)

class SecretFinding(BaseModel):
    file: str
    line: int
    column: int
    match_preview: str      # first 20 chars + "..."
    pattern_name: str
    entropy: float
    classification: str     # "REAL_SECRET" | "FALSE_POSITIVE" | "NEEDS_REVIEW"
    reason: str
    rotate_immediately: bool

class EnvSheriffReport(BaseModel):
    repo_url: str
    scanned_files: int
    total_findings: int
    real_secrets: int
    false_positives: int
    needs_review: int
    findings: List[SecretFinding]
    env_example: str        # full .env.example content
    remediation_checklist: str
    analyzed_at: str
    exposure_risk: str      # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

# ─── PR Risk Scorer ────────────────────────────────────────────────────────────

class DeterministicSummary(BaseModel):
    files_changed: int
    lines_added: int
    lines_deleted: int
    net_lines: int
    commits_count: int
    contributors: List[str]
    test_files_changed: int
    source_files_changed: int
    test_coverage_ratio: float
    new_dependencies: List[str]
    removed_dependencies: List[str]
    critical_files_touched: List[str]
    critical_files_score: int
    config_files_changed: int
    has_lockfile_change: bool
    largest_file_delta: int
    binary_files_changed: int
    file_types: Dict[str, int]

class PRFile(BaseModel):
    filename: str
    status: str
    additions: int
    deletions: int
    changes: int
    criticality_score: int
    patch_preview: str

class PRCommit(BaseModel):
    sha: str
    message: str
    author: str
    date: str

class PRContributor(BaseModel):
    login: str
    avatar_url: str
    commits: int
    additions: int
    deletions: int

class RiskFactor(BaseModel):
    factor: str
    severity: str
    detail: str

class PRRiskReport(BaseModel):
    pr_url: str
    pr_number: int
    pr_title: str
    pr_body: str
    pr_state: str
    base_branch: str
    head_branch: str
    created_at: str
    updated_at: str
    is_draft: bool
    mergeable: Optional[bool]
    author: PRContributor
    reviewers: List[str]
    assignees: List[str]
    files_changed: int
    lines_added: int
    lines_deleted: int
    commits_count: int
    comments_count: int
    files: List[PRFile]
    commits: List[PRCommit]
    contributors: List[PRContributor]
    critical_files: List[str]
    new_dependencies: List[str]
    test_coverage_ratio: float
    risk_score: int
    verdict: str
    confidence: str
    reasons: List[str]
    risk_factors: List[RiskFactor]
    suggestions: List[str]
    raw_llm_output: str = ""         # exact string returned by LLM before parsing
    tokens_used: int = 0             # estimated total tokens
    prompt_tokens: int = 0           # estimated prompt tokens
    response_tokens: int = 0         # estimated response tokens
    merge_url: str
    analyzed_at: str

class PRListItem(BaseModel):
    pr_number: int
    title: str
    state: str               # "open" | "closed" | "merged"
    is_draft: bool
    author: str
    author_avatar: str
    created_at: str
    updated_at: str
    base_branch: str
    head_branch: str
    pr_url: str
    comments: int
    review_comments: int = 0
    commits: int
    additions: int
    deletions: int
    changed_files: int
    mergeable: Optional[bool] = None