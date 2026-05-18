from __future__ import annotations

import time
from enum import Enum
from typing import Callable, Optional

from pydantic import BaseModel, Field


class Phase(str, Enum):
    GREEN_A = "GREEN_A"
    ALL_RED_A_to_B = "ALL_RED_A_to_B"
    GREEN_B = "GREEN_B"
    ALL_RED_B_to_A = "ALL_RED_B_to_A"
    EMERGENCY = "EMERGENCY"
    MANUAL = "MANUAL"


# Phases that represent a clearance period between green phases.
_ALL_RED_PHASES = {Phase.ALL_RED_A_to_B, Phase.ALL_RED_B_to_A}

# Normal cycle transitions (excluding EMERGENCY / MANUAL).
_NORMAL_TRANSITIONS: dict[Phase, Phase] = {
    Phase.GREEN_A: Phase.ALL_RED_A_to_B,
    Phase.ALL_RED_A_to_B: Phase.GREEN_B,
    Phase.GREEN_B: Phase.ALL_RED_B_to_A,
    Phase.ALL_RED_B_to_A: Phase.GREEN_A,
}

# After EMERGENCY or MANUAL is released, return to a safe all-red phase.
_RELEASE_PHASE = Phase.ALL_RED_A_to_B


class PhaseState(BaseModel):
    ts: float = Field(description="Unix timestamp of this snapshot")
    phase: Phase
    phase_started_at: float
    phase_will_end_at: Optional[float] = Field(
        default=None,
        description="Scheduled end time; None when duration is adaptive",
    )
    reason: str


OnPhaseChange = Callable[[PhaseState], None]


class TrafficFSM:
    """Finite state machine for a reversible single-lane corridor.

    Normal cycle: GREEN_A -> ALL_RED_A_to_B -> GREEN_B -> ALL_RED_B_to_A -> GREEN_A
    EMERGENCY and MANUAL can be entered from any state and return to ALL_RED_A_to_B
    on release so the zone is always cleared before the next green phase.
    """

    def __init__(
        self,
        all_red_duration: float = 5.0,
        on_phase_change: Optional[OnPhaseChange] = None,
    ) -> None:
        self._all_red_duration = all_red_duration
        self._on_phase_change = on_phase_change

        now = time.time()
        self._phase = Phase.ALL_RED_A_to_B
        self._phase_started_at = now
        self._phase_will_end_at: Optional[float] = now + all_red_duration
        self._reason = "init"
        self._pre_override_phase: Optional[Phase] = None

    # ------------------------------------------------------------------
    # Public read-only properties
    # ------------------------------------------------------------------

    @property
    def phase(self) -> Phase:
        return self._phase

    @property
    def phase_started_at(self) -> float:
        return self._phase_started_at

    @property
    def phase_will_end_at(self) -> Optional[float]:
        return self._phase_will_end_at

    @property
    def reason(self) -> str:
        return self._reason

    # ------------------------------------------------------------------
    # Core interface
    # ------------------------------------------------------------------

    def state_snapshot(self) -> PhaseState:
        return PhaseState(
            ts=time.time(),
            phase=self._phase,
            phase_started_at=self._phase_started_at,
            phase_will_end_at=self._phase_will_end_at,
            reason=self._reason,
        )

    def can_transition(self, target: Phase) -> bool:
        """Return True if moving to *target* is a valid transition right now."""
        if target == self._phase:
            return False

        # EMERGENCY and MANUAL can always be entered (override from any state).
        if target in (Phase.EMERGENCY, Phase.MANUAL):
            return True

        # Releasing an override: allow transition to any ALL_RED phase for
        # flexible override resolution (e.g. FORCE_GREEN_A needs ALL_RED_B_to_A).
        if self._phase in (Phase.EMERGENCY, Phase.MANUAL):
            return target in _ALL_RED_PHASES

        # Normal cycle: only the next step in the sequence is allowed.
        return _NORMAL_TRANSITIONS.get(self._phase) == target

    def request_transition(self, target: Phase, reason: str) -> bool:
        """Attempt to transition to *target*.

        Returns True if the transition was accepted, False otherwise.
        """
        if not self.can_transition(target):
            return False

        # Remember current phase so we can return to a safe state on release.
        if target in (Phase.EMERGENCY, Phase.MANUAL):
            self._pre_override_phase = self._phase

        self._apply_transition(target, reason)
        return True

    def tick(self) -> bool:
        """Advance the FSM based on elapsed time.

        Should be called regularly (e.g. every 100 ms).
        Returns True if a transition occurred.
        """
        if self._phase_will_end_at is None:
            return False
        if self._phase in (Phase.EMERGENCY, Phase.MANUAL):
            return False
        if time.time() < self._phase_will_end_at:
            return False

        next_phase = _NORMAL_TRANSITIONS.get(self._phase)
        if next_phase is None:
            return False

        self._apply_transition(next_phase, "timer_expired")
        return True

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _apply_transition(self, target: Phase, reason: str) -> None:
        now = time.time()
        self._phase = target
        self._phase_started_at = now
        self._reason = reason

        if target in _ALL_RED_PHASES:
            self._phase_will_end_at = now + self._all_red_duration
        elif target in (Phase.EMERGENCY, Phase.MANUAL):
            # Override phases have no scheduled end; operator or external event ends them.
            self._phase_will_end_at = None
        else:
            # GREEN phases: duration is adaptive (set externally by policy.py).
            self._phase_will_end_at = None

        if self._on_phase_change is not None:
            self._on_phase_change(self.state_snapshot())

    def set_green_end_time(self, end_time: float) -> None:
        """Allow policy.py to schedule when the current green phase should end."""
        if self._phase not in (Phase.GREEN_A, Phase.GREEN_B):
            raise ValueError(f"Cannot set green end time in phase {self._phase}")
        self._phase_will_end_at = end_time
