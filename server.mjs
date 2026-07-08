import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3000);
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

function generateProjects(count = totalProjects) {
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

const PROJECTS = generateProjects();

function groupBy(items, bucketFn, labels) {
  const map = new Map(labels.map((label) => [label, { created: 0, products: 0, actions: 0, budget: 0, views: 0, active: 0, deleted: 0 }]));
  for (const item of items) {
    const bucket = bucketFn(item);
    if (!map.has(bucket)) continue;
    const entry = map.get(bucket);
    entry.created += 1;
    entry.products += item.productsPlaced;
    entry.actions += item.actionsTaken;
    entry.budget += item.budget;
    entry.views += item.views;
    if (item.status === "Live") entry.active += 1;
    else entry.deleted += 1;
  }
  return labels.map((label) => map.get(label));
}

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

function parsePeriodRange(period) {
  const config = pickPeriodConfig(period);
  const end = endOfDay(new Date());
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
    start: addDays(startOfDay(end), -(config.durationDays - 1)),
    end,
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
    const out = startOfDay(end);
    return out;
  }
  if (config.mode === "month") {
    return new Date(end.getFullYear(), 0, 1);
  }
  return addDays(startOfDay(end), -(config.durationDays - 1));
}

function bucketKeyFor(config, date) {
  if (config.mode === "hour") return String(date.getHours()).padStart(2, "0");
  if (config.mode === "month") return String(date.getMonth()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
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

function buildDashboard(period, compare, ownerEmail = "") {
  const { config, start: currentStart, end } = parsePeriodRange(period);
  const previousEnd = endOfDay(addDays(currentStart, -1));
  const previousStart = config.mode === "month" ? new Date(previousEnd.getFullYear(), 0, 1) : addDays(currentStart, -config.durationDays);
  const ownerNeedle = ownerEmail.trim().toLowerCase();
  const ownerMatches = ownerNeedle
    ? (item) => item.ownerEmail.toLowerCase().includes(ownerNeedle)
    : () => true;

  const currentItems = PROJECTS.filter((project) => {
    const created = new Date(project.createdAt);
    return created >= currentStart && created <= end && ownerMatches(project);
  });

  const previousItems = PROJECTS.filter((project) => {
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

  const delta = (current, previous) => {
    if (!compare || !previous || previous === 0) return null;
    const raw = ((current - previous) / previous) * 100;
    return Math.round(raw * 10) / 10;
  };

  const lineSeries = currentSeries.buckets.map((bucket) => bucket.created);
  const compareLineSeries = previousSeries?.buckets.map((bucket) => bucket.created) ?? [];
  const barSeries = currentSeries.buckets.map((bucket) => bucket.products);
  const compareBarSeries = previousSeries?.buckets.map((bucket) => bucket.products) ?? [];

  const legend = config.mode === "hour"
    ? ["Today", "Yesterday"]
    : config.mode === "month"
      ? ["This Year", "Last Year"]
      : ["Current", "Previous"];

  return {
    period: config.label,
    compare,
    cards: [
      {
        title: "Projects created",
        value: totals.created.toLocaleString("en-US"),
        delta: delta(totals.created, previousTotals?.created),
        caption: config.mode === "month" ? "New projects this year" : "New projects this period",
        accent: "green",
        sparkline: lineSeries,
      },
      {
        title: "Products placed",
        value: totals.products.toLocaleString("en-US"),
        delta: delta(totals.products, previousTotals?.products),
        caption: "Items added across all scenes",
        accent: "green",
        sparkline: barSeries,
      },
      {
        title: "Actions on items",
        value: totals.actions.toLocaleString("en-US"),
        delta: delta(totals.actions, previousTotals?.actions),
        caption: "Moves, rotations, edits",
        accent: "red",
        sparkline: currentSeries.buckets.map((bucket) => bucket.actions),
      },
      {
        title: "Active projects",
        value: totals.active.toLocaleString("en-US"),
        delta: delta(totals.active, previousTotals?.active),
        caption: `${totals.active.toLocaleString("en-US")} active, ${totals.deleted.toLocaleString("en-US")} deleted`,
        accent: "red",
        sparkline: currentSeries.buckets.map((bucket) => bucket.active),
      },
      {
        title: "Project budget",
        value: `$${totals.budget.toLocaleString("en-US")}`,
        delta: delta(totals.budget, previousTotals?.budget),
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
        legend,
        labels: currentSeries.labels,
        series: lineSeries,
        compareSeries: compareLineSeries,
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
        legend,
        labels: currentSeries.labels,
        series: barSeries,
        compareSeries: compareBarSeries,
      },
    },
  };
}

function buildCsv(rows) {
  const header = ["Project", "Owner Email", "ID", "Products placed", "Actions taken", "Views", "Budget", "Status", "Created"];
  const lines = [
    header,
    ...rows.map((row) => [
      row.projectName,
      row.ownerEmail,
      row.id,
      row.productsPlaced,
      row.actionsTaken,
      row.views,
      row.budget,
      row.status,
      row.created,
    ]),
  ];

  return lines.map((cols) => cols.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  return "application/octet-stream";
}

function safeJoin(rootDir, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const rel = decoded.startsWith("/") ? decoded.slice(1) : decoded;
  const abs = path.normalize(path.join(rootDir, rel));
  if (!abs.startsWith(rootDir)) return null;
  return abs;
}

function sendFile(res, filePath) {
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    "Content-Type": contentType(filePath),
    "Content-Length": stat.size,
    "Cache-Control": "no-cache",
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/projects") {
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const perPage = Math.max(1, Math.min(totalProjects, Number(url.searchParams.get("per_page") || 100)));
    const ownerEmail = (url.searchParams.get("owner_email") || "").trim().toLowerCase();
    const period = url.searchParams.get("period") || "1y";
    const { start: periodStart, end: periodEnd } = parsePeriodRange(period);
    const filtered = PROJECTS.filter((project) => {
      const created = new Date(project.createdAt);
      const ownerOk = ownerEmail ? project.ownerEmail.toLowerCase().includes(ownerEmail) : true;
      return ownerOk && created >= periodStart && created <= periodEnd;
    });
    const total = filtered.length;
    const sliceStart = (page - 1) * perPage;
    const items = filtered.slice(sliceStart, sliceStart + perPage);
    json(res, 200, { page, per_page: perPage, total, items });
    return;
  }

  if (url.pathname === "/api/analytics") {
    const period = url.searchParams.get("period") || "1y";
    const compare = url.searchParams.get("compare") !== "0";
    const ownerEmail = (url.searchParams.get("owner_email") || "").trim();
    json(res, 200, buildDashboard(period, compare, ownerEmail));
    return;
  }

  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = safeJoin(__dirname, requestPath);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  sendFile(res, filePath);
});

server.listen(port, () => {
  process.stdout.write(`http://localhost:${port}\n`);
});
