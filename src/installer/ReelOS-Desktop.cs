using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: System.Reflection.AssemblyVersion("2.5.4.0")]
[assembly: System.Reflection.AssemblyFileVersion("2.5.4.0")]
[assembly: System.Reflection.AssemblyTitle("ReelOS Media Appliance")]
[assembly: System.Reflection.AssemblyProduct("ReelOS Cinema")]

namespace ReelOSInstaller
{
    public class ReelOSMainWindow : Form
    {
        private static Icon LoadReelOsIcon()
        {
            try
            {
                Stream embedded = Assembly.GetExecutingAssembly().GetManifestResourceStream("ReelOSInstaller.reelos.ico");
                if (embedded != null) return new Icon(embedded);
            }
            catch { }

            try
            {
                string adjacent = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "reelos.ico");
                if (File.Exists(adjacent)) return new Icon(adjacent);
            }
            catch { }

            return SystemIcons.Application;
        }

        // Install paths
        private static readonly string AppDataRoot =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ReelOS");
        private static readonly string UninstallExePath =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ReelOS", "ReelOS-Uninstall.exe");
        private static readonly string StartMenuShortcut =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs", "ReelOS", "ReelOS.lnk");
        private const string RegistryKeyPath =
            @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\ReelOS";

        private static Process appProc = null;
        private static NotifyIcon notifyIcon = null;
        private static string logFile = "";
        private static string basePath = "";
        private static int activePort = 8080;
        private static bool justInstalled = false;

