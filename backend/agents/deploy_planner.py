import os
from models.schemas import RepoAnalysis

async def plan_deployment(analysis: RepoAnalysis) -> dict:
    """
    Plans the deployment strategy based on the repository analysis.
    For MVP, we use a simple Docker-based approach for Node.js apps.
    """
    # Define basic docker commands based on package manager
    pm = analysis.package_manager
    install_cmd = f"{pm} install" if pm != "yarn" else "yarn install"
    
    # Simple build command if nextjs
    build_cmd = f"{pm} run build" if analysis.framework == "nextjs" else None
    
    # Start command
    if analysis.framework == "nextjs":
        start_cmd = f"{pm} run start"
    else:
        # Express or standard node
        start_cmd = f"node {analysis.entry_point}"
        
    return {
        "framework": analysis.framework,
        "package_manager": pm,
        "install_command": install_cmd,
        "build_command": build_cmd,
        "start_command": start_cmd,
        "port": 3000 if analysis.framework == "nextjs" else 8080
    }
