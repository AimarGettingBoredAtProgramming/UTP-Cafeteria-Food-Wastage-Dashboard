"""Step 4 - Mamdani fuzzy inference system for surplus-waste risk.

Why fuzzy logic? The decision tree uses crisp yes/no inputs: 1.0 mm of rain is "heavy rain"
but 0.9 mm is "clear". Real weather is continuous, so a Mamdani fuzzy inference system
(Lecture 8) turns the live numbers into smooth degrees of membership and reasons with
IF-THEN rules written in plain language.

Inputs (crisp)
  day_demand  % of normal-weekday customers from day + academic calendar + class breaks
              (survey multipliers, weather NOT included)
  rain        forecast rain in the selected hour, mm/h (Open-Meteo)
  air         forecast PM2.5 in the selected hour, ug/m3 (Open-Meteo air quality)
Output
  risk        surplus-waste risk score 0-100 (100 = almost nobody comes)
              expected demand = 100 - risk

Pipeline (Lecture 8, slide 23): crisp input -> fuzzification -> rule evaluation (AND = min)
-> implication (clip, min) -> aggregation (max) -> defuzzification (centroid) -> crisp output.

Rules are generated from the survey: for each combination of input terms, a representative
demand is multiplied by the survey's weather effect, and the consequent is the output term
that best describes the resulting risk. Light rain and moderate air are assumed to sit
halfway between "none" and the surveyed heavy-rain / haze effects.

Output: outputs/fuzzy_rules.csv, outputs/fuzzy_comparison.csv,
        outputs/figures/09-11_fuzzy_*.png, and a "fuzzy" block in docs/data/dashboard_data.js
"""
import itertools
import json

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

import config as C

# --- Membership functions: trapezoids (a, b, c, d); a == b or c == d gives a shoulder ---
INPUTS = {
    "day_demand": {
        "label": "Day demand", "unit": "%", "range": [0, 100],
        "sets": {"Low": [0, 0, 30, 50], "Medium": [35, 55, 65, 85], "High": [65, 85, 100, 100]},
    },
    "rain": {
        "label": "Rain", "unit": "mm/h", "range": [0, 6],
        "sets": {"Dry": [0, 0, 0.1, 0.5], "Light": [0.1, 0.5, 1.0, 2.0], "Heavy": [1.0, 2.0, 6, 6]},
    },
    "air": {
        "label": "Air (PM2.5)", "unit": "µg/m³", "range": [0, 100],
        "sets": {"Good": [0, 0, 15, 25], "Moderate": [15, 25, 35, 50], "Hazy": [35, 55, 100, 100]},
    },
}
OUTPUT = {
    "label": "Waste risk", "unit": "/100", "range": [0, 100],
    "sets": {
        "Very low": [0, 0, 5, 15], "Low": [5, 20, 20, 35], "Medium": [20, 35, 35, 50],
        "High": [35, 55, 55, 75], "Very high": [55, 75, 100, 100],
    },
}
# Fuzzy risk score -> tier (same cut-offs as the crisp model: demand 80% / 55%)
TIER_CUTS = {"Low": 20, "Medium": 45}  # score < 20 Low, < 45 Medium, else High

# Representative values used to derive the rule base from the survey
REP_DAY = {"Low": 30, "Medium": 60, "High": 95}
ASSUMED = {"Light": "halfway between dry and heavy rain", "Moderate": "halfway between good air and haze"}


def trap(x, a, b, c, d):
    x = np.asarray(x, dtype=float)
    left = np.ones_like(x) if a == b else np.clip((x - a) / (b - a), 0, 1)
    right = np.ones_like(x) if c == d else np.clip((d - x) / (d - c), 0, 1)
    return np.minimum(left, right)


def weather_factors(m):
    rain = {"Dry": 1.0, "Heavy": m["heavy_rain"]}
    rain["Light"] = (1 + m["heavy_rain"]) / 2
    air = {"Good": 1.0, "Hazy": m["haze"]}
    air["Moderate"] = (1 + m["haze"]) / 2
    return rain, air


def build_rules(m):
    rain_f, air_f = weather_factors(m)
    universe = np.linspace(0, 100, 201)
    rules = []
    for d, r, a in itertools.product(INPUTS["day_demand"]["sets"], INPUTS["rain"]["sets"], INPUTS["air"]["sets"]):
        demand = REP_DAY[d] * rain_f[r] * air_f[a]
        demand = max(demand, C.DEMAND_FLOOR * 100)
        risk = 100 - demand
        best = max(OUTPUT["sets"], key=lambda k: float(trap(risk, *OUTPUT["sets"][k])))
        rules.append({
            "day_demand": d, "rain": r, "air": a, "then": best,
            "evidence": f"{REP_DAY[d]}% x rain {rain_f[r]:.2f} x air {air_f[a]:.2f} = {demand:.0f}% demand",
        })
    return rules


