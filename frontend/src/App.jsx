import { useState , useEffect, useLayoutEffect, useRef, useCallback} from 'react'
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import socket from "./socket";
import { API_URL } from "./config";
import { toPng } from "html-to-image";
import './App.css'
import Header from "./components/Header"
import Toolbar from "./components/Toolbar"
import DrawingLayer from "./components/DrawingLayer"
import StickyNote from "./components/StickyNote"
import TextItem from "./components/TextItem"
import SelectionOverlay from "./components/SelectionOverlay"
import BoardMinimap from "./components/BoardMinimap"
import RevisionTimeline from "./components/RevisionTimeline"
import { getContentBounds } from "./components/boardGeometry"
import useHistory  from './hooks/useHistory'
import {
  REVISION_HISTORY_VERSION,
  createRevisionHistory,
  getPersonalRevisionStorageKey,
  loadPersonalRevisionData,
  savePersonalRevisionData,
} from "./revisions/revisionHistory"
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Landing from "./components/Landing";
import Dashboard from "./components/Dashboard";
const BOARD_COLLECTIONS = ["notes", "strokes", "shapes", "textItems"];
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const GRID_SIZE = 20;

function getCachedUser() {
  const cachedUser = sessionStorage.getItem("user");
  if (!cachedUser) return null;

  try {
    const user = JSON.parse(cachedUser);
    return user && typeof user === "object" && !Array.isArray(user) ? user : null;
  } catch (error) {
    console.error("Cached user data could not be read:", error);
    sessionStorage.removeItem("user");
    return null;
  }
}

function snapToGrid(value) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function getCursorColor(identity) {
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash = Math.imul(hash ^ identity.charCodeAt(index), 16777619);
  }
  const colorHash = hash >>> 0;
  const hue = (colorHash % 360);
  const saturation = 66 + ((colorHash >>> 9) % 19);
  const lightness = 30 + ((colorHash >>> 17) % 12);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function normalizeBoardState(candidate) {
  const emptyBoard = {
    notes: [],
    strokes: [],
    shapes: [],
    textItems: [],
  };
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return emptyBoard;
  }

  return Object.fromEntries(
    Object.keys(emptyBoard).map((collection) => [
      collection,
      Array.isArray(candidate[collection]) ? candidate[collection] : [],
    ])
  );
}

function getPersonalBoardStorageKey(userId) {
  const identity = userId ? encodeURIComponent(String(userId)) : "local";
  return `sanctum-board:personal:${identity}`;
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);

  const projection = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
  );
  return Math.hypot(
    point.x - (start.x + projection * dx),
    point.y - (start.y + projection * dy)
  );
}

function createBoardId() {
  return `${socket.id || "local"}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function describeBoardChange(previousState, nextState) {
  const changedCollections = BOARD_COLLECTIONS.filter(
    (collection) =>
      JSON.stringify(previousState[collection]) !== JSON.stringify(nextState[collection])
  );
  return changedCollections.length
    ? `Updated ${changedCollections.join(", ")}`
    : null;
}

function emitCollectionChanges(collection, previous, next, emitBoardEvent, includeStrokeChanges = false) {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const nextById = new Map(next.map((item) => [item.id, item]));

  for (const item of next) {
    const previousItem = previousById.get(item.id);
    if (!previousItem) {
      if (collection !== "strokes" || includeStrokeChanges) {
        emitBoardEvent("board:object:create", { collection, object: item });
      }
    } else if (
      (collection !== "strokes" || includeStrokeChanges) &&
      JSON.stringify(previousItem) !== JSON.stringify(item)
    ) {
      emitBoardEvent("board:object:update", { collection, object: item });
    } else if (
      collection === "strokes" &&
      previousItem.points.length === item.points.length &&
      JSON.stringify(previousItem) !== JSON.stringify(item)
    ) {
      emitBoardEvent("board:object:update", { collection, object: item });
    }
  }

  for (const item of previous) {
    if (!nextById.has(item.id)) {
      emitBoardEvent("board:object:delete", { collection, id: item.id });
    }
  }
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const boardRoomId = location.pathname.match(/^\/board\/([^/]+)\/?$/)?.[1] || null;
  const [authStatus, setAuthStatus] = useState(() =>
    sessionStorage.getItem("token") ? "checking" : "unauthenticated"
  );
  const [currentUser, setCurrentUser] = useState(() =>
    getCachedUser()
  );
  const revisionAuthorId = currentUser?.id ?? currentUser?._id ?? null;
  const isPersonalBoard = !boardRoomId;
  const revisionHistoryKey = boardRoomId || `personal:${revisionAuthorId || "local"}`;
  const revisionHistoriesRef = useRef(new Map());
  const roomRevisionSaveQueuesRef = useRef(new Map());
  const roomRevisionLoadPromisesRef = useRef(new Map());
  const restoreInProgressRef = useRef(false);
  const pendingRoomRestoreRef = useRef(null);
  const revisionTransactionStartRef = useRef(null);
  const pendingTextRevisionIdsRef = useRef(new Set());
  const [timelineState, setTimelineState] = useState({ boardKey: null, open: false });
  const [timelineHistory, setTimelineHistory] = useState(null);
  const [timelineLoadState, setTimelineLoadState] = useState({ boardKey: null, status: "idle" });
  const timelineOpen =
    timelineState.boardKey === revisionHistoryKey && timelineState.open;
  const boardSessionRef = useRef({ roomId: null, ready: false, requestId: null });
  const [readyBoardLocationKey, setReadyBoardLocationKey] = useState(null);
  const boardReady = !boardRoomId || readyBoardLocationKey === location.key;
  useLayoutEffect(() => {
    revisionTransactionStartRef.current = null;
    pendingRoomRestoreRef.current = null;
    boardSessionRef.current = {
      roomId: boardRoomId,
      ready: !boardRoomId,
      requestId: null,
    };
  }, [boardRoomId, location.key]);
  const emitBoardEvent = useCallback((eventName, ...args) => {
    if (boardSessionRef.current.ready) {
      socket.emit(eventName, ...args);
    }
  }, []);
const [rooms, setRooms] = useState([]);
function handleLogout() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  setCurrentUser(null);
  setRooms([]);
  setAuthStatus("unauthenticated");
  navigate("/", { replace: true });
}
useEffect(() => {
  const token = sessionStorage.getItem("token");
  const cachedUser = sessionStorage.getItem("user");

  if (!token) {
    setAuthStatus("unauthenticated");
    return;
  }

  async function verifyToken() {
    try {
      const response = await fetch(
        `${API_URL}/auth/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 404) {
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("user");
          setCurrentUser(null);
          setAuthStatus("unauthenticated");
        } else {
          setAuthStatus(cachedUser ? "authenticated" : "unauthenticated");
        }
        return;
      }

      const data = await response.json();
      sessionStorage.setItem("user", JSON.stringify(data.user));
      setCurrentUser(data.user);
      setAuthStatus("authenticated");
    } catch (error) {
      console.error("Profile verification failed:", error);
      setAuthStatus(cachedUser ? "authenticated" : "unauthenticated");
    }
  }

  verifyToken();
}, []);
useEffect(() => {
  if (authStatus !== "authenticated") return;

  const token = sessionStorage.getItem("token");
  if (!token) return;

  async function fetchRooms() {
    try {
      const response = await fetch(
        `${API_URL}/rooms/my-rooms`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch rooms");
      }

      const formattedRooms = data.rooms.map((room) => {
        const ownerId = room.owner && typeof room.owner === "object"
          ? room.owner._id ?? room.owner.id ?? room.owner
          : room.owner;

        return {
          id: String(room._id),
          name: room.name,
          inviteCode: room.inviteCode,
          role:
            String(ownerId) === String(currentUser?.id)
              ? "owner"
              : "member",
          memberCount: room.members?.length || 1,
        };
      });

      setRooms(formattedRooms);
    } catch (error) {
      console.error("Fetching rooms failed:", error);
    }
  }

  fetchRooms();
}, [authStatus, currentUser]);

