# Ticket: ReelOS Windows Setup & Appliance Launcher

**Status:** Approved for Production / Master Release  
**Author:** ReelOS Core (`reelos-org`) / Pair  
**Target:** Windows 10/11 Desktop Utility (`ReelOS Setup.exe`)  
**Design Standard:** ReelOS v1.6 Cinematic Obsidian & Gold (`src/styles.css`, `Outfit` sans + `Inter` body, Obsidian `#0b0d10`, Gold `#d4a017`, Live Cyan `#3ec6d8`)

---

## 1. Executive Overview & Objectives

Currently, deploying ReelOS requires users to either:
1. Manually flash a raw bootable ISO using third-party generic software (Rufus in DD mode, balenaEtcher, or Linux `dd`), or
2. Manually provision a local hypervisor testbench using command-line scripts.

This creates onboarding friction for non-technical users, introduces catastrophic risk of formatting physical system disks, and disconnects the setup experience from the ReelOS luxury cinematic design system.

This specification defines the dedicated, lightweight Windows executable (**`ReelOS Setup.exe`**) providing a seamless, automated dual-path setup experience:
1. **Flash Dedicated USB Appliance (Bare-Metal Production):** Safely write the bootable ReelOS appliance ISO directly to a thumb drive for deployment to a dedicated PC, mini PC (Intel N100), thin client, or spare laptop.
2. **Run as Silent Background VM (Local Virtual Lab):** Provision, configure, and boot an isolated ReelOS virtual machine right inside Windows using Hyper-V / WHPX with zero risk to physical drives, auto-forwarded ports, and automatic browser launch to the taste onboarding studio.

---

## 2. Design System & Visual Tokens

The utility strictly follows the active ReelOS v1.6 design language defined in `src/styles.css` and `src/components/wizard.tsx`.

### Core Color & Surface Palette
- **Canvas / Root Background:** `--color-background: #0b0d10` (obsidian/deep charcoal)
- **Elevated Surfaces:** 
  - Standard Card: `--color-card: #181c24` (frosted obsidian)
  - Interactive / Accent Card: `--color-card-2: #1e232c` (elevated surface)
- **Borders:** Thin hairline borders (`rgba(243, 244, 246, 0.08)`, active/hover `rgba(243, 244, 246, 0.16)`)
- **Brand Accents:**
  - Warm Luxury Gold: `--color-gold: #d4a017`
  - Bright Gold Highlight: `--color-gold-bright: #e8b84a`
  - Gold Foreground (on gold buttons): `--color-gold-fg: #1a1406`
  - Circuit Cyan Accent: `--color-live: #3ec6d8` (status pulse & telemetry)
- **State Feedback:** Clean status pills (`ready`, `writing`, `verifying`, `done`) with pulsing 6px indicators. No arbitrary fake percentage animations.
- **Typography Hierarchy:**
  - **Headings & Brand Title:** `Outfit`, semibold/bold modern geometric sans.
  - **Body Copy & Instructions:** `Inter`, quiet neutral sans (`tracking-[-0.011em]`, `leading-relaxed`).
  - **Drives, Paths & Telemetry:** Monospace (`ui-monospace`, `SF Mono`, `Consolas`).

---

## 3. User Flows & Screen Specifications

### Screen 1 — Launch & Mode Selection (`screen-1-mode-selection.png`)
- **Header:**
  - ReelMark icon with subtle spinning cyan accent ring (`#3ec6d8`) + `ReelOS` wordmark in gold Outfit font.
  - Kicker badge: `REELOS SETUP · WINDOWS`.
- **Title:** `How would you like to run ReelOS?`
- **Subtitle:** `Select a deployment mode. Both options include full automated zero-touch setup.`
- **Two Side-by-Side Interactive Selection Cards:**
  - **Card A: Flash Dedicated USB Appliance** (`Bare Metal · Recommended`)
    - Icon: `Usb` (gold container).
    - Description: *Write the bootable appliance image to a USB drive for a spare PC, mini PC (N100), or laptop. Boots into pure appliance mode with zero background Windows overhead.*
    - Badge: `Zero Noise · Full Appliance Power`.
  - **Card B: Run inside Windows as a Silent VM** (`Virtual Lab`)
    - Icon: `MonitorPlay` (cyan container).
    - Description: *Create an isolated virtual machine right on this Windows PC using Hyper-V / WHPX. Perfect for testing without touching physical drives.*
    - Badge: `Instant Setup · Isolated Disk`.
- **Selection Visual:** Active card highlights with `border-gold bg-gold/5 shadow-[var(--shadow-gold)]` and a circular gold checkmark badge.
- **Primary CTA:** Gold button `bg-gold text-gold-fg font-semibold rounded-xl px-6 py-3 hover:bg-gold-bright transition-all` labeled `Select USB Drive` or `Configure Virtual Machine`.

---

### Screen 2A — Virtual Machine Configuration (`screen-2a-vm-configuration.png`)
- **Step Indicator:** `02 / 02`.
- **Title:** `Virtual Machine Configuration`.
- **Subtitle:** `ReelOS will provision an isolated virtual appliance on this Windows PC.`
- **Hardware Advisor Card:**
  - Automatically audits host CPU, RAM, and GPU capabilities.
  - GPU Detection: Explains hardware offloading availability (NVIDIA NVENC, Intel QuickSync QSV, or AMD AMF).
  - Compute Allocation Slider:
    - RAM: 4 GB default (range 2 GB – 8 GB).
    - CPU Cores: 2 Cores default (range 1 – 4 Cores).
