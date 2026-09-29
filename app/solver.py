"""赛道计次裁决核心算法。

输入:
    1~3 名编号互异的选手; 每人两段耗时(起点->中途门, 中途门->终点)的正整数闭区间;
    至多 40 条感应记录(唯一字符串 ID、选手编号、门、非负整数秒)。

每趟由同一选手的 起点 -> 中途门 -> 终点 三条记录组成, 两段耗时均落在给定闭区间内。
同一选手的各趟之间不得共用任何记录, 且后一趟起点必须严格晚于前一趟终点。

每名选手按以下优先级选择方案:
    1. 完整计次数最多;
    2. 各趟用时之和最短(用时 = 终点秒数 - 起点秒数);
    3. 仍并列时, 按计次时间顺序串接的记录 ID 序列字典序最小。
"""
from __future__ import annotations

from bisect import bisect_right
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

GATES = ("start", "mid", "finish")
GATE_NAMES = {"start": "起点", "mid": "中途门", "finish": "终点"}

MAX_RUNNERS = 3
MAX_RECORDS = 40


class JudgeError(ValueError):
    """输入非法, errors 字段收集全部错误信息。"""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


@dataclass(frozen=True)
class Reading:
    rid: str
    runner: int
    gate: str
    second: int


@dataclass(frozen=True)
class Lap:
    """一个候选计次趟次。"""

    start: Reading
    mid: Reading
    finish: Reading
    t_start: int
    t_finish: int

    @property
    def duration(self) -> int:
        return self.t_finish - self.t_start


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _parse_interval(raw: Any, label: str, errors: list[str]) -> tuple[int, int] | None:
    """解析正整数闭区间 [lo, hi]。"""
    if not isinstance(raw, dict):
        errors.append(f"{label}: 必须是包含 lo 与 hi 的区间")
        return None
    lo, hi = raw.get("lo"), raw.get("hi")
    if not _is_int(lo) or not _is_int(hi):
        errors.append(f"{label}: 区间上下限必须为整数")
        return None
    if lo < 1 or hi < 1:
        errors.append(f"{label}: 区间必须为正整数")
        return None
    if lo > hi:
        errors.append(f"{label}: 区间下限不得大于上限")
        return None
    return lo, hi


def judge(payload: Any) -> dict:
    """校验并裁决, 返回完整结果; 输入非法时抛 JudgeError(不返回部分结果)。"""
    errors: list[str] = []
    if not isinstance(payload, dict):
        raise JudgeError(["请求体必须为 JSON 对象"])

    raw_runners = payload.get("runners")
    if not isinstance(raw_runners, list) or not (1 <= len(raw_runners) <= MAX_RUNNERS):
        raise JudgeError([f"选手人数必须为 1~{MAX_RUNNERS} 名"])

    runners: list[dict] = []
    seen_numbers: set[int] = set()
    for i, item in enumerate(raw_runners):
        label = f"选手{i + 1}"
        if not isinstance(item, dict):
            errors.append(f"{label}: 格式不正确")
            continue
        number = item.get("number")
        if not _is_int(number) or number < 1:
            errors.append(f"{label}: 编号必须为正整数")
        elif number in seen_numbers:
            errors.append(f"选手编号重复: {number}")
        else:
            seen_numbers.add(number)
        seg1 = _parse_interval(item.get("seg1"), f"{label} 起点→中途门", errors)
        seg2 = _parse_interval(item.get("seg2"), f"{label} 中途门→终点", errors)
        runners.append({"number": number, "seg1": seg1, "seg2": seg2})

    raw_records = payload.get("records")
    records: list[Reading] = []
    if raw_records is None:
        errors.append("缺少感应记录列表")
    elif not isinstance(raw_records, list):
        errors.append("感应记录必须为列表")
    elif len(raw_records) > MAX_RECORDS:
        errors.append(f"感应记录至多 {MAX_RECORDS} 条")
    else:
        seen_ids: set[str] = set()
        for i, item in enumerate(raw_records):
            label = f"记录{i + 1}"
            if not isinstance(item, dict):
                errors.append(f"{label}: 格式不正确")
                continue

            rid_ok = False
            rid = item.get("id")
            if not isinstance(rid, str) or not rid.strip():
                errors.append(f"{label}: ID 必须为非空字符串")
            elif rid in seen_ids:
                errors.append(f"{label}: ID 重复 ({rid})")
            else:
                seen_ids.add(rid)
                rid_ok = True

            runner_ok = False
            runner = item.get("runner")
            if not _is_int(runner) or runner < 1:
                errors.append(f"{label}: 选手编号必须为正整数")
            elif runner not in seen_numbers:
                errors.append(f"{label}: 选手编号 {runner} 未登记")
            else:
                runner_ok = True

            gate_ok = False
            gate = item.get("gate")
            if gate not in GATES:
                errors.append(f"{label}: 门必须为 start/mid/finish 之一")
            else:
                gate_ok = True

            second_ok = False
            second = item.get("second")
            if not _is_int(second) or second < 0:
                errors.append(f"{label}: 秒数必须为非负整数")
            else:
                second_ok = True

            if rid_ok and runner_ok and gate_ok and second_ok:
                records.append(Reading(rid, runner, gate, second))

    if errors:
        raise JudgeError(errors)

    by_runner: dict[int, list[Reading]] = defaultdict(list)
    for r in records:
        by_runner[r.runner].append(r)

    result_runners = []
    for spec in runners:
        result_runners.append(
            _judge_runner(spec["number"], spec["seg1"], spec["seg2"], by_runner[spec["number"]])
        )
    return {"runners": result_runners}


