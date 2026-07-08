const totalProjects = 2000;

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function parseDateInput(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function differenceInDaysInclusive(start, end) {
  return Math.max(1, Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000) + 1);
}

function buildRequestedRange(period, dateFrom, dateTo) {
  const from = parseDateInput(dateFrom);
  const to = parseDateInput(dateTo);

  if (from && to) {
    const start = startOfDay(from <= to ? from : to);
    const end = endOfDay(from <= to ? to : from);
    const durationDays = differenceInDaysInclusive(start, end);
    return {
      custom: true,
      config: {
        label: formatRangeLabel(start, end),
        durationDays,
        mode: durationDays === 1 ? "hour" : "day",
      },
      start,
      end,
    };
  }

  const parsed = parsePeriodRange(period);
  return { ...parsed, custom: false };
}

const ownerEmails = [
  "client@manager.com",
  "alex@studioalpha.com",
  "maria@blueprint.co",
  "sam@northpeak.io",
  "taylor@harborlabs.design",
  "maya@paperform.studio",
  "jordan@frameworks.dev",
  "noah@cadencehomes.com",
  "zoe@vertexatelier.com",
  "liam@copperline.com",
  "ava@glowgrid.co",
  "nina@workbench.space",
  "owen@districtbuild.com",
  "ella@modulehouse.io",
  "ben@kindredplans.com",
  "mia@alignedbuild.com",
  "lucas@sitecraft.studio",
];

const projectNames = [
  "CTX GYM-Alpha Club Layout",
  "Harbor Loft 14",
  "North Star Lobby",
  "Studio Line 07",
  "Meridian Residence",
  "Quartz Unit",
  "Lumen Workspace",
  "Cinder Shell",
  "Tidal House",
  "Boreal Flat",
  "Aster Yard",
  "Summit Frame",
];

export function generateProjects(count = totalProjects) {
  const now = new Date();
  const end = startOfDay(now);
  const start = addDays(end, -364);
  const spanMs = end.getTime() - start.getTime();

  return Array.from({ length: count }, (_, index) => {
    const seed = hashString(`project-${index + 1}`);
    const rng = makeRng(seed);
    const createdAt = new Date(start.getTime() + Math.floor(rng() * spanMs));

    if (index < 24) {
      createdAt.setTime(end.getTime());
      createdAt.setHours(index % 24, Math.floor(rng() * 60), Math.floor(rng() * 60), 0);
    } else if (index < 96) {
      const recent = addDays(end, -(index % 7));
      createdAt.setTime(recent.getTime());
      createdAt.setHours(Math.floor(rng() * 24), Math.floor(rng() * 60), Math.floor(rng() * 60), 0);
    } else {
      createdAt.setHours(Math.floor(rng() * 24), Math.floor(rng() * 60), Math.floor(rng() * 60), 0);
    }

    const projectName = index < 4 ? "CTX GYM-Alpha Club Layout" : `${projectNames[seed % projectNames.length]} ${String(index + 1).padStart(3, "0")}`;
    const ownerEmail = ownerEmails[(seed + index) % ownerEmails.length];
    const id = `PRJ-${(seed % 0xffffff).toString(16).toUpperCase().padStart(6, "0")}`;
    const productsPlaced = 1 + (seed % 14);
    const actionsTaken = 150 + (seed % 900);
    const views = 120 + (seed % 9800);
    const budget = 600 + (seed % 15000);
    const status = seed % 5 === 0 ? "Deleted" : "Live";

    return {
      projectName,
      ownerEmail,
      id,
      productsPlaced,
      actionsTaken,
      views,
      budget,
      status,
      created: formatDate(createdAt),
      createdAt: createdAt.toISOString(),
      projectUrl: `https://example.com/projects/${encodeURIComponent(id.toLowerCase())}`,
      productUrl: `https://example.com/projects/${encodeURIComponent(id.toLowerCase())}/products`,
    };
  });
}

export const PROJECTS = generateProjects();

function sum(items, key) {
  return items.reduce((acc, item) => acc + item[key], 0);
}

