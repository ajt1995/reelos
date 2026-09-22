import { execSync } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

export const MACHINE_MODES = {
  DEDICATED_APPLIANCE: 'DEDICATED_APPLIANCE',
  SHARED_WORKSTATION: 'SHARED_WORKSTATION',
};

// Known allowed processes for ReelOS
export const REELOS_WHITELIST = new Set([
  'node', 'node.exe', 'caddy', 'caddy.exe', 'decypharr', 'decypharr.exe',
  'ffmpeg', 'ffmpeg.exe', 'ffprobe', 'ffprobe.exe', 'jellyfin', 'jellyfin.exe', 'reelos.exe'
]);

// Development and container services
export const DEV_WHITELIST = new Set([
  'docker', 'docker.exe', 'wsl', 'wsl.exe', 'vmmem', 'vmmemwsl', 'vmms', 'vmms.exe',
  'containerd', 'containerd.exe', 'dockerd', 'dockerd.exe'
]);

// A robust but inexhaustive list of standard OS system infrastructure.
// On a true dedicated appliance, few foreign processes exist.
export const SYSTEM_WHITELIST = new Set([
  // Windows
  'system idle process', 'system', 'secure system', 'registry', 'smss.exe', 'csrss.exe',
  'wininit.exe', 'services.exe', 'lsass.exe', 'svchost.exe', 'fontdrvhost.exe',
  'winlogon.exe', 'dwm.exe', 'taskhostw.exe', 'explorer.exe',
  'conhost.exe', 'cmd.exe', 'powershell.exe', 'pwsh.exe', 'wslhost.exe',
  'runtimebroker.exe', 'sihost.exe', 'ctfmon.exe', 'searchapp.exe', 'startmenuexperiencehost.exe',
  'dllhost.exe', 'spoolsv.exe', 'lsaiso.exe', 'audiodg.exe', 'wmiadap.exe', 'wmiprvse.exe',
  'securityhealthservice.exe', 'securityhealthsystray.exe', 'msmpeng.exe', 'nissrv.exe',
  'systemsettings.exe', 'applicationframehost.exe', 'textinputhost.exe', 'userinit.exe',
  'dashost.exe', 'sppsvc.exe', 'backgroundtaskhost.exe', 'backgroundtransferhost.exe',
  'smartscreen.exe', 'userprofilemanager.exe', 'rundll32.exe', 'igfxcuiservice.exe', 'igfxem.exe',
  'taskmgr.exe', 'compattelrunner.exe', 'wudfhost.exe', 'usocoreworker.exe',
  'mousocoreworker.exe', 'searchui.exe', 'searchindexer.exe', 'cshell.exe', 'shellinternal.exe',
  'lockapp.exe', 'appvshnotify.exe', 'sgrmbroker.exe', 'presentationsh.exe', 'upnpcont.exe',
  
  // Unix
  'systemd', 'kthreadd', 'rcu_gp', 'rcu_par_gp', 'kworker', 'mm_percpu_wq', 
  'rcu_tasks_kth', 'rcu_tasks_trace', 'ksoftirqd', 'rcu_preempt', 'migration', 
  'cpuhp', 'kdevtmpfs', 'netns', 'rcu_tasks_rudel', 'kauditd', 'khungtaskd', 
  'oom_reaper', 'writeback', 'kcompactd0', 'ksmd', 'khugepaged', 'crypto', 
  'kintegrityd', 'kblockd', 'tpm_dev_wq', 'md', 'edac-poller', 'watchdogd', 
  'kswapd0', 'bash', 'sh', 'zsh', 'tmux', 'screen', 'init', 'systemd-journald', 
  'systemd-udevd', 'systemd-networkd', 'systemd-resolved', 'systemd-logind', 
  'dbus-daemon', 'dbus-broker', 'cron', 'crond', 'rsyslogd', 'syslogd',
  'acpid', 'agetty', 'login', 'sshd', 'networkmanager', 'wpa_supplicant', 
  'dhclient', 'polkitd', 'irqbalance', 'auditd', 'sleep'
]);

// Explicit foreign apps that definitively indicate a workstation
const KNOWN_FOREIGN_APPS = new Set([
  'photoshop.exe', 'lightroom.exe', 'chrome.exe', 'msedge.exe', 'steam.exe', 
  'discord.exe', 'blender.exe', 'firefox.exe', 'obs64.exe', 'vlc.exe', 
  'slack.exe', 'teams.exe', 'zoom.exe', 'winword.exe', 'excel.exe'
]);

