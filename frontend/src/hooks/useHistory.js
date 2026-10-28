import { useCallback, useRef, useState } from "react"

function useHistory(initialState) {
  const [past, setPast] = useState([])
  const [present, setPresent] = useState(initialState)
  const [future, setFuture] = useState([])
  const pastRef = useRef(past)
  const presentRef = useRef(present)
  const futureRef = useRef(future)
  const transactionRef = useRef(null)

  function resolveState(newState, currentState) {
    return typeof newState === "function"
      ? newState(currentState)
      : newState
  }

  const set = useCallback((newState) => {
    const nextState = resolveState(newState, presentRef.current)
    pastRef.current = [...pastRef.current, presentRef.current]
    setPast(pastRef.current)
    presentRef.current = nextState
    setPresent(nextState)
    futureRef.current = []
    setFuture([])
  }, [])

  const update = useCallback((newState) => {
    const nextState = resolveState(newState, presentRef.current)
    presentRef.current = nextState
    setPresent(nextState)
  }, [])

  const reset = useCallback((newState) => {
    pastRef.current = []
    setPast([])
    presentRef.current = newState
    setPresent(newState)
    futureRef.current = []
    setFuture([])
    transactionRef.current = null
  }, [])

  const beginTransaction = useCallback(() => {
    if (transactionRef.current === null) {
      transactionRef.current = presentRef.current
    }
  }, [])

  const commitTransaction = useCallback(() => {
    const startingState = transactionRef.current
    transactionRef.current = null
    if (startingState === null || Object.is(startingState, presentRef.current)) return

    pastRef.current = [...pastRef.current, startingState]
    setPast(pastRef.current)
    futureRef.current = []
    setFuture([])
  }, [])

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return
    const previous = pastRef.current[pastRef.current.length - 1]
    futureRef.current = [presentRef.current, ...futureRef.current]
    setFuture(futureRef.current)
    presentRef.current = previous
    setPresent(previous)
    pastRef.current = pastRef.current.slice(0, -1)
    setPast(pastRef.current)
  }, [])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return
    const next = futureRef.current[0]
    pastRef.current = [...pastRef.current, presentRef.current]
    setPast(pastRef.current)
    presentRef.current = next
    setPresent(next)
    futureRef.current = futureRef.current.slice(1)
    setFuture(futureRef.current)
  }, [])

  const getState = useCallback(() => presentRef.current, [])

  return {
    state: present,
    getState,
    set,
    update,
    reset,
    beginTransaction,
    commitTransaction,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0
  }
}

export default useHistory