async function createRoom(name) {
  const token = sessionStorage.getItem("token");
  if (!token) {
    throw new Error("You must be logged in to create a room.");
  }

  const response = await fetch(`${API_URL}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create room.");
  }

  if (!data.room?._id) {
    throw new Error("The server returned an invalid room.");
  }

  const createdRoom = {
    id: String(data.room._id),
    name: data.room.name,
    inviteCode: data.room.inviteCode,
    role: "owner",
    memberCount: data.room.members?.length || 1,
  };

  setRooms((previousRooms) => [
    createdRoom,
    ...previousRooms.filter((room) => room.id !== createdRoom.id),
  ]);

  return createdRoom;
}

async function joinRoom(invitation) {
  const value = invitation.trim();
  let inviteCode = value;

  try {
    const invitationUrl = new URL(value);
    inviteCode = invitationUrl.searchParams.get("inviteCode") || "";
  } catch {
    // A plain invitation code is accepted in addition to a copied link.
  }

  if (!inviteCode) {
    throw new Error("Enter a valid room invitation code or link.");
  }

  const token = sessionStorage.getItem("token");
  if (!token) {
    throw new Error("You must be logged in to join a room.");
  }

  const response = await fetch(`${API_URL}/rooms/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ inviteCode }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to join room.");
  }

  if (!data.room?._id) {
    throw new Error("The server returned an invalid room.");
  }

  const ownerId = data.room.owner && typeof data.room.owner === "object"
    ? data.room.owner._id ?? data.room.owner.id ?? data.room.owner
    : data.room.owner;
  const joinedRoom = {
    id: String(data.room._id),
    name: data.room.name,
    role: String(ownerId) === String(currentUser?.id) ? "owner" : "member",
    memberCount: data.room.members?.length || 1,
  };

  setRooms((previousRooms) => [
    joinedRoom,
    ...previousRooms.filter((room) => room.id !== joinedRoom.id),
  ]);
}

