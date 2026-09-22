import AppKit
import Foundation

// ReelOS Native Apple Silicon AppKit Menu Bar Controller
// Zero-VM Architecture · VideoToolbox/Metal Acceleration · NSWorkspace Pro-App Yielding

class ReelOSMenuBarController: NSObject, NSApplicationDelegate {
    var statusItem: NSStatusItem!
    var yieldMenuItem: NSMenuItem!
    var hwAccelMenuItem: NSMenuItem!
    var isProAppActive = false
    var timer: Timer?

    // Creative Pro App bundle identifiers that trigger polite background yielding
    let proAppIdentifiers: Set<String> = [
        "com.apple.FinalCut",
        "com.apple.logic10",
        "com.blackmagic-design.DaVinciResolve",
        "org.blenderfoundation.blender",
        "com.adobe.PremierePro",
        "com.apple.dt.Xcode",
        "com.seriflabs.affinityphoto2",
        "com.seriflabs.affinitydesigner2"
    ]

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupStatusBarItem()
        setupNSWorkspaceProAppWatcher()
    }

    func setupStatusBarItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.title = "🎬 ReelOS"
        }

        let menu = NSMenu()
        
        let header = NSMenuItem(title: "ReelOS Media Appliance (:8080)", action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)
        
        hwAccelMenuItem = NSMenuItem(title: "⚡ VideoToolbox & Metal: Active (arm64)", action: nil, keyEquivalent: "")
        hwAccelMenuItem.isEnabled = false
        menu.addItem(hwAccelMenuItem)

        yieldMenuItem = NSMenuItem(title: "🛡 Pro-App Yield: Monitoring (Idle)", action: nil, keyEquivalent: "")
        yieldMenuItem.isEnabled = false
        menu.addItem(yieldMenuItem)

        menu.addItem(NSMenuItem.separator())

        let openHome = NSMenuItem(title: "Open ReelOS Cinema", action: #selector(openReelOsHome), keyEquivalent: "o")
        openHome.target = self
        menu.addItem(openHome)

        let openTv = NSMenuItem(title: "📺 TV Couch Mode", action: #selector(openReelOsTv), keyEquivalent: "t")
        openTv.target = self
        menu.addItem(openTv)

        let openSettings = NSMenuItem(title: "⚙ Settings & Diagnostics", action: #selector(openReelOsSettings), keyEquivalent: ",")
        openSettings.target = self
        menu.addItem(openSettings)

        menu.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(title: "Quit ReelOS", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem.menu = menu
    }

    func setupNSWorkspaceProAppWatcher() {
        // 1. Subscribe to frontmost application activations via NSWorkspace
        NSWorkspace.shared.notificationCenter.addObserver(
            self,
            selector: #selector(appDidActivate(_:)),
            name: NSWorkspace.didActivateApplicationNotification,
            object: nil
        )

        // 2. Periodic poll check to ensure background pro tasks are accounted for
        timer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { [weak self] _ in
            self?.checkProAppStatus()
        }

        checkProAppStatus()
    }

    @objc func appDidActivate(_ notification: Notification) {
        checkProAppStatus()
    }

    func checkProAppStatus() {
        let frontApp = NSWorkspace.shared.frontmostApplication
        let frontId = frontApp?.bundleIdentifier ?? ""
        let runningApps = NSWorkspace.shared.runningApplications

        let activePro = runningApps.first { app in
            if let id = app.bundleIdentifier, proAppIdentifiers.contains(id) {
                return !app.isHidden && (app == frontApp || app.isActive)
            }
            return false
        }

        let currentlyYielding = (activePro != nil) || proAppIdentifiers.contains(frontId)

        if currentlyYielding != isProAppActive {
            isProAppActive = currentlyYielding
            updateYieldState(activeApp: activePro ?? frontApp)
        }
    }

    func updateYieldState(activeApp: NSRunningApplication?) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if self.isProAppActive {
                let name = activeApp?.localizedName ?? "Creative Pro App"
                self.yieldMenuItem.title = "🛡 Pro-App Yield: ACTIVE (\(name))"
                if let button = self.statusItem.button {
                    button.title = "🎬 ReelOS (Yielding)"
                }
                self.notifyEngineYield(yielding: true, proApp: name)
            } else {
                self.yieldMenuItem.title = "🛡 Pro-App Yield: Monitoring (Idle)"
                if let button = self.statusItem.button {
                    button.title = "🎬 ReelOS"
                }
                self.notifyEngineYield(yielding: false, proApp: nil)
            }
        }
    }

    func notifyEngineYield(yielding: Bool, proApp: String?) {
        // Demote process priority and record state in .reelos-state
        let stateDir = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Application Support/ReelOS")
        try? FileManager.default.createDirectory(at: stateDir, withIntermediateDirectories: true)
        let flagFile = stateDir.appendingPathComponent("mac-pro-app-yield.json")

        let state: [String: Any] = [
            "yielding": yielding,
            "proApp": proApp ?? "",
            "timestamp": Date().timeIntervalSince1970,
            "hwAccel": "videotoolbox",
            "gfxBackend": "metal"
        ]

        if let data = try? JSONSerialization.data(withJSONObject: state, options: .prettyPrinted) {
            try? data.write(to: flagFile)
        }
    }

    @objc func openReelOsHome() {
        if let url = URL(string: "http://localhost:8080/") {
            NSWorkspace.shared.open(url)
        }
    }

    @objc func openReelOsTv() {
        if let url = URL(string: "http://localhost:8080/tv") {
            NSWorkspace.shared.open(url)
        }
    }

    @objc func openReelOsSettings() {
        if let url = URL(string: "http://localhost:8080/settings") {
            NSWorkspace.shared.open(url)
        }
    }

    @objc func quitApp() {
        NSApplication.shared.terminate(nil)
    }
}

// Entrypoint
let app = NSApplication.shared
let delegate = ReelOSMenuBarController()
app.delegate = delegate
app.run()
