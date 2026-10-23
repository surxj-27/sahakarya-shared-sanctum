function Header({ undo, redo, canUndo, canRedo, onAllClear, saveStatus ,onExport}) {
  return (
    <header className="header flex-h-[70px] items-center justify-between border-b border-white/10 bg-[#1c1d25] px-6 text-white">
      <h2 className="text-lg font-bold tracking-tight"> The Sahakarya</h2>
      <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-grey-300"> Untitle board</div>
      <div className="text-sm text-gray-400">
  {saveStatus === "Saving..." ? "⏳ Saving..." :
   saveStatus === "Saved" ? "✓ Saved" :
   "⚠ Save failed"}
</div>
      <button
  onClick={undo}
  disabled={!canUndo}
  className="rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/10 disabled:opacity-30"
>
  Undo
</button>

<button
  onClick={redo}
  disabled={!canRedo}
  className="rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/10 disabled:opacity-30"
>
  Redo
</button>
<button
  onClick={onAllClear}
  className="rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
>
  All Clear
</button>

<button
  onClick={onExport}
  className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500"
>
  Export PNG
</button>

      <button className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium transition hover:bg-voilet-500"> Invite</button>

    </header>
  )
}
export default Header;