def infer(x, rules, steps=201):
    """Mamdani inference. x = {"day_demand": .., "rain": .., "air": ..}. Returns details for plotting."""
    mu = {k: {s: float(trap(x[k], *p)) for s, p in INPUTS[k]["sets"].items()} for k in INPUTS}
    u = np.linspace(*OUTPUT["range"], steps)
    agg = np.zeros_like(u)
    fired = []
    for r in rules:
        w = min(mu["day_demand"][r["day_demand"]], mu["rain"][r["rain"]], mu["air"][r["air"]])
        if w <= 0:
            continue
        clipped = np.minimum(w, trap(u, *OUTPUT["sets"][r["then"]]))
        agg = np.maximum(agg, clipped)
        fired.append({**r, "strength": round(w, 3)})
    score = float((u * agg).sum() / agg.sum()) if agg.sum() > 0 else 50.0
    tier = "Low" if score < TIER_CUTS["Low"] else "Medium" if score < TIER_CUTS["Medium"] else "High"
    demand = max(100 - score, C.DEMAND_FLOOR * 100)  # same 20% floor as the crisp model
    return {"mu": mu, "fired": sorted(fired, key=lambda f: -f["strength"]), "u": u, "agg": agg,
            "score": score, "demand": demand, "tier": tier}


# Representative crisp values for categorical weather (manual mode / test scenarios)
CATEGORY_VALUES = {"Clear": {"rain": 0.0, "air": 10.0}, "Heavy rain": {"rain": 4.0, "air": 10.0}, "Haze": {"rain": 0.0, "air": 60.0}}


def day_demand(day, calendar, short_break, meal, m):
    d = 1.0
    if day == "Fri":
        d *= m["friday"]
    elif day in ("Sat", "Sun"):
        d *= m["weekend"]
    if calendar == "Exam week":
        d *= m["exam_week"]
    elif calendar == "Holiday / break":
        d *= m["holiday"]
    if short_break and meal == "Lunch" and day not in ("Sat", "Sun") and calendar != "Holiday / break":
        d *= m["short_break"]
    return max(d, C.DEMAND_FLOOR) * 100


# --- Figures ----------------------------------------------------------------------------
COL = ["#2b8a3e", "#1f5f8b", "#e07a2f", "#c0392b", "#7b1fa2"]


def plot_membership(rules):
    fig, axes = plt.subplots(1, 4, figsize=(16, 3.2))
    for ax, (name, spec) in zip(axes, [*INPUTS.items(), ("risk", OUTPUT)]):
        lo, hi = spec["range"]
        x = np.linspace(lo, hi, 400)
        for i, (s, p) in enumerate(spec["sets"].items()):
            ax.plot(x, trap(x, *p), lw=2, color=COL[i % len(COL)], label=s)
        ax.set_title(f"{spec['label']} ({spec['unit']})", fontsize=11, fontweight="bold", loc="left")
        ax.set_ylim(-0.02, 1.08); ax.set_ylabel("membership" if name == "day_demand" else "")
        ax.legend(fontsize=8, frameon=False, loc="center right")
        ax.spines[["top", "right"]].set_visible(False)
    fig.suptitle("Fuzzy membership functions (inputs → output)", fontsize=12, x=0.01, ha="left")
    fig.tight_layout(); fig.savefig(C.FIGURES / "09_fuzzy_membership.png", dpi=150); plt.close(fig)


def plot_example(rules, m):
    x = {"day_demand": day_demand("Fri", "Normal week", False, "Lunch", m), "rain": 1.4, "air": 18.0}
    res = infer(x, rules)
    fig, axes = plt.subplots(1, 4, figsize=(16, 3.4))
    for ax, (name, spec) in zip(axes[:3], INPUTS.items()):
        lo, hi = spec["range"]
        xs = np.linspace(lo, hi, 400)
        for i, (s, p) in enumerate(spec["sets"].items()):
            ax.plot(xs, trap(xs, *p), lw=2, color=COL[i], label=f"{s}: {res['mu'][name][s]:.2f}")
        ax.axvline(x[name], color="black", ls="--", lw=1)
        ax.set_title(f"{spec['label']} = {x[name]:.1f} {spec['unit']}", fontsize=11, fontweight="bold", loc="left")
        ax.legend(fontsize=8, frameon=False); ax.spines[["top", "right"]].set_visible(False)
    ax = axes[3]
    for i, (s, p) in enumerate(OUTPUT["sets"].items()):
        ax.plot(res["u"], trap(res["u"], *p), lw=1, color=COL[i], alpha=.5)
    ax.fill_between(res["u"], res["agg"], color="#1f5f8b", alpha=.45, label="aggregated output")
    ax.axvline(res["score"], color="#c0392b", lw=2, label=f"centroid = {res['score']:.0f}")
    ax.set_title(f"Risk {res['score']:.0f}/100 → {res['tier']} (demand {res['demand']:.0f}%)", fontsize=11, fontweight="bold", loc="left")
    ax.legend(fontsize=8, frameon=False); ax.spines[["top", "right"]].set_visible(False)
    fig.suptitle("Worked example: Friday lunch, 1.4 mm/h rain, PM2.5 18 (fuzzification → aggregation → centroid)", fontsize=12, x=0.01, ha="left")
    fig.tight_layout(); fig.savefig(C.FIGURES / "10_fuzzy_inference_example.png", dpi=150); plt.close(fig)
    return x, res


