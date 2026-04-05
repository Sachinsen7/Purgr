"""AI advisor for cleanup recommendations using litellm."""

import json
from typing import Any

import litellm
from litellm import completion

from ..config.settings import get_settings
from ..models import AIAdvice, ScoredItem
from .memory import MemoryManager
from .prompts import CLEANUP_ADVICE_TEMPLATE, LEARN_PATTERN_TEMPLATE


class AIAdvisor:
    """AI-powered advisor for cleanup recommendations."""

    def __init__(self) -> None:
        self.config = get_settings()
        self.memory = MemoryManager()
        # Configure litellm for local Ollama
        litellm.set_verbose = False  # Disable verbose logging

    async def get_advice(self, item: ScoredItem) -> AIAdvice:
        """Get AI advice for a scored item."""
        # Get similar patterns from memory
        similar_patterns = await self.memory.get_similar_patterns(str(item.entry.path))

        # Prepare context
        context = {
            "entry": item.entry,
            "classification": item.classification,
            "total_score": item.total_score,
            "signals": item.signals,
            "rules": [],  # Would be populated if we had rule matches
            "memory_patterns": [
                {"action": p.action, "reason": p.reason} for p in similar_patterns
            ],
        }

        # Render prompt
        prompt = CLEANUP_ADVICE_TEMPLATE.render(**context)

        try:
            # Call Ollama via litellm
            response = completion(
                model="ollama/llama2",  # Assuming llama2 is available
                messages=[{"role": "user", "content": prompt}],
                api_base="http://localhost:11434",  # Default Ollama port
                max_tokens=200,
                temperature=0.3,  # Lower temperature for consistent advice
            )

            advice_text = response.choices[0].message.content

            # Parse the response
            advice = self._parse_advice(advice_text)

            # Learn from this item if possible
            await self._learn_pattern(item, advice)

            return advice

        except Exception as e:
            # Fallback to rule-based advice if AI fails
            return self._fallback_advice(item)

    def _parse_advice(self, response_text: str) -> AIAdvice:
        """Parse AI response into structured advice."""
        text = response_text.lower().strip()

        # Extract recommendation
        if "delete" in text and "keep" not in text:
            recommendation = "delete"
        elif "keep" in text and "delete" not in text:
            recommendation = "keep"
        else:
            recommendation = "review"

        # Extract confidence (simple heuristic)
        confidence = 0.7  # Default
        if "confident" in text or "certain" in text:
            confidence = 0.9
        elif "unsure" in text or "maybe" in text:
            confidence = 0.5

        # Extract explanation (first sentence or so)
        lines = response_text.split("\n")
        explanation = lines[0] if lines else response_text[:100]

        return AIAdvice(
            recommendation=recommendation,
            confidence=confidence,
            explanation=explanation,
            reasoning_signals=["ai_analysis"],
            similar_patterns=[],
        )

    async def _learn_pattern(self, item: ScoredItem, advice: AIAdvice) -> None:
        """Learn a pattern from the AI advice."""
        if advice.confidence < 0.8:
            return  # Only learn from confident advice

        # Generate a simple pattern based on file path
        path_str = str(item.entry.path)
        # Simple pattern: match file extension and some path elements
        if "." in path_str:
            ext = path_str.split(".")[-1]
            pattern = f".*\\.{ext}$"
        else:
            # For directories or extensionless files
            parts = path_str.split("/")
            if len(parts) > 1:
                pattern = f".*/{parts[-2]}/.*" if len(parts) > 2 else f".*/{parts[-1]}"
            else:
                pattern = ".*"

        try:
            await self.memory.store_pattern(
                pattern=pattern,
                action=advice.recommendation,
                confidence=advice.confidence,
                reason=f"AI learned: {advice.explanation}",
            )
        except Exception:
            # Ignore learning failures
            pass

    def _fallback_advice(self, item: ScoredItem) -> AIAdvice:
        """Provide rule-based fallback advice when AI is unavailable."""
        # Simple rule-based logic
        if item.total_score >= 80:
            recommendation = "delete"
            confidence = 0.8
            explanation = "High score indicates safe to delete"
        elif item.total_score <= 20:
            recommendation = "keep"
            confidence = 0.8
            explanation = "Low score indicates should keep"
        else:
            recommendation = "review"
            confidence = 0.6
            explanation = "Medium score requires manual review"

        return AIAdvice(
            recommendation=recommendation,
            confidence=confidence,
            explanation=explanation,
            reasoning_signals=["fallback_rules"],
            similar_patterns=[],
        )

    async def learn_from_user_action(
        self,
        item: ScoredItem,
        user_action: str,
        user_reason: str = "",
    ) -> None:
        """Learn from user's actual action on an item."""
        # Use AI to extract a pattern from the user's decision
        context = {
            "entry": item.entry,
            "action": user_action,
            "user_reason": user_reason,
            "classification": item.classification,
            "total_score": item.total_score,
            "signals": item.signals,
        }

        prompt = LEARN_PATTERN_TEMPLATE.render(**context)

        try:
            response = completion(
                model="ollama/llama2",
                messages=[{"role": "user", "content": prompt}],
                api_base="http://localhost:11434",
                max_tokens=300,
                temperature=0.1,  # Low temperature for consistent patterns
            )

            result_text = response.choices[0].message.content

            # Try to parse JSON from response
            try:
                pattern_data = json.loads(result_text)
                await self.memory.store_pattern(
                    pattern=pattern_data.get("pattern", ".*"),
                    action=pattern_data.get("action", user_action),
                    confidence=min(pattern_data.get("confidence", 0.5), 1.0),
                    reason=pattern_data.get("reason", user_reason),
                )
            except json.JSONDecodeError:
                # If JSON parsing fails, create a simple pattern
                path_str = str(item.entry.path)
                pattern = (
                    f".*{path_str.split('/')[-1]}$"
                    if "/" in path_str
                    else f".*{path_str}$"
                )
                await self.memory.store_pattern(
                    pattern=pattern,
                    action=user_action,
                    confidence=0.6,
                    reason=user_reason or "User action",
                )

        except Exception:
            # Fallback: store simple pattern
            path_str = str(item.entry.path)
            pattern = (
                f".*{path_str.split('/')[-1]}$" if "/" in path_str else f".*{path_str}$"
            )
            await self.memory.store_pattern(
                pattern=pattern,
                action=user_action,
                confidence=0.5,
                reason=user_reason or "Fallback learning",
            )
