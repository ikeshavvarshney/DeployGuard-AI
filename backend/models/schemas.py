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
