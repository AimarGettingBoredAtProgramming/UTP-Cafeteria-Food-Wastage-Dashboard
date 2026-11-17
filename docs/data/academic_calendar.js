/* UTP academic calendar + public holidays used by the dashboard's live mode.
 *
 * Source: UTP Academic Calendar 2027 (Foundation, Undergraduate and MSc Taught Course),
 *         including the weekly calendars and "No Physical Class on Campus" notices.
 * The September 2026 semester is not in that document. Its dates are ESTIMATED by applying
 * the official Sept 2027 pattern (orientation, 12 lecture weeks, 3-day study break, 11 exam
 * days, break until the next orientation on 4 Jan 2027) to the 2026 dates.
 * Those periods are marked `estimated: true` and the dashboard labels them.
 *
 * Period types -> model "Academic calendar" input:
 *   "teaching"     -> Normal week      (week numbers count from the period start)
 *   "study"        -> Exam week        (students stay in to revise)
 *   "exam"         -> Exam week
 *   "break"        -> Holiday / break
 *   "orientation"  -> Holiday / break  (only new students on campus)
 *   "no_class"     -> Holiday / break  (official "no physical class on campus")
 * Public holidays -> Holiday / break. Specific periods (no_class) take priority over
 * the teaching period they sit inside. Dates are ISO (YYYY-MM-DD) and `end` is inclusive.
 */
window.ACADEMIC_CALENDAR = {
  source: "UTP Academic Calendar 2027 (Foundation, Undergraduate and MSc Taught Course)",
  periods: [
    // ---- September 2026 semester: ESTIMATED from the Sept 2027 pattern ----
    { semester: "Sept 2026 Semester", name: "Orientation week", type: "orientation", start: "2026-09-01", end: "2026-09-06", estimated: true },
    { semester: "Sept 2026 Semester", name: "Lectures", type: "teaching", start: "2026-09-07", end: "2026-11-27", estimated: true },
    { semester: "Sept 2026 Semester", name: "Study break", type: "study", start: "2026-11-28", end: "2026-11-30", estimated: true },
    { semester: "Sept 2026 Semester", name: "Final examination", type: "exam", start: "2026-12-01", end: "2026-12-15", estimated: true },
    { semester: "Sept 2026 Semester", name: "Semester break", type: "break", start: "2026-12-16", end: "2027-01-03", estimated: true },

    // ---- January 2027 semester (official) ----
    { semester: "Jan 2027 Semester", name: "Orientation week", type: "orientation", start: "2027-01-04", end: "2027-01-10" },
    { semester: "Jan 2027 Semester", name: "No physical class on campus (Chinese New Year)", type: "no_class", start: "2027-02-03", end: "2027-02-10" },
    { semester: "Jan 2027 Semester", name: "No physical class on campus (Hari Raya Aidilfitri)", type: "no_class", start: "2027-03-08", end: "2027-03-12" },
    { semester: "Jan 2027 Semester", name: "Lectures", type: "teaching", start: "2027-01-11", end: "2027-04-02" },
    { semester: "Jan 2027 Semester", name: "Study break", type: "study", start: "2027-04-03", end: "2027-04-05" },
    { semester: "Jan 2027 Semester", name: "Final examination", type: "exam", start: "2027-04-06", end: "2027-04-20" },
    { semester: "Jan 2027 Semester", name: "Semester break", type: "break", start: "2027-04-21", end: "2027-05-02" },

    // ---- May 2027 semester (official) ----
    { semester: "May 2027 Semester", name: "Orientation week", type: "orientation", start: "2027-05-03", end: "2027-05-09" },
    { semester: "May 2027 Semester", name: "No physical class on campus (Aidiladha & Wesak)", type: "no_class", start: "2027-05-18", end: "2027-05-21" },
    { semester: "May 2027 Semester", name: "Lectures", type: "teaching", start: "2027-05-10", end: "2027-07-30" },
    { semester: "May 2027 Semester", name: "Study break", type: "study", start: "2027-07-31", end: "2027-08-02" },
    { semester: "May 2027 Semester", name: "Final examination", type: "exam", start: "2027-08-03", end: "2027-08-18" },
    { semester: "May 2027 Semester", name: "Semester break", type: "break", start: "2027-08-19", end: "2027-08-31" },

    // ---- September 2027 semester (official) ----
    { semester: "Sept 2027 Semester", name: "Orientation week", type: "orientation", start: "2027-09-01", end: "2027-09-05" },
    { semester: "Sept 2027 Semester", name: "No physical class on campus (Deepavali)", type: "no_class", start: "2027-10-25", end: "2027-10-29" },
    { semester: "Sept 2027 Semester", name: "Lectures", type: "teaching", start: "2027-09-06", end: "2027-11-26" },
    { semester: "Sept 2027 Semester", name: "Study break", type: "study", start: "2027-11-27", end: "2027-11-29" },
    { semester: "Sept 2027 Semester", name: "Final examination", type: "exam", start: "2027-11-30", end: "2027-12-14" },
    { semester: "Sept 2027 Semester", name: "Semester break", type: "break", start: "2027-12-15", end: "2028-01-09" }
  ],
  public_holidays: [
    // 2026 (Perak) - officeholidays.com
    { date: "2026-11-06", name: "Birthday of the Sultan of Perak" },
    { date: "2026-11-08", name: "Deepavali" },
    { date: "2026-11-09", name: "Deepavali (replacement holiday)" },
    { date: "2026-12-25", name: "Christmas Day" },
    // 2027 - UTP Academic Calendar 2027 (subject to change)
    { date: "2027-01-01", name: "New Year's Day" },
    { date: "2027-01-22", name: "Thaipusam" },
    { date: "2027-02-06", name: "Chinese New Year" },
    { date: "2027-02-07", name: "Chinese New Year" },
    { date: "2027-02-08", name: "Chinese New Year (replacement holiday)" },
    { date: "2027-02-24", name: "Nuzul Al-Quran" },
    { date: "2027-03-10", name: "Hari Raya Aidilfitri" },
    { date: "2027-03-11", name: "Hari Raya Aidilfitri" },
    { date: "2027-05-01", name: "Labour Day" },
    { date: "2027-05-17", name: "Hari Raya Aidiladha" },
    { date: "2027-05-20", name: "Wesak Day" },
    { date: "2027-06-06", name: "Awal Muharram" },
    { date: "2027-06-07", name: "Agong's Birthday" },
    { date: "2027-06-08", name: "Replacement holiday" },
    { date: "2027-08-15", name: "Maulidur Rasul" },
    { date: "2027-08-16", name: "Maulidur Rasul (replacement holiday)" },
    { date: "2027-08-31", name: "National Day" },
    { date: "2027-09-16", name: "Malaysia Day" },
    { date: "2027-10-28", name: "Deepavali" },
    { date: "2027-11-05", name: "Birthday of the Sultan of Perak" },
    { date: "2027-12-25", name: "Christmas Day" },
    { date: "2028-01-01", name: "New Year's Day" }
  ]
};