async function copyRoomInvite(room) {
  if (!room.inviteCode) {
    throw new Error("The invitation is unavailable. Refresh your room list and try again.");
  }

  const inviteUrl = new URL("/dashboard-preview", window.location.origin);
  inviteUrl.searchParams.set("inviteCode", room.inviteCode);
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is unavailable in this browser.");
  }

  await navigator.clipboard.writeText(inviteUrl.toString());
}

  function getInitialBoardState(userId) {
  try {
    const saved = localStorage.getItem(getPersonalBoardStorageKey(userId));

    if (saved) {
      return normalizeBoardState(JSON.parse(saved));
    }
  } catch (error) {
    console.error("Failed to load saved board:", error);
  }

  return normalizeBoardState(null);
}
 
  const [draggingNote,setDraggingNote]=useState(null)
 const boardHistory = useHistory(getInitialBoardState(revisionAuthorId));
  const getBoardHistoryState = boardHistory.getState;
  const beginBoardHistoryTransaction = boardHistory.beginTransaction;
  const commitBoardHistoryTransaction = boardHistory.commitTransaction;
  const boardStateRef = useRef(boardHistory.state);
   const personalBoardUserIdRef = useRef(revisionAuthorId);
   const updateHistory = boardHistory.update;
  const resetBoardHistory = boardHistory.reset;
  const { notes, strokes, shapes, textItems } = boardHistory.state
  useLayoutEffect(() => {
    if (boardRoomId || personalBoardUserIdRef.current === revisionAuthorId) return;

    personalBoardUserIdRef.current = revisionAuthorId;
    const nextBoardState = getInitialBoardState(revisionAuthorId);
    boardStateRef.current = nextBoardState;
    revisionTransactionStartRef.current = null;
    resetBoardHistory(nextBoardState);
  }, [boardRoomId, resetBoardHistory, revisionAuthorId]);
 const loadRoomRevisionHistory = useCallback(async (roomId) => {
   const existing = revisionHistoriesRef.current.get(roomId);
   if (existing) return existing;

   const pending = roomRevisionLoadPromisesRef.current.get(roomId);
   if (pending) return pending;

   const loadPromise = (async () => {
     const token = sessionStorage.getItem("token");
     if (!token) throw new Error("Authentication is required to load room revisions.");

     const response = await fetch(
       `${API_URL}/rooms/${encodeURIComponent(roomId)}/revisions`,
       { headers: { Authorization: `Bearer ${token}` } }
     );
     const revisionData = await response.json();
     if (!response.ok) {
       throw new Error(
         revisionData.message || `Failed to fetch room revisions (HTTP ${response.status}).`
       );
     }
     if (
       !revisionData ||
       !Array.isArray(revisionData.revisions) ||
       revisionData.version !== REVISION_HISTORY_VERSION
     ) {
       throw new Error("The room revisions response has an unsupported format.");
     }

     const history = createRevisionHistory(revisionData);
     revisionHistoriesRef.current.set(roomId, history);
     if (boardSessionRef.current.roomId === roomId) setTimelineHistory(history);
     console.info("Room revision history loaded", {
       revisionCount: history.getRevisions().length,
     });
     return history;
   })();

   roomRevisionLoadPromisesRef.current.set(roomId, loadPromise);
   try {
     return await loadPromise;
   } finally {
     if (roomRevisionLoadPromisesRef.current.get(roomId) === loadPromise) {
       roomRevisionLoadPromisesRef.current.delete(roomId);
     }
   }
 }, []);
 const toggleRevisionTimeline = useCallback(() => {
    if (timelineOpen) {
      setTimelineState({ boardKey: revisionHistoryKey, open: false });
      return;
    }

    let history = revisionHistoriesRef.current.get(revisionHistoryKey);
    if (!history && isPersonalBoard) {
      history = createRevisionHistory(
        loadPersonalRevisionData(getPersonalRevisionStorageKey(revisionAuthorId))
      );
      revisionHistoriesRef.current.set(revisionHistoryKey, history);
    }
    if (!history && !isPersonalBoard) {
      setTimelineHistory(null);
      setTimelineLoadState({ boardKey: revisionHistoryKey, status: "loading" });
      setTimelineState({ boardKey: revisionHistoryKey, open: true });
      loadRoomRevisionHistory(revisionHistoryKey)
        .then((loadedHistory) => {
          setTimelineHistory(loadedHistory);
          setTimelineLoadState({ boardKey: revisionHistoryKey, status: "idle" });
        })
        .catch((error) => {
          console.error("Room revision loading failed:", error);
          setTimelineLoadState({ boardKey: revisionHistoryKey, status: "error" });
        });
      return;
    }
    if (!history) return;
    setTimelineHistory(history);
    setTimelineLoadState({ boardKey: revisionHistoryKey, status: "idle" });
    setTimelineState({ boardKey: revisionHistoryKey, open: true });
  }, [isPersonalBoard, loadRoomRevisionHistory, revisionAuthorId, revisionHistoryKey, timelineOpen]);
  const recordBoardRevision = useCallback((changeDescription, snapshot = boardStateRef.current) => {
    let revisionHistory = revisionHistoriesRef.current.get(revisionHistoryKey);
    if (!revisionHistory && !isPersonalBoard) {
      console.error("Room revision was not recorded because its history has not loaded.");
      return;
    }
    if (!revisionHistory) {
      const personalStorageKey = getPersonalRevisionStorageKey(revisionAuthorId);
      revisionHistory = createRevisionHistory(
        isPersonalBoard
          ? loadPersonalRevisionData(personalStorageKey)
          : null
      );
      revisionHistoriesRef.current.set(revisionHistoryKey, revisionHistory);
    }
    const revision = revisionHistory.createRevision(snapshot, {
      authorId: revisionAuthorId,
      authorName: currentUser?.name ?? null,
      changeDescription,
    });
    console.info("Board revision created", {
      scope: isPersonalBoard ? "personal" : "room",
      revisionCount: revisionHistory.getRevisions().length,
    });
    if (isPersonalBoard) {
      savePersonalRevisionData(
        getPersonalRevisionStorageKey(revisionAuthorId),
        revisionHistory.toJSON()
      );
      console.info("Personal revision history saved", {
        revisionCount: revisionHistory.getRevisions().length,
      });
      return;
    }

    const previousSave = roomRevisionSaveQueuesRef.current.get(revisionHistoryKey) || Promise.resolve();
    const nextSave = previousSave.catch(() => {}).then(async () => {
      const token = sessionStorage.getItem("token");
      if (!token) throw new Error("Authentication is required to save room revisions.");

      const response = await fetch(
        `${API_URL}/rooms/${encodeURIComponent(revisionHistoryKey)}/revisions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(revision),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.message || `Failed to save room revision (HTTP ${response.status}).`
        );
      }
      console.info("Room revision saved");
    });
    roomRevisionSaveQueuesRef.current.set(revisionHistoryKey, nextSave);
    nextSave.catch((error) => {
      console.error("Room revision persistence failed:", error);
    });
  }, [currentUser?.name, isPersonalBoard, revisionAuthorId, revisionHistoryKey]);
  const beginBoardTransaction = useCallback(() => {
    if (revisionTransactionStartRef.current === null) {
      revisionTransactionStartRef.current = getBoardHistoryState();
    }
    beginBoardHistoryTransaction();
  }, [beginBoardHistoryTransaction, getBoardHistoryState]);
  const commitBoardTransaction = useCallback(() => {
    const startingState = revisionTransactionStartRef.current;
    commitBoardHistoryTransaction();
    revisionTransactionStartRef.current = null;
    const nextState = getBoardHistoryState();
    const description = startingState
      ? describeBoardChange(startingState, nextState)
      : null;
    if (description) {
      recordBoardRevision(description, nextState);
    }
  }, [commitBoardHistoryTransaction, getBoardHistoryState, recordBoardRevision]);
  const updateCollection = useCallback((key, nextValue, record = true, revisionOptions = {}) => {
    if (boardSessionRef.current.roomId && !boardSessionRef.current.ready) return;
    const update = record ? boardHistory.set : boardHistory.update
    const previousState = boardStateRef.current
    const previousCollection = previousState[key]
    const nextCollection = typeof nextValue === "function"
      ? nextValue(previousCollection)
      : nextValue
    const nextState = { ...previousState, [key]: nextCollection }

    boardStateRef.current = nextState
    update(nextState)
    emitCollectionChanges(key, previousCollection, nextCollection, emitBoardEvent)
    if (
      record &&
      revisionOptions.recordRevision !== false &&
      JSON.stringify(previousCollection) !== JSON.stringify(nextCollection)
    ) {
      recordBoardRevision(revisionOptions.description || `Updated ${key}`, nextState);
    }
  }, [boardHistory.set, boardHistory.update, emitBoardEvent, recordBoardRevision])
  const setNotes = useCallback((nextNotes) => updateCollection("notes", nextNotes), [updateCollection])
  const setShapes = useCallback((nextShapes) => updateCollection("shapes", nextShapes), [updateCollection])
  const setStrokes = useCallback((nextStrokes) => updateCollection("strokes", nextStrokes), [updateCollection])
  const setTextItems = useCallback((nextTextItems) => updateCollection("textItems", nextTextItems), [updateCollection])
  const updateNotes = useCallback((nextNotes) => updateCollection("notes", nextNotes, false), [updateCollection])
  const updateStrokes = useCallback((nextStrokes) => updateCollection("strokes", nextStrokes, false), [updateCollection])
  const updateShapes = useCallback((nextShapes) => updateCollection("shapes", nextShapes, false), [updateCollection])
  const updateTextItems = useCallback((nextTextItems) => updateCollection("textItems", nextTextItems, false), [updateCollection])
  const [remoteCursors, setRemoteCursors] = useState({});
  useEffect(() => {
    if (authStatus !== "authenticated") return;

    function applyRemoteChange(collection, updateItems) {
      const previousState = boardStateRef.current;
      const previousItems = previousState[collection];
      const nextItems = updateItems(previousItems);
      if (nextItems === previousItems) return;

      const nextState = { ...previousState, [collection]: nextItems };
      boardStateRef.current = nextState;
      updateHistory(nextState);
    }

    function handleRemoteCreate({ collection, object }) {
      if (!BOARD_COLLECTIONS.includes(collection) || !object) return;
      applyRemoteChange(collection, (items) =>
        items.some((item) => item.id === object.id) ? items : [...items, object]
      );
    }

    function handleRemoteUpdate({ collection, object }) {
      if (!BOARD_COLLECTIONS.includes(collection) || !object) return;
      applyRemoteChange(collection, (items) => {
        if (!items.some((item) => item.id === object.id)) return items;
        return items.map((item) => item.id === object.id ? object : item);
      });
    }

    function handleRemoteDelete({ collection, id }) {
      if (!BOARD_COLLECTIONS.includes(collection)) return;
      applyRemoteChange(collection, (items) => {
        const nextItems = items.filter((item) => item.id !== id);
        return nextItems.length === items.length ? items : nextItems;
      });
    }

    function handleRemoteStrokeStart({ stroke }) {
      if (!stroke) return;
      applyRemoteChange("strokes", (items) =>
        items.some((item) => item.id === stroke.id) ? items : [...items, stroke]
      );
    }

    function handleRemoteStrokePoint({ strokeId, point }) {
      if (!point) return;
      applyRemoteChange("strokes", (items) => {
        const stroke = items.find((item) => item.id === strokeId);
        if (!stroke) return items;
        return items.map((item) => item.id === strokeId
          ? { ...item, points: [...item.points, point] }
          : item
        );
      });
    }

    function handleLegacyDrawing(operation) {
      if (operation?.type === "start" && operation.stroke) {
        handleRemoteStrokeStart({ stroke: operation.stroke });
      } else if (operation?.type === "point") {
        handleRemoteStrokePoint(operation);
      }
    }

    async function handleRemoteRestore(operation) {
      if (
        !boardRoomId ||
        operation?.roomId !== boardRoomId ||
        boardSessionRef.current.roomId !== boardRoomId
      ) {
        return;
      }

      if (!boardSessionRef.current.ready) {
        pendingRoomRestoreRef.current = operation;
        console.info("Queued room restore until board initialization completes", {
          roomId: boardRoomId,
          revisionId: operation.revision?.revisionId,
        });
        return;
      }

      const restoredState = normalizeBoardState(operation.boardState);
      boardStateRef.current = restoredState;
      updateHistory(restoredState);

      try {
        const token = sessionStorage.getItem("token");
        if (!token) throw new Error("Authentication is required to refresh room revisions.");

        const response = await fetch(
          `${API_URL}/rooms/${encodeURIComponent(boardRoomId)}/revisions`,
          { headers: { Authorization: ["Bearer", token].join(" ") } }
        );
        const revisionData = await response.json();
        if (
          !response.ok ||
          revisionData?.version !== REVISION_HISTORY_VERSION ||
          !Array.isArray(revisionData.revisions)
        ) {
          throw new Error(revisionData?.message || "Failed to refresh room revisions.");
        }
        if (boardSessionRef.current.roomId !== boardRoomId) return;

        const currentHistory = revisionHistoriesRef.current.get(boardRoomId);
        const revisionsById = new Map(
          revisionData.revisions.map((revision) => [revision.revisionId, revision])
        );
        currentHistory?.getRevisions().forEach((revision) => {
          revisionsById.set(revision.revisionId, revision);
        });
        const history = createRevisionHistory({
          ...revisionData,
          revisions: [...revisionsById.values()],
        });
        revisionHistoriesRef.current.set(boardRoomId, history);
        setTimelineHistory(history);
      } catch (error) {
        console.error("Failed to refresh room revision history after a restore:", error);
      }
    }

    async function handleBoardState(snapshot) {
      const isRoomSnapshot =
        snapshot &&
        typeof snapshot === "object" &&
        Object.prototype.hasOwnProperty.call(snapshot, "roomId");

      if (boardRoomId) {
        if (
          !isRoomSnapshot ||
          snapshot.roomId !== boardRoomId ||
          snapshot.requestId !== boardSessionRef.current.requestId ||
          boardSessionRef.current.roomId !== boardRoomId
        ) {
          return;
        }
        snapshot = snapshot.boardState;
      } else if (isRoomSnapshot) {
        return;
      }

      const boardState = normalizeBoardState(snapshot);
      if (boardRoomId) {
        const roomId = boardRoomId;
        const requestId = boardSessionRef.current.requestId;
        try {
          const token = sessionStorage.getItem("token");
          if (!token) throw new Error("Authentication is required to load room revisions.");

          const response = await fetch(
            `${API_URL}/rooms/${encodeURIComponent(roomId)}/revisions`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const revisionData = await response.json();
          if (!response.ok) {
            throw new Error(revisionData.message || "Failed to fetch room revisions.");
          }
          if (
            !revisionData ||
            revisionData.version !== REVISION_HISTORY_VERSION ||
            !Array.isArray(revisionData.revisions)
          ) {
            throw new Error("The room revisions response has an unsupported format.");
          }
          if (
            boardSessionRef.current.roomId !== roomId ||
            boardSessionRef.current.requestId !== requestId
          ) {
            return;
          }
          revisionHistoriesRef.current.set(roomId, createRevisionHistory(revisionData));
          console.info("Room revision history loaded", {
            revisionCount: revisionData.revisions.length,
          });
        } catch (error) {
          console.error("Room revision loading failed:", error);
        }

        if (
          boardSessionRef.current.roomId !== roomId ||
          boardSessionRef.current.requestId !== requestId
        ) {
          return;
        }
      }

      boardStateRef.current = boardState;
      revisionTransactionStartRef.current = null;
      pendingTextRevisionIdsRef.current.clear();
      boardSessionRef.current.ready = true;
      if (boardRoomId) {
        setTimelineHistory(revisionHistoriesRef.current.get(boardRoomId) || null);
      }
      resetBoardHistory(boardState);
      setReadyBoardLocationKey(location.key);
      const pendingRestore = pendingRoomRestoreRef.current;
      if (pendingRestore?.roomId === boardRoomId) {
        pendingRoomRestoreRef.current = null;
        void handleRemoteRestore(pendingRestore);
      }
    }

    function handleBoardClear() {
      const emptyBoard = {
        notes: [],
        strokes: [],
        shapes: [],
        textItems: [],
      };
      boardStateRef.current = emptyBoard;
      updateHistory(emptyBoard);
    }

    function handleConnect() {
      console.log("Connected to server:", socket.id);
      if (boardRoomId) {
        boardSessionRef.current.ready = false;
        setReadyBoardLocationKey(null);
        const requestId = `${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        boardSessionRef.current.requestId = requestId;
        socket.emit("board:join", { roomId: boardRoomId, requestId });
      } else {
        boardSessionRef.current.ready = true;
        setReadyBoardLocationKey(location.key);
        socket.emit("board:join", boardStateRef.current);
      }
    }

    function handleConnectionError(error) {
      console.error("Socket connection failed:", error.message);
    }

    function handleBoardJoinError(error) {
      console.error("Unable to join board room:", error?.message || "Unknown error");
    }

    function handleDisconnect() {
      console.log("Disconnected from server");
      setRemoteCursors({});
      if (boardRoomId) {
        boardSessionRef.current.ready = false;
        boardSessionRef.current.requestId = null;
        setReadyBoardLocationKey(null);
      }
    }

    function handleCursorUpdate(position) {
      if (
        !position ||
        typeof position.id !== "string" ||
        !Number.isFinite(position.x) ||
        !Number.isFinite(position.y)
      ) {
        return;
      }

      setRemoteCursors((previous) => ({
        ...previous,
        [position.id]: {
          x: position.x,
          y: position.y,
          userId: typeof position.userId === "string" && position.userId
            ? position.userId
            : null,
          displayName: typeof position.displayName === "string" && position.displayName.trim()
            ? position.displayName.trim()
            : "Collaborator",
        },
      }));
    }

    function handleCursorRemove(socketId) {
      if (typeof socketId !== "string") return;

      setRemoteCursors((previous) => {
        if (!(socketId in previous)) return previous;
        const next = { ...previous };
        delete next[socketId];
        return next;
      });
    }

    socket.on("cursor:update", handleCursorUpdate);
    socket.on("cursor:remove", handleCursorRemove);
    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectionError);
    socket.on("board:join:error", handleBoardJoinError);
    socket.on("disconnect", handleDisconnect);
    socket.on("board:state", handleBoardState);
    socket.on("board:restore", handleRemoteRestore);
    socket.on("board:object:create", handleRemoteCreate);
    socket.on("board:object:update", handleRemoteUpdate);
    socket.on("board:object:delete", handleRemoteDelete);
    socket.on("board:stroke:start", handleRemoteStrokeStart);
    socket.on("board:stroke:point", handleRemoteStrokePoint);
    socket.on("drawing", handleLegacyDrawing);
    socket.on("board:clear", handleBoardClear);
    socket.connect();

  return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectionError);
      socket.off("board:join:error", handleBoardJoinError);
      socket.off("disconnect", handleDisconnect);
      socket.off("board:state", handleBoardState);
      socket.off("board:restore", handleRemoteRestore);
      socket.off("board:object:create", handleRemoteCreate);
      socket.off("board:object:update", handleRemoteUpdate);
      socket.off("board:object:delete", handleRemoteDelete);
      socket.off("board:stroke:start", handleRemoteStrokeStart);
      socket.off("board:stroke:point", handleRemoteStrokePoint);
      socket.off("drawing", handleLegacyDrawing);
      socket.off("board:clear", handleBoardClear);
      socket.off("cursor:update", handleCursorUpdate);
      socket.off("cursor:remove", handleCursorRemove);
      socket.disconnect();
  };
  }, [authStatus, boardRoomId, location.key, resetBoardHistory, updateHistory]);
  function applyHistoryAction(action) {
    if (boardSessionRef.current.roomId && !boardSessionRef.current.ready) return;
    const previousState = boardStateRef.current;
    action();
    const nextState = boardHistory.getState();
    boardStateRef.current = nextState;
    for (const collection of BOARD_COLLECTIONS) {
      emitCollectionChanges(
        collection,
        previousState[collection],
        nextState[collection],
        emitBoardEvent,
        true
      );
    }
  }
  const undo = () => applyHistoryAction(boardHistory.undo)
  const redo = () => applyHistoryAction(boardHistory.redo)
  const canUndo=boardHistory.canUndo
  const canRedo=boardHistory.canRedo
  const setBoardHistory = boardHistory.set
  const restoreRevision = useCallback(async (selectedRevision) => {
    if (restoreInProgressRef.current) {
      throw new Error("A restore is already in progress.");
    }
    if (boardSessionRef.current.roomId && !boardSessionRef.current.ready) {
      throw new Error("Wait for the room board to finish loading before restoring.");
    }

    const revisionHistory = revisionHistoriesRef.current.get(revisionHistoryKey);
    const sourceRevision = revisionHistory?.getRevisions().find(
      (revision) => revision.revisionId === selectedRevision?.revisionId
    );
    if (!revisionHistory || !sourceRevision) {
      throw new Error("The selected revision is no longer available.");
    }

    restoreInProgressRef.current = true;
    const restoreRoomId = boardSessionRef.current.roomId;
    const restoreRequestId = boardSessionRef.current.requestId;
    let persistedRevision = null;
    try {
      const restoredState = JSON.parse(JSON.stringify(sourceRevision.snapshot));
      console.info("Revision restore requested", {
        revisionId: sourceRevision.revisionId,
        roomId: restoreRoomId,
        collectionCounts: Object.fromEntries(
          BOARD_COLLECTIONS.map((collection) => [
            collection,
            restoredState[collection].length,
          ])
        ),
      });
      const revision = revisionHistory.prepareRevision(restoredState, {
        authorId: revisionAuthorId,
        authorName: currentUser?.name ?? null,
        changeDescription: "Restored revision",
      });

      if (isPersonalBoard) {
        const nextHistory = createRevisionHistory(revisionHistory.toJSON());
        nextHistory.addRevision(revision);
        const saved = savePersonalRevisionData(
          getPersonalRevisionStorageKey(revisionAuthorId),
          nextHistory.toJSON()
        );
        if (!saved) {
          throw new Error("The restored revision could not be saved to this browser.");
        }
        try {
          globalThis.localStorage.setItem(
            getPersonalBoardStorageKey(revisionAuthorId),
            JSON.stringify(restoredState)
          );
        } catch (error) {
          const rolledBack = savePersonalRevisionData(
            getPersonalRevisionStorageKey(revisionAuthorId),
            revisionHistory.toJSON()
          );
          if (!rolledBack) {
            console.error("Failed to roll back personal revision history after board save failure.");
          }
          throw new Error("The restored board could not be saved to this browser.", {
            cause: error,
          });
        }
      } else {
        if (
          boardSessionRef.current.roomId !== restoreRoomId ||
          boardSessionRef.current.requestId !== restoreRequestId ||
          !boardSessionRef.current.ready
        ) {
          throw new Error("The active room changed before the restore could be applied.");
        }

        if (!socket.connected) {
          throw new Error("The room connection was lost before the board could be restored.");
        }
        const restoreResult = await new Promise((resolve, reject) => {
          socket.timeout(10000).emit(
            "board:restore",
            { boardState: restoredState, revision },
            (error, result) => {
              if (error) {
                console.error("Room restore acknowledgement timed out or failed", {
                  roomId: restoreRoomId,
                  revisionId: revision.revisionId,
                  code: error.code,
                  message: error.message,
                });
                reject(new Error(
                  "No acknowledgement was received from the room server. The save outcome is unknown; reload the room before retrying."
                ));
              } else if (!result?.success) {
                console.error("Room restore was rejected by the server", {
                  roomId: restoreRoomId,
                  revisionId: revision.revisionId,
                  code: result?.code,
                  status: result?.status,
                  message: result?.message,
                });
                reject(new Error(
                  result?.message
                    ? `${result.code ? `${result.code}: ` : ""}${result.message}`
                    : `Room restore failed${result?.status ? ` (HTTP ${result.status})` : ""}.`
                ));
              } else {
                console.info("Room restore acknowledged by the server", {
                  roomId: restoreRoomId,
                  revisionId: result.revision?.revisionId,
                });
                resolve(result);
              }
            }
          );
        });
        if (
          !restoreResult?.success ||
          boardSessionRef.current.roomId !== restoreRoomId ||
          boardSessionRef.current.requestId !== restoreRequestId ||
          !boardSessionRef.current.ready
        ) {
          throw new Error(
            restoreResult?.message || "The active room changed before the restore completed."
          );
        }
        persistedRevision = restoreResult.revision;
      }

      persistedRevision ??= revision;
      revisionHistory.addRevision(persistedRevision);
      boardStateRef.current = restoredState;
      setBoardHistory(restoredState);
      console.info("Board revision restored", {
        scope: isPersonalBoard ? "personal" : "room",
        revisionCount: revisionHistory.getRevisions().length,
      });
      return persistedRevision;
    } finally {
      restoreInProgressRef.current = false;
    }
  }, [
    currentUser?.name,
    isPersonalBoard,
    revisionAuthorId,
    revisionHistoryKey,
    setBoardHistory,
  ]);
  const [activeTool, setActiveTool] = useState("select");
  const [isDrawing, setIsDrawing] = useState(false);
