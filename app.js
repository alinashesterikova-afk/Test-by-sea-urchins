import {
  PROJECTS,
  buildDashboard,
  buildProjectPage,
  formatRangeLabel,
  niceAxis,
  getSuggestionPool,
} from "./shared-data.js?v=6";

const state = {
  period: "1y",
  compareLeft: true,
  compareRight: true,
  page: 1,
  perPage: 100,
  ownerEmail: "",
  chartOwnerEmail: "",
  customRange: null,
  tableCustomRange: null,
  analytics: null,
  total: 0,
  items: [],
  suggestionPool: [],
  chartSuggestionIndex: -1,
  suggestionIndex: -1,
  loadingAnalytics: true,
  loadingProjects: true,
  error: null,
  analyticsToken: 0,
  projectToken: 0,
  analyticsAbort: null,
  projectAbort: null,
  toastTimer: null,
  tooltip: null,
  dialogProject: null,
  filterTimer: null,
  chartFilterTimer: null,
  datePickerOpen: false,
  datePickerTarget: "analytics",
  datePickerAnchor: null,
  datePickerMonth: new Date(),
  datePickerStart: null,
  datePickerEnd: null,
};

const elements = {
  metricsGrid: document.getElementById("metricsGrid"),
  leftChartValue: document.getElementById("leftChartValue"),
  leftChartTitle: document.getElementById("leftChartTitle"),
  leftChartInfo: document.getElementById("leftChartInfo"),
  leftChartDelta: document.getElementById("leftChartDelta"),
  leftChartSubtitle: document.getElementById("leftChartSubtitle"),
  leftChartNote: document.getElementById("leftChartNote"),
  leftLegend: document.getElementById("leftLegend"),
  leftChartSvg: document.getElementById("leftChartSvg"),
  rightChartValue: document.getElementById("rightChartValue"),
  rightChartTitle: document.getElementById("rightChartTitle"),
  rightChartInfo: document.getElementById("rightChartInfo"),
  rightChartDelta: document.getElementById("rightChartDelta"),
  rightChartSubtitle: document.getElementById("rightChartSubtitle"),
  rightChartNote: document.getElementById("rightChartNote"),
  rightLegend: document.getElementById("rightLegend"),
  rightChartSvg: document.getElementById("rightChartSvg"),
  periodNote: document.getElementById("periodNote"),
  chartSearch: document.getElementById("chartSearch"),
  chartSuggestions: document.getElementById("chartSuggestions"),
  dateFilterButton: document.getElementById("dateFilterButton"),
  tableDateFilterButton: document.getElementById("tableDateFilterButton"),
  datePicker: document.getElementById("datePicker"),
  datePickerTitle: document.getElementById("datePickerTitle"),
  datePickerSubtitle: document.getElementById("datePickerSubtitle"),
  datePickerMonths: document.getElementById("datePickerMonths"),
  datePickerPrev: document.getElementById("datePickerPrev"),
  datePickerNext: document.getElementById("datePickerNext"),
  datePickerClear: document.getElementById("datePickerClear"),
  datePickerApply: document.getElementById("datePickerApply"),
  dateFromLabel: document.getElementById("dateFromLabel"),
  dateToLabel: document.getElementById("dateToLabel"),
  tableDateFromLabel: document.getElementById("tableDateFromLabel"),
  tableDateToLabel: document.getElementById("tableDateToLabel"),
  leftCompareControl: document.getElementById("leftCompareControl"),
  rightCompareControl: document.getElementById("rightCompareControl"),
  leftCompareToggle: document.getElementById("leftCompareToggle"),
  rightCompareToggle: document.getElementById("rightCompareToggle"),
  ownerSearch: document.getElementById("ownerSearch"),
  suggestions: document.getElementById("suggestions"),
  exportButton: document.getElementById("exportButton"),
  analyticsErrorBanner: document.getElementById("analyticsErrorBanner"),
  retryAnalyticsButton: document.getElementById("retryAnalyticsButton"),
  tableBody: document.getElementById("tableBody"),
  perPage: document.getElementById("perPage"),
  pageSummary: document.getElementById("pageSummary"),
  pageNumbers: document.getElementById("pageNumbers"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  skipBack: document.getElementById("skipBack"),
  skipForward: document.getElementById("skipForward"),
  tooltip: document.getElementById("tooltip"),
  toast: document.getElementById("toast"),
  productsDialog: document.getElementById("productsDialog"),
  dialogMessage: document.getElementById("dialogMessage"),
  dialogConfirm: document.getElementById("dialogConfirm"),
};

const periodButtons = Array.from(document.querySelectorAll("[data-period]"));

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  return search.toString();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function isFileProtocol() {
  return window.location.protocol === "file:";
}

function startOfDay(date) {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(date) {
  const out = new Date(date);
  out.setHours(23, 59, 59, 999);
  return out;
}

function addDays(date, days) {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function addMonths(date, months) {
  const out = new Date(date);
  out.setMonth(out.getMonth() + months);
  return out;
}

function differenceInCalendarDays(start, end) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000);
}

function parseDateInput(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function coerceDate(value) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function formatRangeValue(date) {
  return date.toLocaleString("en-US", { month: "short", day: "numeric" });
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCustomRangeMode(start, end) {
  return differenceInCalendarDays(start, end) === 0 ? "hour" : "day";
}

function getActiveRange() {
  if (state.customRange?.start && state.customRange?.end) {
    return {
      ...state.customRange,
      mode: getCustomRangeMode(state.customRange.start, state.customRange.end),
      custom: true,
    };
  }

  return {
    custom: false,
    period: state.period,
  };
}

function getTableRange() {
  if (state.tableCustomRange?.start && state.tableCustomRange?.end) {
    return {
      ...state.tableCustomRange,
      mode: getCustomRangeMode(state.tableCustomRange.start, state.tableCustomRange.end),
      custom: true,
    };
  }

  return {
    custom: false,
    period: state.period,
  };
}

function getRequestParams() {
  const range = getActiveRange();
  if (range.custom) {
    return {
      date_from: formatDateInput(range.start),
      date_to: formatDateInput(range.end),
    };
  }

  return { period: state.period };
}

function buildCurrentRangeLabel() {
  const range = getActiveRange();
  if (range.custom) {
    return formatRangeLabel(range.start, range.end);
  }
  const current = state.analytics?.ranges?.current;
  return current ? formatRangeLabel(coerceDate(current.start), coerceDate(current.end)) : "Selected period";
}

function buildPreviousRangeLabel() {
  const previous = state.analytics?.ranges?.previous;
  return previous ? formatRangeLabel(coerceDate(previous.start), coerceDate(previous.end)) : "";
}

function updateDateFilterLabels(target = "analytics") {
  const range = target === "table" ? getTableRange() : getActiveRange();
  const fromLabel = target === "table" ? elements.tableDateFromLabel : elements.dateFromLabel;
  const toLabel = target === "table" ? elements.tableDateToLabel : elements.dateToLabel;
  if (!fromLabel || !toLabel) return;
  if (range.custom) {
    fromLabel.textContent = formatRangeValue(range.start);
    toLabel.textContent = formatRangeValue(range.end);
  } else {
    fromLabel.textContent = "From";
    toLabel.textContent = "Until";
  }
}

function getPeriodNote() {
  const current = buildCurrentRangeLabel();
  const previous = buildPreviousRangeLabel();
  if (!previous) return "";
  return `Showing ${current} compared to ${previous} — the same number of days right before this period`;
}

function getChartNote() {
  const range = getActiveRange();
  if (range.custom) {
    return range.mode === "hour" ? "Each point is one hour" : "Each point is one day";
  }

  if (state.period === "today") return "Each point is one hour";
  if (state.period === "1y") return "Each point is one month · Month in progress";
  return "Each point is one day";
}

function getRightChartNote() {
  return "Every day shown, including days with none placed";
}

function renderChartSuggestions() {
  const query = elements.chartSearch?.value.trim() ?? "";
  if (!query) {
    hideChartSuggestions();
    return;
  }

  const matches = state.suggestionPool
    .filter((email) => email.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6);

  if (!matches.length) {
    hideChartSuggestions();
    return;
  }

  elements.chartSuggestions.innerHTML = matches
    .map(
      (email, index) => `
        <button
          type="button"
          class="suggestion-item"
          data-email="${escapeHtml(email)}"
          aria-selected="${index === state.chartSuggestionIndex ? "true" : "false"}"
        >${highlightMatch(email, query)}</button>
      `,
    )
    .join("");
  elements.chartSuggestions.hidden = false;
}

function hideChartSuggestions() {
  if (!elements.chartSuggestions) return;
  elements.chartSuggestions.hidden = true;
  elements.chartSuggestions.innerHTML = "";
  state.chartSuggestionIndex = -1;
}

function getYearNote() {
  if (state.period === "1y" && !state.customRange) {
    return "Month in progress";
  }
  return "";
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function buildCalendarMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const last = monthEnd(first);
  const leading = (first.getDay() + 6) % 7;
  const days = [];
  const start = addDays(first, -leading);

  for (let index = 0; index < 42; index += 1) {
    days.push(addDays(start, index));
  }

  return {
    title: date.toLocaleString("en-US", { month: "long", year: "numeric" }),
    days,
    month,
    year,
    first,
    last,
  };
}

function isSameDate(a, b) {
  return Boolean(a && b) && formatDateInput(a) === formatDateInput(b);
}

function isInRange(date, start, end) {
  if (!start || !end) return false;
  const current = startOfDay(date).getTime();
  return current >= startOfDay(start).getTime() && current <= endOfDay(end).getTime();
}

function setCustomRange(start, end) {
  state.customRange = { start: startOfDay(start), end: endOfDay(end) };
  updateDateFilterLabels("analytics");
}

function clearCustomRange() {
  state.customRange = null;
  updateDateFilterLabels("analytics");
}

function setTableCustomRange(start, end) {
  state.tableCustomRange = { start: startOfDay(start), end: endOfDay(end) };
  updateDateFilterLabels("table");
}

function clearTableCustomRange() {
  state.tableCustomRange = null;
  updateDateFilterLabels("table");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 1800);
}

async function copyId(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const input = document.createElement("input");
    input.value = value;
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  showToast(`ID copied: ${value}`);
}

function setLoadingRows() {
  elements.tableBody.innerHTML = Array.from({ length: 6 }, (_, rowIndex) => `
    <tr class="loading-row" aria-hidden="true">
      <td><div class="skeleton-line" style="width:150px;height:10px;margin-bottom:6px;"></div><div class="skeleton-line" style="width:120px;height:8px;"></div></td>
      <td><div class="skeleton-line" style="width:104px;height:10px;"></div></td>
      <td><div class="skeleton-line" style="width:62px;height:10px;"></div></td>
      <td><div class="skeleton-line" style="width:46px;height:10px;"></div></td>
      <td><div class="skeleton-line" style="width:34px;height:10px;"></div></td>
      <td><div class="skeleton-line" style="width:56px;height:10px;"></div></td>
      <td><div class="skeleton-line" style="width:46px;height:20px;border-radius:999px;"></div></td>
      <td><div class="skeleton-line" style="width:64px;height:10px;"></div></td>
    </tr>
  `).join("");
}

function renderEmptyState() {
  const filterText = state.ownerEmail ? ` for ${escapeHtml(state.ownerEmail)}` : "";
  const hasDateFilter = Boolean(state.tableCustomRange?.start && state.tableCustomRange?.end);
  const dateText = hasDateFilter
    ? ` ${escapeHtml(formatRangeLabel(state.tableCustomRange.start, state.tableCustomRange.end))}`
    : "";
  elements.tableBody.innerHTML = `
    <tr>
      <td colspan="8">
        <div class="empty-state">
          <strong>No projects found${filterText}${dateText}</strong>
          <div class="empty-actions">
            ${state.ownerEmail ? '<button type="button" class="clear-filter" id="clearFilter">✕ Clear email filter</button>' : ""}
            ${hasDateFilter ? '<button type="button" class="clear-filter" id="clearDateFilter">✕ Clear date filter</button>' : ""}
          </div>
        </div>
      </td>
    </tr>
  `;
  const clear = document.getElementById("clearFilter");
  if (clear) {
    clear.addEventListener("click", () => {
      elements.ownerSearch.value = "";
      state.ownerEmail = "";
      state.page = 1;
      hideSuggestions();
      loadProjects();
    });
  }
  const clearDate = document.getElementById("clearDateFilter");
  if (clearDate) {
    clearDate.addEventListener("click", () => {
      clearTableCustomRange();
      state.page = 1;
      loadProjects();
    });
  }
}

function renderProjectErrorState() {
  elements.tableBody.innerHTML = `
    <tr class="table-error-row">
      <td colspan="8">
        <div class="error-banner table-error">
          <span>Couldn't load projects.</span>
          <button id="retryProjectsButton" type="button">Retry</button>
        </div>
      </td>
    </tr>
  `;
  const retry = document.getElementById("retryProjectsButton");
  if (retry) {
    retry.addEventListener("click", loadProjects);
  }
}

function renderAnalyticsFallback(analytics) {
  const emptyAnalytics = {
    ...analytics,
    cards: analytics.cards.map((card) => ({
      ...card,
      value: "—",
      delta: null,
      caption: card.caption,
      sparkline: card.sparkline.map(() => 0),
    })),
    charts: {
      left: {
        ...analytics.charts.left,
        value: "—",
        delta: null,
        series: analytics.charts.left.series.map(() => 0),
        compareSeries: analytics.charts.left.compareSeries.map(() => 0),
      },
      right: {
        ...analytics.charts.right,
        value: "—",
        delta: null,
        series: analytics.charts.right.series.map(() => 0),
        compareSeries: analytics.charts.right.compareSeries.map(() => 0),
        merged: analytics.charts.right.merged.map((item) => ({ ...item, current: 0, previous: 0 })),
      },
    },
  };
  renderAnalytics(emptyAnalytics);
}

function buildSparkline(data, { color = "#5ada6d", fill = "rgba(90,218,109,0.16)" } = {}) {
  const width = 228;
  const height = 64;
  const paddingX = 4;
  const paddingY = 6;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? (width - paddingX * 2) / (data.length - 1) : 0;
  const points = data.map((value, index) => {
    const x = paddingX + index * step;
    const y = height - paddingY - ((value / max) * (height - paddingY * 2));
    return [x, y];
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L ${points[points.length - 1][0].toFixed(1)} ${height - paddingY} L ${points[0][0].toFixed(1)} ${height - paddingY} Z`;
  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${area}" fill="${fill}"></path>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
}

function formatAxisTick(value) {
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  }
  return String(value);
}

function renderDeltaChip(delta, { compact = false } = {}) {
  if (!delta) return "";
  if (delta.pct === null) {
    return `<span class="metric-delta new">${compact ? "" : " "}New</span>`;
  }

  if (delta.direction === "flat") {
    return `<span class="metric-delta flat"><span class="delta-flat-mark">—</span> ${escapeHtml(delta.label)}</span>`;
  }

  const arrow = delta.direction === "up" ? "↗" : "↘";
  const className = delta.direction === "up" ? "up" : "down";
  return `<span class="metric-delta ${className}">${arrow} ${escapeHtml(delta.label)}</span>`;
}

function renderXLabels(labels, positionForIndex, y, maxLabels = 8) {
  if (!labels.length) return "";
  const stride = Math.max(1, Math.ceil(labels.length / maxLabels));
  return labels
    .map((label, index) => {
      const shouldShow = index === 0 || index === labels.length - 1 || index % stride === 0;
      if (!shouldShow) return "";
      const x = positionForIndex(index);
      return `<text x="${x}" y="${y}" text-anchor="middle" class="axis-label">${escapeHtml(label)}</text>`;
    })
    .join("");
}

function buildLineChart(series, compareSeries, labels, compareEnabled) {
  const width = 760;
  const height = 260;
  const pad = { top: 14, right: 18, bottom: 38, left: 44 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const axis = niceAxis(Math.max(0, ...series, ...(compareEnabled ? compareSeries : [0])));
  const yGrid = axis.ticks.map((tick) => {
    const y = pad.top + chartHeight - (tick / axis.max) * chartHeight;
    return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(0,0,0,0.08)" stroke-width="1" />`;
  }).join("");

  const xStep = series.length > 1 ? chartWidth / (series.length - 1) : 0;
  const makePath = (values) =>
    values
      .map((value, index) => {
        const x = pad.left + index * xStep;
        const y = pad.top + chartHeight - (value / axis.max) * chartHeight;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  const makeArea = (values, baseline = pad.top + chartHeight) => {
    const pts = values.map((value, index) => {
      const x = pad.left + index * xStep;
      const y = pad.top + chartHeight - (value / axis.max) * chartHeight;
      return [x, y];
    });
    const path = pts.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    return `${path} L ${pts[pts.length - 1][0].toFixed(1)} ${baseline} L ${pts[0][0].toFixed(1)} ${baseline} Z`;
  };

  const labelsBottom = renderXLabels(labels, (index) => pad.left + index * xStep, height - 12, 8);

  const comparePath = compareEnabled ? makePath(compareSeries) : "";
  const compareArea = compareEnabled ? makeArea(compareSeries) : "";
  const linePath = makePath(series);
  const areaPath = makeArea(series);

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Line chart">
      ${yGrid}
      ${axis.ticks
        .map((tick) => {
          const y = pad.top + chartHeight - (tick / axis.max) * chartHeight;
          return `<text x="${pad.left - 10}" y="${y + 4}" text-anchor="end">${formatAxisTick(tick)}</text>`;
        })
        .join("")}
      ${compareEnabled ? `<path d="${compareArea}" fill="rgba(0,0,0,0.02)" opacity="1"></path>` : ""}
      ${compareEnabled ? `<path d="${comparePath}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="2" stroke-dasharray="6 6" stroke-linecap="round" stroke-linejoin="round"></path>` : ""}
      <path d="${areaPath}" fill="rgba(90,218,109,0.15)"></path>
      <path d="${linePath}" fill="none" stroke="#22a847" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      ${labelsBottom}
    </svg>
  `;
}

function buildBarChart(mergedData, compareEnabled) {
  const width = 760;
  const height = 260;
  const pad = { top: 14, right: 18, bottom: 38, left: 44 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const axis = niceAxis(Math.max(0, ...mergedData.flatMap((item) => [item.current, ...(compareEnabled ? [item.previous] : [])])));
  const barWidth = mergedData.length > 0 ? Math.max(7, chartWidth / mergedData.length / (compareEnabled ? 3.8 : 2.9)) : 0;
  const groupGap = compareEnabled ? barWidth * 0.18 : 0;
  const groupStep = mergedData.length > 0 ? chartWidth / mergedData.length : 0;

  const yGrid = axis.ticks.map((tick) => {
    const y = pad.top + chartHeight - (tick / axis.max) * chartHeight;
    return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(0,0,0,0.08)" stroke-width="1" />`;
  }).join("");

  const currentBars = mergedData
    .map((item, index) => {
      const center = pad.left + index * groupStep + groupStep / 2;
      const h = (item.current / axis.max) * chartHeight;
      const x = compareEnabled ? center - barWidth - groupGap / 2 : center - barWidth / 2;
      const y = pad.top + chartHeight - h;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(2, h).toFixed(1)}" rx="3.5" fill="#5ada6d" />`;
    })
    .join("");

  const previousBars = compareEnabled
    ? mergedData
      .map((item, index) => {
          const center = pad.left + index * groupStep + groupStep / 2;
          const h = (item.previous / axis.max) * chartHeight;
          const x = compareEnabled ? center + groupGap / 2 : center - barWidth / 2;
          const y = pad.top + chartHeight - h;
          return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(2, h).toFixed(1)}" rx="3.5" fill="#d3d1c7" />`;
        })
        .join("")
    : "";

  const labelsBottom = renderXLabels(mergedData.map((item) => item.label), (index) => pad.left + index * groupStep + groupStep / 2, height - 12, 8);

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Bar chart">
      ${yGrid}
      ${axis.ticks
        .map((tick) => {
          const y = pad.top + chartHeight - (tick / axis.max) * chartHeight;
          return `<text x="${pad.left - 10}" y="${y + 4}" text-anchor="end">${formatAxisTick(tick)}</text>`;
        })
        .join("")}
      ${previousBars}
      ${currentBars}
      ${labelsBottom}
    </svg>
  `;
}

function renderLegend(container, items) {
  if (!items?.length) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }
  container.hidden = false;
  container.innerHTML = items
    .map(
      (item) => `
        <span class="legend-item">
          <span class="legend-swatch ${item.color}"></span>
          <span>${escapeHtml(item.label)}</span>
        </span>
      `,
    )
    .join("");
}

function renderMetrics(metrics) {
  elements.metricsGrid.innerHTML = metrics.cards
    .map((card, index) => {
      const tooltipMap = [
        "metricProjects",
        "metricProducts",
        "metricActions",
        "metricActive",
        "metricBudget",
      ];
      const accentColor = card.accent === "red" ? "#f8c1c1" : "#c6f5c8";
      const sparkColor = card.accent === "red" ? "#ff6d73" : "#5ada6d";
      const sparkFill = card.accent === "red" ? "rgba(255,109,115,0.16)" : "rgba(90,218,109,0.16)";
      return `
        <article class="metric-card">
          <div class="metric-header">
            <div class="metric-title">${escapeHtml(card.title)}</div>
            <button class="info-icon" type="button" data-tooltip="${tooltipMap[index] || "metricProjects"}" aria-label="${escapeHtml(card.title)} info">i</button>
          </div>
          <div class="metric-body">
            <div>
              <div class="metric-top">
                <div class="metric-value">${escapeHtml(card.value)}</div>
                ${renderDeltaChip(card.delta)}
              </div>
              <div class="metric-caption">${escapeHtml(card.caption)}</div>
            </div>
            <div class="metric-chart">${buildSparkline(card.sparkline, { color: sparkColor, fill: sparkFill })}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAnalytics(analytics) {
  state.analytics = analytics;
  renderMetrics(analytics);

  elements.leftChartValue.textContent = analytics.charts.left.value;
  elements.leftChartTitle.textContent = analytics.charts.left.title;
  elements.leftChartSubtitle.textContent = analytics.charts.left.subtitle;
  elements.leftChartDelta.innerHTML = renderDeltaChip(analytics.charts.left.delta, { compact: true });
  if (elements.leftChartInfo) {
    elements.leftChartInfo.dataset.tooltip = state.compareLeft ? "chartProjectsOn" : "chartProjectsOff";
  }
  if (elements.leftChartNote) {
    elements.leftChartNote.textContent = getChartNote();
  }
  renderLegend(elements.leftLegend, state.compareLeft ? [
    { label: analytics.ranges.labels.current, color: "green" },
    { label: analytics.ranges.labels.previous, color: "gray" },
  ] : []);
  elements.leftChartSvg.innerHTML = buildLineChart(
    analytics.charts.left.series,
    analytics.charts.left.compareSeries,
    analytics.charts.left.labels,
    state.compareLeft,
  );

  elements.rightChartValue.textContent = analytics.charts.right.value;
  elements.rightChartTitle.textContent = analytics.charts.right.title;
  elements.rightChartSubtitle.textContent = analytics.charts.right.subtitle;
  elements.rightChartDelta.innerHTML = renderDeltaChip(analytics.charts.right.delta, { compact: true });
  if (elements.rightChartInfo) {
    elements.rightChartInfo.dataset.tooltip = state.compareRight ? "chartProductsOn" : "chartProductsOff";
  }
  if (elements.rightChartNote) {
    elements.rightChartNote.textContent = getRightChartNote();
  }
  renderLegend(elements.rightLegend, state.compareRight ? [
    { label: analytics.ranges.labels.current, color: "green" },
    { label: analytics.ranges.labels.previous, color: "gray" },
  ] : []);
  elements.rightChartSvg.innerHTML = buildBarChart(analytics.charts.right.merged, state.compareRight);

  elements.leftCompareToggle.classList.toggle("on", state.compareLeft);
  elements.rightCompareToggle.classList.toggle("on", state.compareRight);
  if (elements.periodNote) {
    elements.periodNote.textContent = getPeriodNote();
  }
  updateDateFilterLabels("analytics");
}

function renderSkeletonProjects() {
  setLoadingRows();
}

function renderRows(data) {
  if (!data.items.length) {
    renderEmptyState();
    return;
  }

  elements.tableBody.innerHTML = data.items
    .map((item) => `
      <tr>
        <td>
          <div class="project-main">
            <button class="project-link" type="button" data-action="open-project" data-url="${escapeHtml(item.projectUrl)}">${escapeHtml(item.projectName)}</button>
            <div class="owner-email">${escapeHtml(item.ownerEmail)}</div>
          </div>
        </td>
        <td>
          <span class="id-cell">
            ${escapeHtml(item.id)}
            <button class="icon-button copy-button" type="button" data-action="copy-id" data-id="${escapeHtml(item.id)}" aria-label="Copy ${escapeHtml(item.id)}">
              <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
                <rect x="4.1" y="7.6" width="7.8" height="7.8" rx="1.6" stroke="currentColor" stroke-width="1.4"></rect>
                <path d="M6.3 6.2V4.8c0-.99.8-1.79 1.79-1.79h5.31c.99 0 1.79.8 1.79 1.79v5.31c0 .99-.8 1.79-1.79 1.79h-1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"></path>
              </svg>
            </button>
          </span>
        </td>
        <td>
          <button class="count-button" type="button" data-action="view-products" data-name="${escapeHtml(item.projectName)}" data-url="${escapeHtml(item.productUrl)}">
            <span class="count-value">${item.productsPlaced}</span>
            <span class="items-label">items</span>
          </button>
        </td>
        <td>${item.actionsTaken.toLocaleString("en-US")}</td>
        <td><span class="views-value">${item.views.toLocaleString("en-US")}</span></td>
        <td class="budget-value">$${item.budget.toLocaleString("en-US")}</td>
        <td><span class="status-pill ${item.status === "Live" ? "status-live" : "status-deleted"}">${escapeHtml(item.status)}</span></td>
        <td class="created-value">${escapeHtml(item.created)}</td>
      </tr>
    `)
    .join("");
}

function renderPagination(total) {
  const totalPages = Math.max(1, Math.ceil(total / state.perPage));
  const current = clamp(state.page, 1, totalPages);
  const start = total === 0 ? 0 : (current - 1) * state.perPage + 1;
  const end = total === 0 ? 0 : Math.min(current * state.perPage, total);
  elements.pageSummary.textContent = `${start}–${end} of ${total} items`;

  elements.prevPage.disabled = current <= 1;
  elements.nextPage.disabled = current >= totalPages;
  elements.skipBack.disabled = current <= 5;
  elements.skipForward.disabled = current >= totalPages - 4;

  const pages = [];
  const pushPage = (page) => {
    pages.push(`<button type="button" class="page-number ${page === current ? "active" : ""}" data-page="${page}">${page}</button>`);
  };

  const pushEllipsis = () => pages.push('<span class="page-ellipsis">…</span>');

  if (totalPages <= 6) {
    for (let page = 1; page <= totalPages; page += 1) pushPage(page);
  } else if (current <= 4) {
    for (let page = 1; page <= 4; page += 1) pushPage(page);
    pushEllipsis();
    pushPage(totalPages);
  } else if (current >= totalPages - 3) {
    pushPage(1);
    pushEllipsis();
    for (let page = totalPages - 3; page <= totalPages; page += 1) pushPage(page);
  } else {
    pushPage(1);
    pushEllipsis();
    pushPage(current);
    pushEllipsis();
    pushPage(totalPages);
  }

  elements.pageNumbers.innerHTML = pages.join("");
}

function hideSuggestions() {
  elements.suggestions.hidden = true;
  elements.suggestions.innerHTML = "";
  state.suggestionIndex = -1;
}

function renderSuggestions() {
  const query = elements.ownerSearch.value.trim();
  if (!query) {
    hideSuggestions();
    return;
  }

  const matches = state.suggestionPool
    .filter((email) => email.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6);

  if (!matches.length) {
    hideSuggestions();
    return;
  }

  elements.suggestions.innerHTML = matches
    .map(
      (email, index) => `
        <button
          type="button"
          class="suggestion-item"
          data-email="${escapeHtml(email)}"
          aria-selected="${index === state.suggestionIndex ? "true" : "false"}"
        >${highlightMatch(email, query)}</button>
      `,
    )
    .join("");
  elements.suggestions.hidden = false;
}

function highlightMatch(value, query) {
  const lowerValue = value.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerValue.indexOf(lowerQuery);
  if (index === -1) return escapeHtml(value);
  const before = escapeHtml(value.slice(0, index));
  const match = escapeHtml(value.slice(index, index + query.length));
  const after = escapeHtml(value.slice(index + query.length));
  return `${before}<strong>${match}</strong>${after}`;
}

function openTooltip(button) {
  const kind = button.dataset.tooltip;
  const tooltipTexts = {
    metricProjects: "Total number of new projects started in the selected period.",
    metricProducts: "How many times a product was added into a scene. One product used in 3 scenes counts as 3.",
    metricActions: "Every time a user moves, rotates, resizes, or changes a texture on an item, it counts as one action.",
    metricActive: "Share of projects that still exist out of all projects created in this period.",
    metricBudget: "Total value of products placed across all projects, based on catalog price.",
    chartProjectsOff: "Each point shows how many new projects were started in that time bucket.",
    chartProjectsOn: "Solid line is the period you selected. Dashed line is the same number of days right before it.",
    chartProductsOff: "Each bar is the total units placed in that time bucket, across all SKUs.",
    chartProductsOn: "Green bars are the period you selected. Grey bars are the same number of days right before it.",
    tableProducts: "Number of items added to this project. Click to see which products were used.",
    tableActions: "Moves, rotations, resizes and texture changes made in this project.",
    tableViews: "Times this project was opened after being shared publicly.",
    tableBudget: "Total value of products placed in this project, based on catalog price.",
    actions: "Moves, rotations, resizes and texture changes made in this project",
    products: "Number of items placed in this project",
  };
  const text = tooltipTexts[kind] ?? "Metrics update with the selected period";

  const rect = button.getBoundingClientRect();
  const tooltip = elements.tooltip;
  tooltip.textContent = text;
  tooltip.hidden = false;
  tooltip.removeAttribute("data-side");
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";

  const width = Math.min(tooltip.offsetWidth, 300);
  const height = tooltip.offsetHeight;
  const gap = 10;
  const fitsBelow = rect.bottom + gap + height < window.innerHeight - 8;
  const side = fitsBelow ? "bottom" : "top";
  const top = fitsBelow ? rect.bottom + gap : rect.top - gap - height;
  const left = clamp(rect.left + rect.width / 2 - width * 0.12, 12, window.innerWidth - width - 12);

  tooltip.dataset.side = side;
  tooltip.style.width = `${width}px`;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.max(12, top)}px`;
  state.tooltip = button;
}

function hideTooltip() {
  state.tooltip = null;
  elements.tooltip.hidden = true;
}

function openProductsDialog(project) {
  state.dialogProject = project;
  elements.dialogMessage.textContent = `See the products used in ${project.projectName}?`;
  elements.productsDialog.showModal();
}

async function getAnalyticsData() {
  const params = getRequestParams();
  const range = getActiveRange();
  const query = buildQuery({
    ...params,
    compare: 1,
    owner_email: state.chartOwnerEmail,
  });

  if (!isFileProtocol() && !range.custom) {
    try {
      return await fetchJson(`/api/analytics?${query}`);
    } catch {
      // fall back below
    }
  }

  return buildDashboard(
    state.period,
    true,
    state.chartOwnerEmail,
    PROJECTS,
    params.date_from ?? "",
    params.date_to ?? "",
  );
}

async function getProjectsData() {
  const params = getRequestParams();
  const tableRange = getTableRange();
  const tableParams = tableRange.custom
    ? {
        date_from: formatDateInput(tableRange.start),
        date_to: formatDateInput(tableRange.end),
      }
    : {};
  const query = buildQuery({
    page: state.page,
    per_page: state.perPage,
    owner_email: state.ownerEmail,
    ...params,
    ...tableParams,
  });

  if (!isFileProtocol() && !tableRange.custom && !getActiveRange().custom) {
    try {
      return await fetchJson(`/api/projects?${query}`);
    } catch {
      // fall back below
    }
  }

  return buildProjectPage({
    page: state.page,
    perPage: state.perPage,
    ownerEmail: state.ownerEmail,
    period: state.period,
    projects: PROJECTS,
    dateFrom: tableParams.date_from ?? params.date_from ?? "",
    dateTo: tableParams.date_to ?? params.date_to ?? "",
  });
}

function closeDatePicker() {
  state.datePickerOpen = false;
  state.datePickerAnchor = null;
  elements.datePicker.hidden = true;
  elements.dateFilterButton.setAttribute("aria-expanded", "false");
  if (elements.tableDateFilterButton) {
    elements.tableDateFilterButton.setAttribute("aria-expanded", "false");
  }
}

function renderMonthHeader(monthDate) {
  const label = monthDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  return `
    <div class="calendar-month">
      <div class="calendar-month-header">${escapeHtml(label)}</div>
      <div class="calendar-weekdays">
        <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
      </div>
      <div class="calendar-days">
        ${buildCalendarMonth(monthDate).days
          .map((day) => {
            const isOutside = day.getMonth() !== monthDate.getMonth();
            const isSelectedStart = isSameDate(day, state.datePickerStart);
            const isSelectedEnd = isSameDate(day, state.datePickerEnd);
            const inRange = isInRange(day, state.datePickerStart, state.datePickerEnd);
            const isToday = isSameDate(day, new Date());
            return `
              <button
                type="button"
                class="calendar-day ${isOutside ? "outside" : ""} ${inRange ? "in-range" : ""} ${isSelectedStart ? "start" : ""} ${isSelectedEnd ? "end" : ""} ${isToday ? "today" : ""}"
                data-date="${formatDateInput(day)}"
                ${isOutside ? 'tabindex="-1"' : ""}
              >${day.getDate()}</button>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderDatePicker() {
  const month = startOfDay(state.datePickerMonth);
  const nextMonth = addMonths(month, 1);
  elements.datePickerTitle.textContent = state.datePickerStart && state.datePickerEnd ? "Selected date range" : "Choose a date or range";
  elements.datePickerSubtitle.textContent = state.datePickerStart && !state.datePickerEnd ? "Pick an end date to complete the range" : "Choose one day or select a range";
  elements.datePickerApply.disabled = !state.datePickerStart;
  elements.datePickerMonths.innerHTML = `${renderMonthHeader(month)}${renderMonthHeader(nextMonth)}`;
  elements.datePickerPrev.disabled = false;
  elements.datePickerNext.disabled = false;
  if (state.datePickerAnchor) {
    const rect = state.datePickerAnchor.getBoundingClientRect();
    const width = Math.min(756, window.innerWidth - 32);
    const left = clamp(rect.left, 16, window.innerWidth - width - 16);
    const height = elements.datePicker.offsetHeight || 0;
    const fitsBelow = rect.bottom + 10 + height < window.innerHeight - 12;
    const top = fitsBelow ? rect.bottom + 10 : Math.max(12, rect.top - 10 - height);
    elements.datePicker.style.position = "fixed";
    elements.datePicker.style.left = `${left}px`;
    elements.datePicker.style.top = `${top}px`;
    elements.datePicker.style.width = `${width}px`;
  }
}

function openDatePicker(target = "analytics", anchorButton = elements.dateFilterButton) {
  const range = target === "table" ? getTableRange() : getActiveRange();
  state.datePickerTarget = target;
  state.datePickerAnchor = anchorButton || null;
  if (range.custom) {
    state.datePickerStart = new Date(range.start);
    state.datePickerEnd = new Date(range.end);
    state.datePickerMonth = monthStart(range.start);
  } else {
    const anchor = new Date();
    state.datePickerStart = null;
    state.datePickerEnd = null;
    state.datePickerMonth = monthStart(anchor);
  }
  state.datePickerOpen = true;
  renderDatePicker();
  elements.datePicker.hidden = false;
  elements.dateFilterButton.setAttribute("aria-expanded", String(target === "analytics"));
  if (elements.tableDateFilterButton) {
    elements.tableDateFilterButton.setAttribute("aria-expanded", String(target === "table"));
  }
}

function selectCalendarDate(date) {
  if (!state.datePickerStart || (state.datePickerStart && state.datePickerEnd)) {
    state.datePickerStart = startOfDay(date);
    state.datePickerEnd = null;
    return;
  }

  const clicked = startOfDay(date);
  if (clicked.getTime() < state.datePickerStart.getTime()) {
    state.datePickerEnd = state.datePickerStart;
    state.datePickerStart = clicked;
  } else {
    state.datePickerEnd = clicked;
  }
}

function applyDatePickerRange() {
  if (!state.datePickerStart) return;
  const end = state.datePickerEnd || state.datePickerStart;
  if (state.datePickerTarget === "table") {
    setTableCustomRange(state.datePickerStart, end);
  } else {
    setCustomRange(state.datePickerStart, end);
  }
  closeDatePicker();
  if (state.datePickerTarget === "table") {
    loadProjects();
  } else {
    refreshAll({ resetPage: true });
  }
}

function clearDatePickerRange() {
  state.datePickerStart = null;
  state.datePickerEnd = null;
  if (state.datePickerTarget === "table") {
    clearTableCustomRange();
  } else {
    clearCustomRange();
  }
  closeDatePicker();
  if (state.datePickerTarget === "table") {
    loadProjects();
  } else {
    refreshAll({ resetPage: true });
  }
}

function shiftDatePickerMonth(months) {
  state.datePickerMonth = addMonths(state.datePickerMonth, months);
  renderDatePicker();
}

async function resolveData(loader, fallback) {
  if (isFileProtocol()) {
    return fallback();
  }

  try {
    return await loader();
  } catch {
    return fallback();
  }
}

async function loadAnalytics() {
  const token = ++state.analyticsToken;
  state.loadingAnalytics = true;
  elements.analyticsErrorBanner.hidden = true;
  try {
    const data = await getAnalyticsData();
    if (token !== state.analyticsToken) return;
    state.loadingAnalytics = false;
    try {
      renderAnalytics(data);
    } catch (renderError) {
      console.error(renderError);
      const params = getRequestParams();
      const fallback = buildDashboard(
        state.period,
        true,
        state.chartOwnerEmail,
        PROJECTS,
        params.date_from ?? "",
        params.date_to ?? "",
      );
      renderAnalytics(fallback);
    }
  } catch (error) {
    if (token !== state.analyticsToken) return;
    state.loadingAnalytics = false;
    const params = getRequestParams();
    const fallback = buildDashboard(
      state.period,
      true,
      state.chartOwnerEmail,
      PROJECTS,
      params.date_from ?? "",
      params.date_to ?? "",
    );
    renderAnalytics(fallback);
  }
  elements.analyticsErrorBanner.hidden = true;
}

async function loadProjects() {
  const token = ++state.projectToken;
  state.loadingProjects = true;
  state.error = null;
  renderSkeletonProjects();

  try {
    const data = await getProjectsData();
    if (token !== state.projectToken) return;
    state.loadingProjects = false;
    state.total = data.total;
    state.items = data.items;
    renderRows(data);
    renderPagination(data.total);
  } catch (error) {
    if (token !== state.projectToken) return;
    state.loadingProjects = false;
    state.error = error;
    const tableRange = getTableRange();
    const tableParams = tableRange.custom
      ? {
          date_from: formatDateInput(tableRange.start),
          date_to: formatDateInput(tableRange.end),
        }
      : {};
    const params = getRequestParams();
    const fallback = buildProjectPage({
      page: state.page,
      perPage: state.perPage,
      ownerEmail: state.ownerEmail,
      period: state.period,
      projects: PROJECTS,
      dateFrom: tableParams.date_from ?? params.date_from ?? "",
      dateTo: tableParams.date_to ?? params.date_to ?? "",
    });
    state.total = fallback.total;
    state.items = fallback.items;
    renderRows(fallback);
    renderPagination(fallback.total);
  }
}

async function loadSuggestionPool() {
  state.suggestionPool = getSuggestionPool(PROJECTS);
}

function refreshAll({ resetPage = false } = {}) {
  if (resetPage) state.page = 1;
  loadAnalytics();
  loadProjects();
}

function syncPeriodButtons() {
  periodButtons.forEach((button) => {
    button.classList.toggle("active", !state.customRange && button.dataset.period === state.period);
  });
}

function debounceProjects() {
  window.clearTimeout(state.filterTimer);
  state.filterTimer = window.setTimeout(() => {
    state.page = 1;
    loadProjects();
  }, 300);
}

elements.ownerSearch.addEventListener("input", () => {
  state.ownerEmail = elements.ownerSearch.value.trim();
  state.suggestionIndex = -1;
  renderSuggestions();
  window.clearTimeout(state.filterTimer);
  state.filterTimer = window.setTimeout(() => {
    state.page = 1;
    loadProjects();
  }, 300);
});

elements.ownerSearch.addEventListener("focus", renderSuggestions);

elements.ownerSearch.addEventListener("keydown", (event) => {
  const items = Array.from(elements.suggestions.querySelectorAll(".suggestion-item"));
  if (!items.length || elements.suggestions.hidden) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.suggestionIndex = (state.suggestionIndex + 1) % items.length;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    state.suggestionIndex = (state.suggestionIndex - 1 + items.length) % items.length;
  } else if (event.key === "Enter" && state.suggestionIndex >= 0) {
    event.preventDefault();
    items[state.suggestionIndex].click();
    return;
  } else if (event.key === "Escape") {
    hideSuggestions();
    return;
  } else {
    return;
  }

  items.forEach((item, index) => item.setAttribute("aria-selected", String(index === state.suggestionIndex)));
});

elements.suggestions.addEventListener("click", (event) => {
  const button = event.target.closest(".suggestion-item");
  if (!button) return;
  elements.ownerSearch.value = button.dataset.email || "";
  state.ownerEmail = elements.ownerSearch.value.trim();
  hideSuggestions();
  state.page = 1;
  loadProjects();
});

elements.chartSearch?.addEventListener("input", () => {
  state.chartOwnerEmail = elements.chartSearch.value.trim();
  state.chartSuggestionIndex = -1;
  renderChartSuggestions();
  window.clearTimeout(state.chartFilterTimer);
  state.chartFilterTimer = window.setTimeout(() => {
    loadAnalytics();
  }, 300);
});

elements.chartSearch?.addEventListener("focus", renderChartSuggestions);

elements.chartSearch?.addEventListener("keydown", (event) => {
  const items = Array.from(elements.chartSuggestions.querySelectorAll(".suggestion-item"));
  if (!items.length || elements.chartSuggestions.hidden) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.chartSuggestionIndex = (state.chartSuggestionIndex + 1) % items.length;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    state.chartSuggestionIndex = (state.chartSuggestionIndex - 1 + items.length) % items.length;
  } else if (event.key === "Enter" && state.chartSuggestionIndex >= 0) {
    event.preventDefault();
    items[state.chartSuggestionIndex].click();
    return;
  } else if (event.key === "Escape") {
    hideChartSuggestions();
    return;
  } else {
    return;
  }

  items.forEach((item, index) => item.setAttribute("aria-selected", String(index === state.chartSuggestionIndex)));
});

elements.chartSuggestions?.addEventListener("click", (event) => {
  const button = event.target.closest(".suggestion-item");
  if (!button) return;
  elements.chartSearch.value = button.dataset.email || "";
  state.chartOwnerEmail = elements.chartSearch.value.trim();
  hideChartSuggestions();
  loadAnalytics();
});

elements.exportButton.addEventListener("click", async () => {
  try {
    const data = await getProjectsData();
    const csv = buildCsv(data.items);
    const range = getActiveRange();
    const currentRange = state.analytics?.ranges?.current;
    const from = range.custom ? formatDateInput(range.start) : currentRange?.start ? formatDateInput(coerceDate(currentRange.start)) : "0000-00-00";
    const to = range.custom ? formatDateInput(range.end) : currentRange?.end ? formatDateInput(coerceDate(currentRange.end)) : "0000-00-00";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `projects_${from}_${to}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch {
    showToast("Could not export CSV");
  }
});

elements.retryAnalyticsButton.addEventListener("click", () => {
  loadAnalytics();
});

elements.perPage.addEventListener("change", () => {
  state.perPage = Number(elements.perPage.value);
  refreshAll({ resetPage: true });
});

elements.prevPage.addEventListener("click", () => {
  state.page = Math.max(1, state.page - 1);
  loadProjects();
});

elements.nextPage.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(state.total / state.perPage));
  state.page = Math.min(totalPages, state.page + 1);
  loadProjects();
});

