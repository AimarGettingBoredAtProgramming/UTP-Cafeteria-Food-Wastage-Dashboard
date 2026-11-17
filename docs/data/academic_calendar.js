/* UTP academic calendar + Perak public holidays used by the dashboard's live mode.
 *
 * HOW TO UPDATE: replace the dates below with the official UTP Registry calendar
 * for the current semester, then set `verified: true`. Dates are ISO (YYYY-MM-DD),
 * and `end` is inclusive.
 *
 * Period types map onto the model's "Academic calendar" input:
 *   "teaching"  -> Normal week
 *   "study"     -> Exam week   (students stay in to revise)
 *   "exam"      -> Exam week
 *   "break"     -> Holiday / break
 * Any public holiday below            -> Holiday / break
 * Dates outside every period          -> Normal week
 */
window.ACADEMIC_CALENDAR = {
  semester: "September 2026 Semester",
  verified: false,
  source: "Estimated from the course timeline (Week 1 = 14 Sep 2026). Replace with the official UTP Registry academic calendar.",
  periods: [
    { name: "Teaching weeks 1-14", type: "teaching", start: "2026-09-14", end: "2026-12-18" },
    { name: "Study week", type: "study", start: "2026-12-19", end: "2026-12-27" },
    { name: "Final examination", type: "exam", start: "2026-12-28", end: "2027-01-15" },
    { name: "Semester break", type: "break", start: "2027-01-16", end: "2027-02-14" }
  ],
  holidays_source: "Perak 2026 public holidays (officeholidays.com). Islamic dates depend on moon sighting; check the state gazette.",
  public_holidays: [
    { date: "2026-08-25", name: "Maulidur Rasul" },
    { date: "2026-08-31", name: "National Day" },
    { date: "2026-09-16", name: "Malaysia Day" },
    { date: "2026-11-06", name: "Birthday of the Sultan of Perak" },
    { date: "2026-11-08", name: "Deepavali" },
    { date: "2026-11-09", name: "Deepavali (replacement holiday)" },
    { date: "2026-12-25", name: "Christmas Day" },
    { date: "2027-01-01", name: "New Year's Day" }
  ]
};
