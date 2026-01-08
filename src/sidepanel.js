import { formatCreatedAt } from "./domain/memo.js";
import {
  deleteMemoById,
  getAllMemos,
  updateMemoUrlById
} from "./infrastructure/memoRepository.js";

const memoList = document.getElementById("memo-list");
const emptyState = document.getElementById("empty-state");

let memos = [];
let editingId = null;
const expandedMemoIds = new Set();

init();

async function init() {
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
}

async function loadMemos() {
  memos = await getAllMemos();
  memos.sort((a, b) => b.createdAt - a.createdAt);
  render();
}

function render() {
  memoList.innerHTML = "";

  if (memos.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  memos.forEach((memo) => {
    memoList.appendChild(buildMemoCard(memo));
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
    if (target.closest("input")) {
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
