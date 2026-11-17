"""Step 1 - Clean the student survey and turn it into demand multipliers.

Input : data/raw/survey_export.csv  (Microsoft Forms export, ';' separated)
Output: data/survey_responses.csv   (anonymised, short column names)
        outputs/survey_summary.json (counts, percentages, multipliers)
        outputs/figures/*.png       (charts for the report)
"""
import json

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

import config as C


def load_and_clean() -> pd.DataFrame:
    raw = pd.read_csv(C.RAW_SURVEY, sep=";", encoding="utf-8-sig")
    df = raw.rename(columns=C.COLUMNS)[["ID", *C.COLUMNS.values()]].copy()
    df = df.rename(columns={"ID": "respondent"})
    # "Very likely (5)" -> "Very likely"
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].str.replace(r"\s*\(\d\)$", "", regex=True).str.strip()
    df["meals"] = df["meals"].str.strip(";")
    df = df.dropna(subset=["year"])
    df.to_csv(C.CLEAN_SURVEY, index=False)
    return df


def counts(series: pd.Series, order=None) -> dict:
    vc = series.value_counts()
    if order:
        vc = vc.reindex(order, fill_value=0)
    n = len(series)
    return {k: {"count": int(v), "pct": round(100 * v / n, 1)} for k, v in vc.items()}


def compute_multipliers(df: pd.DataFrame) -> dict:
    weekday_prob = (df["days_per_week"].map(C.DAYS_MIDPOINT).clip(upper=5) / 5).mean()

    def likert_mean(col):
        return df[col].map(C.LIKERT_SCORE).mean()

    raw = {
        "exam_week": likert_mean("exam_week"),
        "friday": likert_mean("friday"),
        "weekend": likert_mean("weekend"),
        "heavy_rain": likert_mean("heavy_rain"),
        "haze": likert_mean("haze"),
        "holiday": df["holiday_stay"].map(C.HOLIDAY_STAY_SCORE).mean(),
    }
    mult = {k: v / weekday_prob for k, v in raw.items() if k != "holiday"}
    # Holiday: probability of even being on campus (already relative to a normal day)
    mult["holiday"] = raw["holiday"]
    mult["short_break"] = 1 - df["short_break"].isin(C.SHORT_BREAK_LOST).mean()
    return {
        "baseline_weekday_probability": round(weekday_prob, 3),
        "raw_probabilities": {k: round(v, 3) for k, v in raw.items()},
        "multipliers": {k: round(min(v, 1.0), 3) for k, v in mult.items()},
    }


def summarise(df: pd.DataFrame) -> dict:
    likert_order = list(C.LIKERT_SCORE)
    meals = df["meals"].str.split(";").explode()
    meals = meals[meals != ""]
    n = len(df)
    return {
        "n": n,
        "collection_period": "2-13 November 2026",
        "year": counts(df["year"], ["Foundation", "Year 1", "Year 2", "Year 3", "Year 4", "Postgraduate"]),
        "residence": counts(df["residence"], [f"Village {i}" for i in range(1, 8)] + ["Off-campus"]),
        "days_per_week": counts(df["days_per_week"], list(C.DAYS_MIDPOINT)),
        "meals": {k: {"count": int(v), "pct": round(100 * v / n, 1)} for k, v in meals.value_counts().items()},
        "lunch_time": counts(df["lunch_time"], ["Before 12:00 pm", "12:00 to 1:00 pm", "1:00 to 2:00 pm", "After 2:00 pm"]),
        "dining_mode": counts(df["dining_mode"], ["Dine in", "Both equally", "Takeaway"]),
        "likert": {c: counts(df[c], likert_order) for c in ["exam_week", "friday", "weekend", "heavy_rain", "haze"]},
        "holiday_stay": counts(df["holiday_stay"], list(C.HOLIDAY_STAY_SCORE)),
        "short_break": counts(df["short_break"]),
        "leave_food": counts(df["leave_food"], ["Never", "Rarely", "Sometimes", "Often", "Always"]),
        "leave_reason": counts(df["leave_reason"]),
        "forecast_reaction": counts(df["forecast_reaction"]),
    }


# --- Figures for the report --------------------------------------------------
BLUE, ORANGE, GREY = "#1f5f8b", "#e07a2f", "#9aa5b1"