elements.skipBack.addEventListener("click", () => {
  state.page = Math.max(1, state.page - 5);
  loadProjects();
});

elements.skipForward.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(state.total / state.perPage));
  state.page = Math.min(totalPages, state.page + 5);
  loadProjects();
});

elements.pageNumbers.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (!button) return;
  state.page = Number(button.dataset.page);
  loadProjects();
});

elements.tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "copy-id") {
    copyId(button.dataset.id || "");
    return;
  }

  if (action === "open-project") {
    window.open(button.dataset.url || "/", "_blank", "noopener");
    return;
  }

  if (action === "view-products") {
    const project = state.items.find((item) => item.productUrl === button.dataset.url);
    if (project) openProductsDialog(project);
  }
});

elements.tableDateFilterButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (state.datePickerOpen && state.datePickerTarget === "table") {
    closeDatePicker();
    return;
  }
  openDatePicker("table", elements.tableDateFilterButton);
});

elements.dialogConfirm.addEventListener("click", () => {
  if (state.dialogProject) {
    window.open(state.dialogProject.productUrl, "_blank", "noopener");
  }
  state.dialogProject = null;
});

elements.productsDialog.addEventListener("close", () => {
  state.dialogProject = null;
});

elements.leftCompareControl.addEventListener("click", () => {
  state.compareLeft = !state.compareLeft;
  if (state.analytics) renderAnalytics(state.analytics);
});