function pickPeriodConfig(period) {
  const configs = {
    today: { label: "Today", durationDays: 1, mode: "hour" },
    "7d": { label: "7 D", durationDays: 7, mode: "day" },
    "2w": { label: "2 W", durationDays: 14, mode: "day" },
    "3w": { label: "3 W", durationDays: 21, mode: "day" },
    "4w": { label: "4 W", durationDays: 28, mode: "day" },
    "1m": { label: "1 M", durationDays: 30, mode: "day" },
    "1y": { label: "1 Y", durationDays: 365, mode: "month" },
  };
  return configs[period] ?? configs["1y"];
}

export function parsePeriodRange(period) {
  const config = pickPeriodConfig(period);
  const anchor = startOfDay(new Date());
  const end = period === "today" ? endOfDay(anchor) : endOfDay(addDays(anchor, -1));
  if (config.mode === "month") {
    return {
      config,
      start: new Date(end.getFullYear(), 0, 1),
      end,
    };
  }

  if (config.mode === "hour") {
    return {
      config,
      start: startOfDay(end),
      end,
    };
  }

  return {
    config,
    start: config.mode === "day" ? addDays(startOfDay(end), -(config.durationDays - 1)) : addMonths(end, -1),
    end,
  };
}

export function formatShortDate(date) {
  return date.toLocaleString("en-US", { month: "short", day: "numeric" });
}

export function formatRangeLabel(start, end) {
  const sameDay = formatDate(start) === formatDate(end);
  return sameDay ? formatShortDate(end) : `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

export function describeComparisonLabels(period, currentStart, currentEnd, previousStart, previousEnd) {
  if (period === "today") {
    return { current: formatShortDate(currentEnd), previous: formatShortDate(previousEnd) };
  }

  if (period === "1m") {
    return { current: "This month", previous: "Last month" };
  }

  if (period === "1y") {
    return { current: "This Year", previous: "Last Year" };
  }

  return {
    current: formatRangeLabel(currentStart, currentEnd),
    previous: formatRangeLabel(previousStart, previousEnd),
  };
}

export function niceAxis(maxValue) {
  if (maxValue <= 5) return { max: 5, ticks: [0, 1, 2, 3, 4, 5] };
  if (maxValue <= 10) return { max: 10, ticks: [0, 2, 4, 6, 8, 10] };

  const rawStep = maxValue / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const candidates = [1, 2, 2.5, 5, 10].map((candidate) => candidate * magnitude);
  const step = candidates.find((candidate) => maxValue / candidate <= 5) ?? candidates[candidates.length - 1];
  const max = Math.ceil(maxValue / step) * step;
  const ticks = [];
  for (let value = 0; value <= max; value += step) ticks.push(value);
  return { max, ticks };
}

export function computeDelta(current, previous) {
  if (previous === 0 && current === 0) {
    return { pct: 0, direction: "flat", label: "0%" };
  }
  if (previous === 0) {
    return { pct: null, direction: "up", label: "New" };
  }

  const raw = ((current - previous) / previous) * 100;
  const rounded = Math.round(raw);
  if (rounded > 999) {
    return { pct: 999, direction: "up", label: ">999%" };
  }
  if (rounded < -999) {
    return { pct: -999, direction: "down", label: "<-999%" };
  }
  if (rounded === 0) {
    return { pct: 0, direction: "flat", label: "0%" };
  }

  return {
    pct: rounded,
    direction: rounded > 0 ? "up" : "down",
    label: `${rounded > 0 ? "+" : ""}${rounded}%`,
  };
}

function bucketLabelsFor(config, end) {
  if (config.mode === "hour") {
    return Array.from({ length: 24 }, (_, hour) => `${hour.toString().padStart(2, "0")}`);
  }

  if (config.mode === "month") {
    return Array.from({ length: 12 }, (_, month) => new Date(end.getFullYear(), month, 1).toLocaleString("en-US", { month: "short" }));
  }

  return Array.from({ length: config.durationDays }, (_, offset) => {
    const date = addDays(startOfDay(end), -(config.durationDays - 1 - offset));
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}-${day}`;
  });
}

function bucketStart(config, end) {
  if (config.mode === "hour") {
    return startOfDay(end);
  }
  if (config.mode === "month") {
    return new Date(end.getFullYear(), 0, 1);
  }
  return addDays(startOfDay(end), -(config.durationDays - 1));
}