const [pan, setPan] = useState({ x: 0, y: 0 });
const [isPanning, setIsPanning] = useState(false);
const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
const [zoom, setZoom] = useState(1);
const viewportRef = useRef({ pan, zoom });
const [draggingText, setDraggingText] = useState(null);
const objectDragOriginRef = useRef(null);
const [snappingEnabled, setSnappingEnabled] = useState(true);
const spacePressedRef = useRef(false);
const [shapeType, setShapeType] = useState("rect");
const [selectedObject, setSelectedObject] = useState(null);

const [dragStart, setDragStart] = useState(null);
const canvasRef = useRef(null);
const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
const [saveStatus, setSaveStatus] = useState("Saved");
const currentStrokeIdRef = useRef(null);
const currentShapeIdRef = useRef(null);

useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const updateCanvasSize = () => {
    const nextSize = { width: canvas.clientWidth, height: canvas.clientHeight };
    setCanvasSize((previous) =>
      previous.width === nextSize.width && previous.height === nextSize.height
        ? previous
        : nextSize
    );
  };
  const measurementFrame = window.requestAnimationFrame(updateCanvasSize);

  if (typeof ResizeObserver === "undefined") {
    window.addEventListener("resize", updateCanvasSize);
    return () => {
      window.cancelAnimationFrame(measurementFrame);
      window.removeEventListener("resize", updateCanvasSize);
    };
  }

  const observer = new ResizeObserver(updateCanvasSize);
  observer.observe(canvas);
  return () => {
    window.cancelAnimationFrame(measurementFrame);
    observer.disconnect();
  };
}, [authStatus, location.pathname]);

