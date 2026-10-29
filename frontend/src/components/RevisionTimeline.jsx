import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { compareBoardSnapshots } from "../revisions/revisionDiff";

const EMPTY_REVISIONS = Object.freeze([]);
const NOOP_SUBSCRIBE = () => () => {};
const GET_EMPTY_REVISIONS = () => EMPTY_REVISIONS;
const COLLECTION_LABELS = {
  notes: "Sticky notes",
  textItems: "Text",
  strokes: "Pen strokes",
  shapes: "Shapes",
};

function getRevisionDepth(revision, revisionsById) {
  let depth = 0;
  let parentRevisionId = revision.parentRevisionId;
  const visited = new Set([revision.revisionId]);

  while (parentRevisionId && revisionsById.has(parentRevisionId)) {
    if (visited.has(parentRevisionId)) break;
    visited.add(parentRevisionId);
    depth += 1;
    parentRevisionId = revisionsById.get(parentRevisionId).parentRevisionId;
  }

  return depth;
}

function formatRevisionTime(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDiffValue(value) {
  if (value === undefined) return "Not set";
  if (value === null) return "None";
  if (typeof value === "string") return value || "Empty";
  if (typeof value === "object") {
    const serialized = JSON.stringify(value);
    return serialized.length > 100 ? `${serialized.slice(0, 97)}…` : serialized;
  }
  return String(value);
}

function getObjectDescription(collection, object, id) {
  if ((collection === "notes" || collection === "textItems") && object?.text) {
    const text = String(object.text).replace(/\s+/g, " ").trim();
    return text.length > 60 ? `${text.slice(0, 57)}…` : text;
  }
  return id ? `Object ${id}` : "Object without an ID";
}

function RevisionTimeline({
  history,
  loading = false,
  loadError = false,
  currentUser,
  onClose,
  onRestore,
}) {
  const revisions = useSyncExternalStore(
    history?.subscribe ?? NOOP_SUBSCRIBE,
    history?.getRevisions ?? GET_EMPTY_REVISIONS,
    GET_EMPTY_REVISIONS
  );
  const [selectedRevisionId, setSelectedRevisionId] = useState(null);
  const [baseRevisionId, setBaseRevisionId] = useState("");
  const [comparisonRevisionId, setComparisonRevisionId] = useState("");
  const [view, setView] = useState("timeline");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restoreStatus, setRestoreStatus] = useState("");
  const restoreLockRef = useRef(false);
  const revisionTree = useMemo(() => {
    const revisionsById = new Map(revisions.map((revision) => [revision.revisionId, revision]));
    const siblingCounts = new Map();
    revisions.forEach((revision) => {
      const parentId = revision.parentRevisionId ?? "root";
      siblingCounts.set(parentId, (siblingCounts.get(parentId) ?? 0) + 1);
    });

    return [...revisions]
      .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
      .map((revision) => ({
        ...revision,
        depth: getRevisionDepth(revision, revisionsById),
        isBranch: siblingCounts.get(revision.parentRevisionId ?? "root") > 1,
      }));
  }, [revisions]);
  const revisionsById = useMemo(
    () => new Map(revisions.map((revision) => [revision.revisionId, revision])),
    [revisions]
  );
  const baseRevision = revisionsById.get(baseRevisionId) ?? null;
  const comparisonRevision = revisionsById.get(comparisonRevisionId) ?? null;
  const diff = useMemo(
    () => baseRevision && comparisonRevision
      ? compareBoardSnapshots(baseRevision.snapshot, comparisonRevision.snapshot)
      : null,
    [baseRevision, comparisonRevision]
  );
  const hasDifferences = diff && Object.values(diff).some((collection) =>
    collection.added.length || collection.deleted.length || collection.modified.length
  );
  const selectedRevision = revisionsById.get(selectedRevisionId) ?? null;
  const currentUserId = currentUser?.id ?? currentUser?._id;
  async function restoreSelectedRevision() {
    if (!selectedRevision || !onRestore || restoring || restoreLockRef.current) return;
    console.info("Restore action selected", {
      revisionId: selectedRevision.revisionId,
      callbackConnected: Boolean(onRestore),
      snapshotCollections: Object.fromEntries(
        ["notes", "textItems", "strokes", "shapes"].map((collection) => [
          collection,
          Array.isArray(selectedRevision.snapshot?.[collection])
            ? selectedRevision.snapshot[collection].length
            : null,
        ])
      ),
    });
    const authorName =
      selectedRevision.authorName ||
      (String(selectedRevision.authorId) === String(currentUserId) ? currentUser?.name : null) ||
      "Unknown user";
    const confirmed = globalThis.confirm(
      `Restore "${selectedRevision.changeDescription}" by ${authorName} from ${formatRevisionTime(selectedRevision.timestamp)}? This replaces the current board contents and creates a new revision.`
    );
    if (!confirmed) return;

    console.info("Revision restore confirmed", {
      revisionId: selectedRevision.revisionId,
    });
    restoreLockRef.current = true;
    setRestoreError("");
    setRestoreStatus("");
    setRestoring(true);
    try {
      const restoredRevision = await onRestore(selectedRevision);
      setSelectedRevisionId(restoredRevision.revisionId);
      setRestoreStatus("Board restored and saved as a new revision.");
    } catch (error) {
      console.error("Revision restore failed:", error);
      setRestoreError(error instanceof Error ? error.message : "The revision could not be restored.");
    } finally {
      restoreLockRef.current = false;
      setRestoring(false);
    }
  }

  return (
    <aside
      className="revision-timeline"
      aria-label="Revision timeline"
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <header className="revision-timeline-header">
        <div>
          <span className="revision-timeline-eyebrow">Board history</span>
          <h2>{view === "diff" ? "Revision diff" : "Timeline"}</h2>
        </div>
        <div className="revision-timeline-header-actions">
          {!loading && !loadError && revisions.length > 0 && onRestore && (
            <button
              type="button"
              className="revision-timeline-view-toggle"
              onClick={restoreSelectedRevision}
              disabled={!selectedRevision || restoring}
            >
              {restoring ? "Restoring…" : "Restore selected"}
            </button>
          )}
          {!loading && !loadError && revisions.length > 0 && (
            <button
              type="button"
              className="revision-timeline-view-toggle"
              onClick={() => setView((previous) => previous === "diff" ? "timeline" : "diff")}
            >
              {view === "diff" ? "Timeline" : "Diff view"}
            </button>
          )}
          <button
            type="button"
            className="revision-timeline-close"
            onClick={onClose}
            aria-label="Close revision timeline"
            title="Close timeline"
          >
            ×
          </button>
        </div>
      </header>

      {loading ? (
        <p className="revision-timeline-empty" role="status">Loading revision history…</p>
      ) : loadError ? (
        <p className="revision-timeline-empty" role="alert">
          Revision history could not be loaded. Close the panel and try again.
        </p>
      ) : revisionTree.length === 0 ? (
        <p className="revision-timeline-empty">No revisions yet. Committed board changes will appear here.</p>
      ) : view === "diff" ? (
        <div className="revision-diff">
          <p className="revision-diff-intro">
            Compare any two saved snapshots. Branches do not need to share a parent.
          </p>
          <div className="revision-diff-selectors">
            <label>
              <span>Base revision</span>
              <select value={baseRevisionId} onChange={(event) => setBaseRevisionId(event.target.value)}>
                <option value="">Choose base…</option>
                {revisionTree.map((revision) => (
                  <option key={revision.revisionId} value={revision.revisionId}>
                    {formatRevisionTime(revision.timestamp)} — {revision.changeDescription}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Compare revision</span>
              <select value={comparisonRevisionId} onChange={(event) => setComparisonRevisionId(event.target.value)}>
                <option value="">Choose comparison…</option>
                {revisionTree.map((revision) => (
                  <option key={revision.revisionId} value={revision.revisionId}>
                    {formatRevisionTime(revision.timestamp)} — {revision.changeDescription}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!baseRevision || !comparisonRevision ? (
            <p className="revision-timeline-empty">Select a base and a comparison revision to see their differences.</p>
          ) : !hasDifferences ? (
            <p className="revision-timeline-empty">No differences between these revisions.</p>
          ) : (
            <div className="revision-diff-results" aria-live="polite">
              <p className="revision-diff-pair">
                Comparing “{baseRevision.changeDescription}” with “{comparisonRevision.changeDescription}”
              </p>
              {Object.entries(diff).map(([collection, changes]) => {
                const changeCount = changes.added.length + changes.deleted.length + changes.modified.length;
                if (!changeCount) return null;
                return (
                  <section className="revision-diff-collection" key={collection}>
                    <h3>{COLLECTION_LABELS[collection]}</h3>
                    {[
                      ["Added", changes.added],
                      ["Deleted", changes.deleted],
                      ["Modified", changes.modified],
                    ].map(([kind, entries]) => entries.length > 0 && (
                      <div className="revision-diff-category" key={kind}>
                        <h4>{kind} <span>{entries.length}</span></h4>
                        <ul>
                          {entries.map((entry, index) => (
                            <li key={`${entry.id ?? "unidentified"}-${index}`}>
                              <strong>{getObjectDescription(collection, entry.object ?? entry.after, entry.id)}</strong>
                              {kind === "Modified" && (
                                <ul className="revision-diff-fields">
                                  {entry.fields.map((field) => (
                                    <li key={field.label}>
                                      <span>{field.label}</span>
                                      {field.valuesOmitted ? (
                                        <span>Changed</span>
                                      ) : (
                                        <span>{formatDiffValue(field.before)} → {formatDiffValue(field.after)}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <ol className="revision-timeline-list">
          {revisionTree.map((revision) => (
            <li
              key={revision.revisionId}
              className="revision-timeline-entry"
              style={{ "--revision-depth": Math.min(revision.depth, 5) }}
            >
              <button
                type="button"
                className={`revision-timeline-item${selectedRevisionId === revision.revisionId ? " is-selected" : ""}`}
                onClick={() => setSelectedRevisionId(revision.revisionId)}
                aria-pressed={selectedRevisionId === revision.revisionId}
                title={revision.parentRevisionId
                  ? `Parent revision: ${revision.parentRevisionId}`
                  : "Root revision"}
              >
                <span className="revision-timeline-item-topline">
                  <time dateTime={revision.timestamp}>{formatRevisionTime(revision.timestamp)}</time>
                  {revision.isBranch && <span className="revision-timeline-branch">Branch</span>}
                </span>
                <span className="revision-timeline-description">{revision.changeDescription}</span>
                <span className="revision-timeline-author">
                  By {revision.authorName ||
                    (revision.authorId && String(revision.authorId) === String(currentUserId)
                      ? currentUser?.name
                      : null) ||
                    "Unknown user"}
                </span>
              </button>
              <div className="revision-timeline-compare-actions">
                <span>
                  {baseRevisionId === revision.revisionId
                    ? "Base"
                    : comparisonRevisionId === revision.revisionId ? "Comparison" : ""}
                </span>
                <button
                  type="button"
                  aria-pressed={baseRevisionId === revision.revisionId}
                  onClick={() => {
                    setBaseRevisionId(revision.revisionId);
                    setSelectedRevisionId(revision.revisionId);
                  }}
                >
                  Set base
                </button>
                <button
                  type="button"
                  aria-pressed={comparisonRevisionId === revision.revisionId}
                  onClick={() => {
                    setComparisonRevisionId(revision.revisionId);
                    setSelectedRevisionId(revision.revisionId);
                  }}
                >
                  Compare
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {restoreError && <p className="revision-restore-message is-error" role="alert">{restoreError}</p>}
      {restoreStatus && <p className="revision-restore-message" role="status">{restoreStatus}</p>}
      <p className="revision-timeline-readonly">
        Revision Diff is read-only; comparing snapshots never changes the live board or saved history.
      </p>
    </aside>
  );
}

export default RevisionTimeline;
