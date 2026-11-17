"""Run the full pipeline:
survey -> multipliers -> simulated dataset -> decision tree + Mamdani fuzzy system -> dashboard data.

Usage:  python src/run_all.py
"""
import analyze_survey
import build_dataset
import fuzzy_model
import train_model

if __name__ == "__main__":
    summary = analyze_survey.main()
    df = build_dataset.main(summary)
    fuzzy = fuzzy_model.main(summary)
    train_model.main(summary, df, fuzzy)
    print("\nDone. Open docs/index.html in a browser to use the dashboard.")