useEffect(() => {
  function shouldIgnoreSpace(event) {
    if (!(event.target instanceof HTMLElement)) return false;
    return event.target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) ||
      Boolean(event.target.closest("button, a, [role='button']")) ||
      ![document.body, document.documentElement].includes(event.target) &&
        !event.target.closest(".board-canvas");
  }

  function handleKeyDown(event) {
    if (event.code !== "Space" || shouldIgnoreSpace(event)) return;
    spacePressedRef.current = true;
    event.preventDefault();
  }

  function handleKeyUp(event) {
    if (event.code === "Space") spacePressedRef.current = false;
  }

  function handleWindowBlur() {
    spacePressedRef.current = false;
    setIsPanning(false);
  }

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", handleWindowBlur);
  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", handleWindowBlur);
  };
}, []);

function applyViewport(nextPan, nextZoom, broadcast = true) {
  if (
    !nextPan ||
    !Number.isFinite(nextPan.x) ||
    !Number.isFinite(nextPan.y) ||
    !Number.isFinite(nextZoom)
  ) {
    return;
  }

  const viewport = {
    pan: { x: nextPan.x, y: nextPan.y },
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom)),
  };
  viewportRef.current = viewport;
  setPan(viewport.pan);
  setZoom(viewport.zoom);

  if (broadcast) {
    emitBoardEvent("board:viewport", viewport);
  }
}

function getCanvasPoint(event, canvas = event.currentTarget) {
  const targetCanvas = canvasRef.current || canvas;
  const rect = targetCanvas.getBoundingClientRect();
  const { pan: currentPan, zoom: currentZoom } = viewportRef.current;

  return {
    x: (event.clientX - rect.left - currentPan.x) / currentZoom,
    y: (event.clientY - rect.top - currentPan.y) / currentZoom,
  };
}

function zoomAtCanvasCenter(nextZoom) {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const { pan: currentPan, zoom: currentZoom } = viewportRef.current;
  const rect = canvas.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const boardX = (centerX - currentPan.x) / currentZoom;
  const boardY = (centerY - currentPan.y) / currentZoom;

  applyViewport({
    x: centerX - boardX * nextZoom,
    y: centerY - boardY * nextZoom,
  }, nextZoom);
}

function zoomIn() {
  zoomAtCanvasCenter(viewportRef.current.zoom * 1.2);
}

function zoomOut() {
  zoomAtCanvasCenter(viewportRef.current.zoom / 1.2);
}

function navigateMinimap(centerX, centerY) {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const { zoom: currentZoom } = viewportRef.current;
  applyViewport({
    x: canvas.clientWidth / 2 - centerX * currentZoom,
    y: canvas.clientHeight / 2 - centerY * currentZoom,
  }, currentZoom);
}

function fitBoardToView() {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const bounds = getContentBounds({ notes, textItems, strokes, shapes });
  if (!bounds) {
    applyViewport({ x: 0, y: 0 }, 1);
    return;
  }

  const padding = 100;
  const availableWidth = Math.max(1, canvas.clientWidth - padding * 2);
  const availableHeight = Math.max(1, canvas.clientHeight - padding * 2);
  const nextZoom = Math.max(
    MIN_ZOOM,
    Math.min(
      MAX_ZOOM,
    availableWidth / Math.max(1, bounds.maxX - bounds.minX),
    availableHeight / Math.max(1, bounds.maxY - bounds.minY)
    )
  );
  const centerX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
  const centerY = bounds.minY + (bounds.maxY - bounds.minY) / 2;
  applyViewport({
    x: canvas.clientWidth / 2 - centerX * nextZoom,
    y: canvas.clientHeight / 2 - centerY * nextZoom,
  }, nextZoom);
}


useEffect(() => {
  function handleRemoteViewport(viewport) {
    if (
      !viewport ||
      !viewport.pan ||
      !Number.isFinite(viewport.pan.x) ||
      !Number.isFinite(viewport.pan.y) ||
      !Number.isFinite(viewport.zoom)
    ) {
      return;
    }

    applyViewport(viewport.pan, viewport.zoom, false);
  }

  socket.on("board:viewport", handleRemoteViewport);
  return () => socket.off("board:viewport", handleRemoteViewport);
}, []);


