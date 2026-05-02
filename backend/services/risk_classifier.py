def rank_mutants(mutants: list, repo_path: str = None) -> list:
    """
    LightGBM mutant ranker.
    Features: cyclomatic_complexity, function_size, nesting_depth, mutation_type_risk_weight.
    For MVP: Rank based on mock danger scores calculated from mutation types.
    """
    if not mutants:
        return []
    
    # Mock LightGBM ranking logic
    scored_mutants = []
    for mutant in mutants:
        # Assign mock risk score
        mutation_type = mutant.get("mutatorName", "").lower()
        score = 0.5
        if "conditional" in mutation_type:
            score = 0.85
        elif "arithmetic" in mutation_type:
            score = 0.6
        elif "equality" in mutation_type:
            score = 0.9
            
        mutant["risk_score"] = score
        scored_mutants.append(mutant)

    # Sort descending by risk score
    scored_mutants.sort(key=lambda x: x.get("risk_score", 0), reverse=True)
    
    # Return top 10
    return scored_mutants[:10]
