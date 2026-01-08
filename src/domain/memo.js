const ID_PREFIX = "memo_";

export function createMemo({ text, url, createdAt = Date.now(), number }) {
  return {
    id: generateId(),
    number,
    text,
    url,
    createdAt
  };
}

export function updateMemoUrl(memo, nextUrl) {
  return {
    ...memo,
    url: nextUrl
  };
}

export function formatCreatedAt(timestamp) {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  return formatter.format(new Date(timestamp));
}

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${ID_PREFIX}${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
