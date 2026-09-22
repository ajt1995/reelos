# ReelOS Telemetry & Privacy Notice

*A plain-English guide for friends and family running a ReelOS house appliance.*

---

## 1. Overview & Core Philosophy

ReelOS is designed as an independent, self-hosted appliance that turns spare hardware into a private home media and book server. 

The privacy model is simple: **Your box is your box.** 

ReelOS does not have an advertising business model, does not partner with data brokers, and does not include commercial telemetry or user-tracking SDKs. The software is built to give you full control over your media without anyone peeking over your shoulder.

---

## 2. What Leaves Your Box (And Where It Goes)

ReelOS communicates over the internet only to perform functions necessary to keep the system running, updated, and connected to the media sources you specify.

### A. Software Update Checks (OTA)
* **Destination:** GitHub (`api.github.com`, `raw.githubusercontent.com`)
* **What happens:** Your box checks the project’s release channels (`channel.json` / `channel-beta.json`) to see if an update or bugfix is available.
* **Data transmitted:** Standard outbound HTTPS web request metadata (GitHub receives your public IP address and the project's user-agent header).

### B. Diagnostic Bug Snapshots (`reelos-house.txt`)
* **Destination:** Stays locally on your box by default (`/var/lib/reelos/bugs/`).
* **What triggers it:** Generated automatically when an over-the-air update fails, when the system doctor encounters a critical error, or manually when you open **Settings → Logs**.
* **What is in the snapshot:**
  * ReelOS release version and git commit SHA.
  * System health checks (status of local ports `:80`, `:8080`, and Jellyfin `:8096`).
  * Docker container status table (`docker ps`).
  * System mount status (verifying whether `/mnt/debrid` or storage volumes are mounted).
  * Recent log lines from `ota.log`, `wire.log`, `reelos.service`, and `caddy.service`.
  * Total counts of TV series and movies indexed locally.
* **Automatic Redaction:** ReelOS automatically runs log outputs through a credential scrubber (`redactLogs`) before saving or displaying them. All known API keys, Bearer tokens, authorization headers, and passwords are removed and replaced with `***`.

> [!NOTE]
> **Automatic GitHub Bug Reporting (Optional):**
> If you or an administrator save a GitHub Personal Access Token in **Settings → Logs**, the box will automatically file an issue labeled `house` on the developer repository (`reelos-org/reelos`) whenever an update or startup fails. If no token is provided, **nothing is ever transmitted automatically**.

### C. Direct Metadata & Media Lookups
* **Destination:** Third-party catalog APIs (e.g., TMDB, Open Library, Project Gutenberg, Standard Ebooks) and your configured Debrid provider (e.g., Real-Debrid).
* **What happens:** When you search for a movie, television show, or book, your box queries those providers directly from your home network to fetch cover art, summaries, and streams.
* **Data transmitted:** Search terms and API keys are sent directly to those third-party providers. None of this data is routed through or visible to ReelOS maintainers.

---

## 3. What Is Never Collected or Monitored

ReelOS does **not** collect or log:

* **Viewing & Reading Activity:** What you watch, search for, read, or pause at any hour of the day is completely private to your household.
* **Stored Media Content:** Your personal files, home videos, and media collection details are never transmitted to external servers.
* **Private Credentials:** Debrid tokens, administrative passwords, and WiFi keys remain encrypted or locked to local system configuration files.
* **Third-Party Behavioral Trackers:** ReelOS includes no Google Analytics, PostHog, Mixpanel, Sentry, Datadog, or social tracking pixels.

---

## 4. Your Privacy Controls

| Feature | Where to manage | How it works |
| :--- | :--- | :--- |
| **Bug Reporting** | **Settings → Logs** | Leave the GitHub token field empty to ensure bug snapshots never leave the box automatically. |
| **Log Inspection** | **Settings → Logs** | Click **Refresh**, **Copy**, or **Download** (`reelos-house.txt`) to inspect exactly what the system sees. |
| **Remote Access** | **Settings → Remote Access** | Tailscale and Cloudflare tunnels are strictly opt-in and disabled by default. |
| **Admin Password** | **Settings → Accounts** | Change the default `reelos` / `reelos` password immediately after initial setup. |

---

## 5. Contact & Support

If you run into an issue with your box, you can review your diagnostic logs at any time in **Settings → Logs** or download `reelos-house.txt` and text/send it directly to the person who set up your box.
