import { formatCreatedAt } from "./domain/memo.js";
import {
  deleteMemoById,
  getAllMemos,
  updateMemoUrlById
} from "./infrastructure/memoRepository.js";

const memoList = document.getElementById("memo-list");
const emptyState = document.getElementById("empty-state");
const emptyTitle = document.getElementById("empty-title");
const emptySubtitle = document.getElementById("empty-subtitle");
const memoView = document.getElementById("memo-view");
const domainView = document.getElementById("domain-view");
const domainList = document.getElementById("domain-list");
const domainEmpty = document.getElementById("domain-empty");
const tabMemos = document.getElementById("tab-memos");
const tabDomains = document.getElementById("tab-domains");
const filterBar = document.getElementById("filter-bar");
const filterLabel = document.getElementById("filter-label");
const clearFilter = document.getElementById("clear-filter");
const shortcutHint = document.getElementById("shortcut-hint");

let memos = [];
let editingId = null;
const expandedMemoIds = new Set();
let currentView = "memos";
let selectedScope = null;

init();

async function init() {
  updateShortcutHint();
  await loadMemos();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    if (changes.memos) {
      loadMemos();
    }
  });

  memoList.addEventListener("click", handleListClick);
  memoList.addEventListener("dblclick", handleListDblClick);
  domainList.addEventListener("click", handleDomainClick);
  tabMemos.addEventListener("click", () => setView("memos"));
  tabDomains.addEventListener("click", () => setView("domains"));
  clearFilter.addEventListener("click", () => {
    selectedScope = null;
    render();
  });
}

async function loadMemos() {
  memos = await getAllMemos();
  memos.sort((a, b) => b.createdAt - a.createdAt);
  render();
}

function render() {
  renderMemos();
  renderDomains();
  setView(currentView);
}

function renderMemos() {
  memoList.innerHTML = "";
  const filteredMemos = getFilteredMemos();
  const hasFilter = Boolean(selectedScope);

  if (hasFilter) {
    filterBar.classList.remove("hidden");
    filterBar.classList.add("flex");
    filterLabel.textContent = buildFilterLabel(selectedScope);
  } else {
    filterBar.classList.add("hidden");
    filterBar.classList.remove("flex");
  }

  if (filteredMemos.length === 0) {
    emptyState.classList.remove("hidden");
    if (hasFilter) {
      emptyTitle.textContent = "該当するメモがありません";
      emptySubtitle.classList.add("hidden");
    } else {
      emptyTitle.textContent = "まだメモがありません";
      emptySubtitle.classList.remove("hidden");
      emptySubtitle.textContent = "テキスト選択 → ショートカットで保存";
    }
    return;
  }

  emptyState.classList.add("hidden");

  filteredMemos.forEach((memo) => {
    memoList.appendChild(buildMemoCard(memo));
  });
}

function renderDomains() {
  domainList.innerHTML = "";
  const domains = buildDomainSummaries(memos);

  if (domains.length === 0) {
    domainEmpty.classList.remove("hidden");
    return;
  }

  domainEmpty.classList.add("hidden");
  domains.forEach((item) => {
    domainList.appendChild(
      buildDomainRow({
        label: item.domain,
        count: item.count,
        domain: item.domain,
        type: "domain"
      })
    );
    item.children.forEach((child, index) => {
      domainList.appendChild(
        buildDomainRow({
          label: `/${child.path}`,
          count: child.count,
          domain: item.domain,
          path: child.path,
          type: "path",
          indent: true,
          isLast: index === item.children.length - 1
        })
      );
    });
  });
}

