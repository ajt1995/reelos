/* ReelOS request button inside Jellyfin web / TV web shell. Same household LAN. No Seerr. */
(function () {
  if (window.__reelosRequest) return;
  window.__reelosRequest = true;
  const origin = `${location.protocol}//${location.hostname}`;

  function ids(item) {
    const p = item?.ProviderIds || {};
    const tmdb = p.Tmdb || p.tmdb || "";
    const tvdb = p.Tvdb || p.tvdb || "";
    return { tmdb, tvdb };
  }

  async function currentItem() {
    const m = /[?&]id=([a-f0-9-]+)/i.exec(location.hash || location.search || "");
    if (!m || !window.ApiClient) return null;
    try {
      const uid = ApiClient.getCurrentUserId();
      return await ApiClient.getItem(uid, m[1]);
    } catch {
      return null;
    }
  }

  async function send(item) {
    const { tmdb, tvdb } = ids(item);
    const titleId = tmdb ? `tmdb-${tmdb}` : tvdb ? `tvdb-${tvdb}` : "";
    if (!titleId) {
      window.alert("No TMDB/TVDB id on this title.");
      return;
    }
    try {
      const r = await fetch(`${origin}/api/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: item.Name, titleId, tmdb, tvdb }),
      });
      const j = await r.json();
      window.alert(j.ok ? `Requested ${item.Name}` : j.error || "Request failed");
    } catch (e) {
      window.alert(String(e));
    }
  }

  function ensureBtn() {
    let b = document.getElementById("reelos-request-btn");
    if (!b) {
      b = document.createElement("button");
      b.id = "reelos-request-btn";
      b.type = "button";
      b.textContent = "Request in ReelOS";
      b.style.cssText =
        "position:fixed;z-index:9999;right:16px;bottom:16px;padding:12px 16px;border:0;border-radius:14px;background:#c4a574;color:#1a140c;font:600 14px/1 sans-serif;display:none";
      b.addEventListener("click", function () {
        currentItem().then(function (item) {
          if (item) send(item);
        });
      });
      document.body.appendChild(b);
    }
    currentItem().then(function (item) {
      const type = item && item.Type;
      const show = type === "Movie" || type === "Series";
      b.style.display = show ? "block" : "none";
    });
  }

  window.addEventListener("hashchange", ensureBtn);
  document.addEventListener("viewshow", ensureBtn, true);
  setInterval(ensureBtn, 2500);
})();
