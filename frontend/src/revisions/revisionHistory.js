export const REVISION_HISTORY_VERSION = 1;

const BOARD_COLLECTIONS = ["notes", "textItems", "strokes", "shapes"];

function cloneAndFreeze(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(cloneAndFreeze));
  }
  if (value && typeof value === "object") {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, cloneAndFreeze(entry)])
      )
    );
  }
  return value;
}

function createRevisionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createSnapshot(boardState) {
  return cloneAndFreeze(
    Object.fromEntries(
      BOARD_COLLECTIONS.map((collection) => [
        collection,
        Array.isArray(boardState?.[collection]) ? boardState[collection] : [],
      ])
    )
  );
}

function normalizeRevisionData(data) {
  if (
    !data ||
    typeof data !== "object" ||
    data.version !== REVISION_HISTORY_VERSION ||
    !Array.isArray(data.revisions)
  ) {
    return { version: REVISION_HISTORY_VERSION, headRevisionId: null, revisions: [] };
  }

  const candidates = new Map();
  for (const candidate of data.revisions) {
    const parentRevisionId = candidate?.parentRevisionId ?? null;
    if (
      !candidate ||
      typeof candidate.revisionId !== "string" ||
      !candidate.revisionId ||
      candidates.has(candidate.revisionId) ||
      (parentRevisionId !== null && typeof parentRevisionId !== "string") ||
      typeof candidate.timestamp !== "string" ||
      !Number.isFinite(Date.parse(candidate.timestamp)) ||
      typeof candidate.changeDescription !== "string" ||
      !candidate.snapshot ||
      typeof candidate.snapshot !== "object" ||
      !BOARD_COLLECTIONS.every((collection) =>
        Array.isArray(candidate.snapshot[collection])
      )
    ) {
      continue;
    }

    candidates.set(candidate.revisionId, {
      revisionId: candidate.revisionId,
      parentRevisionId,
      timestamp: new Date(candidate.timestamp).toISOString(),
      authorId: typeof candidate.authorId === "string" ? candidate.authorId : null,
      authorName: typeof candidate.authorName === "string" && candidate.authorName.trim()
        ? candidate.authorName.trim()
        : null,
      changeDescription: candidate.changeDescription.trim().slice(0, 120) || "Updated board",
      snapshot: createSnapshot(candidate.snapshot),
    });
  }

  const revisions = new Map();
  let pending = [...candidates.values()];
  while (pending.length) {
    const remaining = [];
    let added = false;
    for (const revision of pending) {
      if (
        revision.parentRevisionId === null ||
        revisions.has(revision.parentRevisionId)
      ) {
        revisions.set(revision.revisionId, Object.freeze(revision));
        added = true;
      } else {
        remaining.push(revision);
      }
    }
    if (!added) break;
    pending = remaining;
  }

  const validHead = revisions.has(data.headRevisionId) ? data.headRevisionId : null;
  const lastRevisionId = [...revisions.keys()].pop() || null;
  return {
    version: REVISION_HISTORY_VERSION,
    headRevisionId: validHead || lastRevisionId,
    revisions: [...revisions.values()],
  };
}

export function getPersonalRevisionStorageKey(userId) {
  const identity = userId ? encodeURIComponent(String(userId)) : "local";
  return `sanctum-revisions:v${REVISION_HISTORY_VERSION}:personal:${identity}`;
}

export function loadPersonalRevisionData(storageKey) {
  try {
    const stored = globalThis.localStorage?.getItem(storageKey);
    if (!stored) return null;
    return normalizeRevisionData(JSON.parse(stored));
  } catch (error) {
    console.error("Failed to load saved revision history:", error);
    return null;
  }
}

export function savePersonalRevisionData(storageKey, data) {
  try {
    if (!globalThis.localStorage) {
      throw new Error("Local storage is unavailable.");
    }
    globalThis.localStorage.setItem(storageKey, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Failed to persist revision history:", error);
    return false;
  }
}

export function createRevisionHistory(initialData = null) {
  const normalized = normalizeRevisionData(initialData);
  const revisions = new Map(
    normalized.revisions.map((revision) => [revision.revisionId, revision])
  );
  let headRevisionId = normalized.headRevisionId;
  const listeners = new Set();
  let revisionSnapshot = Object.freeze([...revisions.values()]);
  const notify = () => {
    revisionSnapshot = Object.freeze([...revisions.values()]);
    listeners.forEach((listener) => listener());
  };
  const prepareRevision = (boardState, {
    authorId = null,
    authorName = null,
    changeDescription = "Updated board",
    parentRevisionId = headRevisionId,
  } = {}) => {
    if (parentRevisionId !== null && !revisions.has(parentRevisionId)) {
      throw new Error("The parent revision does not exist in this timeline.");
    }

    return Object.freeze({
      revisionId: createRevisionId(),
      parentRevisionId,
      timestamp: new Date().toISOString(),
      authorId: authorId ? String(authorId) : null,
      authorName: typeof authorName === "string" && authorName.trim()
        ? authorName.trim()
        : null,
      changeDescription: String(changeDescription).trim().slice(0, 120) || "Updated board",
      snapshot: createSnapshot(boardState),
    });
  };
  const addRevision = (revision) => {
    if (
      !revision ||
      typeof revision.revisionId !== "string" ||
      !revision.revisionId ||
      revisions.has(revision.revisionId)
    ) {
      throw new Error("The revision is invalid or already exists in this timeline.");
    }
    if (
      revision.parentRevisionId !== null &&
      !revisions.has(revision.parentRevisionId)
    ) {
      throw new Error("The parent revision does not exist in this timeline.");
    }
    if (
      !revision.snapshot ||
      !BOARD_COLLECTIONS.every((collection) => Array.isArray(revision.snapshot[collection]))
    ) {
      throw new Error("The revision snapshot is invalid.");
    }

    const immutableRevision = Object.freeze({
      ...revision,
      snapshot: createSnapshot(revision.snapshot),
    });
    revisions.set(immutableRevision.revisionId, immutableRevision);
    headRevisionId = immutableRevision.revisionId;
    notify();
    return immutableRevision;
  };

  return {
    createRevision(boardState, {
      authorId = null,
      authorName = null,
      changeDescription = "Updated board",
      parentRevisionId = headRevisionId,
    } = {}) {
      return addRevision(prepareRevision(boardState, {
        authorId,
        authorName,
        changeDescription,
        parentRevisionId,
      }));
    },
    prepareRevision,
    addRevision,
    getRevisions() {
      return revisionSnapshot;
    },
    getHeadRevisionId() {
      return headRevisionId;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    toJSON() {
      return {
        version: REVISION_HISTORY_VERSION,
        headRevisionId,
        revisions: [...revisions.values()],
      };
    },
  };
}
