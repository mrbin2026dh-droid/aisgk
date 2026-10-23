// Static Pages uses the hosted API; preserve an explicitly configured LAN API.
try {
  if (!localStorage.getItem("AISGK_BACKEND_URL")) {
    localStorage.setItem("AISGK_BACKEND_URL", "https://aisgk.onrender.com/api");
  }
} catch {
  // On github.io app.js selects the hosted API even with storage disabled.
}
