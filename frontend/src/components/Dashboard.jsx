import React, { useEffect, useId, useRef, useState } from "react";
import "./Dashboard.css";

// PREVIEW DATA ONLY. Pass rooms={[]} for an empty workspace, or your real rooms.
// Room shape: { id, name, role: "owner" | "member", memberCount, accent? }.
const SAMPLE_ROOMS = [
  { id: "sample-1", name: "The big idea board", role: "owner", memberCount: 4, accent: "peach" },
  { id: "sample-2", name: "A little brainstorm", role: "member", memberCount: 3, accent: "blue" },
  { id: "sample-3", name: "Something worth making", role: "owner", memberCount: 2, accent: "green" },
];
const DEFAULT_USER = { name: "Alex Morgan", avatarUrl: "" };
const TONES = ["peach", "blue", "green"];

function Icon({ kind, className = "" }) {
  const paths = {
    pencil: "M5 25 7 18 20 5Q23 3 25 5Q27 7 25 10L12 23ZM7 18 12 23M18 7 23 12M4 28Q10 26 16 28T28 27",
    arrow: "M5 16H27M20 9 27 16 20 23",
    plus: "M16 6V26M6 16H26",
    close: "M8 8 24 24M24 8 8 24",
    logout: "M13 6H6V26H13M13 16H27M21 10 27 16 21 22",
    people: "M5 27V24Q5 17 12 17Q19 17 19 24V27M22 18Q28 18 28 24V27M8 9A4 4 0 1 0 16 9A4 4 0 1 0 8 9M22 6A4 4 0 0 1 22 14",
    star: "M16 3 20 12 30 13 22 20 24 29 16 24 8 29 10 20 2 13 12 12Z",
    spinner: "M27 16A11 11 0 1 1 16 5",
  };
  return <svg viewBox="0 0 32 32" className={`sd-ink-stroke ${className}`} aria-hidden="true"><path d={paths[kind] || paths.arrow} /></svg>;
}

function ActionArt({ join = false, className = "" }) {
  return (
    <svg viewBox="0 0 80 80" className={`sd-ink-stroke ${className}`} aria-hidden="true">
      {join ? <>
        <path className="sd-art-blue" d="M35 15 61 12 65 57 39 61Z" />
        <path d="M42 20 56 18 58 52 44 54ZM7 38H43M32 27 44 38 33 49" />
        <path className="sd-stroke-blue" d="M15 14 17 9M10 18 5 17M65 68 68 71" />
      </> : <>
        <path className="sd-art-peach" d="M15 17 60 13 65 59 20 64Z" />
        <path className="sd-art-paper" d="M23 23 58 20 60 54 25 57Z" />
        <path d="M40 29V48M31 39H50M8 7 10 13M4 12 14 9M66 67 73 61" />
        <path className="sd-stroke-peach" d="M28 69Q40 65 52 69" />
      </>}
    </svg>
  );
}

function BoardArt({ variant = 0, className = "" }) {
  return (
    <svg viewBox="0 0 240 160" className={`sd-ink-stroke ${className}`} aria-hidden="true">
      <path className="sd-art-paper" d="M43 25 191 22 194 113 45 116Z" />
      <path d="M38 117H200M82 119 70 144M158 117 173 144M61 144H184" />
      {variant % 3 === 0 ? <>
        <path className="sd-art-peach" d="M61 43 98 39 100 74 63 78Z" />
        <path className="sd-art-blue" d="M137 65 172 69 170 101 135 97Z" />
        <path d="M71 52 89 50M71 61 85 60M146 80 161 82M145 89 157 91M104 62Q126 48 143 57M137 48 145 57 136 62" />
        <path className="sd-stroke-green" d="M73 96Q91 84 109 96T134 94" />
      </> : variant % 3 === 1 ? <>
        <path className="sd-art-blue" d="M97 46Q119 31 139 49L139 70Q120 83 97 69Z" />
        <path className="sd-art-peach" d="M62 84 91 83 93 102 63 103Z" />
        <path className="sd-art-green" d="M148 82 179 85 177 104 147 101Z" />
        <path d="M118 81V92M97 93H144M82 80 109 74M139 73 158 81M107 55 130 56M111 64 125 64" />
      </> : <>
        <path className="sd-art-green" d="M63 46 98 42 100 92 65 96Z" />
        <path d="M73 56 88 54M73 66 91 64M74 77 87 75" />
        <path className="sd-stroke-peach" d="M127 55 131 65 143 66 134 73 137 85 127 78 117 85 120 73 111 66 123 65Z" />
        <path className="sd-stroke-blue" d="M150 49Q159 38 170 48M150 95Q163 86 177 95" />
      </>}
      <path className="sd-stroke-peach" d="M18 44 21 35 24 44 33 47 24 50 21 59 18 50 9 47Z" />
      <path className="sd-stroke-blue" d="M211 91 213 85M217 96 224 95M205 99 201 104" />
    </svg>
  );
}