function buildMemoCard(memo) {
  const card = document.createElement("article");
  card.className =
    "relative rounded-lg border border-neutral-200 bg-white pt-2.5 px-2.5 pb-1.5 shadow-sm transition-colors hover:bg-neutral-50 cursor-pointer";
  card.dataset.memoId = memo.id;

  const numberBadge = document.createElement("span");
  numberBadge.className =
    "absolute left-1.5 top-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600";
  numberBadge.textContent = formatNumberBadge(memo.number);

  const text = document.createElement("p");
  const isExpanded = expandedMemoIds.has(memo.id);
  const displayText = isExpanded ? ("　　　　　" + memo.text) : ("　　　　　" + memo.text.replace(/\n/g, "/"));
  text.className = isExpanded
    ? "whitespace-pre-wrap break-words text-xs text-neutral-900 leading-5"
    : "max-h-[3.75rem] overflow-hidden whitespace-pre-wrap break-words text-xs text-neutral-900 leading-5";
  text.textContent = displayText;

  const deleteButton = buildIconButton({
    label: "削除",
    action: "delete",
    memoId: memo.id,
    svgPath:
      "M6 18 18 6M6 6l12 12",
    className:
      "absolute right-1.5 top-1.5 text-red-600 hover:text-red-500"
  });

  card.appendChild(numberBadge);
  card.appendChild(deleteButton);

  if (editingId === memo.id) {
    const input = document.createElement("input");
    input.className =
      "mt-2 w-full rounded-md border border-neutral-300 bg-white px-2 px-2 py-1 text-[11px] text-neutral-800 focus:border-neutral-500 focus:outline-none";
    input.type = "url";
    input.value = memo.url;
    input.dataset.memoId = memo.id;

    const actions = document.createElement("div");
    actions.className = "mt-1.5 flex gap-2";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className =
      "rounded-md bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-neutral-100";
    saveButton.textContent = "保存";
    saveButton.dataset.action = "save-url";
    saveButton.dataset.memoId = memo.id;

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className =
      "rounded-md border border-neutral-300 px-2.5 py-1 text-[11px] text-neutral-600";
    cancelButton.textContent = "キャンセル";
    cancelButton.dataset.action = "cancel-edit";
    cancelButton.dataset.memoId = memo.id;

    actions.append(saveButton, cancelButton);

    card.append(text, input, actions);
    return card;
  }

  const urlButton = buildIconButton({
    label: memo.url ? "リンクを開く" : "URLなし",
    action: "open-url",
    memoId: memo.id,
    svgPath:
      "M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 1 0-7.07-7.07L10 5M14 11a5 5 0 0 1-7.07 0L4.1 8.17a5 5 0 1 1 7.07-7.07L13 3",
    className:
      "text-sky-600 hover:text-sky-500"
  });
  urlButton.dataset.url = memo.url;

  const dateIcon = buildInfoIcon({
    label: "作成日時",
    value: formatCreatedAt(memo.createdAt)
  });

  const actions = document.createElement("div");
  actions.className = "mt-1 flex items-center justify-end gap-2";

  const editButton = buildIconButton({
    label: "URL編集",
    action: "edit-url",
    memoId: memo.id,
    svgPath:
      "M12 20h9M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z",
    className:
      "rounded-md border border-neutral-200 p-1 text-neutral-600 hover:border-neutral-300"
  });

  actions.append(urlButton, editButton, dateIcon);

  card.append(text, actions);
  return card;
}

async function handleListClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return;
  }

  const button = target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const memoId = button.dataset.memoId;

  if (action === "open-url") {
    const url = button.dataset.url;
    if (url) {
      chrome.tabs.create({ url });
    }
    return;
  }

  if (!memoId) {
    return;
  }

  if (action === "edit-url") {
    editingId = memoId;
    render();
    return;
  }

  if (action === "cancel-edit") {
    editingId = null;
    render();
    return;
  }

  if (action === "save-url") {
    const input = memoList.querySelector(`input[data-memo-id="${memoId}"]`);
    const nextUrl = input instanceof HTMLInputElement ? input.value.trim() : "";
    await updateMemoUrlById(memoId, nextUrl);
    editingId = null;
    return;
  }

  if (action === "delete") {
    const ok = window.confirm("このメモを削除しますか？");
    if (!ok) {
      return;
    }
    await deleteMemoById(memoId);
  }
}

function handleListDblClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return;
  }
  if (target.closest("button") || target.closest("input")) {
    return;
  }
  const card = target.closest("article[data-memo-id]");
  if (!card) {
    return;
  }
  const memoId = card.dataset.memoId;
  if (!memoId || editingId === memoId) {
    return;
  }
  if (expandedMemoIds.has(memoId)) {
    expandedMemoIds.delete(memoId);
  } else {
    expandedMemoIds.add(memoId);
  }
  render();
}

function handleDomainClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return;
  }
  const button = target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const action = button.dataset.action;
  if (action === "open-url") {
    const url = button.dataset.url;
    if (url) {
      chrome.tabs.create({ url });
    }
    return;
  }
  if (action !== "filter") {
    return;
  }
  const domain = button.dataset.domain;
  if (!domain) {
    return;
  }
  const scopeType = button.dataset.scopeType;
  if (scopeType === "path") {
    selectedScope = {
      type: "path",
      domain,
      path: button.dataset.path || "/"
    };
  } else {
    selectedScope = { type: "domain", domain };
  }
  setView("memos");
  render();
}

function setView(view) {
  currentView = view;
  memoView.classList.toggle("hidden", view !== "memos");
  domainView.classList.toggle("hidden", view !== "domains");
  setTabState(tabMemos, view === "memos");
  setTabState(tabDomains, view === "domains");
}

function setTabState(tab, isActive) {
  tab.classList.toggle("border-2", isActive);
  tab.classList.toggle("border-neutral-900", isActive);
  tab.classList.toggle("font-semibold", isActive);
  tab.classList.toggle("text-neutral-900", isActive);
  tab.classList.toggle("border", !isActive);
  tab.classList.toggle("border-neutral-200", !isActive);
  tab.classList.toggle("text-neutral-600", !isActive);
}

function getFilteredMemos() {
  if (!selectedScope) {
    return memos;
  }
  return memos.filter((memo) => matchesScope(memo, selectedScope));
}