def plot_rain_sweep(rules, m):
    rains = np.linspace(0, 5, 101)
    base = day_demand("Mon", "Normal week", False, "Lunch", m)
    fuzzy = [infer({"day_demand": base, "rain": r, "air": 10}, rules)["demand"] for r in rains]
    crisp = [base * (m["heavy_rain"] if r >= 1.0 else 1) for r in rains]
    fig, ax = plt.subplots(figsize=(8, 3.6))
    ax.plot(rains, crisp, color="#9aa5b1", lw=2.5, label="Crisp rule (≥ 1 mm = heavy rain)", drawstyle="steps-post")
    ax.plot(rains, fuzzy, color="#1f5f8b", lw=2.5, label="Fuzzy logic (Mamdani)")
    ax.set_xlabel("Rain in the selected hour (mm)"); ax.set_ylabel("Expected demand (%)")
    ax.set_title("Normal weekday lunch: crisp jump vs smooth fuzzy response", loc="left", fontweight="bold")
    ax.set_ylim(0, 105); ax.legend(frameon=False); ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout(); fig.savefig(C.FIGURES / "11_fuzzy_vs_crisp_rain.png", dpi=160); plt.close(fig)


def main(summary=None):
    if summary is None:
        summary = json.loads((C.OUTPUTS / "survey_summary.json").read_text())
    m = summary["multipliers"]
    rules = build_rules(m)
    pd.DataFrame(rules).to_csv(C.OUTPUTS / "fuzzy_rules.csv", index=False)

    # Compare with the crisp survey rule on all 252 scenarios (categorical weather -> representative values)
    from build_dataset import expected_demand, risk_tier
    rows = []
    for day, cal, wx, sb, meal in itertools.product(C.DAYS, C.CALENDAR, C.WEATHER, [False, True], C.MEALS):
        x = {"day_demand": day_demand(day, cal, sb, meal, m), **CATEGORY_VALUES[wx]}
        res = infer(x, rules)
        crisp = expected_demand(day, cal, wx, sb, meal, m)
        rows.append({"day": day, "calendar": cal, "weather": wx, "short_break": sb, "meal": meal,
                     "crisp_demand": round(crisp * 100, 1), "crisp_tier": risk_tier(crisp),
                     "fuzzy_score": round(res["score"], 1), "fuzzy_demand": round(res["demand"], 1), "fuzzy_tier": res["tier"]})
    comp = pd.DataFrame(rows)
    comp.to_csv(C.OUTPUTS / "fuzzy_comparison.csv", index=False)
    agree = float((comp.crisp_tier == comp.fuzzy_tier).mean())
    mae = float((comp.crisp_demand - comp.fuzzy_demand).abs().mean())

    plot_membership(rules)
    ex_x, ex = plot_example(rules, m)
    plot_rain_sweep(rules, m)

    block = {
        "method": "Mamdani", "and": "min", "implication": "min (clip)", "aggregation": "max", "defuzzification": "centroid",
        "inputs": INPUTS, "output": OUTPUT, "tier_cuts": TIER_CUTS, "category_values": CATEGORY_VALUES,
        "rules": rules, "assumptions": ASSUMED, "rep_day": REP_DAY,
        "metrics": {"tier_agreement_with_crisp": round(agree, 4), "mean_abs_demand_diff": round(mae, 2), "rules": len(rules)},
        "example": {"inputs": {k: round(v, 2) for k, v in ex_x.items()}, "score": round(ex["score"], 1),
                    "demand": round(ex["demand"], 1), "tier": ex["tier"]},
    }
    print(f"[3/4] Fuzzy (Mamdani): {len(rules)} rules | tier agreement with crisp rule {agree:.1%} | mean demand diff {mae:.1f} pts")
    print(f"      Example Friday lunch, 1.4 mm rain: risk {ex['score']:.0f}/100 -> {ex['tier']} ({ex['demand']:.0f}% demand)")
    return block


if __name__ == "__main__":
    main()