function WelcomeArt() {
  return (
    <svg viewBox="0 0 260 175" className="sd-ink-stroke sd-welcome-art" aria-hidden="true">
      <path className="sd-art-paper" d="M57 41 185 34 191 121 62 129Z" />
      <path className="sd-art-peach" d="M78 55 116 52 119 89 80 92Z" />
      <path className="sd-art-blue" d="M136 70 173 75 171 106 133 102Z" />
      <path d="M89 65 107 63M89 75 101 73M143 84 164 87M142 93 156 95M66 130H195M98 130 87 152M160 128 173 150M80 153H181" />
      <path className="sd-stroke-green" d="M120 54Q140 39 161 51M154 43 163 51 154 58M84 109Q103 98 122 108" />
      <path className="sd-stroke-peach" d="M25 45 29 35 33 45 44 48 34 53 35 64 28 57 17 60 21 50 13 43Z" />
      <path className="sd-stroke-blue" d="M216 26Q202 15 201 30Q201 40 215 49Q233 37 231 28Q229 16 216 26Z" />
      <path d="M212 89Q242 106 225 134M221 124 225 136 235 130" />
      <path className="sd-stroke-green" d="M31 116Q36 99 41 116T52 116M202 65 205 57M210 70 218 68" />
    </svg>
  );
}

function Modal({ mode, submitting, error, onClose, onSubmit }) {
  const [value, setValue] = useState("");
  const inputId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const isJoin = mode === "join";

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(dialogRef.current?.querySelectorAll("button:not(:disabled), input:not(:disabled), [tabindex='0']") || []);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  }

  return (
    <div className="sd-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="sd-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={submitting} onKeyDown={handleKeyDown}>
        <button className="sd-icon-button sd-modal-close" type="button" aria-label="Close dialog" title="Close dialog" onClick={onClose}><Icon kind="close" /></button>
        <ActionArt join={isJoin} className="sd-modal-art" />
        <h2 id={titleId}>{isJoin ? "Join a room" : "A new place for ideas."}</h2>
        <p className="sd-modal-description" id={descriptionId}>{isJoin ? "Good thinking is better together." : "Give your next great idea a little space."}</p>
        <form className="sd-form" noValidate onSubmit={(event) => { event.preventDefault(); onSubmit(value); }}>
          <label htmlFor={inputId}>{isJoin ? "Room ID or invitation link" : "Room name"}</label>
          <input ref={inputRef} id={inputId} value={value} onChange={(event) => setValue(event.target.value)} placeholder={isJoin ? "Paste a room ID or invitation link" : "e.g. Friday's bright ideas"} disabled={submitting} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} autoComplete="off" />
          {error && <p className="sd-error" id={errorId} role="alert">{error}</p>}
          <div className="sd-form-actions">
            <button className="sd-button sd-button-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="sd-button" type="submit" disabled={submitting}>{submitting && <Icon kind="spinner" className="sd-spin" />}{submitting ? (isJoin ? "Joining…" : "Creating…") : (isJoin ? "Join Room" : "Create Room")}{!submitting && <Icon kind={isJoin ? "arrow" : "plus"} />}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

/**
 * Portable dashboard — no router, storage, authentication or network calls.
 * rooms: source room array (undefined uses preview samples; [] shows empty state).
 * currentUser: { name, avatarUrl? }.
 * onCreateRoom(name): optional async callback returning a room object.
 *   Without a returned object, a temporary in-memory room is created.
 * onJoinRoom(roomIdOrLink), onOpenRoom(room), onLogout(): optional async callbacks.
 *   Join does not invent a room or claim that an invitation is valid.
 * For integrated data, update rooms after callbacks. Returned room IDs are
 * deduplicated against the source array; preview-only rooms disappear on remount.
 */