function buildSeries(items, config, end) {
  const labels = bucketLabelsFor(config, end);
  const start = bucketStart(config, end);
  const buckets = labels.map(() => ({ created: 0, products: 0, actions: 0, budget: 0, views: 0, active: 0, deleted: 0 }));

  for (const item of items) {
    const date = new Date(item.createdAt);
    if (date > end) continue;
    if (config.mode === "hour") {
      if (date < start) continue;
      const index = date.getHours();
      buckets[index].created += 1;
      buckets[index].products += item.productsPlaced;
      buckets[index].actions += item.actionsTaken;
      buckets[index].budget += item.budget;
      buckets[index].views += item.views;
      if (item.status === "Live") buckets[index].active += 1;
      else buckets[index].deleted += 1;
      continue;
    }

    if (config.mode === "month") {
      if (date < start) continue;
      const index = date.getMonth();
      buckets[index].created += 1;
      buckets[index].products += item.productsPlaced;
      buckets[index].actions += item.actionsTaken;
      buckets[index].budget += item.budget;
      buckets[index].views += item.views;
      if (item.status === "Live") buckets[index].active += 1;
      else buckets[index].deleted += 1;
      continue;
    }

    if (date >= start) {
      const index = Math.floor((startOfDay(date).getTime() - start.getTime()) / 86400000);
      if (index >= 0 && index < buckets.length) {
        buckets[index].created += 1;
        buckets[index].products += item.productsPlaced;
        buckets[index].actions += item.actionsTaken;
        buckets[index].budget += item.budget;
        buckets[index].views += item.views;
        if (item.status === "Live") buckets[index].active += 1;
        else buckets[index].deleted += 1;
      }
    }
  }

  return { labels, buckets };
}

