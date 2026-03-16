const CHUNK_RELOAD_KEY = "yenomplanner_chunk_reload_once";

export function isDynamicImportError(errorLike) {
    const message = String(
        errorLike?.message ||
        errorLike?.reason?.message ||
        errorLike ||
        ""
    );

    return (
        message.includes("Failed to fetch dynamically imported module") ||
        message.includes("Importing a module script failed") ||
        message.includes("ChunkLoadError") ||
        message.includes("Loading chunk")
    );
}

export function tryReloadOnce() {
    const alreadyReloaded =
        sessionStorage.getItem(CHUNK_RELOAD_KEY) === "true";

    if (!alreadyReloaded) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, "true");
        window.location.reload();
        return true;
    }

    return false;
}

export function clearChunkReloadFlag() {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
}

export function resetReloadFlagSoon() {
    window.addEventListener(
        "load",
        () => {
            setTimeout(() => {
                clearChunkReloadFlag();
            }, 1500);
        },
        { once: true }
    );
}

export function registerGlobalChunkHandlers() {
    window.addEventListener("error", (event) => {
        const err = event?.error || event?.message;

        if (isDynamicImportError(err)) {
            tryReloadOnce();
        }
    });

    window.addEventListener("unhandledrejection", (event) => {
        if (isDynamicImportError(event?.reason)) {
            tryReloadOnce();
        }
    });
}