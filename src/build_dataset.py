"""Step 2 - Turn the survey multipliers into a labelled training dataset.

No real sales or leftover records were available, so the training data is
SIMULATED from the survey:

1. Every combination of day x calendar x weather x short-break x meal is listed
   (7 x 3 x 3 x 2 x 2 = 252 scenarios).
2. Expected demand for a scenario = product of the survey multipliers that apply,
   floored at DEMAND_FLOOR (independence assumption).
3. Each scenario is "operated" for SIM_DAYS_PER_SCENARIO simulated days with random
   day-to-day variation (DAILY_NOISE_SD), so the model sees realistic, noisy data.
4. Each simulated day gets a surplus-waste risk label from the observed demand:
   Low (>= 80% of a normal day), Medium (55-80%), High (< 55%), assuming the vendor
   cooks their usual normal-day batch.

Output: data/scenario_dataset.csv
"""
import json
import itertools

import numpy as np
import pandas as pd

import config as C


def expected_demand(day: str, calendar: str, weather: str, short_break: bool, meal: str, m: dict) -> float:
    """Expected demand as a fraction of a normal weekday (same formula as the dashboard)."""
    d = 1.0
    if day == "Fri":
        d *= m["friday"]
    elif day in ("Sat", "Sun"):
        d *= m["weekend"]
    if calendar == "Exam week":
        d *= m["exam_week"]
    elif calendar == "Holiday / break":
        d *= m["holiday"]
    if weather == "Heavy rain":
        d *= m["heavy_rain"]
    elif weather == "Haze":
        d *= m["haze"]
    # Short class breaks only matter for weekday lunch during term
    if short_break and meal == "Lunch" and day not in ("Sat", "Sun") and calendar != "Holiday / break":
        d *= m["short_break"]
    return max(d, C.DEMAND_FLOOR)


def risk_tier(demand: float) -> str:
    if demand >= C.RISK_THRESHOLDS["Low"]:
        return "Low"
    if demand >= C.RISK_THRESHOLDS["Medium"]:
        return "Medium"
    return "High"


def encode(day, calendar, weather, short_break, meal) -> dict:
    """Numeric features used by the decision tree (must match docs/js/app.js)."""
    return {
        "is_friday": int(day == "Fri"),
        "is_weekend": int(day in ("Sat", "Sun")),
        "exam_week": int(calendar == "Exam week"),
        "holiday": int(calendar == "Holiday / break"),
        "heavy_rain": int(weather == "Heavy rain"),
        "haze": int(weather == "Haze"),
        "short_break": int(short_break),
        "is_lunch": int(meal == "Lunch"),
    }


FEATURES = ["is_friday", "is_weekend", "exam_week", "holiday", "heavy_rain", "haze", "short_break", "is_lunch"]


def main(summary: dict | None = None) -> pd.DataFrame:
    if summary is None:
        summary = json.loads((C.OUTPUTS / "survey_summary.json").read_text())
    m = summary["multipliers"]
    rng = np.random.default_rng(C.RANDOM_SEED)

    rows = []
    for day, cal, wx, sb, meal in itertools.product(C.DAYS, C.CALENDAR, C.WEATHER, [False, True], C.MEALS):
        exp = expected_demand(day, cal, wx, sb, meal, m)
        for sim_day in range(C.SIM_DAYS_PER_SCENARIO):
            observed = float(np.clip(exp + rng.normal(0, C.DAILY_NOISE_SD), C.DEMAND_FLOOR * 0.75, 1.2))
            rows.append({
                "day": day, "calendar": cal, "weather": wx, "short_break": sb, "meal": meal,
                **encode(day, cal, wx, sb, meal),
                "expected_demand": round(exp, 3),
                "simulated_demand": round(observed, 3),
                "risk": risk_tier(observed),
            })
    df = pd.DataFrame(rows)
    df.to_csv(C.SCENARIO_DATASET, index=False)
    dist = df["risk"].value_counts().reindex(C.RISK_ORDER).to_dict()
    print(f"[2/3] Simulated dataset: {len(df)} rows from {len(df) // C.SIM_DAYS_PER_SCENARIO} scenarios. Risk mix: {dist}")
    return df


if __name__ == "__main__":
    main()