export function buildDashboard(period, compare, ownerEmail = "", projects = PROJECTS, dateFrom = "", dateTo = "") {
  const requestedRange = buildRequestedRange(period, dateFrom, dateTo);
  const { config, start: currentStart, end } = requestedRange;
  const previousEnd = endOfDay(addDays(currentStart, -1));
  const previousStart = config.mode === "month"
    ? new Date(previousEnd.getFullYear(), 0, 1)
    : config.mode === "hour"
      ? startOfDay(addDays(currentStart, -1))
      : addDays(currentStart, -config.durationDays);
  const ownerNeedle = ownerEmail.trim().toLowerCase();
  const ownerMatches = ownerNeedle
    ? (item) => item.ownerEmail.toLowerCase().includes(ownerNeedle)
    : () => true;

  const currentItems = projects.filter((project) => {
    const created = new Date(project.createdAt);
    return created >= currentStart && created <= end && ownerMatches(project);
  });

  const previousItems = projects.filter((project) => {
    const created = new Date(project.createdAt);
    return created >= previousStart && created <= previousEnd && ownerMatches(project);
  });

  const currentSeries = buildSeries(currentItems, config, end);
  const previousSeries = compare ? buildSeries(previousItems, config, previousEnd) : null;
  const totals = {
    created: currentItems.length,
    products: sum(currentItems, "productsPlaced"),
    actions: sum(currentItems, "actionsTaken"),
    budget: sum(currentItems, "budget"),
    active: currentItems.filter((item) => item.status === "Live").length,
    deleted: currentItems.filter((item) => item.status === "Deleted").length,
    views: sum(currentItems, "views"),
  };
  const previousTotals = previousItems.length
    ? {
        created: previousItems.length,
        products: sum(previousItems, "productsPlaced"),
        actions: sum(previousItems, "actionsTaken"),
        budget: sum(previousItems, "budget"),
        active: previousItems.filter((item) => item.status === "Live").length,
        deleted: previousItems.filter((item) => item.status === "Deleted").length,
        views: sum(previousItems, "views"),
      }
    : null;

  const lineSeries = currentSeries.buckets.map((bucket) => bucket.created);
  const compareLineSeries = previousSeries?.buckets.map((bucket) => bucket.created) ?? [];
  const barSeries = currentSeries.buckets.map((bucket) => bucket.products);
  const compareBarSeries = previousSeries?.buckets.map((bucket) => bucket.products) ?? [];
  const comparisonLabels = requestedRange.custom
    ? {
        current: formatRangeLabel(currentStart, end),
        previous: formatRangeLabel(previousStart, previousEnd),
      }
    : describeComparisonLabels(period, currentStart, end, previousStart, previousEnd);
  const periodPreviousStart = previousStart;
  const periodPreviousEnd = previousEnd;

  return {
    period: config.label,
    compare,
    ranges: {
      current: { start: currentStart, end },
      previous: { start: periodPreviousStart, end: periodPreviousEnd },
      labels: comparisonLabels,
    },
    cards: [
      {
        title: "Projects created",
        value: totals.created.toLocaleString("en-US"),
        delta: compare ? computeDelta(totals.created, previousTotals?.created ?? 0) : null,
        caption: config.mode === "month" ? "New projects this year" : "New projects this period",
        accent: "green",
        sparkline: lineSeries,
      },
      {
        title: "Products placed",
        value: totals.products.toLocaleString("en-US"),
        delta: compare ? computeDelta(totals.products, previousTotals?.products ?? 0) : null,
        caption: "Items added across all scenes",
        accent: "green",
        sparkline: barSeries,
      },
      {
        title: "Actions on items",
        value: totals.actions.toLocaleString("en-US"),
        delta: compare ? computeDelta(totals.actions, previousTotals?.actions ?? 0) : null,
        caption: "Moves, rotations, edits",
        accent: "red",
        sparkline: currentSeries.buckets.map((bucket) => bucket.actions),
      },
      {
        title: "Active projects",
        value: totals.active.toLocaleString("en-US"),
        delta: compare ? computeDelta(totals.active, previousTotals?.active ?? 0) : null,
        caption: `${totals.active.toLocaleString("en-US")} active, ${totals.deleted.toLocaleString("en-US")} deleted`,
        accent: "red",
        sparkline: currentSeries.buckets.map((bucket) => bucket.active),
      },
      {
        title: "Project budget",
        value: `$${totals.budget.toLocaleString("en-US")}`,
        delta: compare ? computeDelta(totals.budget, previousTotals?.budget ?? 0) : null,
        caption: "Total spent this period",
        accent: "green",
        sparkline: currentSeries.buckets.map((bucket) => bucket.budget),
      },
    ],
    charts: {
      left: {
        value: totals.created.toLocaleString("en-US"),
        title: "Projects created",
        subtitle: config.mode === "hour" ? "Each point is one hour" : config.mode === "month" ? "Each point is one month" : "Each point is one day",
        delta: compare ? computeDelta(totals.created, previousTotals?.created ?? 0) : null,
        legend: [comparisonLabels.current, comparisonLabels.previous],
        labels: currentSeries.labels,
        series: lineSeries,
        compareSeries: compareLineSeries,
        maxValue: Math.max(...lineSeries, ...(compare ? compareLineSeries : []), 0),
      },
      right: {
        value: totals.products.toLocaleString("en-US"),
        title: config.mode === "hour" ? "Products placed today" : "Products placed by day",
        subtitle:
          config.mode === "hour"
            ? "Every hour shown, including hours with none placed"
            : config.mode === "month"
              ? "Every month shown, including months with none placed"
              : "Every day shown, including days with none placed",
        delta: compare ? computeDelta(totals.products, previousTotals?.products ?? 0) : null,
        legend: [comparisonLabels.current, comparisonLabels.previous],
        labels: currentSeries.labels,
        series: barSeries,
        compareSeries: compareBarSeries,
        merged: currentSeries.labels.map((label, index) => ({
          label,
          current: barSeries[index] ?? 0,
          previous: compareBarSeries[index] ?? 0,
        })),
        maxValue: Math.max(...barSeries, ...(compare ? compareBarSeries : []), 0),
      },
    },
  };
}

export function buildProjectPage({ page = 1, perPage = 100, ownerEmail = "", period = "1y", projects = PROJECTS, dateFrom = "", dateTo = "" } = {}) {
  const ownerNeedle = ownerEmail.trim().toLowerCase();
  const { start, end } = buildRequestedRange(period, dateFrom, dateTo);
  const filtered = projects.filter((project) => {
    const created = new Date(project.createdAt);
    const ownerOk = ownerNeedle ? project.ownerEmail.toLowerCase().includes(ownerNeedle) : true;
    return ownerOk && created >= start && created <= end;
  });
  const total = filtered.length;
  const sliceStart = (Math.max(1, page) - 1) * Math.max(1, perPage);
  const items = filtered.slice(sliceStart, sliceStart + perPage);
  return { page, per_page: perPage, total, items };
}

export function getSuggestionPool(projects = PROJECTS) {
  return Array.from(new Set(projects.map((item) => item.ownerEmail))).sort();
}
