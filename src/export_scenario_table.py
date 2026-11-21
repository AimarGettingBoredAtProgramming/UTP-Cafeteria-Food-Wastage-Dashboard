"""Export easy-to-read tables of the 252 scenarios and their 20 simulated copies.

Output (open in Excel):
  outputs/scenario_252_table.csv   one row per scenario: the calculation, expected crowd,
                                   label, and a summary of its 20 wobbled copies
  outputs/scenario_5040_copies.csv every simulated day: expected crowd, wobble, crowd, label

Usage:  python src/export_scenario_table.py   (after python src/run_all.py)
"""
import json

import pandas as pd

import config as C
from build_dataset import risk_tier


def calc_text(day, cal, wx, sb, meal, m):
    """The multiplication used for the expected crowd, written out (and the raw product)."""
    parts, raw = [], 1.0
    if day == "Fri":
        parts.append(f"Friday {m['friday']:.2f}"); raw *= m["friday"]
    elif day in ("Sat", "Sun"):
        parts.append(f"Weekend {m['weekend']:.2f}"); raw *= m["weekend"]
    if cal == "Exam week":
        parts.append(f"Exam {m['exam_week']:.2f}"); raw *= m["exam_week"]
    elif cal == "Holiday / break":
        parts.append(f"Holiday {m['holiday']:.2f}"); raw *= m["holiday"]
    if wx == "Heavy rain":
        parts.append(f"Rain {m['heavy_rain']:.2f}"); raw *= m["heavy_rain"]
    elif wx == "Haze":
        parts.append(f"Haze {m['haze']:.2f}"); raw *= m["haze"]
    if sb and meal == "Lunch" and day not in ("Sat", "Sun") and cal != "Holiday / break":
        parts.append(f"Short break {m['short_break']:.2f}"); raw *= m["short_break"]
    if not parts:
        return "100% (normal day)"
    text = "100% x " + " x ".join(parts) + f" = {raw * 100:.1f}%"
    if raw < C.DEMAND_FLOOR:
        text += f" -> raised to {C.DEMAND_FLOOR * 100:.0f}% floor"
    return text


def main():
    m = json.loads((C.OUTPUTS / "survey_summary.json").read_text())["multipliers"]
    d = pd.read_csv(C.SCENARIO_DATASET)
    keys = ["day", "calendar", "weather", "short_break", "meal"]

    # every simulated day with its wobble
    copies = d[keys + ["expected_demand", "simulated_demand", "risk"]].copy()
    copies.insert(0, "copy_no", copies.groupby(keys, sort=False).cumcount() + 1)
    copies.insert(0, "scenario_no", copies.groupby(keys, sort=False).ngroup() + 1)
    copies["expected_%"] = (copies.expected_demand * 100).round(1)
    copies["wobble_points"] = ((copies.simulated_demand - copies.expected_demand) * 100).round(1)
    copies["crowd_%"] = (copies.simulated_demand * 100).round(1)
    copies["short_break"] = copies.short_break.astype(str).str.lower().isin(["1", "true", "yes"]).map({True: "Yes", False: "No"})
    copies = copies[["scenario_no", "copy_no"] + keys + ["expected_%", "wobble_points", "crowd_%", "risk"]]
    copies.to_csv(C.OUTPUTS / "scenario_5040_copies.csv", index=False)

    # one row per scenario
    rows = []
    for no, g in copies.groupby("scenario_no", sort=True):
        r = g.iloc[0]
        sb = r.short_break == "Yes"
        exp = r["expected_%"]
        mix = g.risk.value_counts()
        rows.append({
            "scenario_no": no, "day": r.day, "calendar": r.calendar, "weather": r.weather,
            "short_break": r.short_break, "meal": r.meal,
            "calculation": calc_text(r.day, r.calendar, r.weather, sb, r.meal, m),
            "expected_crowd_%": exp,
            "expected_label": risk_tier(exp / 100),
            "copies_min_%": g["crowd_%"].min(), "copies_avg_%": round(g["crowd_%"].mean(), 1), "copies_max_%": g["crowd_%"].max(),
            "wobble_min": g.wobble_points.min(), "wobble_max": g.wobble_points.max(),
            "copies_Low": int(mix.get("Low", 0)), "copies_Medium": int(mix.get("Medium", 0)), "copies_High": int(mix.get("High", 0)),
        })
    table = pd.DataFrame(rows)
    table.to_csv(C.OUTPUTS / "scenario_252_table.csv", index=False)
    print(f"wrote outputs/scenario_252_table.csv ({len(table)} rows) and outputs/scenario_5040_copies.csv ({len(copies)} rows)")
    return table, copies


if __name__ == "__main__":
    main()