function buildDomainSummaries(items) {
  const map = new Map();
  items.forEach((memo) => {
    const { domain, path } = getDomainAndFirstPath(memo.url);
    const entry = map.get(domain) ?? {
      domain,
      count: 0,
      latestCreatedAt: 0,
      children: new Map()
    };
    entry.count += 1;
    entry.latestCreatedAt = Math.max(entry.latestCreatedAt, memo.createdAt);
    const child = entry.children.get(path) ?? {
      path,
      count: 0,
      latestCreatedAt: 0
    };
    child.count += 1;
    child.latestCreatedAt = Math.max(child.latestCreatedAt, memo.createdAt);
    entry.children.set(path, child);
    map.set(domain, entry);
  });
  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      children: Array.from(entry.children.values()).sort(
        (a, b) => b.latestCreatedAt - a.latestCreatedAt
      )
    }))
    .sort((a, b) => b.latestCreatedAt - a.latestCreatedAt);
}

function buildDomainRow(item) {
  const row = document.createElement("div");
  row.className =
    "flex w-full items-center justify-between rounded-md border border-neutral-200 bg-white px-2.5 text-xs text-neutral-800 hover:bg-neutral-50";
  if (item.indent) {
    row.className += " border-l-2 border-l-neutral-200 pl-4 py-1.5 ml-2";
  } else {
    row.className += " py-2 mt-4";
  }

  const nameButton = document.createElement("button");
  nameButton.type = "button";
  nameButton.className = "flex min-w-0 items-center gap-1 text-left";
  nameButton.dataset.action = "open-url";
  nameButton.dataset.url = buildScopeUrl(item);

  if (item.indent) {
    const marker = document.createElement("span");
    marker.className = "text-[10px] text-neutral-400";
    marker.textContent = item.isLast ? "└─" : "├─";
    nameButton.appendChild(marker);
  }

  const name = document.createElement("span");
  name.className = "max-w-[170px] truncate";
  name.textContent = item.label;
  nameButton.appendChild(name);

  const countButton = document.createElement("button");
  countButton.type = "button";
  countButton.className =
    "rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 hover:text-neutral-800";
  countButton.textContent = `${item.count}件`;
  countButton.dataset.action = "filter";
  countButton.dataset.domain = item.domain;
  countButton.dataset.scopeType = item.type;
  if (item.type === "path") {
    countButton.dataset.path = item.path ?? "/";
  }

  row.append(nameButton, countButton);
  return row;
}

function getDomainAndFirstPath(url) {
  if (!url) {
    return { domain: "不明", path: "/" };
  }
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const path = segments.length > 0 ? segments[0] : "/";
    return { domain: parsed.host, path };
  } catch {
    return { domain: "不明", path: "/" };
  }
}

function buildScopeUrl(item) {
  if (item.type === "path") {
    const path = item.path && item.path !== "/" ? `/${item.path}` : "/";
    return `https://${item.domain}${path}`;
  }
  return `https://${item.domain}/`;
}

function matchesScope(memo, scope) {
  const parsed = getDomainAndFirstPath(memo.url);
  if (scope.type === "domain") {
    return parsed.domain === scope.domain;
  }
  return parsed.domain === scope.domain && parsed.path === scope.path;
}

function buildFilterLabel(scope) {
  if (scope.type === "domain") {
    return `ドメイン: ${scope.domain}`;
  }
  const pathLabel = scope.path === "/" ? "/" : `/${scope.path}`;
  return `ドメイン/パス: ${scope.domain}${pathLabel}`;
}

function buildIconButton({ label, action, memoId, svgPath, className }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `inline-flex items-center justify-center ${className}`;
  button.setAttribute("aria-label", label);
  button.dataset.action = action;
  button.dataset.memoId = memoId;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("class", "h-3.5 w-3.5");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", svgPath);
  svg.appendChild(path);

  button.appendChild(svg);
  return button;
}

function buildInfoIcon({ label, value }) {
  const wrapper = document.createElement("span");
  wrapper.className = "inline-flex items-center text-neutral-500";
  wrapper.setAttribute("aria-label", `${label}: ${value}`);
  wrapper.setAttribute("title", value);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("class", "h-4 w-4");

  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "9");

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", "12");
  line.setAttribute("y1", "10");
  line.setAttribute("x2", "12");
  line.setAttribute("y2", "16");

  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("cx", "12");
  dot.setAttribute("cy", "7");
  dot.setAttribute("r", "0.8");

  svg.append(circle, line, dot);
  wrapper.appendChild(svg);
  return wrapper;
}

function formatNumberBadge(number) {
  if (typeof number !== "number") {
    return "#-----";
  }
  const padded = String(number).padStart(5, "0");
  return `#${padded}`;
}

function updateShortcutHint() {
  if (!shortcutHint) {
    return;
  }
  const isMac = navigator.platform.includes("Mac");
  const text = isMac ? "Control + Shift + C" : "Alt + C";
  shortcutHint.textContent = `ショートカット: ${text}`;
}
