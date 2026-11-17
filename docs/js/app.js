/* UTP Cafeteria Batch Advisor - dashboard logic.
 *
 * Data sources
 *  - data/dashboard_data.js   trained decision tree + survey summary (built by src/train_model.py)
 *  - data/academic_calendar.js UTP semester periods + Perak public holidays
 *  - Open-Meteo APIs           live weather + air-quality (haze) forecast for UTP
 *
 * The decision tree trained in Python is walked node-by-node here, so the browser
 * gives exactly the same prediction as the scikit-learn model.
 */
(function () {
  "use strict";
  const D = window.DASHBOARD_DATA;
  const CAL = window.ACADEMIC_CALENDAR || { periods: [], public_holidays: [], verified: false };
  if (!D) { document.body.innerHTML = "<p style='padding:40px;color:#fff'>dashboard_data.js missing - run <code>python src/run_all.py</code>.</p>"; return; }

  const S = D.survey, M = S.multipliers, CFG = D.settings, TREE = D.tree;
  const $ = (id) => document.getElementById(id);
  const fmt = (n, d = 0) => Number(n).toLocaleString("en-MY", { maximumFractionDigits: d, minimumFractionDigits: d });

  const COLORS = { Low: "#34d399", Medium: "#fbbf24", High: "#f87171", brand: "#38bdf8", teal: "#2dd4bf", grey: "#475569" };
  const SOFT = { Low: "rgba(52,211,153,.14)", Medium: "rgba(251,191,36,.14)", High: "rgba(248,113,113,.14)" };
  const GRID = "rgba(148,163,184,.10)";
  const DAY_FULL = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
  const ICONS = { Lunch: "🍛", Dinner: "🌙", "Normal week": "📘", "Exam week": "📝", "Holiday / break": "🏖️", Clear: "☀️", "Heavy rain": "🌧️", Haze: "🌫️" };
  const SHORT = { "Normal week": "Normal", "Exam week": "Exam", "Holiday / break": "Holiday" };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* ---------------------------------------------------------- live config */
  const UTP = { lat: 4.385, lon: 100.979 };
  const MEAL_HOURS = { Lunch: [11, 12, 13, 14], Dinner: [17, 18, 19, 20] };
  const RULES = { heavyRainMm: 2.5, heavyRainProb: 75, heavyRainProbMinMm: 1, hazePm25: 35 };

  /* ---------------------------------------------------------------- dates */
  const todayKL = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
  const toDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  const toIso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const addDays = (iso, n) => { const d = toDate(iso); d.setDate(d.getDate() + n); return toIso(d); };
  const dowIdx = (iso) => (toDate(iso).getDay() + 6) % 7; // Mon = 0
  const shortDate = (iso) => { const d = toDate(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

  /* -------------------------------------------------------------- state */
  const state = {
    date: todayKL(), live: true, ovCal: false, ovWx: false,
    day: "Wed", meal: "Lunch", calendar: "Normal week", weather: "Clear", shortBreak: false, batch: 120,
  };
  const WX = { status: "loading", byDate: {}, first: null, last: null, aqLast: null };

  /* ------------------------------------------------------------ calendar */
  function calendarFor(iso) {
    const inside = (CAL.periods || []).filter((x) => x.start <= iso && iso <= x.end);
    // the most specific period wins: a "no physical class" week sits inside the lecture period
    const p = inside.find((x) => x.type === "no_class") || inside[0];
    const est = p && p.estimated;
    const semLine = (p ? p.semester : "") + (est ? " · estimated dates" : "");
    const hol = (CAL.public_holidays || []).find((h) => h.date === iso);
    if (hol) return { calendar: "Holiday / break", title: hol.name, sub: "Public holiday" + (p ? ` · ${p.semester}` : ""), ico: "🏖️", estimated: false };
    if (!p) return { calendar: "Normal week", title: "No calendar entry", sub: "Treated as a normal week", ico: "📘", estimated: false };
    if (p.type === "teaching") {
      const wk = Math.floor((toDate(iso) - toDate(p.start)) / 864e5 / 7) + 1;
      return { calendar: "Normal week", title: `Lecture week ${wk}`, sub: semLine, ico: "📘", estimated: est };
    }
    const map = {
      study: ["Exam week", "📚"], exam: ["Exam week", "📝"], break: ["Holiday / break", "🏖️"],
      orientation: ["Holiday / break", "🎒"], no_class: ["Holiday / break", "🏠"],
    };
    const [cal, ico] = map[p.type] || ["Normal week", "📘"];
    return { calendar: cal, title: p.name, sub: semLine, ico, estimated: est };
  }

  /* ------------------------------------------------------------- weather */
  async function loadWeather() {
    const tz = "Asia%2FKuala_Lumpur";
    const fUrl = `https://api.open-meteo.com/v1/forecast?latitude=${UTP.lat}&longitude=${UTP.lon}` +
      `&hourly=precipitation,precipitation_probability,weather_code,temperature_2m&timezone=${tz}&forecast_days=16`;
    const aUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${UTP.lat}&longitude=${UTP.lon}` +
      `&hourly=pm2_5&timezone=${tz}&forecast_days=5`;
    const [f, a] = await Promise.allSettled([fetch(fUrl).then((r) => r.ok ? r.json() : Promise.reject(r.status)),
                                             fetch(aUrl).then((r) => r.ok ? r.json() : Promise.reject(r.status))]);
    if (f.status !== "fulfilled") { WX.status = "error"; return; }

    const slot = (iso, meal) => {
      WX.byDate[iso] = WX.byDate[iso] || {};
      return (WX.byDate[iso][meal] = WX.byDate[iso][meal] || { rain: 0, prob: 0, code: 0, temps: [], pm: [] });
    };
    const mealOf = (h) => Object.keys(MEAL_HOURS).find((m) => MEAL_HOURS[m].includes(h));
    const H = f.value.hourly;
    H.time.forEach((t, i) => {
      const meal = mealOf(+t.slice(11, 13));
      if (!meal) return;
      const s = slot(t.slice(0, 10), meal);
      s.rain += H.precipitation[i] || 0;
      s.prob = Math.max(s.prob, H.precipitation_probability[i] || 0);
      s.code = Math.max(s.code, H.weather_code[i] || 0);
      s.temps.push(H.temperature_2m[i]);
    });
    if (a.status === "fulfilled") {
      const A = a.value.hourly;
      A.time.forEach((t, i) => {
        const meal = mealOf(+t.slice(11, 13));
        if (meal && A.pm2_5[i] != null) slot(t.slice(0, 10), meal).pm.push(A.pm2_5[i]);
      });
      WX.aqLast = A.time[A.time.length - 1].slice(0, 10);
    }
    const dates = Object.keys(WX.byDate).sort();
    WX.first = dates[0]; WX.last = dates[dates.length - 1];
    WX.status = a.status === "fulfilled" ? "ok" : "partial";
  }

  function codeIcon(code) {
    if (code >= 95) return "⛈️";
    if (code >= 51) return "🌧️";
    if (code === 45 || code === 48) return "🌫️";
    if (code >= 2) return "⛅";
    return "☀️";
  }

  function weatherFor(iso, meal) {
    const s = WX.byDate[iso] && WX.byDate[iso][meal];
    if (!s) return null;
    const pm = s.pm.length ? s.pm.reduce((x, y) => x + y, 0) / s.pm.length : null;
    const temp = s.temps.length ? Math.round(s.temps.reduce((x, y) => x + y, 0) / s.temps.length) : null;
    let weather = "Clear";
    if (s.rain >= RULES.heavyRainMm || (s.prob >= RULES.heavyRainProb && s.rain >= RULES.heavyRainProbMinMm)) weather = "Heavy rain";
    else if (pm != null && pm >= RULES.hazePm25) weather = "Haze";
    const title = weather === "Heavy rain" ? "Heavy rain expected"
      : weather === "Haze" ? "Hazy air expected"
      : s.rain >= 0.2 ? "Light showers only" : (s.code >= 2 ? "Cloudy, mostly dry" : "Fair and dry");
    const parts = [`${s.rain.toFixed(1)} mm rain`, `${Math.round(s.prob)}% chance`];
    if (temp != null) parts.push(`${temp}°C`);
    parts.push(pm != null ? `PM2.5 ${Math.round(pm)} µg/m³` : "no haze data");
    return { weather, title, sub: parts.join(" · "), ico: weather === "Haze" ? "🌫️" : codeIcon(s.code) };
  }

  /* ------------------------------------------------------------ scenario */
  function scenarioFor(iso, opts = {}) {
    const meal = state.meal;
    const cal = calendarFor(iso);
    const wx = weatherFor(iso, meal);
    if (!state.live && !opts.forceLive) {
      return { date: iso, day: opts.day || state.day, meal, calendar: state.calendar, weather: state.weather,
               shortBreak: state.shortBreak, src: { cal: "manual", wx: "manual" }, cal, wx };
    }
    return {
      date: iso, day: CFG.days[dowIdx(iso)], meal, shortBreak: state.shortBreak,
      calendar: state.ovCal ? state.calendar : cal.calendar,
      weather: state.ovWx ? state.weather : (wx ? wx.weather : "Clear"),
      src: { cal: state.ovCal ? "manual" : "live", wx: state.ovWx ? "manual" : (wx ? "live" : "fallback") },
      cal, wx,
    };
  }

  /* --------------------------------------------------------------- model */
  function encode(s) {
    return {
      is_friday: +(s.day === "Fri"),
      is_weekend: +(s.day === "Sat" || s.day === "Sun"),
      exam_week: +(s.calendar === "Exam week"),
      holiday: +(s.calendar === "Holiday / break"),
      heavy_rain: +(s.weather === "Heavy rain"),
      haze: +(s.weather === "Haze"),
      short_break: +s.shortBreak,
      is_lunch: +(s.meal === "Lunch"),
    };
  }

  // Same formula as src/build_dataset.py -> expected_demand()
  function demand(s) {
    const f = [];
    if (s.day === "Fri") f.push(["Friday", M.friday]);
    else if (s.day === "Sat" || s.day === "Sun") f.push(["Weekend", M.weekend]);
    if (s.calendar === "Exam week") f.push(["Exam week", M.exam_week]);
    else if (s.calendar === "Holiday / break") f.push(["Holiday / break", M.holiday]);
    if (s.weather === "Heavy rain") f.push(["Heavy rain", M.heavy_rain]);
    else if (s.weather === "Haze") f.push(["Haze", M.haze]);
    if (s.shortBreak && s.meal === "Lunch" && !["Sat", "Sun"].includes(s.day) && s.calendar !== "Holiday / break")
      f.push(["Short class breaks", M.short_break]);
    const raw = f.reduce((a, [, m]) => a * m, 1);
    return { value: Math.max(raw, CFG.demand_floor), raw, factors: f, floored: raw < CFG.demand_floor };
  }

  function predict(features) {
    const nodes = TREE.nodes, path = [];
    let i = 0;
    while (nodes[i].left !== -1) {
      const n = nodes[i], x = features[n.feature];
      path.push({ feature: n.feature, yes: !!x });
      i = x > n.threshold ? n.right : n.left;
    }
    const probs = nodes[i].probs;
    let best = 0;
    probs.forEach((p, k) => { if (p > probs[best]) best = k; });
    return { tier: TREE.classes[best], confidence: probs[best], path, leafSamples: nodes[i].samples };
  }

  function assumptions() {
    const v = (id, d) => { const x = parseFloat($(id).value); return isFinite(x) && x >= 0 ? x : d; };
    return { kg: v("a-kg", 0.35), rm: v("a-rm", 4), kwh: v("a-kwh", 0.4), warm: v("a-warm", 1.5), hrs: v("a-hrs", 2), co2: v("a-co2", 0.58) };
  }

  /* ------------------------------------------------------------ controls */
  function buildControls() {
    CFG.days.forEach((d, idx) => {
      const b = document.createElement("button");
      b.className = "chip"; b.textContent = d; b.dataset.val = d; b.type = "button";
      b.onclick = () => {
        if (state.live) { state.date = addDays(state.date, idx - dowIdx(state.date)); state.ovCal = state.ovWx = false; }
        else state.day = d;
        render();
      };
      $("day-chips").appendChild(b);
    });
    const seg = (el, key, opts, ov) => opts.forEach((o) => {
      const b = document.createElement("button");
      b.className = "seg-btn"; b.type = "button"; b.dataset.val = o;
      b.innerHTML = `<span class="ico">${ICONS[o] || ""}</span><span>${SHORT[o] || o}</span>`;
      b.onclick = () => { state[key] = o; if (ov && state.live) state[ov] = true; render(); };
      $(el).appendChild(b);
    });
    seg("meal-seg", "meal", CFG.meals);
    seg("cal-seg", "calendar", CFG.calendar, "ovCal");
    seg("wx-seg", "weather", CFG.weather, "ovWx");

    $("date").value = state.date;
    $("date").onchange = (e) => { if (e.target.value) { state.date = e.target.value; state.ovCal = state.ovWx = false; render(); } };
    $("today-btn").onclick = () => { state.date = todayKL(); state.ovCal = state.ovWx = false; render(); };
    $("live").onchange = (e) => {
      if (!e.target.checked) { // freeze current live values as the manual starting point
        const sc = scenarioFor(state.date);
        Object.assign(state, { day: sc.day, calendar: sc.calendar, weather: sc.weather });
      }
      state.live = e.target.checked; state.ovCal = state.ovWx = false; render();
    };
    $("reset-live").onclick = () => { state.ovCal = state.ovWx = false; render(); };
    $("short-break").onchange = (e) => { state.shortBreak = e.target.checked; render(); };
    const setBatch = (v) => { state.batch = Math.max(1, Math.min(2000, Math.round(v) || 1)); render(); };
    $("batch-range").oninput = (e) => setBatch(+e.target.value);
    $("batch").oninput = (e) => setBatch(+e.target.value);
    ["a-kg", "a-rm", "a-kwh", "a-warm", "a-hrs", "a-co2"].forEach((id) => { $(id).oninput = render; });
    $("cafe").onchange = render;
  }

  function badge(el, src) {
    const b = $(el);
    if (!state.live) { b.textContent = ""; b.className = "badge"; return; }
    const map = { live: ["LIVE", "live"], manual: ["MANUAL", "manual"], fallback: ["NO FORECAST", "manual"] };
    const [t, c] = map[src] || ["", ""];
    b.textContent = t; b.className = "badge " + c;
  }

  function syncControls(sc) {
    document.querySelectorAll("#day-chips .chip").forEach((b) => b.classList.toggle("active", b.dataset.val === sc.day));
    [["meal-seg", sc.meal], ["cal-seg", sc.calendar], ["wx-seg", sc.weather]].forEach(([el, v]) =>
      document.querySelectorAll(`#${el} .seg-btn`).forEach((b) => b.classList.toggle("active", b.dataset.val === v)));
    $("date").value = state.date;
    $("date").disabled = !state.live;
    $("today-btn").disabled = !state.live;
    $("short-break").checked = state.shortBreak;
    if (+$("batch").value !== state.batch) $("batch").value = state.batch;
    $("batch-range").value = Math.min(400, state.batch);
    badge("b-day", state.live ? "live" : "");
    badge("b-cal", sc.src.cal);
    badge("b-wx", sc.src.wx);
    $("reset-live").hidden = !(state.live && (state.ovCal || state.ovWx));
  }

  /* -------------------------------------------------------------- render */
  let slotChart;

  function render() {
    const sc = scenarioFor(state.date);
    syncControls(sc);
    const dem = demand(sc), pred = predict(encode(sc)), A = assumptions();
    const tier = pred.tier, pct = Math.round(dem.value * 100);
    document.documentElement.style.setProperty("--risk", COLORS[tier]);
    document.documentElement.style.setProperty("--risk-soft", SOFT[tier]);

    renderLive(sc);

    const when = state.live ? `${DAY_FULL[sc.day]} ${shortDate(sc.date)}` : DAY_FULL[sc.day];
    $("scenario-title").textContent = `${$("cafe").value} · ${when} · ${sc.meal}`;
    $("risk-tier").textContent = tier;
    $("risk-msg").textContent = {
      Low: "Customer numbers should be close to a normal day. Cook as usual and keep the normal warmer schedule.",
      Medium: "Expect noticeably fewer customers. Cook a smaller first batch and top up only if it sells.",
      High: "Expect far fewer customers than usual. Cook a small first batch and cook more only when needed.",
    }[tier];
    $("demand-pct").textContent = pct;
    const arc = 157.1;
    $("gauge-fg").style.strokeDasharray = arc;
    $("gauge-fg").style.strokeDashoffset = arc * (1 - Math.min(dem.value, 1));
    $("conf-bar").style.width = Math.round(pred.confidence * 100) + "%";
    $("conf-pct").textContent = Math.round(pred.confidence * 100) + "%";

    const rec = Math.round(state.batch * dem.value);
    const lo = Math.round(rec * 0.9), hi = Math.min(state.batch, Math.round(rec * 1.1));
    const saved = state.batch - rec;
    const warmerKwh = tier === "High" ? A.warm * A.hrs : tier === "Medium" ? A.warm * A.hrs * 0.5 : 0;
    const kwh = saved * A.kwh + warmerKwh;
    $("kpi-rec").textContent = fmt(rec);
    $("kpi-range").textContent = `portions · range ${fmt(lo)}–${fmt(hi)}`;
    $("kpi-saved").textContent = fmt(saved);
    $("kpi-kg").textContent = fmt(saved * A.kg, 1) + " kg";
    $("kpi-rm").textContent = `≈ RM ${fmt(saved * A.rm)} in ingredients`;
    $("kpi-kwh").textContent = fmt(kwh, 1) + " kWh";
    $("kpi-co2").textContent = `≈ ${fmt(kwh * A.co2, 1)} kg CO₂ avoided`;

    renderPlan(sc, tier, rec);
    renderWhy(dem, pred);
    renderWeek();
    renderSlots(sc, dem, tier);
    renderTips(sc);
  }

  function renderLive(sc) {
    const applied = state.live ? "" : " · not applied (manual mode)";
    $("wx-when").textContent = `${sc.meal.toLowerCase()} window · ${shortDate(sc.date)}`;
    if (sc.wx) {
      $("wx-ico").textContent = sc.wx.ico;
      $("wx-title").textContent = sc.wx.title + (sc.src.wx === "manual" ? " (overridden)" : "");
      $("wx-sub").textContent = sc.wx.sub + applied;
    } else {
      $("wx-ico").textContent = "🛰️";
      $("wx-title").textContent = WX.status === "loading" ? "Loading forecast…" : WX.status === "error" ? "Forecast unavailable" : "Outside forecast range";
      $("wx-sub").textContent = WX.status === "error" ? "Offline or blocked. Set the weather by hand."
        : WX.last ? `Forecast covers ${shortDate(WX.first)} – ${shortDate(WX.last)}. Assumed clear.` : "Open-Meteo · UTP, Seri Iskandar";
    }
    $("cal-ico").textContent = sc.cal.ico;
    $("cal-title").textContent = sc.cal.title + (sc.src.cal === "manual" ? " (overridden)" : "");
    $("cal-sub").textContent = `${sc.cal.sub}${applied}`;

    const pw = $("pill-weather");
    const wxMap = {
      loading: ["", "Weather: connecting…"], ok: ["ok", "Live weather · Open-Meteo"],
      partial: ["warn", "Live weather · no haze data"], error: ["err", "Weather offline · manual"],
    };
    const [cls, txt] = wxMap[WX.status];
    pw.className = "pill " + cls;
    pw.innerHTML = `<span class="dot"></span>${txt}`;
    const pc = $("pill-cal");
    pc.className = "pill " + (sc.cal.estimated ? "warn" : "ok");
    pc.innerHTML = `<span class="dot"></span>${sc.cal.estimated ? "UTP calendar · estimated" : "UTP academic calendar"}`;
  }

  function renderPlan(sc, tier, rec) {
    const lunch = sc.meal === "Lunch";
    const t = lunch ? { prep: "By 11:30 AM", peak: "12:30 PM check", late: "After 2:30 PM" }
                    : { prep: "By 5:30 PM", peak: "7:30 PM check", late: "After 9:00 PM" };
    const first = { Low: rec, Medium: Math.round(rec * 0.8), High: Math.round(rec * 0.6) }[tier];
    const topUp = Math.max(rec - first, 0);
    const steps = {
      Low: [
        [t.prep, `Cook the full first batch of <strong>${first} portions</strong>.`],
        [t.peak, lunch ? `Expect a normal rush: ${S.lunch_time["12:00 to 1:00 pm"].pct}% of lunch customers arrive 12–1 PM.` : "Expect a normal dinner rush."],
        [t.late, lunch ? `Keep the warmers on, because ${S.lunch_time["After 2:00 pm"].pct}% of students eat lunch after 2 PM. Switch to low heat after 3:00 PM.` : "Turn the warmers down to low once the dinner rush ends."],
      ],
      Medium: [
        [t.prep, `Cook <strong>${first} portions</strong> first. Prep the ingredients for another ${topUp}, but don't cook them yet.`],
        [t.peak, `If more than half has sold, cook the <strong>${topUp}-portion top-up</strong>. If not, skip it.`],
        [t.late, "Move leftovers into fewer warmer wells, switch off the empty wells and run the exhaust hood on low."],
      ],
      High: [
        [t.prep, `Cook only a small first batch of <strong>${first} portions</strong>.`],
        [t.peak, `Cook small top-ups of about ${Math.max(Math.round(state.batch * 0.1), 1)} portions only when a tray is less than a quarter full, up to ${topUp} more in total.`],
        [t.late, "Switch off unused warmer wells and turn the exhaust hood to its lowest setting. This saves gas and electricity on idle equipment."],
      ],
    }[tier];
    $("plan").innerHTML = steps.map(([time, txt]) => `<li><span class="time">${time}</span>${txt}</li>`).join("");
  }

  function renderWhy(dem, pred) {
    const rows = [["Normal weekday", 1], ...dem.factors];
    let html = rows.map(([lbl, m]) => `
      <div class="factor"><span>${lbl}</span><div class="fbar"><div style="width:${Math.min(m, 1) * 100}%"></div></div>
      <span class="fv">${lbl === "Normal weekday" ? "100%" : "×" + m.toFixed(2)}</span></div>`).join("");
    html += `<div class="factor total"><span>Expected demand${dem.floored ? " (floor)" : ""}</span><div class="fbar"><div style="width:${dem.value * 100}%"></div></div><span class="fv">${Math.round(dem.value * 100)}%</span></div>`;
    $("factors").innerHTML = html;
    const L = CFG.feature_labels;
    const steps = pred.path.map((p) => `<li>${L[p.feature].replace(/ \(.*\)/, "")}? <span class="${p.yes ? "yes" : "no"}">${p.yes ? "Yes" : "No"}</span></li>`);
    steps.push(`<li class="leaf">→ <span style="color:${COLORS[pred.tier]}">${pred.tier} risk</span> <span class="muted small">(${Math.round(pred.confidence * 100)}% of ${pred.leafSamples} similar training days)</span></li>`);
    $("path").innerHTML = steps.join("");
  }

  function renderWeek() {
    const el = $("week");
    el.innerHTML = "";
    const start = state.live ? state.date : addDays(state.date, -dowIdx(state.date));
    for (let k = 0; k < 7; k++) {
      const iso = addDays(start, k);
      const sc = state.live ? scenarioFor(iso) : scenarioFor(iso, { day: CFG.days[k] });
      const dm = demand(sc), p = predict(encode(sc));
      const selected = state.live ? iso === state.date : sc.day === state.day;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wday" + (selected ? " sel" : "");
      b.style.setProperty("--tc", COLORS[p.tier]);
      const wico = ICONS[sc.weather];
      b.innerHTML = `<div class="d">${sc.day}</div>${state.live ? `<div class="dt">${shortDate(iso)}</div>` : ""}
        <div class="wi" title="${sc.weather} · ${sc.calendar}">${sc.calendar === "Holiday / break" ? "🏖️" : wico}</div>
        <div class="p">${Math.round(dm.value * 100)}%</div><span class="t t-${p.tier}">${p.tier}</span>`;
      b.onclick = () => { if (state.live) { state.date = iso; state.ovCal = state.ovWx = false; } else state.day = sc.day; render(); };
      el.appendChild(b);
    }
    $("week-note").textContent = state.live ? "Live forecast & calendar · click a day" : `${state.calendar} · ${state.weather} · click a day`;
  }

  function renderSlots(sc, dem, tier) {
    let labels, normal, scen;
    if (sc.meal === "Lunch") {
      const keys = ["Before 12:00 pm", "12:00 to 1:00 pm", "1:00 to 2:00 pm", "After 2:00 pm"];
      labels = ["Before 12 PM", "12–1 PM", "1–2 PM", "After 2 PM"];
      const shares = keys.map((k) => S.lunch_time[k].pct / 100);
      normal = shares.map((s) => Math.round(state.batch * s));
      scen = shares.map((s) => Math.round(state.batch * dem.value * s));
      $("slot-note").textContent = "Lunch timing from survey Q5";
    } else {
      labels = ["Whole dinner service"];
      normal = [state.batch]; scen = [Math.round(state.batch * dem.value)];
      $("slot-note").textContent = "Dinner timing wasn't surveyed, so only the total is shown";
    }
    const data = { labels, datasets: [
      { label: "Normal weekday", data: normal, backgroundColor: "#2a3547", borderRadius: 8 },
      { label: "This service", data: scen, backgroundColor: COLORS[tier], borderRadius: 8 },
    ] };
    if (slotChart) { slotChart.data = data; slotChart.update(); return; }
    slotChart = new Chart($("slot-chart"), { type: "bar", data, options: baseOpts({ y: { title: { display: true, text: "Expected customers" } } }) });
  }

  function renderTips(sc) {
    const pct = (o, k) => (o[k] ? o[k].pct : 0);
    const tips = [];
    if (sc.weather === "Heavy rain")
      tips.push(["☔", "Rain plan", `${Math.round(pct(S.dining_mode, "Both equally") + pct(S.dining_mode, "Takeaway"))}% of students sometimes take their food away. Have containers ready for quick grab-and-go orders.`]);
    if (sc.weather === "Haze")
      tips.push(["🌫️", "Haze plan", "Students stay indoors more on hazy days. Keep the menu short and push takeaway."]);
    if (sc.calendar === "Holiday / break")
      tips.push(["🏖️", "Break day", `Only ${Math.round(M.holiday * 100)}% of students stay on campus during breaks. Run a short menu with your 2–3 best sellers.`]);
    if (sc.calendar === "Exam week")
      tips.push(["📝", "Exam period", "Students stay in to study, so quick takeaway food sells better than full dine-in meals."]);
    if (sc.shortBreak && sc.meal === "Lunch")
      tips.push(["⏱️", "Short breaks", `${pct(S.short_break, "Eat before or after class")}% of students eat before or after class instead. Expect small rushes before 12 and after 2 PM.`]);
    const portion = pct(S.leave_reason, "Ordered too much") + pct(S.leave_reason, "Portion too big");
    tips.push(["🍽️", "Offer a small portion", `${Math.round(portion)}% of students who leave food say they ordered too much or the portion was too big. A half-portion option cuts plate waste.`]);
    const shift = pct(S.forecast_reaction, "Eat somewhere else") + pct(S.forecast_reaction, "Eat earlier or later");
    tips.push(["📣", "Post your quiet hours", `${Math.round(shift)}% of students would change when or where they eat if told it's busy. Posting quiet times spreads out the rush.`]);
    $("tips").innerHTML = tips.slice(0, 3).map(([i, t, d]) => `<div class="card tip"><span class="ti">${i}</span><div><strong>${t}</strong>${d}</div></div>`).join("");
  }

  /* ---------------------------------------------------------- chart utils */
  function baseOpts(scales = {}, extra = {}) {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "rectRounded" } } },
      scales: {
        x: { grid: { display: false }, border: { color: GRID }, ...(scales.x || {}) },
        y: { grid: { color: GRID }, border: { display: false }, beginAtZero: true, ...(scales.y || {}) },
      },
      indexAxis: extra.indexAxis || "x",
    };
  }
  const pctTick = { callback: (v) => v + "%" };
  function hbar(id, obj, color, opts = {}) {
    const labels = Object.keys(obj), vals = labels.map((k) => obj[k].pct);
    return new Chart($(id), {
      type: "bar",
      data: { labels, datasets: [{ data: vals, backgroundColor: color, borderRadius: 6, maxBarThickness: 26 }] },
      options: {
        ...baseOpts({ x: { grid: { color: GRID }, ticks: pctTick, beginAtZero: true, max: opts.max }, y: { grid: { display: false } } }, { indexAxis: "y" }),
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.parsed.x}% (${obj[c.label].count} students)` } } },
      },
    });
  }

  /* ------------------------------------------------------------- insights */
  let insightsBuilt = false;
  function buildInsights() {
    if (insightsBuilt) return;
    insightsBuilt = true;
    const multLabels = { exam_week: "Exam week", friday: "Friday", haze: "Hazy day", weekend: "Weekend", short_break: "Short breaks (lunch)", heavy_rain: "Heavy rain", holiday: "Holiday / break" };
    const keys = Object.keys(multLabels).sort((a, b) => M[b] - M[a]);
    const vals = keys.map((k) => Math.round(M[k] * 100));
    const th = CFG.risk_thresholds;
    new Chart($("ch-mult"), {
      type: "bar",
      data: { labels: ["Normal weekday", ...keys.map((k) => multLabels[k])],
        datasets: [{ data: [100, ...vals], borderRadius: 6, maxBarThickness: 26,
          backgroundColor: [COLORS.grey, ...vals.map((v) => v >= th.Low * 100 ? COLORS.Low : v >= th.Medium * 100 ? COLORS.Medium : COLORS.High)] }] },
      options: { ...baseOpts({ x: { grid: { color: GRID }, ticks: pctTick, max: 100 }, y: { grid: { display: false } } }, { indexAxis: "y" }),
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.parsed.x}% of normal-day demand` } } } },
    });

    const lk = { exam_week: "Exam week", friday: "Friday", weekend: "Weekend", haze: "Haze", heavy_rain: "Heavy rain" };
    const levels = ["Very unlikely", "Somewhat unlikely", "Neither likely nor unlikely", "Somewhat likely", "Very likely"];
    const lkColors = ["#f87171", "#fb923c", "#475569", "#38bdf8", "#2dd4bf"];
    new Chart($("ch-likert"), {
      type: "bar",
      data: { labels: Object.values(lk),
        datasets: levels.map((lv, i) => ({ label: lv.replace(" nor unlikely", ""), data: Object.keys(lk).map((k) => S.likert[k][lv].pct), backgroundColor: lkColors[i], maxBarThickness: 30 })) },
      options: { ...baseOpts({ x: { stacked: true, max: 100, ticks: pctTick, grid: { color: GRID } }, y: { stacked: true, grid: { display: false } } }, { indexAxis: "y" }),
        plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.x}%` } } } },
    });

    hbar("ch-lunch", S.lunch_time, COLORS.brand);
    hbar("ch-meals", S.meals, COLORS.teal, { max: 100 });
    hbar("ch-days", S.days_per_week, COLORS.brand);
    hbar("ch-break", S.short_break, COLORS.teal);
    hbar("ch-reason", Object.fromEntries(Object.entries(S.leave_reason).sort((a, b) => b[1].pct - a[1].pct)), "#fb923c");
    hbar("ch-forecast", S.forecast_reaction, COLORS.teal);
    hbar("ch-village", S.residence, "#818cf8");
    hbar("ch-year", S.year, "#818cf8");
  }

  function fillStats() {
    document.querySelectorAll('[data-bind="n"]').forEach((e) => (e.textContent = S.n));
    const lr = S.likert.heavy_rain;
    $("st-rain").textContent = Math.round(lr["Very unlikely"].pct + lr["Somewhat unlikely"].pct) + "%";
    $("st-holiday").textContent = Math.round(S.holiday_stay.Never.pct + S.holiday_stay.Rarely.pct) + "%";
    $("st-plate").textContent = Math.round(S.leave_food.Never.pct + S.leave_food.Rarely.pct) + "%";
    $("st-forecast").textContent = Math.round(S.forecast_reaction["Eat somewhere else"].pct + S.forecast_reaction["Eat earlier or later"].pct) + "%";
    $("gen-date").textContent = D.generated;
    $("r-rain").textContent = RULES.heavyRainMm;
    $("r-prob").textContent = RULES.heavyRainProb;
    $("r-pm").textContent = RULES.hazePm25;
    $("cal-verify").innerHTML = `The Jan, May and Sept 2027 semesters, "no physical class" weeks and holidays come from the official ${CAL.source || "UTP calendar"}. ` +
      `<span class="warn-text">The Sept 2026 semester isn't in that document, so its dates are estimated from the 2027 pattern.</span>`;
  }

  /* ---------------------------------------------------------------- model */
  let modelBuilt = false;
  function buildModel() {
    if (modelBuilt) return;
    modelBuilt = true;
    const mt = D.metrics;
    $("m-acc").textContent = Math.round(mt.test_accuracy * 1000) / 10 + "%";
    $("m-agree").textContent = Math.round(mt.agreement_with_survey_rule * 1000) / 10 + "%";
    $("m-leaves").textContent = mt.tree_leaves;
    $("m-depth").textContent = mt.tree_depth;
    $("m-rows").textContent = fmt(mt.train_rows + mt.test_rows);

    const imp = Object.entries(mt.feature_importance).sort((a, b) => b[1] - a[1]);
    new Chart($("ch-imp"), {
      type: "bar",
      data: { labels: imp.map(([k]) => CFG.feature_labels[k]), datasets: [{ data: imp.map(([, v]) => Math.round(v * 1000) / 10),
        backgroundColor: imp.map((_, i) => i < 3 ? COLORS.brand : "#2a5b78"), borderRadius: 6, maxBarThickness: 22 }] },
      options: { ...baseOpts({ x: { grid: { color: GRID }, ticks: pctTick }, y: { grid: { display: false } } }, { indexAxis: "y" }), plugins: { legend: { display: false } } },
    });

    const cm = mt.confusion_matrix, max = Math.max(...cm.matrix.flat());
    let html = `<div class="h"></div>` + cm.labels.map((l) => `<div class="h">${l}</div>`).join("");
    cm.matrix.forEach((row, i) => {
      html += `<div class="h">${cm.labels[i]}</div>`;
      row.forEach((v, j) => {
        const a = v / max;
        const bg = i === j ? `rgba(56,189,248,${0.12 + 0.55 * a})` : v ? `rgba(248,113,113,${0.12 + 0.5 * a})` : "rgba(148,163,184,.06)";
        html += `<div class="c" style="background:${bg}">${v}</div>`;
      });
    });
    $("cm").innerHTML = html;

    const tb = $("tests");
    tb.innerHTML = `<thead><tr><th>Scenario</th><th>Meal</th><th>Calendar</th><th>Weather</th><th class="num">Demand</th><th>Risk</th><th class="num">Confidence</th><th class="num">Cook (of 100)</th></tr></thead><tbody>` +
      D.test_scenarios.map((t, i) => `<tr data-i="${i}"><td><strong>${t.scenario}</strong></td><td>${t.meal}</td><td>${t.calendar}</td><td>${t.weather}${t.short_break ? " · short breaks" : ""}</td><td class="num">${t.expected_demand_pct}%</td><td><span class="t t-${t.predicted_risk}">${t.predicted_risk}</span></td><td class="num">${t.confidence_pct}%</td><td class="num">${t.recommended_batch_if_usual_100}</td></tr>`).join("") + "</tbody>";
    tb.querySelectorAll("tbody tr").forEach((tr) => tr.onclick = () => {
      const t = D.test_scenarios[+tr.dataset.i];
      Object.assign(state, { live: false, ovCal: false, ovWx: false, day: t.day, meal: t.meal, calendar: t.calendar, weather: t.weather, shortBreak: t.short_break, batch: 100 });
      $("live").checked = false;
      showTab("predict"); render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    $("m-base").textContent = S.baseline_weekday_probability;
    $("m-floor").textContent = Math.round(CFG.demand_floor * 100);
    $("m-low").textContent = Math.round(CFG.risk_thresholds.Low * 100);
    $("m-med").textContent = Math.round(CFG.risk_thresholds.Medium * 100);
  }

  /* ----------------------------------------------------------------- tabs */
  function showTab(name) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + name));
    if (name === "insights") buildInsights();
    if (name === "model") buildModel();
  }

  /* ----------------------------------------------------------------- init */
  if (window.Chart) {
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    Chart.defaults.color = "#8b9ab0";
    Chart.defaults.borderColor = GRID;
    Chart.defaults.plugins.tooltip.backgroundColor = "#0b1220";
    Chart.defaults.plugins.tooltip.borderColor = "rgba(148,163,184,.25)";
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
  } else {
    window.Chart = function () { return { update() {} }; }; // offline: skip charts
  }
  document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => showTab(t.dataset.tab)));
  buildControls();
  fillStats();
  buildModel(); // assumption inputs live in the model tab and are read by render()
  render();
  loadWeather().catch(() => { WX.status = "error"; }).finally(render);
})();