let overrideDedicated = null;

export function setDedicatedOverride(bool) {
  overrideDedicated = bool;
}

export const PROCESS_WHITELIST = new Set([
  ...REELOS_WHITELIST,
  ...DEV_WHITELIST,
  ...SYSTEM_WHITELIST,
]);

export function isWhitelisted(processName) {
  if (!processName) return false;
  const p = processName.toLowerCase();
  if (REELOS_WHITELIST.has(p)) return true;
  if (DEV_WHITELIST.has(p)) return true;
  if (SYSTEM_WHITELIST.has(p)) return true;
  if (p.startsWith('kworker/')) return true;
  if (p.startsWith('svchost.exe')) return true;
  return false;
}

export function extractForeignProcesses(processList = []) {
  const foreign = new Set();
  for (const item of processList) {
    const name = String(item || '').trim().toLowerCase();
    if (!name) continue;
    if (KNOWN_FOREIGN_APPS.has(name)) {
      foreign.add(name);
    } else if (!isWhitelisted(name)) {
      foreign.add(name);
    }
  }
  return Array.from(foreign).sort();
}

export function getForeignProcesses() {
  const isWindows = os.platform() === 'win32';
  const foreignProcesses = new Set();
  
  try {
    if (isWindows) {
      const output = execSync('tasklist /FO CSV /NH', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      const lines = output.trim().split('\n');
      for (const line of lines) {
        if (!line) continue;
        // Strip quotes and carriage returns
        const cleanLine = line.replace(/"/g, '').replace(/\r/g, '');
        const parts = cleanLine.split(',');
        if (parts.length > 0) {
          const processName = parts[0].toLowerCase();
          if (KNOWN_FOREIGN_APPS.has(processName)) {
            foreignProcesses.add(processName);
          } else if (!isWhitelisted(processName)) {
            foreignProcesses.add(processName);
          }
        }
      }
    } else {
      const output = execSync('ps -eo comm', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      for (let i = 1; i < lines.length; i++) {
        const processName = lines[i].trim().toLowerCase();
        if (processName && !isWhitelisted(processName)) {
          foreignProcesses.add(processName);
        }
      }
    }
  } catch (error) {
    if (process.env.REELOS_DEBUG_MACHINE_CLASSIFIER === '1') {
      console.error('Error fetching process list:', error);
    }
  }

  return Array.from(foreignProcesses);
}

export function classifyMachine(options = {}) {
  let isDedicated = false;
  let mode = MACHINE_MODES.SHARED_WORKSTATION;

  if (overrideDedicated !== null) {
    isDedicated = Boolean(overrideDedicated);
    mode = isDedicated ? MACHINE_MODES.DEDICATED_APPLIANCE : MACHINE_MODES.SHARED_WORKSTATION;
  } else if (process.env.REELOS_DEDICATED === '1') {
    isDedicated = true;
    mode = MACHINE_MODES.DEDICATED_APPLIANCE;
  } else if (process.env.REELOS_DEDICATED === '0') {
    isDedicated = false;
    mode = MACHINE_MODES.SHARED_WORKSTATION;
  } else {
    const stateDir = fs.existsSync('.reelos-state') ? '.reelos-state' : '/var/lib/reelos';
    const configPath = path.join(stateDir, 'system-config.json');
    let configOverride = null;
    if (fs.existsSync(configPath)) {
      try {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        if (config.forceDedicated === true) configOverride = true;
        if (config.forceShared === true) configOverride = false;
      } catch (e) {}
    }

    if (configOverride !== null) {
      isDedicated = configOverride;
      mode = isDedicated ? MACHINE_MODES.DEDICATED_APPLIANCE : MACHINE_MODES.SHARED_WORKSTATION;
    } else {
      const foreignProcs = options.runningProcesses ? extractForeignProcesses(options.runningProcesses) : getForeignProcesses();
      isDedicated = foreignProcs.length === 0;
      mode = isDedicated ? MACHINE_MODES.DEDICATED_APPLIANCE : MACHINE_MODES.SHARED_WORKSTATION;
    }
  }

  if (options && options.returnReport) {
    return {
      classification: mode,
      isDedicated,
      foreignProcesses: options.runningProcesses ? extractForeignProcesses(options.runningProcesses) : getForeignProcesses(),
    };
  }

  return mode;
}

export function isDedicatedMachine() {
  return classifyMachine() === MACHINE_MODES.DEDICATED_APPLIANCE;
}