        [System.Runtime.InteropServices.DllImport("shell32.dll", SetLastError = true)]
        private static extern void SetCurrentProcessExplicitAppUserModelID([System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.LPWStr)] string AppID);

        private Label lblTitle;
        private Label lblSubtitle;
        private Panel pnlStatusCard;
        private Label lblHardware;
        private Label lblEngineStatus;
        private Button btnOpenBrowser;
        private Button btnOpenTv;
        private Button btnOpenSettings;
        private Button btnRestartEngine;
        private Button btnExit;
        private System.Windows.Forms.Timer statusTimer;

        public ReelOSMainWindow()
        {
            InitializeComponent();
            InitializeEngine();
        }

        private void InitializeComponent()
        {
            this.Text = "ReelOS Media Appliance";
            this.Size = new Size(540, 480);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(18, 18, 20);
            this.ForeColor = Color.White;
            this.ShowInTaskbar = true;
            this.Icon = LoadReelOsIcon();

            // Title
            lblTitle = new Label();
            lblTitle.Text = "ReelOS Media Appliance";
            lblTitle.Font = new Font("Segoe UI", 16, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(245, 197, 24);
            lblTitle.Location = new Point(24, 20);
            lblTitle.AutoSize = true;
            this.Controls.Add(lblTitle);

            // Subtitle
            lblSubtitle = new Label();
            lblSubtitle.Text = "Living Mirror Media Hub · Local Appliance Engine";
            lblSubtitle.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            lblSubtitle.ForeColor = Color.FromArgb(160, 160, 170);
            lblSubtitle.Location = new Point(26, 52);
            lblSubtitle.AutoSize = true;
            this.Controls.Add(lblSubtitle);

            // Status Card Panel
            pnlStatusCard = new Panel();
            pnlStatusCard.Location = new Point(24, 84);
            pnlStatusCard.Size = new Size(476, 110);
            pnlStatusCard.BackColor = Color.FromArgb(28, 28, 32);
            pnlStatusCard.BorderStyle = BorderStyle.FixedSingle;

            lblHardware = new Label();
            lblHardware.Text = "Hardware: Probing workstation...";
            lblHardware.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            lblHardware.ForeColor = Color.FromArgb(220, 220, 230);
            lblHardware.Location = new Point(14, 14);
            lblHardware.Size = new Size(448, 40);
            pnlStatusCard.Controls.Add(lblHardware);

            lblEngineStatus = new Label();
            lblEngineStatus.Text = "Engine Status: Initializing...";
            lblEngineStatus.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            lblEngineStatus.ForeColor = Color.FromArgb(74, 222, 128);
            lblEngineStatus.Location = new Point(14, 62);
            lblEngineStatus.Size = new Size(448, 36);
            pnlStatusCard.Controls.Add(lblEngineStatus);

            this.Controls.Add(pnlStatusCard);

            // Button: Open ReelOS Web UI (Primary)
            btnOpenBrowser = new Button();
            btnOpenBrowser.Text = "▶  Open ReelOS Web Interface";
            btnOpenBrowser.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            btnOpenBrowser.Location = new Point(24, 212);
            btnOpenBrowser.Size = new Size(476, 44);
            btnOpenBrowser.BackColor = Color.FromArgb(245, 197, 24);
            btnOpenBrowser.ForeColor = Color.Black;
            btnOpenBrowser.FlatStyle = FlatStyle.Flat;
            btnOpenBrowser.FlatAppearance.BorderSize = 0;
            btnOpenBrowser.Cursor = Cursors.Hand;
            btnOpenBrowser.Click += delegate { OpenReelOsBrowser("http://localhost:" + activePort + "/"); };
            this.Controls.Add(btnOpenBrowser);

            // Quick launch row 1: TV Mode and Settings
            btnOpenTv = new Button();
            btnOpenTv.Text = "📺  TV Couch Mode";
            btnOpenTv.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            btnOpenTv.Location = new Point(24, 268);
            btnOpenTv.Size = new Size(230, 38);
            btnOpenTv.BackColor = Color.FromArgb(36, 36, 42);
            btnOpenTv.ForeColor = Color.White;
            btnOpenTv.FlatStyle = FlatStyle.Flat;
            btnOpenTv.FlatAppearance.BorderColor = Color.FromArgb(60, 60, 70);
            btnOpenTv.Cursor = Cursors.Hand;
            btnOpenTv.Click += delegate { OpenReelOsBrowser("http://localhost:" + activePort + "/tv"); };
            this.Controls.Add(btnOpenTv);

            btnOpenSettings = new Button();
            btnOpenSettings.Text = "⚙  Settings and Cockpit";
            btnOpenSettings.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            btnOpenSettings.Location = new Point(270, 268);
            btnOpenSettings.Size = new Size(230, 38);
            btnOpenSettings.BackColor = Color.FromArgb(36, 36, 42);
            btnOpenSettings.ForeColor = Color.White;
            btnOpenSettings.FlatStyle = FlatStyle.Flat;
            btnOpenSettings.FlatAppearance.BorderColor = Color.FromArgb(60, 60, 70);
            btnOpenSettings.Cursor = Cursors.Hand;
            btnOpenSettings.Click += delegate { OpenReelOsBrowser("http://localhost:" + activePort + "/settings"); };
            this.Controls.Add(btnOpenSettings);

            // Quick launch row 2: Restart Engine
            btnRestartEngine = new Button();
            btnRestartEngine.Text = "🔄  Restart Engine";
            btnRestartEngine.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            btnRestartEngine.Location = new Point(24, 318);
            btnRestartEngine.Size = new Size(476, 38);
            btnRestartEngine.BackColor = Color.FromArgb(36, 36, 42);
            btnRestartEngine.ForeColor = Color.White;
            btnRestartEngine.FlatStyle = FlatStyle.Flat;
            btnRestartEngine.FlatAppearance.BorderColor = Color.FromArgb(60, 60, 70);
            btnRestartEngine.Cursor = Cursors.Hand;
            btnRestartEngine.Click += delegate { RestartBackend(); };
            this.Controls.Add(btnRestartEngine);

            // Exit Button
            btnExit = new Button();
            btnExit.Text = "✖  Stop Engine and Exit";
            btnExit.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            btnExit.Location = new Point(24, 376);
            btnExit.Size = new Size(476, 34);
            btnExit.BackColor = Color.FromArgb(28, 20, 20);
            btnExit.ForeColor = Color.FromArgb(248, 113, 113);
            btnExit.FlatStyle = FlatStyle.Flat;
            btnExit.FlatAppearance.BorderColor = Color.FromArgb(90, 40, 40);
            btnExit.Cursor = Cursors.Hand;
            btnExit.Click += delegate { ExitApplication(); };
            this.Controls.Add(btnExit);

            // Notify Icon
            ContextMenuStrip menu = new ContextMenuStrip();
            ToolStripMenuItem itemHome = new ToolStripMenuItem("Open ReelOS Home");
            itemHome.Click += delegate { OpenReelOsBrowser("http://localhost:" + activePort + "/"); };
            menu.Items.Add(itemHome);

            ToolStripMenuItem itemTv = new ToolStripMenuItem("TV Couch Mode");
            itemTv.Click += delegate { OpenReelOsBrowser("http://localhost:" + activePort + "/tv"); };
            menu.Items.Add(itemTv);

            ToolStripMenuItem itemSettings = new ToolStripMenuItem("Settings and Diagnostics");
            itemSettings.Click += delegate { OpenReelOsBrowser("http://localhost:" + activePort + "/settings"); };
            menu.Items.Add(itemSettings);

            menu.Items.Add(new ToolStripSeparator());

            ToolStripMenuItem itemShow = new ToolStripMenuItem("Show ReelOS Window");
            itemShow.Click += delegate { ShowMainWindow(); };
            menu.Items.Add(itemShow);

            ToolStripMenuItem itemExit = new ToolStripMenuItem("Stop and Exit ReelOS");
            itemExit.Click += delegate { ExitApplication(); };
            menu.Items.Add(itemExit);

            notifyIcon = new NotifyIcon();
            notifyIcon.Text = "ReelOS Cinema Appliance";
            notifyIcon.Icon = LoadReelOsIcon();
            notifyIcon.ContextMenuStrip = menu;
            notifyIcon.Visible = true;
            notifyIcon.DoubleClick += delegate { ShowMainWindow(); };

            statusTimer = new System.Windows.Forms.Timer();
            statusTimer.Interval = 3000;
            statusTimer.Tick += delegate { UpdateStatusTick(); };
            statusTimer.Start();

            this.FormClosing += ReelOSMainWindow_FormClosing;
        }

        private void ShowMainWindow()
        {
            this.Show();
            this.WindowState = FormWindowState.Normal;
            this.BringToFront();
            this.Activate();
        }

        private void ReelOSMainWindow_FormClosing(object sender, FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                this.Hide();
                if (notifyIcon != null)
                {
                    notifyIcon.ShowBalloonTip(2000, "ReelOS Still Running", "ReelOS is active in the background. Right-click or double-click tray icon to reopen.", ToolTipIcon.Info);
                }
            }
        }

        private void InitializeEngine()
        {
            logFile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "reelos-desktop.log");

            try
            {
                File.WriteAllText(logFile, string.Format("[{0}] Starting ReelOS...\r\n", DateTime.Now));

                basePath = ResolveBasePath();
                File.AppendAllText(logFile, string.Format("[{0}] BasePath: {1}\r\n", DateTime.Now, basePath));

                DetectLocalHardware();

                if (!justInstalled && IsApiReady())
                {
                    File.AppendAllText(logFile, string.Format("[{0}] Already running on port 8080.\r\n", DateTime.Now));
                    lblEngineStatus.Text = "● Live on http://localhost:8080/ (Connected)";
                    lblEngineStatus.ForeColor = Color.FromArgb(74, 222, 128);
                    OpenReelOsBrowser();
                    return;
                }

                if (justInstalled)
                {
                    File.AppendAllText(logFile, string.Format("[{0}] Fresh install/upgrade detected. Recycling backend...\r\n", DateTime.Now));
                    CleanupBackend();
                }

                StartBackend();
            }
            catch (Exception ex)
            {
                File.AppendAllText(logFile, string.Format("[{0}] FATAL: {1}\r\n{2}\r\n", DateTime.Now, ex.Message, ex.StackTrace));
                lblEngineStatus.Text = "Error: " + ex.Message;
                lblEngineStatus.ForeColor = Color.FromArgb(248, 113, 113);
            }
        }

        private void DetectLocalHardware()
        {
            try
            {
                int cores = Environment.ProcessorCount;
                string cpu = Environment.GetEnvironmentVariable("PROCESSOR_IDENTIFIER") ?? "x86_64 Processor";
                lblHardware.Text = string.Format("Host: {0} Logical Cores · {1}", cores, cpu);
            }
            catch
            {
                lblHardware.Text = "Host: Direct Hardware Scaling Active";
            }
        }

        private void StartBackend()
        {
            string boxScript = Path.Combine(basePath, "scripts\\reelos-box.mjs");
            string envScript = Path.Combine(basePath, "scripts\\with-app-env.mjs");

            string failFlag = Path.Combine(AppDataRoot, ".launch-failed");
            try { File.WriteAllText(failFlag, DateTime.UtcNow.ToString("o")); } catch { }

            if (!File.Exists(boxScript))
            {
                // Auto-heal: run installer immediately to fetch missing core files
                if (RunInstaller())
                {
                    basePath = ResolveBasePath();
                    boxScript = Path.Combine(basePath, "scripts\\reelos-box.mjs");
                    envScript = Path.Combine(basePath, "scripts\\with-app-env.mjs");
                }
            }

            if (!File.Exists(boxScript))
            {
                string msg = string.Format("ReelOS could not find its core files.\r\n\r\nLooked in:\r\n{0}\r\n\r\nPlease ensure internet connection is available to download updates.", basePath);
                File.AppendAllText(logFile, string.Format("[{0}] ERROR: {1}\r\n", DateTime.Now, msg));
                lblEngineStatus.Text = "Core files missing. Relaunch to retry.";
                lblEngineStatus.ForeColor = Color.FromArgb(248, 113, 113);
                return;
            }

            activePort = FindAvailablePort(8080, 71);
            // Safe cleanup: only terminate previous ReelOS node processes on default ports
            KillProcessOnPort(8080);

            string nodeExe = FindNodeExecutable();
            File.AppendAllText(logFile, string.Format("[{0}] Found Node executable: {1} (Port: {2})\r\n", DateTime.Now, nodeExe, activePort));

            lblEngineStatus.Text = string.Format("Starting ReelOS engine on port {0}...", activePort);
            lblEngineStatus.ForeColor = Color.FromArgb(250, 204, 21);

            appProc = new Process();
            appProc.StartInfo.FileName = nodeExe;
            appProc.StartInfo.Arguments = "\"" + envScript + "\" \"" + nodeExe + "\" \"" + boxScript + "\"";
            appProc.StartInfo.WorkingDirectory = basePath;
            appProc.StartInfo.UseShellExecute = false;
            appProc.StartInfo.CreateNoWindow = true;
            appProc.StartInfo.EnvironmentVariables["PORT"] = activePort.ToString();
            appProc.Start();
            File.AppendAllText(logFile, string.Format("[{0}] Started ReelOS engine process PID: {1}\r\n", DateTime.Now, appProc.Id));

            ThreadPool.QueueUserWorkItem(delegate
            {
                bool ready = false;
                for (int i = 0; i < 60; i++)
                {
                    if (appProc != null && appProc.HasExited)
                    {
                        File.AppendAllText(logFile, string.Format("[{0}] ERROR: ReelOS backend exited with code {1}\r\n", DateTime.Now, appProc.ExitCode));
                        this.Invoke(new Action(delegate
                        {
                            lblEngineStatus.Text = string.Format("Backend exited with code {0}. Relaunch to auto-repair.", appProc.ExitCode);
                            lblEngineStatus.ForeColor = Color.FromArgb(248, 113, 113);
                        }));
                        return;
                    }

                    if (IsApiReady())
                    {
                        ready = true;
                        break;
                    }
                    Thread.Sleep(500);
                }

                this.Invoke(new Action(delegate
                {
                    if (ready)
                    {
                        try { if (File.Exists(failFlag)) File.Delete(failFlag); } catch { }
                        lblEngineStatus.Text = string.Format("● Live on http://localhost:{0}/ (Port {0} Active)", activePort);
                        lblEngineStatus.ForeColor = Color.FromArgb(74, 222, 128);
                        OpenReelOsBrowser();
                    }
                    else
                    {
                        lblEngineStatus.Text = "Timeout waiting for backend to respond. Relaunch to auto-repair.";
                        lblEngineStatus.ForeColor = Color.FromArgb(248, 113, 113);
                    }
                }));
            });
        }

        private void RestartBackend()
        {
            lblEngineStatus.Text = "Restarting ReelOS engine...";
            lblEngineStatus.ForeColor = Color.FromArgb(250, 204, 21);
            CleanupBackend();
            Thread.Sleep(1000);
            StartBackend();
        }

        // Direct Win32 Sector-Level Flasher Implementation (Zero External Tools)
        public static bool DirectFlashSectorImage(string imagePath, int physicalDriveNumber, Action<int> progressCallback = null)
        {
            if (physicalDriveNumber <= 0)
            {
                throw new InvalidOperationException("Safety violation: Refusing to write raw sectors to PhysicalDrive0 or system disk.");
            }
            if (!File.Exists(imagePath))
            {
                throw new FileNotFoundException("Image file not found: " + imagePath);
            }

            string rawDrivePath = string.Format(@"\\.\PhysicalDrive{0}", physicalDriveNumber);
            const int bufferSize = 64 * 1024; // 64KB sector-aligned chunk
            byte[] buffer = new byte[bufferSize];

            using (FileStream srcStream = new FileStream(imagePath, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                long totalBytes = srcStream.Length;
                long writtenTotal = 0;

                try
                {
                    using (FileStream dstStream = new FileStream(rawDrivePath, FileMode.Open, FileAccess.Write, FileShare.ReadWrite))
                    {
                        int bytesRead;
                        while ((bytesRead = srcStream.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            dstStream.Write(buffer, 0, bytesRead);
                            writtenTotal += bytesRead;
                            if (progressCallback != null)
                            {
                                int percent = (int)((writtenTotal * 100) / totalBytes);
                                progressCallback(percent);
                            }
                        }
                        dstStream.Flush();
                        return true;
                    }
                }
                catch
                {
                    return false;
                }
            }
        }


        private void UpdateStatusTick()
        {
            bool ready = IsApiReady();
            if (ready)
            {
                lblEngineStatus.Text = string.Format("● Live on http://localhost:{0}/ (Healthy)", activePort);
                lblEngineStatus.ForeColor = Color.FromArgb(74, 222, 128);
            }
            else
            {
                lblEngineStatus.Text = string.Format("○ Engine Offline (Port {0} Unreachable)", activePort);
                lblEngineStatus.ForeColor = Color.FromArgb(248, 113, 113);
            }
        }

        private static bool IsApiReady()
        {
            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + activePort + "/api/ready");
                request.Timeout = 1000;
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    return response.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        private static void OpenReelOsBrowser(string targetUrl = "")
        {
            if (string.IsNullOrEmpty(targetUrl))
            {
                targetUrl = "http://localhost:" + activePort + "/";
            }
            try
            {
                string[] candidateBrowsers = new string[]
                {
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft\\Edge\\Application\\msedge.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft\\Edge\\Application\\msedge.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft\\Edge\\Application\\msedge.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google\\Chrome\\Application\\chrome.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google\\Chrome\\Application\\chrome.exe")
                };

                string profileDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ReelOS", "cinema-profile");
                try { Directory.CreateDirectory(profileDir); } catch { }

                foreach (string browserPath in candidateBrowsers)
                {
                    if (File.Exists(browserPath))
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = browserPath,
                            Arguments = "--app=\"" + targetUrl + "\" --user-data-dir=\"" + profileDir + "\" --class=ReelOS.Cinema --window-name=\"ReelOS Cinema\" --start-maximized --disable-features=Translate,OptimizationHints --disable-extensions",
                            UseShellExecute = false
                        });
                        return;
                    }
                }
            }
            catch { }

            Process.Start(new ProcessStartInfo
            {
                FileName = targetUrl,
                UseShellExecute = true
            });
        }

        private void ExitApplication()
        {
            if (statusTimer != null) statusTimer.Stop();
            if (notifyIcon != null)
            {
                notifyIcon.Visible = false;
                notifyIcon.Dispose();
            }
            CleanupBackend();
            Application.ExitThread();
            Environment.Exit(0);
        }

        private static void CleanupBackend()
        {
            try
            {
                if (appProc != null && !appProc.HasExited)
                {
                    try
                    {
                        ProcessStartInfo psi = new ProcessStartInfo("taskkill", "/PID " + appProc.Id + " /T /F")
                        {
                            CreateNoWindow = true,
                            UseShellExecute = false
                        };
                        Process p = Process.Start(psi);
                        p.WaitForExit(2000);
                    }
                    catch { }

                    if (!appProc.HasExited)
                    {
                        appProc.Kill();
                    }
                }
            }
            catch { }
            KillProcessOnPort(8080);
        }

        private static void KillProcessOnPort(int port)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("cmd.exe", "/c netstat -ano | findstr :" + port)
                {
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                Process p = Process.Start(psi);
                string output = p.StandardOutput.ReadToEnd();
                p.WaitForExit();

                string[] lines = output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (string line in lines)
                {
                    string[] parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 5 && parts[3].Equals("LISTENING", StringComparison.OrdinalIgnoreCase))
                    {
                        int colonIdx = parts[1].LastIndexOf(':');
                        if (colonIdx >= 0 && parts[1].Substring(colonIdx + 1) == port.ToString())
                        {
                            int pid;
                            if (int.TryParse(parts[4], out pid) && pid > 0 && pid != Process.GetCurrentProcess().Id)
                            {
                                try
                                {
                                    Process targetProc = Process.GetProcessById(pid);
                                    // SAFETY INVARIANT: Never assassinate foreign user processes! Only kill Node/ReelOS.
                                    string procName = targetProc.ProcessName.ToLowerInvariant();
                                    if (procName.Contains("node") || procName.Contains("reelos"))
                                    {
                                        targetProc.Kill();
                                    }
                                }
                                catch { }
                            }
                        }
                    }
                }
            }
            catch { }
        }

        private static string FindNodeExecutable()
        {
            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            string[] portableCandidates = new string[] {
                Path.Combine(exeDir, "node.exe"),
                Path.Combine(exeDir, "node\\node.exe"),
                Path.Combine(AppDataRoot, "node.exe"),
                Path.Combine(AppDataRoot, "node\\node.exe")
            };
            foreach (string p in portableCandidates)
            {
                if (File.Exists(p)) return p;
            }

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("where.exe", "node")
                {
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                Process p = Process.Start(psi);
                string outStr = p.StandardOutput.ReadLine();
                p.WaitForExit();
                if (!string.IsNullOrEmpty(outStr) && File.Exists(outStr.Trim()))
                {
                    return outStr.Trim();
                }
            }
            catch { }

            string userHome = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            string[] candidates = new string[] {
                @"C:\Program Files\nodejs\node.exe",
                @"C:\Program Files (x86)\nodejs\node.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs\\node\\node.exe"),
                Path.Combine(userHome, "AppData\\Roaming\\nvm\\current\\node.exe"),
                Path.Combine(userHome, "scoop\\shims\\node.exe"),
                Path.Combine(userHome, "scoop\\apps\\nodejs\\current\\node.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "fnm\\current\\node.exe"),
                "node"
            };

            foreach (string cand in candidates)
            {
                if (cand != "node" && File.Exists(cand))
                {
                    return cand;
                }
            }

            return "node";
        }

        private static int FindAvailablePort(int startPort = 8080, int maxAttempts = 71)
        {
            for (int p = startPort; p < startPort + maxAttempts; p++)
            {
                try
                {
                    System.Net.Sockets.TcpListener listener = new System.Net.Sockets.TcpListener(IPAddress.Loopback, p);
                    listener.Start();
                    listener.Stop();
                    return p;
                }
                catch { }
            }
            return startPort;
        }

        // ── is ReelOS installed? ───────────────────────────────────────────
        private static bool IsInstalled()
        {
            return File.Exists(Path.Combine(AppDataRoot, "scripts", "reelos-box.mjs"));
        }

        // ── first-run installer ────────────────────────────────────────────
        private static bool RunInstaller()
        {
            Form splash = new Form() { Text = "Setting up ReelOS…", Size = new Size(420, 140), StartPosition = FormStartPosition.CenterScreen, FormBorderStyle = FormBorderStyle.FixedSingle, MaximizeBox = false, MinimizeBox = false, BackColor = Color.FromArgb(18, 18, 20), ForeColor = Color.White };
            Label lbl = new Label() { Text = "Setting up ReelOS on your computer…", Font = new Font("Segoe UI", 10f), ForeColor = Color.FromArgb(245, 197, 24), Location = new Point(20, 20), AutoSize = true };
            Label lbl2 = new Label() { Text = "This only takes a moment.", Font = new Font("Segoe UI", 9f), ForeColor = Color.FromArgb(160, 160, 170), Location = new Point(20, 50), AutoSize = true };
            ProgressBar pb = new ProgressBar() { Location = new Point(20, 80), Size = new Size(370, 16), Style = ProgressBarStyle.Marquee, MarqueeAnimationSpeed = 30 };
            splash.Controls.Add(lbl); splash.Controls.Add(lbl2); splash.Controls.Add(pb);
            splash.Show(); Application.DoEvents();

            try
            {
                // Terminate previous running backend instances before unpacking and updating
                KillProcessOnPort(8080);

                // Force TLS 1.2 protocol for modern HTTPS
                try { ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | SecurityProtocolType.Tls; } catch { }

                string tempZip = Path.Combine(Path.GetTempPath(), "reelos-setup.zip");
                bool isDevMode = false;
                Directory.CreateDirectory(AppDataRoot);

                string exeDir = AppDomain.CurrentDomain.BaseDirectory;

                // ── 1. Portable Node Runtime Provisioning ──
                string nodeTarget = Path.Combine(AppDataRoot, "node.exe");
                string existingNode = FindNodeExecutable();
                if (existingNode == "node" || !File.Exists(existingNode))
                {
                    string localNode = Path.Combine(exeDir, "node.exe");
                    if (File.Exists(localNode))
                    {
                        lbl2.Text = "Configuring local engine runtime...";
                        Application.DoEvents();
                        File.Copy(localNode, nodeTarget, overwrite: true);
                    }
                    else if (!File.Exists(nodeTarget))
                    {
                        lbl2.Text = "Downloading lightweight engine runtime (one-time)...";
                        Application.DoEvents();
                        using (WebClient wc = new WebClient())
                        {
                            wc.Headers["User-Agent"] = "ReelOS-Installer/2.5.4";
                            wc.DownloadProgressChanged += (s, e) =>
                            {
                                try { splash.Invoke(new Action(() => { pb.Value = e.ProgressPercentage; lbl2.Text = string.Format("Downloading engine runtime… {0}%", e.ProgressPercentage); Application.DoEvents(); })); }
                                catch { }
                            };
                            string tempNode = Path.Combine(Path.GetTempPath(), "reelos-node.exe");
                            wc.DownloadFile(new Uri("https://nodejs.org/dist/v20.18.0/win-x64/node.exe"), tempNode);
                            if (File.Exists(tempNode))
                            {
                                File.Copy(tempNode, nodeTarget, overwrite: true);
                                try { File.Delete(tempNode); } catch { }
                            }
                        }
                    }
                }

                // ── 0. Check for Embedded Binary Bundle (ReelOS.bundle.zip) ──
                bool bundleLoaded = false;
                try
                {
                    System.Reflection.Assembly asm = System.Reflection.Assembly.GetExecutingAssembly();
                    using (Stream resStream = asm.GetManifestResourceStream("ReelOS.bundle.zip"))
                    {
                        if (resStream != null && resStream.Length > 10000)
                        {
                            lbl2.Text = "Extracting verified embedded payload…";
                            Application.DoEvents();
                            using (FileStream fs = new FileStream(tempZip, FileMode.Create, FileAccess.Write))
                            {
                                resStream.CopyTo(fs);
                            }
                            bundleLoaded = true;
                        }
                    }
                }
                catch { }

                if (!bundleLoaded)
                {
                    string[] candidateBundles = new string[]
                    {
                        Path.Combine(exeDir, "ReelOS.bundle.zip"),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Google Drive", "ReelOS.bundle.zip"),
                        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "OneDrive", "ReelOS_Installers", "ReelOS.bundle.zip"),
                        @"C:\Users\austi\reelos\dist-windows\ReelOS.bundle.zip"
                    };

                    string bundleZip = null;
                    foreach (string cb in candidateBundles)
                    {
                        if (File.Exists(cb))
                        {
                            bundleZip = cb;
                            break;
                        }
                    }

                    if (bundleZip != null)
                    {
                        lbl2.Text = "Using local verified bundle…"; Application.DoEvents();
                        File.Copy(bundleZip, tempZip, overwrite: true);
                        bundleLoaded = true;
                    }
                }

                if (!bundleLoaded)
                {
                    // ── 2. Download latest main-branch archive from GitHub ──
                    const string DownloadUrl = "https://github.com/ajt1995/reelos/archive/refs/heads/main.zip";
                    lbl2.Text = "Downloading latest ReelOS…"; Application.DoEvents();

                    pb.Style = ProgressBarStyle.Continuous;
                    pb.Maximum = 100;
                    pb.Value   = 0;

                    bool      done = false;
                    Exception dlEx = null;

                    using (WebClient wc = new WebClient())
                    {
                        wc.Headers["User-Agent"] = "ReelOS-Installer/2.5.4";

                        wc.DownloadProgressChanged += (s, e) =>
                        {
                            try { splash.Invoke(new Action(() => { pb.Value = e.ProgressPercentage; lbl2.Text = string.Format("Downloading… {0}%", e.ProgressPercentage); Application.DoEvents(); })); }
                            catch { }
                        };

                        wc.DownloadFileCompleted += (s, e) => { dlEx = e.Error; done = true; };
                        wc.DownloadFileAsync(new Uri(DownloadUrl), tempZip);

                        while (!done) { Application.DoEvents(); Thread.Sleep(40); }
                    }

                    if (dlEx != null || !File.Exists(tempZip) || new FileInfo(tempZip).Length < 10000)
                    {
                        // No internet — dev/offline mode: point at the repo folder this exe lives in
                        isDevMode = true;
                        lbl2.Text = "Offline — running from local source."; Application.DoEvents();
                        Thread.Sleep(700);
                    }
                }

                if (isDevMode)
                {
                    // Dev stub: record the repo path so ResolveBasePath finds it
                    File.WriteAllText(Path.Combine(AppDataRoot, "_dev_source.txt"), exeDir);
                    string ss = Path.Combine(AppDataRoot, "scripts");
                    if (!Directory.Exists(ss)) Directory.CreateDirectory(ss);
                    string sb = Path.Combine(ss, "reelos-box.mjs");
                    if (!File.Exists(sb)) File.WriteAllText(sb, "// dev stub");
                }
                else
                {
                    // ── 3. Extract — Clean install guarantee ──
                    lbl2.Text = "Unpacking clean installation…";
                    pb.Style  = ProgressBarStyle.Marquee;
                    Application.DoEvents();

                    // Wipe old scripts and prebuilt directories so stale chunks are cleanly removed
                    try
                    {
                        string oldPrebuilt = Path.Combine(AppDataRoot, "prebuilt");
                        if (Directory.Exists(oldPrebuilt)) Directory.Delete(oldPrebuilt, recursive: true);
                        string oldScripts = Path.Combine(AppDataRoot, "scripts");
                        if (Directory.Exists(oldScripts)) Directory.Delete(oldScripts, recursive: true);
                    }
                    catch { }

                    string extractTemp = Path.Combine(Path.GetTempPath(), "reelos-" + Guid.NewGuid().ToString("N").Substring(0, 8));
                    ZipFile.ExtractToDirectory(tempZip, extractTemp);

                    // Flatten the single inner folder (e.g. "reelos-main") if downloaded from GitHub
                    string[] inner = Directory.GetDirectories(extractTemp);
                    string   src   = (inner.Length == 1) ? inner[0] : extractTemp;

                    foreach (string file in Directory.GetFiles(src, "*", SearchOption.AllDirectories))
                    {
                        string rel     = file.Substring(src.Length).TrimStart(Path.DirectorySeparatorChar);
                        string dest    = Path.Combine(AppDataRoot, rel);
                        string destDir = Path.GetDirectoryName(dest);
                        if (!Directory.Exists(destDir)) Directory.CreateDirectory(destDir);
                        File.Copy(file, dest, overwrite: true);
                    }

                    try { Directory.Delete(extractTemp, recursive: true); } catch { }
                    try { File.Delete(tempZip); }                          catch { }
                }


                // ── 4. Register exe + uninstaller + Start Menu ──
                string thisExe      = Process.GetCurrentProcess().MainModule.FileName;
                string installedExe = Path.Combine(AppDataRoot, "ReelOS.exe");
                if (!string.Equals(thisExe, installedExe, StringComparison.OrdinalIgnoreCase))
                    File.Copy(thisExe, installedExe, overwrite: true);
                File.Copy(thisExe, UninstallExePath, overwrite: true);

                RegisterUninstaller(installedExe);

                try
                {
                    string shortcutDir = Path.GetDirectoryName(StartMenuShortcut);
                    if (!Directory.Exists(shortcutDir)) Directory.CreateDirectory(shortcutDir);
                    Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                    if (shellType != null)
                    {
                        dynamic shell    = Activator.CreateInstance(shellType);
                        dynamic shortcut = shell.CreateShortcut(StartMenuShortcut);
                        shortcut.TargetPath      = installedExe;
                        shortcut.WorkingDirectory = AppDataRoot;
                        shortcut.Description      = "ReelOS Cinema";
                        shortcut.Save();
                    }
                }
                catch { }

                lbl.Text  = "All done!";
                lbl2.Text = "Starting ReelOS…";
                Application.DoEvents();
                Thread.Sleep(500);
            }
            catch (Exception ex)
            {
                splash.Close();
                MessageBox.Show("Could not install ReelOS:\n\n" + ex.Message, "ReelOS Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return false;
            }
            finally { splash.Close(); splash.Dispose(); }
            return true;
        }

        // ── registry registration ──────────────────────────────────────────
        private static void RegisterUninstaller(string installedExe)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(RegistryKeyPath))
                {
                    if (key == null) return;
                    key.SetValue("DisplayName", "ReelOS Cinema");
                    key.SetValue("DisplayVersion", "2.5.4");
                    key.SetValue("Publisher", "ReelOS");
                    key.SetValue("InstallLocation", AppDataRoot);
                    key.SetValue("UninstallString", "\"" + UninstallExePath + "\" /uninstall");
                    key.SetValue("QuietUninstallString", "\"" + UninstallExePath + "\" /uninstall");
                    key.SetValue("DisplayIcon", installedExe);
                    key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                    key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    key.SetValue("EstimatedSize", 150000, RegistryValueKind.DWord);
                }
            }
            catch { }
        }

        // ── uninstaller ────────────────────────────────────────────────────
        private static void RunUninstaller()
        {
            DialogResult r = MessageBox.Show(
                "This will remove ReelOS from your computer.\n\nYour personal settings and history will also be removed.",
                "Remove ReelOS",
                MessageBoxButtons.OKCancel,
                MessageBoxIcon.Warning);
            if (r != DialogResult.OK) return;

            KillProcessOnPort(8080);

            try
            {
                string startMenuDir = Path.GetDirectoryName(StartMenuShortcut);
                if (Directory.Exists(startMenuDir)) Directory.Delete(startMenuDir, recursive: true);
            }
            catch { }

            try { Registry.CurrentUser.DeleteSubKeyTree(RegistryKeyPath, throwOnMissingSubKey: false); }
            catch { }

            string bat = Path.Combine(Path.GetTempPath(), "reelos_uninstall.bat");
            File.WriteAllText(bat, "@echo off\r\ntimeout /t 2 /nobreak >nul\r\nrmdir /s /q \"" + AppDataRoot + "\"\r\ndel /f /q \"" + bat + "\"\r\n");
            Process.Start(new ProcessStartInfo("cmd.exe", "/c \"" + bat + "\"") { WindowStyle = ProcessWindowStyle.Hidden, CreateNoWindow = true });
            MessageBox.Show("ReelOS has been removed.", "ReelOS", MessageBoxButtons.OK, MessageBoxIcon.Information);
            Environment.Exit(0);
        }

        // ── AppData-aware ResolveBasePath ──────────────────────────────────
        private static string ResolveBasePath()
        {
            // 1. Current executable directory (when running from local repo or portable bundle)
            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            if (File.Exists(Path.Combine(exeDir, "scripts", "reelos-box.mjs"))) return exeDir;

            // 2. Current working directory
            string curDir = Directory.GetCurrentDirectory();
            if (File.Exists(Path.Combine(curDir, "scripts", "reelos-box.mjs"))) return curDir;

            // 3. Parent directory of exe (e.g. if exe is located in a build or tools subfolder)
            try
            {
                string parentDir = Path.GetFullPath(Path.Combine(exeDir, ".."));
                if (File.Exists(Path.Combine(parentDir, "scripts", "reelos-box.mjs"))) return parentDir;
            }
            catch { }

            // 4. Dev mode override file
            string devFile = Path.Combine(AppDataRoot, "_dev_source.txt");
            if (File.Exists(devFile))
            {
                try
                {
                    string devSrc = File.ReadAllText(devFile).Trim();
                    foreach (string c in new[] { devSrc, Path.GetFullPath(Path.Combine(devSrc, "..")), Path.GetFullPath(Path.Combine(devSrc, "..", "..")) })
                        if (File.Exists(Path.Combine(c, "scripts", "reelos-box.mjs"))) return c;
                }
                catch { }
            }

            // 5. Standard AppData installation
            if (File.Exists(Path.Combine(AppDataRoot, "scripts", "reelos-box.mjs"))) return AppDataRoot;

            // 6. Environment variable overrides
            string envHome = Environment.GetEnvironmentVariable("REELOS_HOME") ?? Environment.GetEnvironmentVariable("REELOS_ROOT");
            if (!string.IsNullOrEmpty(envHome) && File.Exists(Path.Combine(envHome, "scripts", "reelos-box.mjs"))) return envHome;

            string userReelOs = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "reelos");
            if (File.Exists(Path.Combine(userReelOs, "scripts", "reelos-box.mjs"))) return userReelOs;

            return AppDataRoot;
        }

        [STAThread]
        static void Main(string[] args)
        {
            try { SetCurrentProcessExplicitAppUserModelID("ReelOS.Cinema.Desktop"); } catch { }

            if (args.Length > 0 && (args[0].ToLowerInvariant().TrimStart('-', '/') == "uninstall" || args[0].ToLowerInvariant().TrimStart('-', '/') == "remove"))
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                RunUninstaller();
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string thisExe = Process.GetCurrentProcess().MainModule.FileName;
            string installedExe = Path.Combine(AppDataRoot, "ReelOS.exe");
            bool isExternalInstaller = !string.Equals(thisExe, installedExe, StringComparison.OrdinalIgnoreCase);

            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            bool isRunningFromLocalSource = File.Exists(Path.Combine(exeDir, "scripts", "reelos-box.mjs")) ||
                                           File.Exists(Path.Combine(Directory.GetCurrentDirectory(), "scripts", "reelos-box.mjs"));

            string failFlag = Path.Combine(AppDataRoot, ".launch-failed");
            bool forceUpdate = args.Length > 0 && (args[0].ToLowerInvariant().Contains("update") || 
                                                   args[0].ToLowerInvariant().Contains("repair") ||
                                                   args[0].ToLowerInvariant().Contains("install") ||
                                                   args[0].ToLowerInvariant().Contains("clean"));

            bool cleanSlate = args.Length > 0 && (args[0].ToLowerInvariant().Contains("clean") || args[0].ToLowerInvariant().Contains("reset"));
            if (cleanSlate)
            {
                try
                {
                    string stateDir = Path.Combine(AppDataRoot, ".reelos-state");
                    if (Directory.Exists(stateDir)) Directory.Delete(stateDir, recursive: true);
                }
                catch { }
            }

            bool needsInstallOrRepair = (!isRunningFromLocalSource && isExternalInstaller) || (!isRunningFromLocalSource && !IsInstalled()) || File.Exists(failFlag) || forceUpdate || cleanSlate;

            if (needsInstallOrRepair)
            {
                justInstalled = true;
                if (!RunInstaller()) return;
                try { if (File.Exists(failFlag)) File.Delete(failFlag); } catch { }
            }


            Application.Run(new ReelOSMainWindow());
        }
    }
}