useEffect(() => {
  function handleKeyDown(e) {
    if (
      e.key === "Escape" &&
      selectedObject?.type === "text" &&
      e.target instanceof HTMLTextAreaElement &&
      e.target.classList.contains("text-item")
    ) {
      e.preventDefault();
      e.target.blur();
      return;
    }

    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if (e.target instanceof HTMLElement &&
      (e.target.isContentEditable || ["INPUT", "TEXTAREA"].includes(e.target.tagName))) return;
    if (!selectedObject) return;

    if (selectedObject.type === "note") {
      setNotes((prev) => prev.filter((item) => item.id !== selectedObject.id));
    } else if (selectedObject.type === "shape") {
      setShapes((prev) => prev.filter((item) => item.id !== selectedObject.id));
    } else if (selectedObject.type === "text") {
      setTextItems((prev) => prev.filter((item) => item.id !== selectedObject.id));
    } else if (selectedObject.type === "stroke") {
      setStrokes((prev) => prev.filter((item) => item.id !== selectedObject.id));
    }

    setSelectedObject(null);
  }

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, [selectedObject, setNotes, setShapes, setStrokes, setTextItems]);

function getObjectBounds(object) {
  if (object.type === "note") {
    const note = notes.find((item) => item.id === object.id);
    return note ? {
      x: note.x,
      y: note.y,
      width: note.width ?? 192,
      height: note.height ?? 204,
    } : null;
  }
  if (object.type === "text") {
    const item = textItems.find((entry) => entry.id === object.id);
    return item ? { x: item.x, y: item.y, width: item.width ?? 164, height: item.height ?? 48 } : null;
  }
  if (object.type === "shape") {
    const shape = shapes.find((item) => item.id === object.id);
    if (!shape) return null;
    if (shape.type === "arrow") {
      const startX = shape.startX ?? shape.x;
      const startY = shape.startY ?? shape.y;
      const endX = shape.endX ?? shape.x + shape.width;
      const endY = shape.endY ?? shape.y + shape.height;
      return {
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        width: Math.max(1, Math.abs(endX - startX)),
        height: Math.max(1, Math.abs(endY - startY)),
      };
    }
    return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  }
  if (object.type === "stroke") {
    const stroke = strokes.find((item) => item.id === object.id);
    if (!stroke || stroke.points.length === 0) return null;
    const xs = stroke.points.map((point) => point.x);
    const ys = stroke.points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
      x: x - 6,
      y: y - 6,
      width: Math.max(12, Math.max(...xs) - x + 12),
      height: Math.max(12, Math.max(...ys) - y + 12),
    };
  }
  return null;
}


useEffect(() => {
  if (boardRoomId) return;

  setSaveStatus("Saving...");

  try {
    localStorage.setItem(
        getPersonalBoardStorageKey(revisionAuthorId),
      JSON.stringify(boardHistory.state)
    );

    setSaveStatus("Saved");
  } catch (error) {
    console.error("Autosave failed:", error);
    setSaveStatus("Save failed");
  }
}, [boardHistory.state, boardRoomId, revisionAuthorId]);

useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  function handleWheel(e) {
    e.preventDefault();

    const { pan: currentPan, zoom: currentZoom } = viewportRef.current;
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, currentZoom * Math.exp(-e.deltaY * 0.001))
    );
    const rect = canvas.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const canvasX = (cursorX - currentPan.x) / currentZoom;
    const canvasY = (cursorY - currentPan.y) / currentZoom;

    applyViewport({
      x: cursorX - canvasX * nextZoom,
      y: cursorY - canvasY * nextZoom,
    }, nextZoom);
  }

  canvas.addEventListener("wheel", handleWheel, { passive: false });
  return () => canvas.removeEventListener("wheel", handleWheel);
}, [pan, zoom]);

async function exportBoardAsPng() {
  const board = canvasRef.current;
  if (!board) return;

  try {
    const dataUrl = await toPng(board, {
      cacheBust: true,
      pixelRatio: 2,
    });

    const link = document.createElement("a");
    link.download = "shared-sanctum.png";
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error("PNG export failed:", error);
  }
}


  function createNote(){
    const id = createBoardId();
    setNotes((previous) => [
      ...previous,
      {
        id,
        text: "",
        x: 200 + previous.length * 25,
        y: 150 + previous.length * 25,
        color: "bg-yellow-200",
      },
    ]);
  }
  function deleteNote(id){
    setNotes((prevnotes)=>
      prevnotes.filter((note)=> note.id!==id)
    )
  }
  function clearBoard() {
    if (boardSessionRef.current.roomId && !boardSessionRef.current.ready) return;
    if (!window.confirm("Clear all canvas content? This can be undone.")) return;

    commitBoardTransaction();
    const emptyBoard = {
      notes: [],
      strokes: [],
      shapes: [],
      textItems: [],
    };
    const previousBoardState = boardStateRef.current;
    boardStateRef.current = emptyBoard;
    setBoardHistory(emptyBoard);
    if (describeBoardChange(previousBoardState, emptyBoard)) {
      recordBoardRevision("Cleared board", emptyBoard);
    }
    emitBoardEvent("board:clear");
    setSelectedObject(null);
    setDragStart(null);
    setDraggingNote(null);
    setDraggingText(null);
    setIsDrawing(false);
    setIsPanning(false);
  }
const activeRoom = boardRoomId
  ? rooms.find((room) => room.id === boardRoomId)
  : null;

return (
  <Routes>
   <Route
  path="/dashboard-preview"
  element={
    authStatus === "checking" ? null : authStatus !== "authenticated" ? (
      <Navigate to="/login" replace />
    ) : (
      <Dashboard
  rooms={rooms}
  currentUser={currentUser}
  onCreateRoom={createRoom}
  onJoinRoom={joinRoom}
  onInviteRoom={copyRoomInvite}
  onOpenRoom={(room) => {
      navigate(`/board/${encodeURIComponent(String(room.id))}`);
  }}
  onLogout={handleLogout}
/>
    )
  }
/>
    <Route
      path="/"
      element={(
        <Landing
          onLogin={() => navigate("/login")}
          onSignup={() => navigate("/signup")}
        />
      )}
    />
    <Route
      path="/login"
      element={
        authStatus === "checking" ? null : authStatus === "authenticated" ? (
          <Navigate to="/dashboard-preview" replace />
        ) : (
          <Login
            onSwitchToSignup={() => navigate("/signup")}
            onLoginSuccess={() => {
              setRooms([]);
              setCurrentUser(getCachedUser());
              setAuthStatus("authenticated");
              navigate("/dashboard-preview", { replace: true });
            }}
          />
        )
      }
    />
    <Route
      path="/signup"
      element={
        authStatus === "checking" ? null : authStatus === "authenticated" ? (
          <Navigate to="/dashboard-preview" replace />
        ) : (
          <Signup onSwitchToLogin={() => navigate("/login")} />
        )
      }
    />
    <Route
      path="/board/:roomId?"
      element={
        authStatus === "checking" ? null : authStatus !== "authenticated" ? (
          <Navigate to="/login" replace />
        ) : (
          <div className="board-layout">
<Header
  undo={undo}
  redo={redo}
  canUndo={canUndo}
  canRedo={canRedo}
  onAllClear={clearBoard}
  saveStatus={saveStatus}
  onExport={exportBoardAsPng}
  onLogout={handleLogout}
  user={currentUser}
  roomName={activeRoom?.name || (boardRoomId ? "Shared room" : "Personal board")}
  onInviteRoom={activeRoom?.inviteCode ? () => copyRoomInvite(activeRoom) : undefined}
/>
  <main ref={canvasRef} className={`board-canvas tool-${activeTool}${isPanning ? " is-panning" : ""}`} style={{
    backgroundImage:`radial-gradient(#d9d0c2 ${zoom}px,transparent ${zoom}px)`,
    backgroundSize:`${24 * zoom}px ${24 * zoom}px`,
    backgroundPosition:`${pan.x}px ${pan.y}px`,
   
  }}
  onMouseDown={(e) => {
    if (!boardReady) return;
    if (
      spacePressedRef.current &&
      e.button === 0 &&
      !e.target.closest("aside, button, input, textarea, select, [contenteditable='true'], .board-minimap")
    ) {
      e.preventDefault();
      setIsPanning(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
      return;
    }

    const handle = e.target.closest("[data-resize-handle]");
    if (handle && selectedObject) {
      const bounds = getObjectBounds(selectedObject);
      if (bounds) {
        e.preventDefault();
        beginBoardTransaction();
        const { x: mouseX, y: mouseY } = getCanvasPoint(e);
        setDragStart({
          mode: "resize",
          handle: handle.dataset.resizeHandle,
          bounds,
          mouseX,
          mouseY,
        });
      }
      return;
    }

    if (e.target.closest("aside, button, input, textarea, select, [contenteditable='true'], .board-minimap")) {
      return;
    }

if (activeTool === "select") {
  if (e.target instanceof HTMLElement &&
    !["INPUT", "TEXTAREA"].includes(e.target.tagName) &&
    document.activeElement instanceof HTMLElement &&
    ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    document.activeElement.blur();
  }

  const { x: mouseX, y: mouseY } = getCanvasPoint(e);

  const clickedNote = notes.find(
    (note) =>
      mouseX >= note.x &&
      mouseX <= note.x + (note.width ?? 192) &&
      mouseY >= note.y &&
      mouseY <= note.y + (note.height ?? 204)
  );

if (clickedNote) {
  beginBoardTransaction();
  setSelectedObject({
    type: "note",
    id: clickedNote.id,
  });

  setDragStart({
    mode: "move",
    mouseX,
    mouseY,
    object: clickedNote,
  });
} else {
  const clickedShape = [...shapes].reverse().find((shape) => {
    if (shape.type === "arrow") {
      const startX = shape.startX ?? shape.x;
      const startY = shape.startY ?? shape.y;
      const endX = shape.endX ?? shape.x + shape.width;
      const endY = shape.endY ?? shape.y + shape.height;
      const lineX = endX - startX;
      const lineY = endY - startY;
      const lengthSquared = lineX * lineX + lineY * lineY;
      const projection = lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((mouseX - startX) * lineX + (mouseY - startY) * lineY) / lengthSquared));
      const distanceX = mouseX - (startX + projection * lineX);
      const distanceY = mouseY - (startY + projection * lineY);

      return Math.hypot(distanceX, distanceY) <= 8 / zoom;
    }

    if (shape.type === "circle") {
      const radiusX = shape.width / 2;
      const radiusY = shape.height / 2;

      return radiusX > 0 && radiusY > 0 &&
        ((mouseX - (shape.x + radiusX)) / radiusX) ** 2 +
        ((mouseY - (shape.y + radiusY)) / radiusY) ** 2 <= 1;
    }

    return mouseX >= shape.x &&
      mouseX <= shape.x + shape.width &&
      mouseY >= shape.y &&
      mouseY <= shape.y + shape.height;
  });

  if (clickedShape) {
    beginBoardTransaction();
    setSelectedObject({
      type: "shape",
      id: clickedShape.id,
    });
    setDragStart({
      mode: "move",
      mouseX,
      mouseY,
      object: clickedShape,
    });
  } else {
    const clickedStroke = [...strokes].reverse().find((stroke) =>
      stroke.points.some((point, index) => {
        const next = stroke.points[index + 1];
        if (!next) {
          return Math.hypot(mouseX - point.x, mouseY - point.y) <= 10 / zoom;
        }
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const lengthSquared = dx * dx + dy * dy;
        const projection = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
          ((mouseX - point.x) * dx + (mouseY - point.y) * dy) / lengthSquared
        ));
        return Math.hypot(mouseX - (point.x + projection * dx), mouseY - (point.y + projection * dy)) <= 10 / zoom;
      })
    );

    if (clickedStroke) {
      beginBoardTransaction();
      setSelectedObject({ type: "stroke", id: clickedStroke.id });
      setDragStart({ mode: "move", mouseX, mouseY, object: clickedStroke });
    } else {
      setSelectedObject(null);
      setDragStart(null);
    }
  }
}
  return;
}


    if (activeTool === "shape") {
  beginBoardTransaction();
  const { x: startX, y: startY } = getCanvasPoint(e);
  const shapeId = createBoardId();
  currentShapeIdRef.current = shapeId;

  updateShapes((prev) => [
    ...prev,
    {
      id: shapeId,
      type: shapeType,
      startX,
      startY,
      endX: startX,
      endY: startY,
      x: startX,
      y: startY,
      width: 0,
      height: 0,
    },
  ]);

  setIsDrawing(true);
  return;
}
    if (activeTool === "text") {
  const { x, y } = getCanvasPoint(e);
  setTextItems((prev) => [
    ...prev,
    {
      id: createBoardId(),
      x,
      y,
      text: "",
    },
  ]);
  return;
}
    if (activeTool === "eraser") {
  beginBoardTransaction();
  setIsDrawing(true);
  return;
}
    if (activeTool === "hand") {
  setIsPanning(true);
  setLastMouse({
    x: e.clientX,
    y: e.clientY,
  });
  return;
}
  if (activeTool !== "pen") return;
  if (e.target.closest(".sticky-note, .text-item")) return;
const point = getCanvasPoint(e);

const newStroke = {
  id: createBoardId(),
  points: [point],
};

currentStrokeIdRef.current = newStroke.id;

beginBoardTransaction();
setIsDrawing(true);

updateStrokes((prev) => [...prev, newStroke]);
console.log("Sending drawing:", newStroke);
emitBoardEvent("board:stroke:start", {
  stroke: newStroke,
});
}}
  
