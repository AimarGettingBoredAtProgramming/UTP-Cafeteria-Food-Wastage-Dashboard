"""Step 3 - Train the decision tree, evaluate it, and export everything the dashboard needs.

Output: outputs/model_metrics.json
        outputs/decision_tree_rules.txt
        outputs/test_scenarios.csv
        outputs/figures/06_decision_tree.png, 07_confusion_matrix.png, 08_feature_importance.png
        docs/data/dashboard_data.js   (loaded by the HTML dashboard)
"""
import json
from datetime import date

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, export_text, plot_tree

import config as C
from build_dataset import FEATURES, encode, expected_demand, risk_tier

FEATURE_LABELS = {
    "is_friday": "Friday",
    "is_weekend": "Weekend (Sat/Sun)",
    "exam_week": "Exam week",
    "holiday": "Public holiday / break",
    "heavy_rain": "Heavy rain",
    "haze": "Haze",
    "short_break": "Short class breaks",
    "is_lunch": "Lunch service",
}

# The five test scenarios from the proposal + three extra stress cases
TEST_SCENARIOS = [
    ("Normal Monday", "Mon", "Normal week", "Clear", False, "Lunch"),
    ("Normal Friday", "Fri", "Normal week", "Clear", False, "Lunch"),
    ("Rainy Tuesday", "Tue", "Normal week", "Heavy rain", False, "Lunch"),
    ("Exam-week Wednesday", "Wed", "Exam week", "Clear", False, "Lunch"),
    ("Public holiday (Thursday)", "Thu", "Holiday / break", "Clear", False, "Lunch"),
    ("Rainy Friday", "Fri", "Normal week", "Heavy rain", False, "Lunch"),
    ("Hazy exam-week Monday", "Mon", "Exam week", "Haze", False, "Dinner"),
    ("Tuesday with short class breaks", "Tue", "Normal week", "Clear", True, "Lunch"),
]


def export_tree(clf: DecisionTreeClassifier) -> dict:
    t = clf.tree_
    nodes = []
    for i in range(t.node_count):
        counts = t.value[i][0]
        probs = counts / counts.sum()
        nodes.append({
            "feature": FEATURES[t.feature[i]] if t.children_left[i] != -1 else None,
            "threshold": round(float(t.threshold[i]), 3) if t.children_left[i] != -1 else None,
            "left": int(t.children_left[i]),
            "right": int(t.children_right[i]),
            "probs": [round(float(p), 4) for p in probs],
            "samples": int(t.n_node_samples[i]),
        })
    return {"classes": list(clf.classes_), "nodes": nodes}


