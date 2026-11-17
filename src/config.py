"""Shared settings for the UTP Cafeteria Food Wastage pipeline.

Every number here is either derived from the student survey (see analyze_survey.py)
or is a clearly stated modelling assumption. Change assumptions here, then re-run
`python src/run_all.py` to rebuild the dataset, model and dashboard data.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_SURVEY = ROOT / "data" / "raw" / "survey_export.csv"
CLEAN_SURVEY = ROOT / "data" / "survey_responses.csv"
SCENARIO_DATASET = ROOT / "data" / "scenario_dataset.csv"
OUTPUTS = ROOT / "outputs"
FIGURES = OUTPUTS / "figures"
DASHBOARD_DATA_JS = ROOT / "docs" / "data" / "dashboard_data.js"

# --- Survey column names (short) -------------------------------------------
COLUMNS = {
    "What is your year of study?": "year",
    "Where do you live?": "residence",
    "How many days per week do you eat at your preferred cafeteria?": "days_per_week",
    "Which meals do you eat there? Select all that apply.": "meals",
    "What time do you usually eat lunch there?": "lunch_time",
    "How do you usually eat?": "dining_mode",
    "During exam weeks, how likely are you to eat at your preferred cafeteria?": "exam_week",
    "On Fridays, how likely are you to eat at your preferred cafeteria?": "friday",
    "On weekends, how likely are you to eat at your preferred cafeteria?": "weekend",
    "During public holidays or semester breaks, do you stay on campus?": "holiday_stay",
    "If your break between classes is under 1 hour, what do you usually do?": "short_break",
    "When it rains heavily, how likely are you to eat at your preferred cafeteria?": "heavy_rain",
    "On hazy days, how likely are you to eat at your preferred cafeteria?": "haze",
    "How often do you leave food uneaten at your preferred cafeteria?": "leave_food",
    "What is the main reason you leave food?": "leave_reason",
    "If a forecast showed your preferred cafeteria would be very busy at your usual time, what would you do?": "forecast_reaction",
}

# --- Scoring rules (assumptions) --------------------------------------------
# 5-point likelihood scale -> probability of eating at the cafeteria
LIKERT_SCORE = {
    "Very unlikely": 0.0,
    "Somewhat unlikely": 0.25,
    "Neither likely nor unlikely": 0.5,
    "Somewhat likely": 0.75,
    "Very likely": 1.0,
}
# Days per week -> midpoint. Weekday baseline caps at 5 (Mon-Fri).
DAYS_MIDPOINT = {"0-1 days": 0.5, "2-3 days": 2.5, "4-5 days": 4.5, "6-7 days": 6.5}
# Stay on campus during holidays -> probability
HOLIDAY_STAY_SCORE = {"Never": 0.0, "Rarely": 0.25, "Sometimes": 0.6, "Always": 1.0}
# Short break: these answers mean the cafeteria loses the customer for that meal
SHORT_BREAK_LOST = {"Skip the meal", "Eat something quick elsewhere"}

# --- Model settings ----------------------------------------------------------
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
CALENDAR = ["Normal week", "Exam week", "Holiday / break"]
WEATHER = ["Clear", "Heavy rain", "Haze"]
MEALS = ["Lunch", "Dinner"]

DEMAND_FLOOR = 0.20          # never predict below 20% of a normal day
RISK_THRESHOLDS = {"Low": 0.80, "Medium": 0.55}  # demand >= 0.80 Low, >= 0.55 Medium, else High
RISK_ORDER = ["Low", "Medium", "High"]

# Simulation of day-to-day variation for training data
SIM_DAYS_PER_SCENARIO = 20   # simulated operating days per scenario combination
DAILY_NOISE_SD = 0.05        # random day-to-day variation in demand (5 percentage points)
RANDOM_SEED = 42
TREE_MAX_DEPTH = 8
