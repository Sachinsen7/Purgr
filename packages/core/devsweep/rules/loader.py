import yaml
from pathlib import Path
from typing import Dict, List

from ..models import ToolRules


def load_rules(rules_dir: Path | None = None) -> Dict[str, ToolRules]:
    if rules_dir is None:
        # Default to rules directory relative to this file
        rules_dir = Path(__file__).parent.parent / "rules"
    
    rules = {}
    
    for yaml_file in rules_dir.glob("*.yaml"):
        try:
            with open(yaml_file, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            
            tool_rules = ToolRules(**data)
            rules[tool_rules.tool] = tool_rules
            
        except Exception as e:
            # Log error but continue loading other rules
            import structlog
            logger = structlog.get_logger()
            logger.error(
                "Failed to load rule file",
                file=str(yaml_file),
                error=str(e),
            )
    
    return rules


def get_matching_rules(
    file_path: Path,
    tool_rules: ToolRules,
) -> List[tuple[str, int, str | None]]:
    """
    Returns list of (description, score_adjustment, classification_override)
    for rules that match the file path.
    """
    import re
    matches = []
    normalized_path = str(file_path).replace("\\", "/")
    
    for rule in tool_rules.rules:
        try:
            if re.search(rule.pattern, normalized_path):
                matches.append((
                    rule.description,
                    rule.score_adjustment,
                    rule.classification_override,
                ))
        except re.error:
            continue  # Skip invalid regex patterns
    
    return matches
