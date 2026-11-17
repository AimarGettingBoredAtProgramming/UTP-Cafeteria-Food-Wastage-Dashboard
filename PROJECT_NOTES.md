# Project Notes – UTP Cafeteria Waste Management System (Group 13, TEB2023)

Working notes for the dashboard build and the final report. Numbers come from the student survey export
`UTP Student Survey for the AI Based Cafeteria Waste Management Project(1-56).csv` (56 responses, 2–13 Nov 2026).

---

## 1. Scope decisions (record these in the report as scope changes)

| Decision | Reason | Where to mention |
|---|---|---|
| Vendor questionnaire and vendor interview **dropped** | Too time-consuming; lecturer did not think vendor data would suffice | Preliminary Study → Method + Limitations |
| Tool is for **all UTP cafeteria vendors**, not just Village 2 | Survey asked about each student's *preferred* cafeteria; per-village samples too small to split | Introduction → Scope; Proposed Solution → Users |
| Student survey is the **only data source** | — | Preliminary Study → Data sources |
| Prototype = **interactive mock dashboard** with scenario selectors | Brief allows mock / proof-of-concept | Prototype section |
| Results are **simulated**, derived from survey-based weights | No real sales / leftover records | Every results screenshot + Limitations |

Proposal sections that need updating: Objective 1, Table 2.1 Phase 1, Section 4.1 (all still mention vendor interviews/questionnaire), and the outcome "baseline waste estimates through vendor interviews".

---

## 2. Survey findings (n = 56)

### Respondents
- Year: Year 2 52%, Year 1 23%, Foundation 11%, Year 3 5%, Year 4 5%, Postgrad 4%
- Residence: V5 19 (34%), V2 9, V3 8, V6 7, V1 5, V4 3, V7 3, Off-campus 2 → **pooled analysis only**

### Eating habits
- Days/week at preferred cafeteria: 0–1 7%, 2–3 36%, 4–5 38%, 6–7 20% (mean ≈ 3.9 days)
- Meals: Lunch 95%, Dinner 75%, Breakfast 25%, Supper 18%, Tea 12%
- Lunch time: <12:00 5%, **12–1 PM 55%**, 1–2 PM 14%, **after 2 PM 25%**
- Dine-in 50%, Both 43%, Takeaway only 7%

### Demand multipliers (core of the model)
Likert scored as probability: Very unlikely 0 · Somewhat unlikely 0.25 · Neither 0.5 · Somewhat likely 0.75 · Very likely 1.
Baseline = normal weekday probability from Q3 (days/week, capped at 5 weekdays) = **0.72**.

| Condition | Source | Avg probability | Multiplier |
|---|---|---|---|
| Normal weekday | Q3 | 0.72 | ×1.00 |
| Exam week | Q7 | 0.59 | ×0.82 |
| Friday | Q8 | 0.53 | ×0.74 |
| Hazy day | Q13 | 0.48 | ×0.66 |
| Weekend | Q9 | 0.47 | ×0.65 |
| Heavy rain | Q12 | 0.32 | ×0.45 (68% unlikely – strongest effect) |
| Public holiday / break | Q10 (Never 0, Rarely .25, Sometimes .6, Always 1) | 0.23 | ×0.23 (77% never/rarely stay) |
| Short class break <1 hr | Q11 | 23% still eat, 36% shift time, 41% skip/elsewhere | lunch-peak ×0.59 |

Combination rule: multiply factors (assumes independence) → **floor at ~20%** to avoid unrealistic near-zero results.

Example scenarios:
- Normal Monday, clear → 100% → Low risk
- Exam-week Wednesday → 82% → Low
- Friday, clear → 74% → Medium
- Friday + rain → 33% → High
- Public holiday → ~23% → High

Proposed risk thresholds (tunable): Low ≥ 80% · Medium 55–80% · High < 55%.

### Leftovers (plate waste)
- How often leave food: Never 38%, Rarely 54%, Sometimes 9% → **91% rarely/never** (37.5% + 53.6%)
- Main reasons (of those who leave): Ordered too much 16%, Taste 14%, Too oily 9%, Portion too big 9%, Not hungry 7%, No time 4%
- Interpretation: plate waste is low → main waste lever is **vendor over-preparation**, which supports the tool's purpose.

