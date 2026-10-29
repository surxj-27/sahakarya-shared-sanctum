const BOARD_COLLECTIONS = ["notes", "textItems", "strokes", "shapes"];

function getObjectId(object) {
  const id = object?.id ?? object?._id;
  return id === null || id === undefined ? null : String(id);
}

function valuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (
    !left ||
    !right ||
    typeof left !== "object" ||
    typeof right !== "object" ||
    Array.isArray(left) !== Array.isArray(right)
  ) {
    return false;
  }

  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) =>
      key === rightKeys[index] && valuesEqual(left[key], right[key])
    );
}

function getFieldLabel(field) {
  return field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function getFieldChanges(collection, before, after) {
  const changes = [];
  const consumed = new Set(["id", "_id"]);
  const isTextual = collection === "notes" || collection === "textItems";

  if (isTextual) {
    for (const field of ["text", "color"]) {
      consumed.add(field);
      if (!valuesEqual(before[field], after[field])) {
        changes.push({
          label: getFieldLabel(field),
          before: before[field],
          after: after[field],
        });
      }
    }

    for (const field of ["x", "y", "width", "height"]) consumed.add(field);
    if (!valuesEqual(before.x, after.x) || !valuesEqual(before.y, after.y)) {
      changes.push({
        label: "Position",
        before: { x: before.x, y: before.y },
        after: { x: after.x, y: after.y },
      });
    }
    if (
      !valuesEqual(before.width, after.width) ||
      !valuesEqual(before.height, after.height)
    ) {
      changes.push({
        label: "Size",
        before: { width: before.width, height: before.height },
        after: { width: after.width, height: after.height },
      });
    }
  }

  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const field of fields) {
    if (consumed.has(field) || valuesEqual(before[field], after[field])) continue;
    changes.push({
      label: getFieldLabel(field),
      before: before[field],
      after: after[field],
      valuesOmitted: collection === "strokes" || collection === "shapes",
    });
  }

  return changes;
}

function diffCollection(collection, baseItems, comparisonItems) {
  const baseById = new Map();
  const comparisonById = new Map();
  const baseWithoutId = [];
  const addedWithoutId = [];

  baseItems.forEach((object) => {
    const id = getObjectId(object);
    if (id === null) {
      baseWithoutId.push(object);
      return;
    }
    baseById.set(id, { id, object });
  });
  comparisonItems.forEach((object) => {
    const id = getObjectId(object);
    if (id === null) {
      const matchingIndex = baseWithoutId.findIndex((candidate) =>
        valuesEqual(candidate, object)
      );
      if (matchingIndex < 0) addedWithoutId.push({ id: null, object });
      else baseWithoutId.splice(matchingIndex, 1);
      return;
    }
    comparisonById.set(id, { id, object });
  });

  const added = [...addedWithoutId];
  const deleted = baseWithoutId.map((object) => ({ id: null, object }));
  const modified = [];

  for (const [id, { object }] of comparisonById) {
    const baseEntry = baseById.get(id);
    if (!baseEntry) {
      added.push({ id, object });
      continue;
    }

    const fields = getFieldChanges(collection, baseEntry.object, object);
    if (fields.length) {
      modified.push({ id, before: baseEntry.object, after: object, fields });
    }
  }

  for (const [id, { object }] of baseById) {
    if (!comparisonById.has(id)) deleted.push({ id, object });
  }

  return { added, deleted, modified };
}

export function compareBoardSnapshots(baseSnapshot, comparisonSnapshot) {
  return Object.fromEntries(
    BOARD_COLLECTIONS.map((collection) => [
      collection,
      diffCollection(
        collection,
        Array.isArray(baseSnapshot?.[collection]) ? baseSnapshot[collection] : [],
        Array.isArray(comparisonSnapshot?.[collection])
          ? comparisonSnapshot[collection]
          : []
      ),
    ])
  );
}
