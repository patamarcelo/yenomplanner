export function trackEvent(name, params = {}) {
    if (typeof window === "undefined") return;

    if (typeof window.gtag !== "function") {
        console.log("[analytics blocked]", name, params);
        return;
    }

    window.gtag("event", name, {
        ...params,
        page_path: window.location.pathname,
        location: window.location.href,
    });
}