elements.rightCompareControl.addEventListener("click", () => {
  state.compareRight = !state.compareRight;
  if (state.analytics) renderAnalytics(state.analytics);
});

elements.dateFilterButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (state.datePickerOpen && state.datePickerTarget === "analytics") {
    closeDatePicker();
    return;
  }
  openDatePicker("analytics", elements.dateFilterButton);
});

elements.datePickerPrev.addEventListener("click", () => {
  shiftDatePickerMonth(-1);
});

elements.datePickerNext.addEventListener("click", () => {
  shiftDatePickerMonth(1);
});

elements.datePickerClear.addEventListener("click", clearDatePickerRange);

elements.datePickerApply.addEventListener("click", applyDatePickerRange);

elements.datePickerMonths.addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]");
  if (!button) return;
  const clicked = parseDateInput(button.dataset.date);
  if (!clicked) return;
  selectCalendarDate(clicked);
  renderDatePicker();
});

periodButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.period = button.dataset.period;
    state.customRange = null;
    updateDateFilterLabels();
    syncPeriodButtons();
    refreshAll({ resetPage: true });
  });
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-wrap")) {
    hideSuggestions();
  }
  if (!event.target.closest(".chart-search-wrap")) {
    hideChartSuggestions();
  }

  if (state.datePickerOpen) {
    const insidePicker = event.target.closest(".date-picker");
    const insideFilter = event.target.closest(".date-filter");
    const insideTableFilter = event.target.closest(".table-date-filter");
    if (!insidePicker && !insideFilter && !insideTableFilter) {
      closeDatePicker();
    }
  }

  const tooltipButton = event.target.closest("[data-tooltip]");
  if (tooltipButton) {
    event.stopPropagation();
    if (state.tooltip === tooltipButton && !elements.tooltip.hidden) {
      hideTooltip();
      return;
    }
    openTooltip(tooltipButton);
    return;
  }

  if (state.tooltip) {
    hideTooltip();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideSuggestions();
    hideTooltip();
  }
});

window.addEventListener("resize", () => {
  if (state.tooltip) {
    openTooltip(state.tooltip);
  }
  if (state.datePickerOpen) {
    renderDatePicker();
  }
});

syncPeriodButtons();
updateDateFilterLabels("analytics");
updateDateFilterLabels("table");
loadSuggestionPool().then(() => {
  refreshAll();
});

function buildCsv(rows) {
  const header = ["Project", "Owner Email", "ID", "Products placed", "Actions taken", "Views", "Budget", "Status", "Created"];
  return [header, ...rows.map((row) => [
    row.projectName,
    row.ownerEmail,
    row.id,
    row.productsPlaced,
    row.actionsTaken,
    row.views,
    row.budget,
    row.status,
    row.created,
  ])]
    .map((cols) => cols.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}