onMouseMove={(e) => {
if (!boardReady) return;

const { x, y } = getCanvasPoint(e);
socket.emit("cursor:move", {
  x,
  y,
  displayName: currentUser?.name || "Collaborator",
});

if (isPanning) {
  const dx = e.clientX - lastMouse.x;
  const dy = e.clientY - lastMouse.y;
  const currentViewport = viewportRef.current;

  applyViewport({
    x: currentViewport.pan.x + dx,
    y: currentViewport.pan.y + dy,
  }, currentViewport.zoom);

  setLastMouse({ x: e.clientX, y: e.clientY });
  return;
}
  
if (
  activeTool === "select" &&
  selectedObject &&
  dragStart &&
  e.buttons === 1
) {
 const { x: mouseX, y: mouseY } = getCanvasPoint(e);
  const deltaX = mouseX - dragStart.mouseX;
  const deltaY = mouseY - dragStart.mouseY;

  if (dragStart.mode === "resize") {
    const bounds = dragStart.bounds;
    const right = dragStart.handle.includes("e");
    const bottom = dragStart.handle.includes("s");
    const minSize = selectedObject.type === "note" ? 204 : 24;
    const width = Math.max(minSize, bounds.width + (right ? deltaX : -deltaX));
    const height = Math.max(minSize, bounds.height + (bottom ? deltaY : -deltaY));
    const x = right ? bounds.x : bounds.x + bounds.width - width;
    const y = bottom ? bounds.y : bounds.y + bounds.height - height;

    if (selectedObject.type === "shape") {
      updateShapes((prev) => prev.map((shape) =>
        shape.id === selectedObject.id
          ? { ...shape, x, y, width, height }
          : shape
      ));
    } else if (selectedObject.type === "note") {
      updateNotes((prev) => prev.map((note) =>
        note.id === selectedObject.id ? { ...note, x, y, width, height } : note
      ));
    } else if (selectedObject.type === "text") {
      updateTextItems((prev) => prev.map((item) =>
        item.id === selectedObject.id ? { ...item, x, y, width, height } : item
      ));
    }
  } else if (selectedObject.type === "note") {
    updateNotes((prev) =>
      prev.map((note) =>
        note.id === selectedObject.id
          ? {
              ...note,
              x: dragStart.object.x + deltaX,
              y: dragStart.object.y + deltaY,
            }
          : note
      )
    );
  } else if (selectedObject.type === "shape") {
    updateShapes((prev) =>
      prev.map((shape) => {
        if (shape.id !== selectedObject.id) return shape;

        if (shape.type === "arrow") {
          const originalShape = dragStart.object;

          return {
            ...shape,
            startX: (originalShape.startX ?? originalShape.x) + deltaX,
            startY: (originalShape.startY ?? originalShape.y) + deltaY,
            endX: (originalShape.endX ?? originalShape.x + originalShape.width) + deltaX,
            endY: (originalShape.endY ?? originalShape.y + originalShape.height) + deltaY,
          };
        }

        return {
          ...shape,
          x: dragStart.object.x + deltaX,
          y: dragStart.object.y + deltaY,
        };
      })
    );
  } else if (selectedObject.type === "stroke") {
    updateStrokes((prev) => prev.map((stroke) =>
      stroke.id === selectedObject.id
        ? {
            ...stroke,
            points: dragStart.object.points.map((point) => ({
              x: point.x + deltaX,
              y: point.y + deltaY,
            })),
          }
        : stroke
    ));
  } else if (selectedObject.type === "text") {
    updateTextItems((prev) => prev.map((item) =>
      item.id === selectedObject.id
        ? {
            ...item,
            x: dragStart.object.x + deltaX,
            y: dragStart.object.y + deltaY,
          }
        : item
    ));
  }

  return;
}

  if (activeTool === "shape" && isDrawing) {
  const { x: currentX, y: currentY } = getCanvasPoint(e);

  updateShapes((prev) => {
    const activeShape = prev.find((shape) => shape.id === currentShapeIdRef.current);
    if (!activeShape) return prev;

    return prev.map((shape) => {
      if (shape.id !== currentShapeIdRef.current) return shape;

      if (shape.type === "arrow") {
        return {
          ...shape,
          endX: currentX,
          endY: currentY,
        };
      }

      return {
        ...shape,
        x: Math.min(activeShape.startX, currentX),
        y: Math.min(activeShape.startY, currentY),
        width: Math.abs(currentX - activeShape.startX),
        height: Math.abs(currentY - activeShape.startY),
      };
    });
  });

  return;
}
  if (activeTool === "eraser" && isDrawing) {
  const { x, y } = getCanvasPoint(e);
  updateStrokes((prev) =>
    prev.filter((stroke) => {
      const threshold = 15 / zoom;
      const isNear = stroke.points.some((point, index) =>
        index === 0
          ? Math.hypot(point.x - x, point.y - y) < threshold
          : distanceToSegment(
              { x, y },
              stroke.points[index - 1],
              point
            ) < threshold
      );

      return !isNear;
    })
  );
  return;
}if (activeTool === "pen" && isDrawing) {
const point = getCanvasPoint(e);

updateStrokes((prev) => {
  if (!currentStrokeIdRef.current) return prev;
  return prev.map((stroke) => stroke.id === currentStrokeIdRef.current
    ? { ...stroke, points: [...stroke.points, point] }
    : stroke
  );
  });
console.log("Sending point");
  emitBoardEvent("board:stroke:point", {
    strokeId: currentStrokeIdRef.current,
    point,
  });

  return;
}
  if (draggingText !== null) {
  updateTextItems((prev) =>
    prev.map((item) =>
      item.id === draggingText
        ? {
            ...item,
            x: item.x + e.movementX / zoom,
            y: item.y + e.movementY / zoom,
          }
        : item
    )
  );
  return;
}
  if (draggingNote === null) return;

  updateNotes((prevNotes) =>
    prevNotes.map((note) =>
      note.id === draggingNote
        ? {
            ...note,
            x: note.x + e.movementX / zoom,
            y: note.y + e.movementY / zoom,
          }
        : note
    )
  );
}}

  onMouseUp={()=>{
    if (!boardReady) return;

    const dragOrigin = objectDragOriginRef.current;
    if (snappingEnabled && dragOrigin) {
      const collection = dragOrigin.type === "note" ? "notes" : "textItems";
      const draggedObject = boardStateRef.current[collection].find(
        (item) => item.id === dragOrigin.id
      );
      if (
        draggedObject &&
        (draggedObject.x !== dragOrigin.x || draggedObject.y !== dragOrigin.y)
      ) {
        const x = snapToGrid(draggedObject.x);
        const y = snapToGrid(draggedObject.y);
        if (x !== draggedObject.x || y !== draggedObject.y) {
          const updateObjects = dragOrigin.type === "note" ? updateNotes : updateTextItems;
          updateObjects((previous) => previous.map((item) =>
            item.id === dragOrigin.id ? { ...item, x, y } : item
          ));
        }
      }
    }
    objectDragOriginRef.current = null;
    commitBoardTransaction();
    setIsPanning(false);
    setDraggingText(null);
    setIsDrawing(false)
    setDraggingNote(null)
    currentStrokeIdRef.current = null;
    currentShapeIdRef.current = null;
  }}
  onPointerDown={(event) => {
    if (!boardReady || event.button !== 0) return;
    if (event.target.closest("aside, button, input, textarea, select, [contenteditable='true'], .board-minimap")) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }}
  >
    <div className="board-toolbar-dock">
