using System;
using System.Diagnostics;
using System.IO;
using System.Security.Principal;

namespace ReelOS.Installer
{
    class Program
    {
        static bool IsAdministrator()
        {
            using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
            {
                WindowsPrincipal principal = new WindowsPrincipal(identity);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
        }

        static void ElevateSelf(string[] args)
        {
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = Process.GetCurrentProcess().MainModule.FileName;
            psi.Arguments = string.Join(" ", args);
            psi.Verb = "runas";
            psi.UseShellExecute = true;

            try
            {
                Process.Start(psi);
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Elevation cancelled or failed: " + ex.Message);
                Console.ResetColor();
            }
        }

        static string FindLauncherScript()
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string[] candidates = new string[]
            {
                Path.Combine(appDir, "scripts", "reelos-windows-launcher.ps1"),
                Path.Combine(appDir, "..", "scripts", "reelos-windows-launcher.ps1"),
                Path.Combine(appDir, "..", "..", "scripts", "reelos-windows-launcher.ps1"),
                Path.Combine(Directory.GetCurrentDirectory(), "scripts", "reelos-windows-launcher.ps1")
            };

            foreach (string c in candidates)
            {
                try
                {
                    string full = Path.GetFullPath(c);
                    if (File.Exists(full))
                        return full;
                }
                catch { }
            }
            return null;
        }

        static int Main(string[] args)
        {
            Console.Title = "ReelOS Setup & Appliance Engine";
            Console.BackgroundColor = ConsoleColor.Black;
            Console.ForegroundColor = ConsoleColor.Yellow;

            string mode = "Menu";
            bool requireAdmin = false;

            if (args.Length > 0)
            {
                string arg0 = args[0].ToLowerInvariant().TrimStart('-', '/');
                if (arg0 == "install" || arg0 == "vm") mode = "Install";
                else if (arg0 == "flash" || arg0 == "usb") { mode = "Flash"; requireAdmin = true; }
                else if (arg0 == "update") mode = "Update";
                else if (arg0 == "uninstall" || arg0 == "stop") mode = "Uninstall";
                else if (arg0 == "status") mode = "Status";
            }

            if (requireAdmin && !IsAdministrator())
            {
                Console.ForegroundColor = ConsoleColor.Cyan;
                Console.WriteLine(">> Flash mode requires administrator privileges for raw disk access.");
                Console.WriteLine(">> Requesting elevation...");
                Console.ResetColor();
                ElevateSelf(args);
                return 0;
            }

            string launcher = FindLauncherScript();
            if (launcher == null || !File.Exists(launcher))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Error: Unable to locate reelos-windows-launcher.ps1.");
                Console.WriteLine("Please ensure the installer is run from the ReelOS repository or deployment root.");
                Console.ResetColor();
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
                return 1;
            }

            ProcessStartInfo ps = new ProcessStartInfo();
            ps.FileName = "powershell.exe";
            ps.Arguments = string.Format("-NoProfile -ExecutionPolicy Bypass -File \"{0}\" -Mode {1}", launcher, mode);
            ps.UseShellExecute = false;

            try
            {
                Process proc = Process.Start(ps);
                if (proc != null)
                {
                    proc.WaitForExit();
                    return proc.ExitCode;
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("Failed to execute launcher: " + ex.Message);
                Console.ResetColor();
                return 1;
            }

            return 0;
        }
    }
}
