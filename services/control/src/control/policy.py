from __future__ import annotations

import time
from typing import Literal

PolicyMode = Literal["fixed", "adaptive"]
Phase = Literal["GREEN_A", "GREEN_B"]

T_MIN: float = 15.0
T_MAX: float = 300.0
FIXED_GREEN: float = 180.0
EMPTY_QUEUE_TIMEOUT: float = 30.0


class TrafficPolicy:
    def __init__(
        self,
        mode: PolicyMode = "adaptive",
        w1: float = 1.0,
        w2: float = 0.1,
    ) -> None:
        self.mode: PolicyMode = mode
        self.w1 = w1
        self.w2 = w2

        self.queue_a: int = 0
        self.queue_b: int = 0
        self.wait_a: float = 0.0
        self.wait_b: float = 0.0

        now = time.time()
        self.last_nonempty_a: float = now
        self.last_nonempty_b: float = now

    def set_mode(self, mode: str) -> None:
        if mode not in ("fixed", "adaptive"):
            raise ValueError(f"Unknown mode: {mode!r}. Expected 'fixed' or 'adaptive'.")
        self.mode = mode  # type: ignore[assignment]

    def update_queues(
        self,
        queue_a: int,
        queue_b: int,
        wait_a: float,
        wait_b: float,
    ) -> None:
        now = time.time()
        self.queue_a = queue_a
        self.queue_b = queue_b
        self.wait_a = wait_a
        self.wait_b = wait_b
        if queue_a > 0:
            self.last_nonempty_a = now
        if queue_b > 0:
            self.last_nonempty_b = now

    def should_switch(
        self,
        current_phase: Phase,
        phase_duration: float,
    ) -> tuple[bool, str]:
        if self.mode == "fixed":
            return self._check_fixed(phase_duration)
        return self._check_adaptive(current_phase, phase_duration)

    def get_recommended_duration(self, phase: Phase) -> float:
        if self.mode == "fixed":
            return FIXED_GREEN
        queue = self.queue_a if phase == "GREEN_A" else self.queue_b
        wait = self.wait_a if phase == "GREEN_A" else self.wait_b
        score = self.w1 * queue + self.w2 * wait
        duration = T_MIN + score * 5.0
        return max(T_MIN, min(T_MAX, duration))

    def _check_fixed(self, phase_duration: float) -> tuple[bool, str]:
        if phase_duration >= FIXED_GREEN:
            return True, f"fixed timer expired ({FIXED_GREEN:.0f}s)"
        return False, "fixed timer running"

    def _check_adaptive(
        self,
        current_phase: Phase,
        phase_duration: float,
    ) -> tuple[bool, str]:
        if phase_duration >= T_MAX:
            return True, f"max green time reached ({T_MAX:.0f}s)"

        now = time.time()
        if current_phase == "GREEN_A":
            current_queue = self.queue_a
            last_nonempty_current = self.last_nonempty_a
            priority_current = self.w1 * self.queue_a + self.w2 * self.wait_a
            priority_opposing = self.w1 * self.queue_b + self.w2 * self.wait_b
        else:
            current_queue = self.queue_b
            last_nonempty_current = self.last_nonempty_b
            priority_current = self.w1 * self.queue_b + self.w2 * self.wait_b
            priority_opposing = self.w1 * self.queue_a + self.w2 * self.wait_a

        if current_queue == 0 and (now - last_nonempty_current) > EMPTY_QUEUE_TIMEOUT:
            return True, "current side queue empty for >30s"

        if (
            priority_opposing > priority_current
            and phase_duration >= T_MIN
        ):
            return (
                True,
                f"opposing priority {priority_opposing:.1f} > current {priority_current:.1f}",
            )

        return False, "adaptive timer running"