### Forecast acceptance
- If told cafeteria would be busy: Eat elsewhere 43%, Eat earlier/later 34%, Same time 20%, Not sure 4%
- **77% would change behaviour** → students respond to forecasts; supports a demand-aware tool.

### Data quality notes
- One Foundation respondent selected only "Supper" but answered the lunch-time question (minor inconsistency).
- No direct "normal weekday likelihood" question → baseline inferred from Q3 (state as assumption).
- Self-reported intention, not observed behaviour.

---

## 3. AI model plan

- **Input:** day of week, calendar (normal / exam week / holiday-break), weather (clear / rain / haze), short class breaks (yes/no), vendor's usual batch size.
- **Process:**
  1. Survey → multipliers (above).
  2. Generate all scenario combinations (7 days × 3 calendar × 3 weather × 2 break = 126 rows) → expected demand % → risk label.
  3. Train a **decision tree classifier** on the scenario table (explainable; show decision path in dashboard).
- **Output:** risk tier (Low/Medium/High), expected demand %, recommended portions (usual batch × demand %, ±10% range), timing advice, estimated food/energy saved, "Simulated" label.
- **Honest framing:** the tree learns rules derived from survey weights; it is a proof of concept, not a trained-on-sales forecaster.

## 4. Dashboard features (planned)
- Inputs: day, calendar, weather, class-break toggle, usual batch size, (optional) cafeteria name.
- Outputs: colour-coded risk card, demand gauge, recommended batch with range, "why" decision path,
  peak-time chart from Q5 (warmers down after 2:30 PM, not 2:00 – 25% eat after 2 PM),
  takeaway packaging tip on rainy days, portion-size tip from Q15, estimated portions/energy saved.
- Footer label: "Simulated – based on survey of 56 UTP students."

---

## 5. How to write the final report (maps to brief Section 6)

1. **Cover page** – title, TEB2023, group members (brief asks for 5 – currently 4 listed), submission date.
2. **Abstract** – problem (vendor over-preparation → food + gas/electricity waste), study (survey n=56), AI idea (scenario-based decision tree advisory dashboard), main result (rain and holidays cause the largest demand drops; tool recommends smaller batches in those scenarios).
3. **Introduction** – UTP village cafeterias context; problem statement; refined project question, e.g.
   *"Can student-reported dining behaviour under different calendar and weather conditions be used to give UTP cafeteria vendors a simple daily batch-cooking risk estimate?"*; objectives (updated without vendor interviews).
4. **Preliminary study**
   - Method: online Microsoft Forms survey, 16 questions, anonymous, voluntary, 2–13 Nov 2026, n=56.
   - Findings: tables/charts from Section 2 above (bar charts for each multiplier, lunch-time distribution, leftover reasons, forecast acceptance).
   - Limitations: small convenience sample skewed to Year 2 & Village 5; self-reported; no vendor/sales data; no normal-day likelihood question.
   - Scope change: vendor component dropped (reason).
5. **Proposed AI solution** – users (vendors, cafeteria management), inputs, multiplier method, decision tree, workflow diagram (Input → Survey weights → Demand % → Decision tree → Risk tier + Batch advice → Vendor action), expected output.
6. **Prototype** – option: interactive mock dashboard; screenshots; the 5 test scenarios (normal Monday, Friday, rainy day, exam-week day, public holiday) with output table; clearly state what is simulated.
7. **Discussion**
   - Benefits: less food cooked and discarded; less gas for unneeded batches; warmers/hoods reduced in off-peak (SDG 12 + SDG 7); vendor cost savings.
   - Feasibility: no hardware, runs in browser, vendor only enters usual batch size.
   - Limitations/risks: independence assumption, compounding factors (floored at 20%), intention ≠ behaviour, under-prediction risk → food shortage (mitigate with "cook second batch if needed" advice).
   - Ethics: anonymous survey, no names collected, consent, output labelled as estimate; vendor makes final decision.
   - Next steps: collect real cooked/sold/leftover logs from 1–2 vendors to replace simulated labels; add headcount observations; per-cafeteria calibration; live weather feed.
8. **Conclusion & references** – keep Ali et al. (2022), Daud et al. (2022), Achariam (2026); add a source for gas/electricity-per-portion figure if used.
   **Appendices** – full survey questions, raw CSV (anonymised), scenario table, model code.

Deliverables to attach: CSV/Excel of responses, scenario table, dashboard (link or file) + screenshots/video, presentation slides.
