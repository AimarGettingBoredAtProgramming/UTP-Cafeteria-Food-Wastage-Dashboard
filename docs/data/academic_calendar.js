/* UTP academic calendar + public holidays used by the dashboard's live mode.
 *
 * Sources: UTP Academic Calendar 2026 and UTP Academic Calendar 2027
 *          (Foundation, Undergraduate and MSc Taught Course), including the weekly
 *          calendars, "blended learning" and "no physical class on campus" notices.
 *
 * Period types -> model "Academic calendar" input:
 *   "teaching"     -> Normal week      (week numbers count from the period start)
 *   "blended"      -> Normal week      (shown as blended learning; classes partly online)
 *   "study"        -> Exam week        (students stay in to revise)
 *   "exam"         -> Exam week
 *   "break"        -> Holiday / break
 *   "orientation"  -> Holiday / break  (only new students on campus)
 *   "no_class"     -> Holiday / break  (official "no physical class on campus")
 * Public holidays -> Holiday / break. no_class/blended take priority over the lecture period
 * they sit inside. Dates are ISO (YYYY-MM-DD) and `end` is inclusive.
 */
window.ACADEMIC_CALENDAR = {
  source: "UTP Academic Calendar 2026 & 2027 (Foundation, Undergraduate and MSc Taught Course)",
  periods: [
    // ---- January 2026 semester ----
    { semester: "Jan 2026 Semester", name: "Orientation week", type: "orientation", start: "2026-01-05", end: "2026-01-11" },
    { semester: "Jan 2026 Semester", name: "Blended learning", type: "blended", start: "2026-02-16", end: "2026-02-20" },
    { semester: "Jan 2026 Semester", name: "Blended learning", type: "blended", start: "2026-03-18", end: "2026-03-19" },
    { semester: "Jan 2026 Semester", name: "No physical class on campus (Hari Raya Aidilfitri)", type: "no_class", start: "2026-03-20", end: "2026-03-23" },
    { semester: "Jan 2026 Semester", name: "Lectures", type: "teaching", start: "2026-01-12", end: "2026-04-03" },
    { semester: "Jan 2026 Semester", name: "Study break", type: "study", start: "2026-04-04", end: "2026-04-08" },
    { semester: "Jan 2026 Semester", name: "Final examination", type: "exam", start: "2026-04-09", end: "2026-04-21" },
    { semester: "Jan 2026 Semester", name: "Semester break", type: "break", start: "2026-04-22", end: "2026-05-03" },

    // ---- May 2026 semester ----
    { semester: "May 2026 Semester", name: "Orientation week", type: "orientation", start: "2026-05-04", end: "2026-05-10" },
    { semester: "May 2026 Semester", name: "Blended learning", type: "blended", start: "2026-05-25", end: "2026-05-29" },
    { semester: "May 2026 Semester", name: "Lectures", type: "teaching", start: "2026-05-11", end: "2026-07-31" },
    { semester: "May 2026 Semester", name: "Study break", type: "study", start: "2026-08-01", end: "2026-08-05" },
    { semester: "May 2026 Semester", name: "Final examination", type: "exam", start: "2026-08-06", end: "2026-08-18" },
    { semester: "May 2026 Semester", name: "Semester break", type: "break", start: "2026-08-19", end: "2026-08-31" },

    // ---- September 2026 semester ----
    { semester: "Sept 2026 Semester", name: "Orientation week", type: "orientation", start: "2026-09-01", end: "2026-09-06" },
    { semester: "Sept 2026 Semester", name: "Blended learning", type: "blended", start: "2026-11-02", end: "2026-11-15" },
    { semester: "Sept 2026 Semester", name: "Lectures", type: "teaching", start: "2026-09-07", end: "2026-11-27" },
    { semester: "Sept 2026 Semester", name: "Study break", type: "study", start: "2026-11-28", end: "2026-12-02" },
    { semester: "Sept 2026 Semester", name: "Final examination", type: "exam", start: "2026-12-03", end: "2026-12-15" },
    { semester: "Sept 2026 Semester", name: "Semester break", type: "break", start: "2026-12-16", end: "2027-01-03" },

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
    // 2026 - UTP Academic Calendar 2026 (JPM Hari Kelepasan Am 2026; subject to change)
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-02-01", name: "Thaipusam" },
    { date: "2026-02-02", name: "Thaipusam (replacement holiday)" },
    { date: "2026-02-17", name: "Chinese New Year" },
    { date: "2026-02-18", name: "Chinese New Year" },
    { date: "2026-03-06", name: "Nuzul Al-Quran (replacement holiday)" },
    { date: "2026-03-07", name: "Nuzul Al-Quran" },
    { date: "2026-03-21", name: "Hari Raya Aidilfitri" },
    { date: "2026-03-22", name: "Hari Raya Aidilfitri" },
    { date: "2026-05-01", name: "Labour Day" },
    { date: "2026-05-27", name: "Hari Raya Aidiladha" },
    { date: "2026-05-31", name: "Wesak Day" },
    { date: "2026-06-01", name: "Agong's Birthday" },
    { date: "2026-06-02", name: "Wesak Day (replacement holiday)" },
    { date: "2026-06-17", name: "Awal Muharram" },
    { date: "2026-08-25", name: "Maulidur Rasul" },
    { date: "2026-08-31", name: "National Day" },
    { date: "2026-09-16", name: "Malaysia Day" },
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
