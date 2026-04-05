"""Unit tests for AI components."""

import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from devsweep.ai.advisor import AIAdvisor
from devsweep.ai.memory import MemoryManager
from devsweep.ai.prompts import PromptManager
from devsweep.db.models import LearnedPattern
from devsweep.models import AIAdvice, ScanEntry, ScoredItem, SignalResult


class TestPromptManager:
    """Test prompt template management."""

    def test_get_template(self):
        """Test template loading."""
        manager = PromptManager()
        # Should not raise if templates directory exists
        # (even if empty, it should handle gracefully)

    def test_render_embedded_template(self):
        """Test rendering embedded templates."""
        from devsweep.ai.prompts import CLEANUP_ADVICE_TEMPLATE

        context = {
            "entry": ScanEntry(
                path=Path("/test/file.txt"),
                size=1000,
                mtime=1234567890,
                is_dir=False,
                is_file=True,
                is_symlink=False,
            ),
            "classification": "optional",
            "total_score": 50,
            "signals": {"age": SignalResult(score=30, reason="old file")},
            "rules": [],
            "memory_patterns": [],
        }

        result = CLEANUP_ADVICE_TEMPLATE.render(**context)
        assert "file.txt" in result
        assert "optional" in result
        assert "50" in result


class TestMemoryManager:
    """Test pattern learning and memory."""

    @pytest.mark.asyncio
    async def test_store_pattern(self):
        """Test storing a new pattern."""
        manager = MemoryManager()

        pattern = LearnedPattern(
            pattern=r".*\.tmp$",
            action="delete",
            confidence=0.8,
            reason="Temporary files should be deleted",
        )

        # Mock session
        with patch("devsweep.ai.memory.get_session") as mock_session:
            mock_session.return_value.__aenter__ = AsyncMock()
            mock_session.return_value.__aexit__ = AsyncMock()
            mock_session.return_value.exec = AsyncMock(return_value=MagicMock())
            mock_session.return_value.exec.return_value.first = MagicMock(
                return_value=None
            )
            mock_session.return_value.add = MagicMock()
            mock_session.return_value.commit = AsyncMock()
            mock_session.return_value.refresh = AsyncMock()

            result = await manager.store_pattern(
                pattern.pattern, pattern.action, pattern.confidence, pattern.reason
            )

            assert result.pattern == pattern.pattern
            assert result.action == pattern.action

    @pytest.mark.asyncio
    async def test_find_matching_patterns(self):
        """Test finding patterns that match a file path."""
        manager = MemoryManager()

        with patch("devsweep.ai.memory.get_session") as mock_session:
            mock_patterns = [
                LearnedPattern(
                    pattern=r".*\.log$",
                    action="delete",
                    confidence=0.9,
                    reason="Log files",
                ),
                LearnedPattern(
                    pattern=r".*\.tmp$",
                    action="delete",
                    confidence=0.7,
                    reason="Temp files",
                ),
            ]
            mock_session.return_value.__aenter__ = AsyncMock()
            mock_session.return_value.__aexit__ = AsyncMock()
            mock_session.return_value.exec = AsyncMock(return_value=mock_patterns)

            matches = await manager.find_matching_patterns("/var/log/app.log")
            assert len(matches) == 1
            assert matches[0].pattern == r".*\.log$"

    @pytest.mark.asyncio
    async def test_record_application(self):
        """Test recording pattern application."""
        manager = MemoryManager()

        with patch("devsweep.ai.memory.get_session") as mock_session:
            mock_session.return_value.__aenter__ = AsyncMock()
            mock_session.return_value.__aexit__ = AsyncMock()
            mock_session.return_value.add = MagicMock()
            mock_session.return_value.commit = AsyncMock()
            mock_session.return_value.refresh = AsyncMock()
            mock_session.return_value.get = AsyncMock(
                return_value=LearnedPattern(
                    id=1,
                    pattern=".*",
                    action="keep",
                    confidence=0.8,
                    reason="test",
                    use_count=0,
                )
            )

            result = await manager.record_application(1, 1, "kept", True)
            assert result.pattern_id == 1
            assert result.user_agreed is True


class TestAIAdvisor:
    """Test AI advisor functionality."""

    @pytest.fixture
    def sample_item(self):
        """Create a sample scored item for testing."""
        return ScoredItem(
            entry=ScanEntry(
                path=Path("/test/old_cache.dat"),
                size=1000000,
                mtime=1234567890,
                is_dir=False,
                is_file=True,
                is_symlink=False,
            ),
            total_score=75,
            classification="optional",
            signals={
                "age": SignalResult(score=50, reason="Very old file"),
                "process": SignalResult(score=0, reason="Not in use"),
                "version": SignalResult(score=25, reason="No version match"),
            },
        )

    @pytest.mark.asyncio
    async def test_get_advice_with_mock_ai(self, sample_item):
        """Test getting advice with mocked AI response."""
        advisor = AIAdvisor()

        # Mock memory
        with patch.object(advisor.memory, "get_similar_patterns", return_value=[]):
            # Mock litellm completion
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[
                0
            ].message.content = "I recommend deleting this old cache file because it's very old and not in use."

            with patch("devsweep.ai.advisor.completion", return_value=mock_response):
                advice = await advisor.get_advice(sample_item)

                assert isinstance(advice, AIAdvice)
                assert advice.recommendation == "delete"
                assert advice.confidence > 0

    @pytest.mark.asyncio
    async def test_fallback_advice(self, sample_item):
        """Test fallback advice when AI fails."""
        advisor = AIAdvisor()

        # Mock memory and AI to fail
        with patch.object(
            advisor.memory, "get_similar_patterns", side_effect=Exception("DB error")
        ):
            with patch(
                "devsweep.ai.advisor.completion", side_effect=Exception("AI error")
            ):
                advice = await advisor.get_advice(sample_item)

                assert isinstance(advice, AIAdvice)
                assert advice.recommendation in ["keep", "delete", "review"]
                assert "fallback" in advice.reasoning_signals

    @pytest.mark.asyncio
    async def test_learn_from_user_action(self, sample_item):
        """Test learning from user actions."""
        advisor = AIAdvisor()

        # Mock AI response for pattern learning
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[
            0
        ].message.content = '{"pattern": ".*\\\\.dat$", "action": "delete", "confidence": 0.8, "reason": "Cache files are often safe to delete"}'

        with patch("devsweep.ai.advisor.completion", return_value=mock_response):
            with patch.object(advisor.memory, "store_pattern") as mock_store:
                await advisor.learn_from_user_action(
                    sample_item, "delete", "Old cache file"
                )

                mock_store.assert_called_once()
                args = mock_store.call_args[0]
                assert args[0] == ".*\\.dat$"  # pattern
                assert args[1] == "delete"  # action