def _bar(ax, labels, values, title, color=BLUE, pct=True):
    bars = ax.barh(labels, values, color=color)
    ax.invert_yaxis()
    ax.set_title(title, fontsize=11, loc="left", fontweight="bold")
    ax.spines[["top", "right"]].set_visible(False)
    for b, v in zip(bars, values):
        ax.text(b.get_width() + max(values) * 0.01, b.get_y() + b.get_height() / 2,
                f"{v:.0f}%" if pct else f"{v:.2f}", va="center", fontsize=9)


def make_figures(summary: dict, mult: dict):
    C.FIGURES.mkdir(parents=True, exist_ok=True)
    n = summary["n"]

    # 1. Demand multipliers
    labels = {"exam_week": "Exam week", "friday": "Friday", "haze": "Hazy day", "weekend": "Weekend",
              "short_break": "Short class break (lunch)", "heavy_rain": "Heavy rain", "holiday": "Public holiday / break"}
    m = mult["multipliers"]
    order = sorted(labels, key=lambda k: -m[k])
    fig, ax = plt.subplots(figsize=(8, 4))
    vals = [m[k] * 100 for k in order]
    _bar(ax, [labels[k] for k in order], vals, f"Expected demand vs a normal weekday (survey, n={n})",
         color=[BLUE if v >= 80 else ORANGE if v >= 55 else "#c0392b" for v in vals])
    ax.axvline(100, color=GREY, ls="--", lw=1)
    ax.set_xlim(0, 115)
    ax.set_xlabel("% of normal weekday demand")
    fig.tight_layout(); fig.savefig(C.FIGURES / "01_demand_multipliers.png", dpi=160); plt.close(fig)

    # 2. Lunch time
    lt = summary["lunch_time"]
    fig, ax = plt.subplots(figsize=(7, 3))
    _bar(ax, list(lt), [v["pct"] for v in lt.values()], "When students eat lunch")
    fig.tight_layout(); fig.savefig(C.FIGURES / "02_lunch_time.png", dpi=160); plt.close(fig)

    # 3. Likelihood by condition (stacked)
    conds = {"exam_week": "Exam week", "friday": "Friday", "weekend": "Weekend", "haze": "Haze", "heavy_rain": "Heavy rain"}
    colors = ["#c0392b", "#e59866", "#d5d8dc", "#7fb3d5", "#1f5f8b"]
    fig, ax = plt.subplots(figsize=(8, 3.6))
    left = [0] * len(conds)
    for i, lvl in enumerate(C.LIKERT_SCORE):
        vals = [summary["likert"][c][lvl]["pct"] for c in conds]
        ax.barh(list(conds.values()), vals, left=left, color=colors[i], label=lvl)
        left = [a + b for a, b in zip(left, vals)]
    ax.invert_yaxis(); ax.set_xlim(0, 100)
    ax.set_title("How likely are you to eat at your preferred cafeteria?", loc="left", fontsize=11, fontweight="bold")
    ax.legend(ncol=3, fontsize=8, loc="upper center", bbox_to_anchor=(0.5, -0.12), frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout(); fig.savefig(C.FIGURES / "03_likelihood_by_condition.png", dpi=160); plt.close(fig)

    # 4. Leftover reasons
    lr = summary["leave_reason"]
    fig, ax = plt.subplots(figsize=(7, 3.4))
    _bar(ax, list(lr), [v["pct"] for v in lr.values()], "Main reason for leaving food", color=ORANGE)
    fig.tight_layout(); fig.savefig(C.FIGURES / "04_leftover_reasons.png", dpi=160); plt.close(fig)

    # 5. Forecast reaction
    fr = summary["forecast_reaction"]
    fig, ax = plt.subplots(figsize=(7, 2.8))
    _bar(ax, list(fr), [v["pct"] for v in fr.values()], "If a forecast said 'very busy', students would...")
    fig.tight_layout(); fig.savefig(C.FIGURES / "05_forecast_reaction.png", dpi=160); plt.close(fig)


def main():
    df = load_and_clean()
    mult = compute_multipliers(df)
    summary = summarise(df)
    summary.update(mult)
    C.OUTPUTS.mkdir(exist_ok=True)
    (C.OUTPUTS / "survey_summary.json").write_text(json.dumps(summary, indent=2))
    make_figures(summary, mult)
    print(f"[1/4] Survey cleaned: {len(df)} responses")
    print(f"      Weekday baseline probability: {mult['baseline_weekday_probability']}")
    for k, v in mult["multipliers"].items():
        print(f"      {k:<12} x{v}")
    return summary


if __name__ == "__main__":
    main()
