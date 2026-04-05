"""Prompt template management for AI advisor."""

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, Template

from ..config.settings import get_settings


class PromptManager:
    """Manages prompt templates for AI advisor."""

    def __init__(self) -> None:
        config = get_settings()
        template_dir = Path(__file__).parent / "templates"
        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def get_template(self, name: str) -> Template:
        """Get a template by name."""
        return self.env.get_template(f"{name}.j2")

    def render(self, name: str, **kwargs: Any) -> str:
        """Render a template with given context."""
        template = self.get_template(name)
        return template.render(**kwargs)


# Embedded templates for common prompts
CLEANUP_ADVICE_TEMPLATE = Template(
    """
You are an AI assistant helping developers clean up their storage space.
Analyze the following file/directory information and provide cleanup advice.

File: {{ entry.path }}
Size: {{ entry.size }} bytes
Last modified: {{ entry.mtime }}
Type: {{ 'directory' if entry.is_dir else 'file' }}
Classification: {{ classification }}
Total score: {{ total_score }}

Signals:
{% for signal_name, signal in signals.items() %}
- {{ signal_name }}: {{ signal.score }} ({{ signal.reason }})
{% endfor %}

{% if rules %}
Applied rules:
{% for rule in rules %}
- {{ rule.pattern }}: {{ rule.description }} (adjustment: {{ rule.score_adjustment }})
{% endfor %}
{% endif %}

{% if memory_patterns %}
Similar patterns from your history:
{% for pattern in memory_patterns %}
- {{ pattern.action }}: {{ pattern.reason }}
{% endfor %}
{% endif %}

Provide a brief recommendation (keep/delete/review) with a short explanation.
Focus on developer productivity and storage efficiency.
""".strip()
)

LEARN_PATTERN_TEMPLATE = Template(
    """
Based on the user's action on this file, learn a cleanup pattern.

File: {{ entry.path }}
User action: {{ action }}
User reason: {{ user_reason }}

Classification: {{ classification }}
Score: {{ total_score }}

Signals: {{ signals | tojson }}

Extract a generalized pattern that could apply to similar files.
Return a JSON object with:
- pattern: regex pattern matching similar files
- action: recommended action (keep/delete/review)
- confidence: number 0-1
- reason: explanation
""".strip()
)
