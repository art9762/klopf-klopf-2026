from __future__ import annotations

import json
import os
import time
from typing import Any

import aiosqlite
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

DB_PATH: str = os.environ.get("DB_PATH", "control.db")

_CREATE_EVENT_LOG = """
CREATE TABLE IF NOT EXISTS event_log (
    id      INTEGER PRIMARY KEY,
    ts      REAL    NOT NULL,
    level   TEXT    NOT NULL,
    code    TEXT    NOT NULL,
    msg     TEXT    NOT NULL,
    data    TEXT    NOT NULL
)
"""

_CREATE_PHASE_LOG = """
CREATE TABLE IF NOT EXISTS phase_log (
    id       INTEGER PRIMARY KEY,
    ts       REAL    NOT NULL,
    phase    TEXT    NOT NULL,
    reason   TEXT    NOT NULL,
    duration REAL    NOT NULL
)
"""

_CREATE_SESSION = """
CREATE TABLE IF NOT EXISTS session (
    id           INTEGER PRIMARY KEY,
    scenario_id  TEXT    NOT NULL,
    mode         TEXT    NOT NULL,
    started_at   REAL    NOT NULL,
    ended_at     REAL,
    metrics_json TEXT
)
"""


class SqliteStorage:
    def __init__(self, db_path: str = DB_PATH) -> None:
        self._db_path = db_path
        self._conn: aiosqlite.Connection | None = None

    async def init(self) -> None:
        self._conn = await aiosqlite.connect(self._db_path)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.execute(_CREATE_EVENT_LOG)
        await self._conn.execute(_CREATE_PHASE_LOG)
        await self._conn.execute(_CREATE_SESSION)
        await self._conn.commit()

    async def log_event(
        self,
        ts: float,
        level: str,
        code: str,
        msg: str,
        data_dict: dict[str, Any],
    ) -> None:
        assert self._conn is not None
        await self._conn.execute(
            "INSERT INTO event_log (ts, level, code, msg, data) VALUES (?, ?, ?, ?, ?)",
            (ts, level, code, msg, json.dumps(data_dict)),
        )
        await self._conn.commit()

    async def log_phase(
        self,
        ts: float,
        phase: str,
        reason: str,
        duration: float,
    ) -> None:
        assert self._conn is not None
        await self._conn.execute(
            "INSERT INTO phase_log (ts, phase, reason, duration) VALUES (?, ?, ?, ?)",
            (ts, phase, reason, duration),
        )
        await self._conn.commit()

    async def start_session(self, scenario_id: str, mode: str) -> int:
        assert self._conn is not None
        cursor = await self._conn.execute(
            "INSERT INTO session (scenario_id, mode, started_at) VALUES (?, ?, ?)",
            (scenario_id, mode, time.time()),
        )
        await self._conn.commit()
        return cursor.lastrowid  # type: ignore[return-value]

    async def end_session(self, session_id: int, metrics_dict: dict[str, Any]) -> None:
        assert self._conn is not None
        await self._conn.execute(
            "UPDATE session SET ended_at = ?, metrics_json = ? WHERE id = ?",
            (time.time(), json.dumps(metrics_dict), session_id),
        )
        await self._conn.commit()

    async def get_sessions(self, scenario_id: str | None = None) -> list[dict[str, Any]]:
        assert self._conn is not None
        if scenario_id is not None:
            cursor = await self._conn.execute(
                "SELECT * FROM session WHERE scenario_id = ? ORDER BY started_at DESC",
                (scenario_id,),
            )
        else:
            cursor = await self._conn.execute(
                "SELECT * FROM session ORDER BY started_at DESC"
            )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def get_events(self, limit: int = 50) -> list[dict[str, Any]]:
        assert self._conn is not None
        cursor = await self._conn.execute(
            "SELECT * FROM event_log ORDER BY ts DESC LIMIT ?",
            (limit,),
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def close(self) -> None:
        if self._conn is not None:
            await self._conn.close()
            self._conn = None


class InfluxStorage:
    def __init__(
        self,
        url: str = os.environ.get("INFLUX_URL", "http://localhost:8086"),
        token: str = os.environ.get("INFLUX_TOKEN", ""),
        org: str = os.environ.get("INFLUX_ORG", "klopf"),
        bucket: str = os.environ.get("INFLUX_BUCKET", "traffic"),
    ) -> None:
        self._url = url
        self._token = token
        self._org = org
        self._bucket = bucket
        self._client = InfluxDBClient(url=url, token=token, org=org)
        self._write_api = self._client.write_api(write_options=SYNCHRONOUS)
        self._query_api = self._client.query_api()

    def write_metrics(self, ts: float, metrics_dict: dict[str, Any]) -> None:
        point = Point("traffic_metrics").time(
            int(ts * 1_000_000_000), WritePrecision.NANOSECONDS
        )
        for key, value in metrics_dict.items():
            if isinstance(value, str):
                point = point.tag(key, value)
            elif isinstance(value, (int, float)):
                point = point.field(key, value)
        self._write_api.write(bucket=self._bucket, org=self._org, record=point)

    def query_metrics(
        self,
        scenario_id: str,
        start: float,
        end: float,
    ) -> list[dict[str, Any]]:
        start_rfc = _unix_to_rfc3339(start)
        end_rfc = _unix_to_rfc3339(end)
        flux = (
            f'from(bucket: "{self._bucket}")'
            f" |> range(start: {start_rfc}, stop: {end_rfc})"
            f' |> filter(fn: (r) => r["scenario_id"] == "{scenario_id}")'
            " |> pivot(rowKey:[\"_time\"], columnKey: [\"_field\"], valueColumn: \"_value\")"
        )
        tables = self._query_api.query(flux, org=self._org)
        results: list[dict[str, Any]] = []
        for table in tables:
            for record in table.records:
                results.append(record.values)
        return results

    def close(self) -> None:
        self._client.close()


def _unix_to_rfc3339(ts: float) -> str:
    import datetime
    dt = datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


class StorageManager:
    def __init__(
        self,
        sqlite: SqliteStorage | None = None,
        influx: InfluxStorage | None = None,
    ) -> None:
        self.sqlite = sqlite or SqliteStorage()
        self.influx = influx or InfluxStorage()

    async def init(self) -> None:
        await self.sqlite.init()

    async def log_event(
        self,
        ts: float,
        level: str,
        code: str,
        msg: str,
        data_dict: dict[str, Any],
    ) -> None:
        await self.sqlite.log_event(ts, level, code, msg, data_dict)

    async def log_phase(
        self,
        ts: float,
        phase: str,
        reason: str,
        duration: float,
    ) -> None:
        await self.sqlite.log_phase(ts, phase, reason, duration)

    async def start_session(self, scenario_id: str, mode: str) -> int:
        return await self.sqlite.start_session(scenario_id, mode)

    async def end_session(
        self,
        session_id: int,
        metrics_dict: dict[str, Any],
    ) -> None:
        await self.sqlite.end_session(session_id, metrics_dict)
        ts = metrics_dict.get("ended_at", time.time())
        self.influx.write_metrics(float(ts), metrics_dict)

    async def get_comparison_data(self, scenario_id: str) -> dict[str, Any]:
        sessions = await self.sqlite.get_sessions(scenario_id)
        fixed: list[dict[str, Any]] = []
        adaptive: list[dict[str, Any]] = []
        for s in sessions:
            raw = s.get("metrics_json")
            metrics = json.loads(raw) if raw else {}
            entry = {**s, "metrics": metrics}
            if s.get("mode") == "fixed":
                fixed.append(entry)
            else:
                adaptive.append(entry)
        return {"scenario_id": scenario_id, "fixed": fixed, "adaptive": adaptive}

    async def close(self) -> None:
        await self.sqlite.close()
        self.influx.close()
