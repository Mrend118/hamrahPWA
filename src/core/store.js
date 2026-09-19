export function createStore(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    get() {
      return state;
    },
    set(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((listener) => {
        try {
          listener(state);
        } catch (error) {
          console.error("[store] خطا در شنونده", error);
        }
      });
      return state;
    },
    /** @returns {() => void} تابع لغو اشتراک */
    subscribe(listener, { immediate = false } = {}) {
      listeners.add(listener);
      if (immediate) listener(state);
      return () => listeners.delete(listener);
    },
  };
}