- **Virtual Disk Spec:**
  - 40 GB dynamic sparse VHDX (consumes $< 1\text{ GB}$ initially on physical disk).
- **Networking:** Default Switch with bridged LAN port forwarding (`8080 -> 80` for ReelOS Web Wizard, `2222 -> 22` for SSH).
- **Primary CTA:** `Deploy & Start Lab` (triggers automated creation, starts VM, and automatically opens default browser to `http://localhost:8080`).

---

### Screen 2B — USB Drive Flasher (`screen-2b-usb-flasher.png`)
- **Step Indicator:** `02 / 02`.
- **Title:** `Flash Installation Drive`.
- **Subtitle:** `Write the bootable appliance image to your target removable drive.`
- **Removable Drive Selector:**
  - Scans and lists only genuine USB removable storage devices.
  - Displays Drive Letter, Friendly Model Name, Total Size (GB), and Bus Type.
  - **Strict Safeguard:** Any internal NVMe, SATA, system, or boot disk is completely filtered out and hidden.
- **Safety Warning:** Clear callout explaining that the chosen USB drive will be completely reformatted.
- **Primary CTA:** `Flash Drive` (triggers confirmation modal).

---

### Screen 3B & 4 — Confirmation & Flashing Progress (`screen-3b-usb-flashing.png`, `screen-4-usb-confirm-modal.png`)
- **Confirmation Modal (`screen-4`):**
  - High-visibility modal requiring explicit confirmation: *"Erase [Drive Name] ([Size] GB)?"*.
  - Warning: *"All existing files on this removable USB drive will be permanently erased."*.
  - Dual actions: `Cancel` (quiet) vs. `Erase & Flash Drive` (gold primary).
- **Flashing Progress (`screen-3b`):**
  - Lock volume and dismount filesystem via Win32 API.
  - Write raw ISO sectors in DD streaming mode.
  - Live progress telemetry: Megabytes written, transfer rate (MB/s), and real-time status pill (`writing` → `verifying`).
  - Read-after-write checksum validation.

---

### Screen 5 — USB Flash Success (`screen-5-usb-flash-success.png`)
- **State Badge:** `✓ Flash Complete · Ready to Boot`.
- **Next Steps Guide:**
  1. Insert the USB drive into your target PC or laptop.
  2. Turn on the PC and press the Boot Menu key (`F12`, `F11`, or `Delete`).
  3. Select the USB drive to launch the automated ReelOS installation.
  4. Once complete, browse to `http://reelos.local:8080` from your phone or laptop.
- **Primary Action:** `Safely Eject & Exit`.

---

## 4. Technical Architecture & Engine Implementation

### Recommended Framework
- **Tauri v2 (Rust Backend + React / Vite Frontend):**
  - **Lightweight Footprint:** $< 15\text{ MB}$ standalone executable (no massive Chromium/Electron bloat).
  - **Direct Win32 Access:** Native Rust access to Win32 raw volume handles (`CreateFileW`, `FSCTL_LOCK_VOLUME`, `FSCTL_DISMOUNT_VOLUME`, `SetFilePointerEx`, `WriteFile`).
  - **Design System Sharing:** Uses the exact Tailwind CSS tokens, icons (`lucide-react`), and UI components from the main ReelOS web application.

### Drive Safeguards & Verification
1. **Drive Filtering Engine:**
   - Queries `Win32_DiskDrive` and `MSFT_Disk` via PowerShell/CIM:
     ```powershell
     Get-Disk | Where-Object { $_.BusType -eq 'USB' -and $_.IsSystem -eq $false -and $_.IsBoot -eq $false }
     ```
   - Rejects any drive flagged as `IsSystem`, `IsBoot`, `BusType != 'USB'`, or containing the Windows operating system partition.
2. **Raw Disk Writing:**
   - Acquired volume lock (`FSCTL_LOCK_VOLUME`) to prevent Windows explorer write conflicts.
   - Streamed 4MB write chunks directly to `\\.\PhysicalDriveX`.
3. **Hyper-V / WHPX VM Engine:**
   - Powershell orchestration leveraging [`scripts/setup-vm-testbench.ps1`](file:///C:/Users/austi/reelos/scripts/setup-vm-testbench.ps1):
     - Checks `Microsoft-Hyper-V-All` or `HypervisorPlatform` (WHPX).
     - Automated `New-VM` generation with UEFI Secure Boot enabled.
     - Port forwarding verification with automated browser launching.

---

## 5. Acceptance Criteria

- [x] Modernized UI specification matching ReelOS v1.6 Obsidian/Gold visual language.
- [x] Dual-mode selection between bare-metal USB flashing and local VM deployment.
- [x] Strict physical drive protection: refuses to display or touch internal/system disks.
- [x] Integrated Intelligent Hardware & GPU Advisor (NVENC, QuickSync, AMF, compute allocation).
- [x] Virtual Lab mode automates Hyper-V / WHPX provisioning with browser launch to `http://localhost:8080`.
- [x] Checksum verification pass and safe drive ejection upon write completion.
- [x] Zero technical jargon exposed to users (no raw MBR/GPT, partition offset, or cluster size prompts).
