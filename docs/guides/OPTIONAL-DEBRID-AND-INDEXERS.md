# Optional Third-Party Providers & Custom Indexers Guide
## Community Configuration Manual for ReelOS (Plex / Jellyfin Model)

---

## 🏛️ Legal Notice & Community Disclaimer

ReelOS is 100% sovereign, independent personal cinema software and home appliance firmware. 

Out of the box, ReelOS:
- Contains **no pre-configured debrid credentials or commercial scraping accounts**.
- Bundles **no torrents, magnets, pirate indexers, or unauthorized media streams**.
- Operates exclusively on **personal local media** (your own home video files, ripped discs, and authorized digital files) and **curated public-domain cinema**.

Connecting external third-party cloud debrid services (such as TorBox or Real-Debrid) or private custom indexers (such as private Torznab/Newznab servers) is **entirely optional, self-hosted, and at the sole discretion of the household owner**, exactly as it is when configuring third-party plugins in Plex, Jellyfin, Kodi, or Stremio. ReelOS does not host, provide, manage, or affiliate with any external provider.

---

## 1. How to Obtain an Optional Debrid API Key

If you wish to use an external debrid service to stream cached cloud content over encrypted HTTPS:

1. Visit your preferred provider's official website:
   - **TorBox**: [https://torbox.app](https://torbox.app)
   - **Real-Debrid**: [https://real-debrid.com](https://real-debrid.com)
2. Create or log into your personal account.
3. Locate your personal API Key / Secret Token:
   - On TorBox: Navigate to **Settings** $\rightarrow$ **API** $\rightarrow$ Copy your **API Key**.
   - On Real-Debrid: Navigate to **My Account** $\rightarrow$ **API Token** $\rightarrow$ Copy the private key.
4. Keep this key private. Never share it publicly or commit it to version control.

---

## 2. Configuring Your Debrid Key in ReelOS

Once you have your personal key, you can activate it directly from the ReelOS interface:

1. Open ReelOS on your computer, tablet, or phone (`http://localhost:8080` or `http://reelos.local:8080`).
2. Navigate to **Settings** (`/settings`) from the navigation menu or resident avatar.
3. Scroll down and open the **Sources & Providers** section.
4. Set **Debrid Provider Integration** to **Enabled**.
5. Select your provider from the dropdown:
   - `TorBox` (Default)
   - `Real-Debrid`
6. Paste your private API key into the **API Key** field.
7. Click **Test & Verify Connection**:
   - ReelOS securely transmits the key directly from your local server to the provider over HTTPS.
   - The status will change to **Connected** with a green checkmark once verified.
   - If the key is invalid or expired, ReelOS will report an honest connection error and remain in safe `public-personal` mode.

> [!NOTE]
> All credentials are encrypted and stored strictly on your local machine (`.reelos-state/credentials.json`). They are never uploaded to any central ReelOS server or external telemetry service.

---

## 3. Configuring Custom Private Indexers (Torznab / Newznab)

ReelOS ships with a clean template at `config/indexer-presets.example.json`. To connect your own custom indexers:

1. On your host computer or appliance, navigate to the ReelOS configuration folder:
   - **Windows**: `%APPDATA%\ReelOS\config\`
   - **Debian Linux Appliance**: `/etc/reelos/config/` or `~/.reelos/config/`
2. Copy `indexer-presets.example.json` to a new file named `indexer-presets.json`:
   ```bash
   cp config/indexer-presets.example.json config/indexer-presets.json
   ```
3. Open `indexer-presets.json` in your favorite text editor.
4. Add your authorized custom indexers using the standard Torznab format:
   ```json
   {
     "schemaVersion": 1,
     "presets": [
       {
         "id": "my-private-tracker",
         "displayName": "My Private Torznab",
         "name": "private-indexer-1",
         "role": "both",
         "type": "torznab",
         "mirrors": [
           "https://my-indexer.example.com/api?apikey=YOUR_PERSONAL_INDEXER_KEY"
         ]
       }
     ]
   }
   ```
5. Save the file and restart ReelOS or click **Reload Sources** in Settings.

---

## 4. Built-in Safeguards & Architectural Protections

When third-party providers are configured, ReelOS automatically engages two vital safeguards:

### A. The Strict Zero-P2P ISP Shield
ReelOS **never** initiates direct peer-to-peer (P2P) BitTorrent connections from your home IP address. 
- All media bytes are downloaded or streamed exclusively over TLS-encrypted HTTPS directly from the cloud provider's servers.
- Your home IP address is never announced to public torrent swarms or peer trackers.

### B. Single-Pipe Token-Bucket Rate Limiter
To prevent your personal TorBox or Real-Debrid account from being banned or rate-limited (HTTP 429):
- All household devices (TV, phones, laptops) route their requests through a unified local token bucket.
- Background pre-caching automatically pauses if provider rate limits are approached, prioritizing live active playback.

---

## 5. Disabling or Removing Providers

To revert ReelOS to pure personal/public-domain mode at any time:
1. Return to **Settings** $\rightarrow$ **Sources & Providers**.
2. Toggle the integration to **Disabled** or click **Disconnect & Clear Credentials**.
3. All third-party streaming routes are immediately revoked. Your local personal files, watch history, and profiles remain intact.
