"""Pattern learning and memory management for AI advisor."""

import re
from typing import Optional

from sqlmodel import select

from ..db.session import get_session
from ..db.models import LearnedPattern, PatternApplication


class MemoryManager:
    """Manages learned cleanup patterns from user behavior."""

    async def _open_session(self):
        session_or_manager = get_session()
        if hasattr(session_or_manager, "exec"):
            return session_or_manager, None

        session = await session_or_manager.__aenter__()
        return session, session_or_manager

    async def store_pattern(
        self,
        pattern: str,
        action: str,
        confidence: float,
        reason: str,
    ) -> LearnedPattern:
        """Store a new learned pattern."""
        session, manager = await self._open_session()
        try:
            # Check if pattern already exists
            existing = await session.exec(
                select(LearnedPattern).where(LearnedPattern.pattern == pattern)
            )
            existing_pattern = existing.first()

            if existing_pattern:
                # Update existing pattern
                existing_pattern.action = action
                existing_pattern.confidence = confidence
                existing_pattern.reason = reason
                existing_pattern.last_used = (
                    existing_pattern.created_at
                )  # Will be updated
                session.add(existing_pattern)
                await session.commit()
                await session.refresh(existing_pattern)
                return existing_pattern
            else:
                # Create new pattern
                new_pattern = LearnedPattern(
                    pattern=pattern,
                    action=action,
                    confidence=confidence,
                    reason=reason,
                )
                session.add(new_pattern)
                await session.commit()
                await session.refresh(new_pattern)
                return new_pattern
        finally:
            if manager is not None:
                await manager.__aexit__(None, None, None)

    async def find_matching_patterns(self, file_path: str) -> list[LearnedPattern]:
        """Find patterns that match the given file path."""
        session, manager = await self._open_session()
        try:
            patterns = await session.exec(select(LearnedPattern))
            matching = []

            for pattern in patterns:
                try:
                    if re.search(pattern.pattern, file_path):
                        matching.append(pattern)
                except re.error:
                    # Skip invalid regex patterns
                    continue

            return matching
        finally:
            if manager is not None:
                await manager.__aexit__(None, None, None)

    async def record_application(
        self,
        pattern_id: int,
        result_id: int,
        actual_action: str,
        user_agreed: Optional[bool] = None,
    ) -> PatternApplication:
        """Record when a pattern was applied to a scan result."""
        session, manager = await self._open_session()
        try:
            application = PatternApplication(
                pattern_id=pattern_id,
                result_id=result_id,
                actual_action=actual_action,
                user_agreed=user_agreed,
            )
            session.add(application)

            # Update pattern statistics
            pattern = await session.get(LearnedPattern, pattern_id)
            if pattern:
                pattern.use_count += 1
                pattern.last_used = application.applied_at
                if user_agreed is not None:
                    # Update success rate (simple moving average)
                    if pattern.use_count == 1:
                        pattern.success_rate = 1.0 if user_agreed else 0.0
                    else:
                        pattern.success_rate = (
                            pattern.success_rate * (pattern.use_count - 1)
                            + (1.0 if user_agreed else 0.0)
                        ) / pattern.use_count
                session.add(pattern)

            await session.commit()
            await session.refresh(application)
            return application
        finally:
            if manager is not None:
                await manager.__aexit__(None, None, None)

    async def get_similar_patterns(
        self, file_path: str, limit: int = 5
    ) -> list[LearnedPattern]:
        """Get patterns similar to the given file path, ordered by confidence."""
        matching = await self.find_matching_patterns(file_path)
        # Sort by confidence and success rate
        matching.sort(key=lambda p: p.confidence * p.success_rate, reverse=True)
        return matching[:limit]

    async def cleanup_old_patterns(self, max_age_days: int = 365) -> int:
        """Remove patterns that haven't been used recently."""
        # This would be implemented if needed, but for now just return 0
        return 0
