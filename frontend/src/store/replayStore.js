import { create } from 'zustand';
import ReplayService from '../services/ReplayService';

/**
 * replayStore — Zustand store for managing execution replay state.
 * Keeps replay state strictly decoupled from graph canvas state.
 */
const useReplayStore = create((set, get) => ({
  // ─── State ──────────────────────────────────────────────────────────────────
  isReplayActive: false,
  selectedExecution: null,
  snapshots: [],
  timelineCursor: ReplayService.createCursor(0, []),
  mode: 'normal', // 'normal' | 'step-by-step' | 'debug'
  speed: 1, // 0.5 | 1 | 2 | 5
  isPlaying: false,
  isPaused: false,
  inspectorNodeId: null,
  activeTab: 'inspector', // 'inspector' | 'events' | 'stats'
  timerId: null,

  // ─── Actions ────────────────────────────────────────────────────────────────

  /**
   * Initializes replay for an execution log.
   */
  startReplay: (execution, workflowNodes = []) => {
    if (get().timerId) clearInterval(get().timerId);

    const snapshots = ReplayService.buildSnapshots(execution, workflowNodes);
    const timelineCursor = ReplayService.createCursor(0, snapshots);

    set({
      isReplayActive: true,
      selectedExecution: execution,
      snapshots,
      timelineCursor,
      isPlaying: false,
      isPaused: false,
      inspectorNodeId: snapshots[0]?.nodeId || null,
      timerId: null,
    });
  },

  /**
   * Exits replay mode and cleans up timers.
   */
  stopReplay: () => {
    if (get().timerId) clearInterval(get().timerId);
    set({
      isReplayActive: false,
      selectedExecution: null,
      snapshots: [],
      timelineCursor: ReplayService.createCursor(0, []),
      isPlaying: false,
      isPaused: false,
      inspectorNodeId: null,
      timerId: null,
    });
  },

  /**
   * Plays/resumes replay animation loop.
   */
  play: () => {
    const { isPlaying, snapshots, timelineCursor, speed, mode } = get();
    if (isPlaying) return;

    // If at end, restart from beginning
    let startIndex = timelineCursor.index;
    if (startIndex >= snapshots.length - 1) {
      startIndex = 0;
    }

    set({ isPlaying: true, isPaused: false });

    // Step interval calculated from speed (base 1000ms / speed)
    const intervalMs = Math.max(150, Math.round(1000 / speed));

    const timerId = setInterval(() => {
      const { timelineCursor: currCursor, snapshots: currentSnaps, mode: currentMode } = get();
      const nextIdx = currCursor.index + 1;

      if (nextIdx >= currentSnaps.length) {
        // Replay completed
        clearInterval(get().timerId);
        set({ isPlaying: false, isPaused: false, timerId: null });
        return;
      }

      const nextCursor = ReplayService.createCursor(nextIdx, currentSnaps);
      const nextSnap = currentSnaps[nextIdx];

      set({
        timelineCursor: nextCursor,
        inspectorNodeId: nextSnap?.nodeId || get().inspectorNodeId,
      });

      // If Debug mode, pause after every snapshot frame until user resumes
      if (currentMode === 'debug') {
        clearInterval(get().timerId);
        set({ isPlaying: false, isPaused: true, timerId: null });
      }
    }, intervalMs);

    set({ timerId, timelineCursor: ReplayService.createCursor(startIndex, snapshots) });
  },

  /**
   * Pauses replay.
   */
  pause: () => {
    if (get().timerId) clearInterval(get().timerId);
    set({ isPlaying: false, isPaused: true, timerId: null });
  },

  /**
   * Restarts replay from step 0.
   */
  restart: () => {
    if (get().timerId) clearInterval(get().timerId);
    const { snapshots } = get();
    const timelineCursor = ReplayService.createCursor(0, snapshots);

    set({
      timelineCursor,
      isPlaying: false,
      isPaused: false,
      inspectorNodeId: snapshots[0]?.nodeId || null,
      timerId: null,
    });
  },

  /**
   * Step forward 1 snapshot frame.
   */
  stepForward: () => {
    if (get().timerId) clearInterval(get().timerId);
    const { snapshots, timelineCursor } = get();
    const nextIdx = Math.min(timelineCursor.index + 1, snapshots.length - 1);
    const nextCursor = ReplayService.createCursor(nextIdx, snapshots);
    const nextSnap = snapshots[nextIdx];

    set({
      timelineCursor: nextCursor,
      isPlaying: false,
      isPaused: true,
      inspectorNodeId: nextSnap?.nodeId || get().inspectorNodeId,
      timerId: null,
    });
  },

  /**
   * Step backward 1 snapshot frame.
   */
  stepBackward: () => {
    if (get().timerId) clearInterval(get().timerId);
    const { snapshots, timelineCursor } = get();
    const prevIdx = Math.max(timelineCursor.index - 1, 0);
    const prevCursor = ReplayService.createCursor(prevIdx, snapshots);
    const prevSnap = snapshots[prevIdx];

    set({
      timelineCursor: prevCursor,
      isPlaying: false,
      isPaused: true,
      inspectorNodeId: prevSnap?.nodeId || get().inspectorNodeId,
      timerId: null,
    });
  },

  /**
   * Seeks timeline cursor directly to a target snapshot index.
   */
  seekTo: (targetIndex) => {
    const { snapshots } = get();
    const timelineCursor = ReplayService.createCursor(targetIndex, snapshots);
    const targetSnap = snapshots[timelineCursor.index];

    set({
      timelineCursor,
      inspectorNodeId: targetSnap?.nodeId || get().inspectorNodeId,
    });
  },

  /**
   * Jump to a specific execution event by event id.
   */
  jumpToEvent: (eventId) => {
    const { snapshots } = get();
    const targetIndex = snapshots.findIndex((snap) =>
      snap.events?.some((evt) => evt.id === eventId)
    );
    if (targetIndex !== -1) {
      get().seekTo(targetIndex);
    }
  },

  /**
   * Sets playback speed (0.5x, 1x, 2x, 5x).
   */
  setSpeed: (speed) => {
    set({ speed });
    if (get().isPlaying) {
      get().pause();
      get().play();
    }
  },

  /**
   * Sets replay mode ('normal', 'step-by-step', 'debug').
   */
  setMode: (mode) => set({ mode }),

  /**
   * Sets selected node ID for inspector display.
   */
  setInspectorNodeId: (inspectorNodeId) => set({ inspectorNodeId }),

  /**
   * Sets active panel tab ('inspector' | 'events' | 'stats').
   */
  setActiveTab: (activeTab) => set({ activeTab }),
}));

export default useReplayStore;