def _judge_runner(
    number: int,
    seg1: tuple[int, int],
    seg2: tuple[int, int],
    readings: list[Reading],
) -> dict:
    (lo1, hi1), (lo2, hi2) = seg1, seg2
    by_gate: dict[str, list[Reading]] = {g: [] for g in GATES}
    for r in readings:
        by_gate[r.gate].append(r)

    # 枚举所有合法候选趟次: 起点 -> 中途门 -> 终点, 两段耗时均合格。
    laps: list[Lap] = []
    for s in by_gate["start"]:
        for m in by_gate["mid"]:
            d1 = m.second - s.second
            if not (lo1 <= d1 <= hi1):
                continue
            for f in by_gate["finish"]:
                d2 = f.second - m.second
                if lo2 <= d2 <= hi2:
                    laps.append(
                        Lap(s, m, f, s.second, f.second)
                    )

    # 按终点时间排序; 同终点时间下顺序无关(最终只保留唯一最优方案)。
    laps.sort(key=lambda lap: (lap.t_finish, lap.t_start))
    n = len(laps)
    finish_times = [lap.t_finish for lap in laps]

    # 加权区间调度 DP:
    # dp[i] = 仅用前 i 个候选(按终点排序)时的最优方案
    #         (计次数, 总用时, ID 串接元组, 候选下标列表)。
    # 兼容条件: 前一趟终点 < 本趟起点 (bisect_right(t_start-1))。
    none_state = (0, 0, (), [])

    def better(a, b):
        """a 是否优于 b: 计次更多 > 总用时更短 > ID 序列字典序更小。"""
        if a[0] != b[0]:
            return a[0] > b[0]
        if a[1] != b[1]:
            return a[1] < b[1]
        return a[2] < b[2]

    dp = [none_state] * (n + 1)
    for i in range(1, n + 1):
        lap = laps[i - 1]
        p = bisect_right(finish_times, lap.t_start - 1, hi=i - 1)
        prev = dp[p]
        take = (
            prev[0] + 1,
            prev[1] + lap.duration,
            prev[2] + (lap.start.rid, lap.mid.rid, lap.finish.rid),
            prev[3] + [i - 1],
        )
        skip = dp[i - 1]
        dp[i] = take if better(take, skip) else skip

    best = dp[n]
    chosen_laps = [laps[idx] for idx in best[3]]

    used: set[str] = set()
    lap_dicts = []
    for k, lap in enumerate(chosen_laps, start=1):
        used.update((lap.start.rid, lap.mid.rid, lap.finish.rid))
        lap_dicts.append(
            {
                "index": k,
                "start": _reading_json(lap.start),
                "mid": _reading_json(lap.mid),
                "finish": _reading_json(lap.finish),
                "seg1": lap.mid.second - lap.start.second,
                "seg2": lap.finish.second - lap.mid.second,
                "duration": lap.duration,
            }
        )

    unused = sorted(
        (_reading_json(r) for r in readings if r.rid not in used),
        key=lambda r: (r["second"], r["gate"], r["id"]),
    )

    return {
        "number": number,
        "seg1": {"lo": lo1, "hi": hi1},
        "seg2": {"lo": lo2, "hi": hi2},
        "lap_count": best[0],
        "total_duration": best[1],
        "laps": lap_dicts,
        "unused": unused,
    }


def _reading_json(r: Reading) -> dict:
    return {"id": r.rid, "runner": r.runner, "gate": r.gate, "second": r.second}
