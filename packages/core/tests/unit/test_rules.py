import tempfile
from pathlib import Path

from devsweep.rules.loader import load_rules, get_matching_rules


def test_load_rules():
    with tempfile.TemporaryDirectory() as tmpdir:
        rules_dir = Path(tmpdir)
        
        # Create a test rule file
        rule_file = rules_dir / "test.yaml"
        rule_file.write_text("""
tool: test
rules:
  - pattern: ".*\.tmp$"
    description: "Temporary files"
    score_adjustment: 30
""")
        
        rules = load_rules(rules_dir)
        
        assert "test" in rules
        assert rules["test"].tool == "test"
        assert len(rules["test"].rules) == 1
        assert rules["test"].rules[0].pattern == ".*\.tmp$"
        assert rules["test"].rules[0].score_adjustment == 30


def test_get_matching_rules():
    from devsweep.models import FileRule, ToolRules
    
    tool_rules = ToolRules(
        tool="test",
        rules=[
            FileRule(
                pattern=r".*\.tmp$",
                description="Temp files",
                score_adjustment=30,
            ),
            FileRule(
                pattern=r"cache/.*",
                description="Cache files",
                score_adjustment=20,
            ),
        ],
    )
    
    # Test matching temp file
    matches = get_matching_rules(Path("/path/file.tmp"), tool_rules)
    assert len(matches) == 1
    assert matches[0][0] == "Temp files"
    assert matches[0][1] == 30
    
    # Test matching cache file
    matches = get_matching_rules(Path("/cache/old.dat"), tool_rules)
    assert len(matches) == 1
    assert matches[0][0] == "Cache files"
    assert matches[0][1] == 20
    
    # Test no match
    matches = get_matching_rules(Path("/normal/file.txt"), tool_rules)
    assert len(matches) == 0


def test_load_default_rules():
    # Test loading from default rules directory
    rules = load_rules()
    
    # Should load the 4 default rules
    expected_tools = {"vscode", "android", "python", "node"}
    assert set(rules.keys()) == expected_tools
    
    for tool in expected_tools:
        assert rules[tool].tool == tool
        assert len(rules[tool].rules) > 0