def main(summary: dict | None = None, df: pd.DataFrame | None = None, fuzzy: dict | None = None):
    if summary is None:
        summary = json.loads((C.OUTPUTS / "survey_summary.json").read_text())
    if df is None:
        df = pd.read_csv(C.SCENARIO_DATASET)
    if fuzzy is None:
        import fuzzy_model
        fuzzy = fuzzy_model.main(summary)
    m = summary["multipliers"]

    X, y = df[FEATURES], df["risk"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=C.RANDOM_SEED, stratify=y)
    clf = DecisionTreeClassifier(max_depth=C.TREE_MAX_DEPTH, min_samples_leaf=5, random_state=C.RANDOM_SEED)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred, labels=C.RISK_ORDER)
    report = classification_report(y_test, y_pred, labels=C.RISK_ORDER, output_dict=True, zero_division=0)

    # Agreement with the noise-free survey rule on every unique scenario
    uniq = df.drop_duplicates(subset=["day", "calendar", "weather", "short_break", "meal"]).copy()
    uniq["rule_tier"] = uniq["expected_demand"].apply(risk_tier)
    uniq["model_tier"] = clf.predict(uniq[FEATURES])
    rule_agreement = float((uniq["rule_tier"] == uniq["model_tier"]).mean())

    importances = {f: round(float(v), 4) for f, v in zip(FEATURES, clf.feature_importances_)}

    # Test scenarios
    tests = []
    for name, day, cal, wx, sb, meal in TEST_SCENARIOS:
        feats = pd.DataFrame([encode(day, cal, wx, sb, meal)])[FEATURES]
        proba = clf.predict_proba(feats)[0]
        tier = clf.classes_[int(np.argmax(proba))]
        exp = expected_demand(day, cal, wx, sb, meal, m)
        tests.append({
            "scenario": name, "day": day, "calendar": cal, "weather": wx,
            "short_break": sb, "meal": meal,
            "expected_demand_pct": round(exp * 100),
            "predicted_risk": tier, "confidence_pct": round(float(proba.max()) * 100),
            "recommended_batch_if_usual_100": round(100 * exp),
        })
    pd.DataFrame(tests).to_csv(C.OUTPUTS / "test_scenarios.csv", index=False)

    rules = export_text(clf, feature_names=FEATURES)
    (C.OUTPUTS / "decision_tree_rules.txt").write_text(rules)

    metrics = {
        "train_rows": int(len(X_train)), "test_rows": int(len(X_test)),
        "test_accuracy": round(acc, 4),
        "agreement_with_survey_rule": round(rule_agreement, 4),
        "confusion_matrix": {"labels": C.RISK_ORDER, "matrix": cm.tolist()},
        "per_class": {k: {m_: round(v, 3) for m_, v in report[k].items()} for k in C.RISK_ORDER},
        "feature_importance": importances,
        "tree_depth": int(clf.get_depth()), "tree_leaves": int(clf.get_n_leaves()),
    }
    (C.OUTPUTS / "model_metrics.json").write_text(json.dumps(metrics, indent=2))

    # --- Figures -------------------------------------------------------------
    fig, ax = plt.subplots(figsize=(22, 10))
    plot_tree(clf, feature_names=FEATURES, class_names=list(clf.classes_), filled=True,
              rounded=True, fontsize=7, max_depth=3, ax=ax, impurity=False, proportion=True)
    ax.set_title("Decision tree (top 3 levels)", fontsize=14)
    fig.tight_layout(); fig.savefig(C.FIGURES / "06_decision_tree.png", dpi=130); plt.close(fig)

    fig, ax = plt.subplots(figsize=(4.6, 4))
    ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(3), C.RISK_ORDER); ax.set_yticks(range(3), C.RISK_ORDER)
    ax.set_xlabel("Predicted"); ax.set_ylabel("Actual")
    for i in range(3):
        for j in range(3):
            ax.text(j, i, cm[i, j], ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() / 2 else "black", fontsize=11)
    ax.set_title(f"Confusion matrix (accuracy {acc:.0%})", fontsize=11)
    fig.tight_layout(); fig.savefig(C.FIGURES / "07_confusion_matrix.png", dpi=160); plt.close(fig)

    fig, ax = plt.subplots(figsize=(7, 3.4))
    imp = sorted(importances.items(), key=lambda kv: kv[1])
    ax.barh([FEATURE_LABELS[k] for k, _ in imp], [v * 100 for _, v in imp], color="#1f5f8b")
    ax.set_xlabel("Importance (%)"); ax.set_title("What drives the prediction", loc="left", fontweight="bold")
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout(); fig.savefig(C.FIGURES / "08_feature_importance.png", dpi=160); plt.close(fig)

    # --- Dashboard data --------------------------------------------------------
    payload = {
        "generated": date.today().isoformat(),
        "survey": summary,
        "settings": {
            "days": C.DAYS, "calendar": C.CALENDAR, "weather": C.WEATHER, "meals": C.MEALS,
            "demand_floor": C.DEMAND_FLOOR, "risk_thresholds": C.RISK_THRESHOLDS,
            "features": FEATURES, "feature_labels": FEATURE_LABELS,
        },
        "tree": export_tree(clf),
        "metrics": metrics,
        "test_scenarios": tests,
        "fuzzy": fuzzy,
    }
    C.DASHBOARD_DATA_JS.parent.mkdir(parents=True, exist_ok=True)
    C.DASHBOARD_DATA_JS.write_text(
        "// Auto-generated by src/train_model.py - do not edit by hand.\n"
        f"window.DASHBOARD_DATA = {json.dumps(payload, indent=1)};\n", encoding="utf-8")

    print(f"[4/4] Decision tree trained: depth {clf.get_depth()}, {clf.get_n_leaves()} leaves")
    print(f"      Test accuracy {acc:.1%} | agreement with survey rule {rule_agreement:.1%}")
    print("      Test scenarios:")
    for t in tests:
        print(f"        {t['scenario']:<34} demand {t['expected_demand_pct']:>3}%  ->  {t['predicted_risk']:<6} ({t['confidence_pct']}%)")
    return metrics


if __name__ == "__main__":
    main()
