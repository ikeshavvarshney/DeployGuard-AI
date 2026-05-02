from pydantic import BaseModel
from typing import Optional, List
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