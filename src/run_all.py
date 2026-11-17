"""Run the full pipeline: survey -> multipliers -> simulated dataset -> decision tree -> dashboard data.

Usage:  python src/run_all.py
"""
import analyze_survey
import build_dataset
import train_model

if __name__ == "__main__":
    summary = analyze_survey.main()
    df = build_dataset.main(summary)
    train_model.main(summary, df)
    print("\nDone. Open docs/index.html in a browser to use the dashboard.")
