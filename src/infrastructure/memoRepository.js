const STORAGE_KEY = "memos";

export async function getAllMemos() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const memos = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  const normalized = normalizeNumbers(memos);
  if (normalized.didUpdate) {
    await saveMemos(normalized.memos);
  }
  return normalized.memos;
}

export async function saveMemos(memos) {
  await chrome.storage.local.set({ [STORAGE_KEY]: memos });
}

export async function addMemo(memo) {
  const memos = await getAllMemos();
  const nextNumber = getNextNumber(memos);
  const memoWithNumber = { ...memo, number: nextNumber };
  const nextMemos = [memoWithNumber, ...memos];
  await saveMemos(nextMemos);
}

export async function deleteMemoById(id) {
  const memos = await getAllMemos();
  const nextMemos = memos.filter((memo) => memo.id !== id);
  await saveMemos(nextMemos);
}

function getNextNumber(memos) {
  const maxNumber = memos.reduce((max, memo) => {
    const value = typeof memo.number === "number" ? memo.number : 0;
    return Math.max(max, value);
  }, 0);
  return maxNumber + 1;
}

function normalizeNumbers(memos) {
  const needsUpdate = memos.some((memo) => typeof memo.number !== "number");
  if (!needsUpdate) {
    return { memos, didUpdate: false };
  }
  const sorted = [...memos].sort((a, b) => a.createdAt - b.createdAt);
  const withNumbers = sorted.map((memo, index) => ({
    ...memo,
    number: index + 1
  }));
  const byId = new Map(withNumbers.map((memo) => [memo.id, memo]));
  const restored = memos.map((memo) => byId.get(memo.id) ?? memo);
  return { memos: restored, didUpdate: true };
}