<Toolbar
  onNoteClick={createNote}
  activeTool={activeTool}
  setActiveTool={setActiveTool}
  shapeType={shapeType}
  setShapeType={setShapeType}
  onZoomIn={zoomIn}
  onZoomOut={zoomOut}
  zoom={zoom}
  onFitView={fitBoardToView}
  snappingEnabled={snappingEnabled}
  onToggleSnapping={() => setSnappingEnabled((enabled) => !enabled)}
  timelineOpen={timelineOpen}
  onToggleTimeline={toggleRevisionTimeline}
  timelineDisabled={!boardReady}
/>
    </div>
    <div
  className="absolute inset-0"
  style={{
     transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "0 0",
      visibility: boardReady ? "visible" : "hidden",
    }}
>  
    <DrawingLayer strokes={strokes} shapes={shapes} />
    {notes.map((note) => (
      <StickyNote
        key={note.id}
        note={note}
        onBeginDrag={() => {
          if (activeTool !== "select") return;
          beginBoardTransaction();
          objectDragOriginRef.current = {
            type: "note",
            id: note.id,
            x: note.x,
            y: note.y,
          };
          setDraggingNote(note.id);
        }}
        onTextMouseDown={() => {
          if (activeTool === "select") {
            setSelectedObject({ type: "note", id: note.id });
          }
        }}
        onTextChange={(text) => {
          const revisionKey = `note:${note.id}`;
          if (!pendingTextRevisionIdsRef.current.has(revisionKey)) {
            beginBoardTransaction();
            pendingTextRevisionIdsRef.current.add(revisionKey);
          }
          updateCollection("notes", (previous) =>
            previous.map((item) =>
              item.id === note.id ? { ...item, text } : item
            ), true, { recordRevision: false });
        }}
        onTextCommit={() => {
          if (pendingTextRevisionIdsRef.current.delete(`note:${note.id}`)) {
            commitBoardTransaction();
          }
        }}
        onColorChange={(color) => setNotes((previous) =>
          previous.map((item) =>
            item.id === note.id ? { ...item, color } : item
          )
        )}
        onDelete={() => deleteNote(note.id)}
      />
    ))}
    {textItems.map((item) => (
      <TextItem
        key={item.id}
        item={item}
        onChange={(text) => {
          const revisionKey = `text:${item.id}`;
          if (!pendingTextRevisionIdsRef.current.has(revisionKey)) {
            beginBoardTransaction();
            pendingTextRevisionIdsRef.current.add(revisionKey);
          }
          updateCollection("textItems", (previous) =>
            previous.map((entry) =>
              entry.id === item.id ? { ...entry, text } : entry
            ), true, { recordRevision: false });
        }}
        onCommit={() => {
          if (pendingTextRevisionIdsRef.current.delete(`text:${item.id}`)) {
            commitBoardTransaction();
          }
        }}
        onMouseDown={(event) => {
          if (activeTool === "select") {
            beginBoardTransaction();
            const { x, y } = getCanvasPoint(event);
            objectDragOriginRef.current = {
              type: "text",
              id: item.id,
              x: item.x,
              y: item.y,
            };
            setSelectedObject({ type: "text", id: item.id });
            setDragStart({
              mode: "move",
              mouseX: x,
              mouseY: y,
              object: item,
            });
            return;
          }
          beginBoardTransaction();
          objectDragOriginRef.current = {
            type: "text",
            id: item.id,
            x: item.x,
            y: item.y,
          };
          setDraggingText(item.id);
          setSelectedObject(null);
          setDragStart(null);
        }}
      />
    ))}
    <SelectionOverlay
      bounds={selectedObject ? getObjectBounds(selectedObject) : null}
      canResize={
        selectedObject?.type === "note" ||
        selectedObject?.type === "text" ||
        (selectedObject?.type === "shape" &&
          shapes.find((shape) => shape.id === selectedObject.id)?.type !== "arrow")
      }
    />
    </div>
    {canvasSize.width > 0 && canvasSize.height > 0 && (
      <BoardMinimap
        notes={notes}
        textItems={textItems}
        strokes={strokes}
        shapes={shapes}
        viewport={{ pan, zoom }}
        canvasSize={canvasSize}
        onNavigate={navigateMinimap}
      />
    )}
    {timelineOpen && timelineHistory && (
      <RevisionTimeline
        key={revisionHistoryKey}
        history={timelineHistory}
        currentUser={currentUser}
        onRestore={restoreRevision}
        onClose={() => setTimelineState({ boardKey: revisionHistoryKey, open: false })}
      />
    )}
    {timelineOpen && !timelineHistory && (
      <RevisionTimeline
        key={revisionHistoryKey}
        loading={timelineLoadState.boardKey === revisionHistoryKey &&
          timelineLoadState.status === "loading"}
        loadError={timelineLoadState.boardKey === revisionHistoryKey &&
          timelineLoadState.status === "error"}
        currentUser={currentUser}
        onClose={() => setTimelineState({ boardKey: revisionHistoryKey, open: false })}
      />
    )}
    {Object.entries(remoteCursors).map(([id, position]) => (
  <div
    key={id}
    className="pointer-events-none absolute z-50"
    style={{
      left: pan.x + position.x * zoom,
      top: pan.y + position.y * zoom,
      transition: "left 50ms linear, top 50ms linear",
    }}
  >
    <div className="board-cursor-dot" style={{ backgroundColor: getCursorColor(position.userId || id) }} />
    <span className="board-cursor-label" style={{ backgroundColor: getCursorColor(position.userId || id) }}>
      {position.displayName || "Collaborator"}
    </span>
  </div>
))}
  </main>

  </div>
        )
      }
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
}

export default App
