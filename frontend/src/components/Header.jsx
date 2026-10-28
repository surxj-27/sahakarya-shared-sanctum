function Header({ undo, redo, canUndo, canRedo, onAllClear, saveStatus, onExport, onLogout, user, roomName }) {
  return (
    <header className="board-header">
      <div className="board-header-identity">
        <div className="board-brand-mark" aria-hidden="true">S</div>
        <div className="board-room-heading">
          <span className="board-brand-name">The Shared Sanctum</span>
          <h1>{roomName || "Your canvas"}</h1>
        </div>
      </div>
      <div className={`board-save-status ${saveStatus === "Saved" ? "is-saved" : saveStatus === "Saving..." ? "is-saving" : "is-error"}`} role="status">
        <span className="board-status-dot" aria-hidden="true" />
        {saveStatus === "Saving..." ? "Saving changes" : saveStatus === "Saved" ? "All changes saved" : "Save failed"}
      </div>
      <div className="board-header-actions">
      <button
  onClick={undo}
  disabled={!canUndo}
  className="board-header-button"
>
  Undo
</button>

<button
  onClick={redo}
  disabled={!canRedo}
  className="board-header-button"
>
  Redo
</button>
<button
  onClick={onAllClear}
  className="board-header-button board-clear-button"
>
  All Clear
</button>

<button
  onClick={onExport}
  className="board-header-button board-export-button"
>
  Export PNG
</button>

      <button className="board-header-button board-invite-button">Invite</button>
      <button
  onClick={onLogout}
  className="board-header-button board-logout-button"
>
  Logout
</button>
      </div>
<div className="board-user">
{user && (
  <div>
    <p className="board-user-name">{user.name}</p>
    <p className="board-user-email">{user.email}</p>
  </div>
)}
</div>
    </header>
  )
}
export default Header;