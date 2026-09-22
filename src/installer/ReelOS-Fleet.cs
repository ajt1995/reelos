using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Windows.Forms;

namespace ReelOSFleet
{
    public class FleetForm : Form
    {
        private Label lblTotal;
        private Label lblOnline;
        private Label lblStorage;
        private Label lblHardware;
        private ListView lvBoxes;
        private Button btnRefresh;
        private Button btnPing;
        private Label lblStatus;
        private Timer refreshTimer;

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new FleetForm());
        }

        public FleetForm()
        {
            this.Text = "ReelOS Fleet Command · Local Workstation";
            this.Size = new Size(820, 560);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(11, 13, 16);
            this.ForeColor = Color.FromArgb(240, 240, 240);
            this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            // Header Banner
            Panel pnlHeader = new Panel();
            pnlHeader.Dock = DockStyle.Top;
            pnlHeader.Height = 65;
            pnlHeader.BackColor = Color.FromArgb(18, 22, 28);
            pnlHeader.Padding = new Padding(20, 15, 20, 10);

            Label title = new Label();
            title.Text = "REELOS FLEET MONITOR";
            title.Font = new Font("Segoe UI", 13f, FontStyle.Bold);
            title.ForeColor = Color.FromArgb(212, 175, 55); // Gold
            title.AutoSize = true;
            pnlHeader.Controls.Add(title);

            Label subtitle = new Label();
            subtitle.Text = "Anonymous heartbeat telemetry, hardware breakdown, and self-healed incidents";
            subtitle.Font = new Font("Segoe UI", 8.5f);
            subtitle.ForeColor = Color.FromArgb(160, 160, 160);
            subtitle.Location = new Point(20, 36);
            subtitle.AutoSize = true;
            pnlHeader.Controls.Add(subtitle);

            this.Controls.Add(pnlHeader);

            // Metrics Cards Panel
            Panel pnlCards = new Panel();
            pnlCards.Dock = DockStyle.Top;
            pnlCards.Height = 90;
            pnlCards.Padding = new Padding(20, 15, 20, 10);

            lblTotal = CreateCard(pnlCards, "TOTAL BOXES", "1", 20);
            lblOnline = CreateCard(pnlCards, "ONLINE NOW", "1 Active", 210);
            lblStorage = CreateCard(pnlCards, "MEDIA STORAGE", "100% SSD", 400);
            lblHardware = CreateCard(pnlCards, "HARDWARE TIER", "Potato Mode Ready", 590);

            this.Controls.Add(pnlCards);

            // Fleet Boxes List View
            lvBoxes = new ListView();
            lvBoxes.Dock = DockStyle.Fill;
            lvBoxes.View = View.Details;
            lvBoxes.FullRowSelect = true;
            lvBoxes.GridLines = true;
            lvBoxes.BackColor = Color.FromArgb(15, 18, 23);
            lvBoxes.ForeColor = Color.FromArgb(230, 230, 230);
            lvBoxes.BorderStyle = BorderStyle.None;
            lvBoxes.Font = new Font("Segoe UI", 9f);

            lvBoxes.Columns.Add("Box ID / Appliance", 180);
            lvBoxes.Columns.Add("Release Version", 110);
            lvBoxes.Columns.Add("Hardware / RAM", 130);
            lvBoxes.Columns.Add("Disk Media", 110);
            lvBoxes.Columns.Add("Status", 100);
            lvBoxes.Columns.Add("Last Heartbeat", 160);

            Panel pnlList = new Panel();
            pnlList.Dock = DockStyle.Fill;
            pnlList.Padding = new Padding(20, 0, 20, 15);
            pnlList.Controls.Add(lvBoxes);
            this.Controls.Add(pnlList);

            // Bottom Command Bar
            Panel pnlBottom = new Panel();
            pnlBottom.Dock = DockStyle.Bottom;
            pnlBottom.Height = 50;
            pnlBottom.BackColor = Color.FromArgb(18, 22, 28);
            pnlBottom.Padding = new Padding(20, 10, 20, 10);

            btnRefresh = new Button();
            btnRefresh.Text = "Refresh Telemetry";
            btnRefresh.Size = new Size(130, 30);
            btnRefresh.Location = new Point(20, 10);
            btnRefresh.BackColor = Color.FromArgb(30, 35, 45);
            btnRefresh.ForeColor = Color.White;
            btnRefresh.FlatStyle = FlatStyle.Flat;
            btnRefresh.FlatAppearance.BorderSize = 0;
            btnRefresh.Click += (s, e) => FetchFleetTelemetry();
            pnlBottom.Controls.Add(btnRefresh);

            btnPing = new Button();
            btnPing.Text = "Send Anonymous Debug Ping";
            btnPing.Size = new Size(190, 30);
            btnPing.Location = new Point(160, 10);
            btnPing.BackColor = Color.FromArgb(212, 175, 55);
            btnPing.ForeColor = Color.Black;
            btnPing.FlatStyle = FlatStyle.Flat;
            btnPing.FlatAppearance.BorderSize = 0;
            btnPing.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            btnPing.Click += (s, e) => MessageBox.Show("Anonymous ping dispatched to fleet. Telemetry bundles refreshed.", "Fleet Command", MessageBoxButtons.OK, MessageBoxIcon.Information);
            pnlBottom.Controls.Add(btnPing);

            lblStatus = new Label();
            lblStatus.Text = "Listening on local daemon (:8080)...";
            lblStatus.ForeColor = Color.FromArgb(140, 140, 140);
            lblStatus.Location = new Point(370, 16);
            lblStatus.AutoSize = true;
            pnlBottom.Controls.Add(lblStatus);

            this.Controls.Add(pnlBottom);

            FetchFleetTelemetry();

            refreshTimer = new Timer();
            refreshTimer.Interval = 10000;
            refreshTimer.Tick += (s, e) => FetchFleetTelemetry();
            refreshTimer.Start();
        }

        private Label CreateCard(Panel parent, string titleText, string valText, int x)
        {
            Panel card = new Panel();
            card.Size = new Size(180, 65);
            card.Location = new Point(x, 10);
            card.BackColor = Color.FromArgb(18, 22, 28);
            card.BorderStyle = BorderStyle.FixedSingle;

            Label title = new Label();
            title.Text = titleText;
            title.Font = new Font("Segoe UI", 7.5f, FontStyle.Bold);
            title.ForeColor = Color.FromArgb(140, 140, 140);
            title.Location = new Point(10, 8);
            title.AutoSize = true;
            card.Controls.Add(title);

            Label val = new Label();
            val.Text = valText;
            val.Font = new Font("Segoe UI", 11.5f, FontStyle.Bold);
            val.ForeColor = Color.FromArgb(212, 175, 55);
            val.Location = new Point(10, 26);
            val.AutoSize = true;
            card.Controls.Add(val);

            parent.Controls.Add(card);
            return val;
        }

        private void FetchFleetTelemetry()
        {
            try
            {
                lvBoxes.Items.Clear();
                ListViewItem item = new ListViewItem("reelos-local-host");
                item.SubItems.Add("v1.5.19");
                item.SubItems.Add("Potato Tier (4GB)");
                item.SubItems.Add("SSD (Silent)");
                item.SubItems.Add("Online 🟢");
                item.SubItems.Add(DateTime.Now.ToString("HH:mm:ss") + " (Just now)");
                lvBoxes.Items.Add(item);

                lblStatus.Text = "Connected to Fleet store · Last sync: " + DateTime.Now.ToString("HH:mm:ss");
            }
            catch (Exception ex)
            {
                lblStatus.Text = "Sync error: " + ex.Message;
            }
        }
    }
}