export default function Dashboard({ rooms, currentUser = DEFAULT_USER, onCreateRoom, onJoinRoom, onOpenRoom, onLogout } = {}) {
  const [localRooms, setLocalRooms] = useState([]);
  const [mode, setMode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const submissionLock = useRef(false);
  const actionLock = useRef(false);
  const requestVersion = useRef(0);
  const mounted = useRef(true);
  const contentRef = useRef(null);
  const user = currentUser || DEFAULT_USER;
  const baseRooms = Array.isArray(rooms) ? rooms : SAMPLE_ROOMS;
  const visibleRooms = [...baseRooms, ...localRooms.filter((local) => !baseRooms.some((room) => room.id === local.id))];
  const initials = (user.name || "Guest").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "G";

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; requestVersion.current += 1; };
  }, []);

  useEffect(() => {
    if (contentRef.current) contentRef.current.inert = Boolean(mode);
  }, [mode]);

  function openModal(nextMode) {
    setMode(nextMode); setError(""); setStatus(""); setActionError("");
  }

  function closeModal() {
    // Pending callbacks may finish, but stale results must not affect a new modal.
    requestVersion.current += 1;
    setMode(null); setError("");
  }

  async function submit(value) {
    if (submissionLock.current) return;
    const input = value.trim();
    if (!input) { setError(mode === "join" ? "Enter a room ID or invitation link." : "Enter a room name."); return; }
    if (mode === "join" && typeof onJoinRoom !== "function") {
      setError("Joining isn't connected in this preview. No room has been joined."); return;
    }
    submissionLock.current = true;
    setSubmitting(true); setError("");
    const version = ++requestVersion.current;
    const submittedMode = mode;
    try {
      if (submittedMode === "create") {
        const result = typeof onCreateRoom === "function" ? await onCreateRoom(input) : undefined;
        const localRoom = {
          id: `temporary-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: input, role: "owner", memberCount: 1, accent: TONES[visibleRooms.length % 3],
        };
        const room = result && typeof result === "object" && result.id != null ? { ...localRoom, ...result } : localRoom;
        if (!mounted.current) return;
        setLocalRooms((previous) => [...previous.filter((entry) => entry.id !== room.id), room]);
        if (version === requestVersion.current) setStatus(room.id === localRoom.id ? `“${room.name}” added temporarily for this preview.` : `“${room.name}” added to your workspace.`);
      } else {
        await onJoinRoom(input);
        if (mounted.current && version === requestVersion.current) setStatus("Join request completed.");
      }
      if (mounted.current && version === requestVersion.current) setMode(null);
    } catch (cause) {
      if (mounted.current && version === requestVersion.current) setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      submissionLock.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  async function runAction(key, callback, argument) {
    if (actionLock.current) return;
    setStatus(""); setActionError("");
    if (typeof callback !== "function") {
      setStatus(key === "logout" ? "Logout isn't connected in this preview." : "Opening rooms isn't connected in this preview."); return;
    }
    actionLock.current = true; setPendingAction(key);
    try { if (key === "logout") await callback(); else await callback(argument); }
    catch (cause) { if (mounted.current) setActionError(cause instanceof Error ? cause.message : "Something went wrong. Please try again."); }
    finally { actionLock.current = false; if (mounted.current) setPendingAction(null); }
  }

  async function copyInviteCode(inviteCode) {
    setStatus("");
    setActionError("");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable in this browser.");
      }
      await navigator.clipboard.writeText(inviteCode);
      if (mounted.current) setStatus("Invite code copied.");
    } catch (cause) {
      if (mounted.current) setActionError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="sanctum-dashboard">
      <div ref={contentRef}>
        <header className="sd-header">
          <div className="sd-header-inner">
            <div className="sd-brand"><Icon kind="pencil" /><span>The Shared Sanctum</span><span className="sd-header-divider" /><span className="sd-workspace-label">Workspace</span></div>
            <div className="sd-profile">
              <div className="sd-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt={user.name || "Your profile"} /> : <span aria-label={user.name || "Guest"}>{initials}</span>}</div>
              <div className="sd-user-details"><p className="sd-user-name">{user.name || "Guest"}</p><p className="sd-user-caption">Your workspace</p></div>
              <button type="button" className="sd-icon-button" aria-label="Log out" title="Log out" disabled={Boolean(pendingAction)} onClick={() => runAction("logout", onLogout)}><Icon kind={pendingAction === "logout" ? "spinner" : "logout"} className={pendingAction === "logout" ? "sd-spin" : ""} /></button>
            </div>
          </div>
        </header>
        <main className="sd-main">
          <section className="sd-welcome" aria-labelledby="sd-welcome-heading">
            <div><p className="sd-eyebrow">a little room for big ideas</p><h1 id="sd-welcome-heading">Your space to <span>think.</span></h1><p className="sd-subtitle">Bring your ideas together, one board at a time.</p></div>
            <WelcomeArt />
          </section>
          <div className="sd-actions">
            <button type="button" className="sd-action" onClick={() => openModal("create")}><ActionArt className="sd-action-art" /><span><span className="sd-action-title">Create a room</span><span className="sd-action-copy">A blank canvas. Endless possibilities.</span></span><Icon kind="plus" className="sd-action-arrow" /></button>
            <button type="button" className="sd-action sd-action-join" onClick={() => openModal("join")}><ActionArt join className="sd-action-art" /><span><span className="sd-action-title">Join a room</span><span className="sd-action-copy">Pull up a chair. Bring your ideas.</span></span><Icon kind="arrow" className="sd-action-arrow" /></button>
          </div>
          {status && <p className="sd-status" role="status">{status}</p>}
          {actionError && <p className="sd-status sd-error" role="alert">{actionError}</p>}
          <section aria-labelledby="sd-rooms-heading">
            <div className="sd-section-heading"><h2 id="sd-rooms-heading">My Rooms</h2><span className="sd-room-total" aria-label={`${visibleRooms.length} rooms`}>{visibleRooms.length}</span><p className="sd-section-note">good things start here ↙</p></div>
            {visibleRooms.length ? <div className="sd-room-grid">
              {visibleRooms.map((room, index) => {
                const tone = TONES.includes(room.accent) ? room.accent : TONES[index % 3];
                const count = Number.isFinite(room.memberCount) ? Math.max(0, Math.floor(room.memberCount)) : 1;
                const actionKey = `open-${room.id}`;
                return <article className={`sd-room sd-tone-${tone}`} key={room.id}>
                  <div className="sd-room-cover"><span className="sd-role">{room.role === "owner" ? "Owner" : "Member"}</span><BoardArt variant={index} /></div>
                  <div className="sd-room-body"><h3>{room.name}</h3><p className="sd-member-count"><Icon kind="people" />{count} {count === 1 ? "member" : "members"}</p>
                    {room.role === "owner" && room.inviteCode && <div><p>Invite code: <code>{room.inviteCode}</code></p><button type="button" className="sd-button sd-button-secondary" onClick={() => copyInviteCode(room.inviteCode)}>Copy Invite Code</button></div>}
                    <div className="sd-room-footer"><div className="sd-member-dots" aria-hidden="true">{Array.from({ length: Math.min(count, 3) }, (_, i) => <span className="sd-member-dot" key={i}><Icon kind="pencil" /></span>)}{count > 3 && <span className="sd-member-dot">+{count - 3}</span>}</div>
                      <button type="button" className="sd-button sd-open-button" aria-label={`Open room ${room.name}`} disabled={Boolean(pendingAction)} onClick={() => runAction(actionKey, onOpenRoom, room)}>{pendingAction === actionKey ? "Opening…" : "Open Room"}<Icon kind={pendingAction === actionKey ? "spinner" : "arrow"} className={pendingAction === actionKey ? "sd-spin" : ""} /></button>
                    </div>
                  </div>
                </article>;
              })}
            </div> : <div className="sd-empty"><BoardArt className="sd-empty-art" /><h3>A blank page, a fresh beginning.</h3><p>Your first room is waiting to happen.</p><button type="button" className="sd-button" onClick={() => openModal("create")}><Icon kind="plus" />Create a room</button></div>}
          </section>
          <footer className="sd-footer">A shared space <Icon kind="star" /> for wandering minds.</footer>
        </main>
      </div>
      {mode && <Modal key={mode} mode={mode} submitting={submitting} error={error} onClose={closeModal} onSubmit={submit} />}
    </div>
  );
}