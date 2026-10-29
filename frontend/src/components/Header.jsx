import { useState } from "react";

function Header({ undo, redo, canUndo, canRedo, onAllClear, saveStatus, onExport, onLogout, onInviteRoom, user, roomName }) {
  const [inviteFeedback, setInviteFeedback] = useState(null);

  async function handleInvite() {
    if (!onInviteRoom) return;
    setInviteFeedback(null);
    try {
      await onInviteRoom();
      setInviteFeedback({ message: "Invite link copied.", error: false });
    } catch (error) {
      console.error("Failed to copy room invitation:", error);
      setInviteFeedback({
        message: error instanceof Error ? error.message : "The invite link could not be copied.",
        error: true,
      });
    }
  }

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

      <button
        type="button"
        className="board-header-button board-invite-button"
        onClick={handleInvite}
        disabled={!onInviteRoom}
      >
        Invite
      </button>
      {inviteFeedback && (
        <span
          className={`board-invite-feedback${inviteFeedback.error ? " is-error" : ""}`}
          role={inviteFeedback.error ? "alert" : "status"}
        >
          {inviteFeedback.message}
        </span>
      )}
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