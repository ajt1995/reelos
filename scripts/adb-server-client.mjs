import fs from "node:fs";
import net from "node:net";

const host = process.env.ADB_SERVER_HOST || "127.0.0.1";
const port = Number(process.env.ADB_SERVER_PORT || 5037);
const frame = (value) => `${Buffer.byteLength(value).toString(16).padStart(4, "0")}${value}`;

function readExactly(socket, count) {
  return new Promise((resolve, reject) => {
    // Keep the socket in paused/readable mode so bytes that arrive in the
    // same packet as ADB's OKAY marker remain in Node's internal buffer for
    // the next protocol read. Switching temporary `data` listeners used to
    // strand coalesced device-list payloads.
    socket.pause();
    const readable = () => {
      const value = socket.read(count);
      if (value === null) return;
      cleanup();
      resolve(value);
    };
    const cleanup = () => { socket.off("readable", readable); socket.off("error", reject); };
    socket.on("readable", readable);
    socket.once("error", reject);
    readable();
  });
}

async function okay(socket) {
  const status = (await readExactly(socket, 4)).toString();
  if (status === "OKAY") return;
  const length = Number.parseInt((await readExactly(socket, 4)).toString(), 16);
  const message = (await readExactly(socket, length)).toString();
  throw new Error(`ADB ${status}: ${message}`);
}

async function connect() {
  return await new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => resolve(socket));
    socket.once("error", reject);
  });
}

async function select(socket, serial) {
  socket.write(frame(`host:transport:${serial}`));
  await okay(socket);
}

async function collect(socket) {
  const chunks = [];
  for await (const chunk of socket) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function devices() {
  const socket = await connect();
  // The tracking service always emits a fresh length-prefixed snapshot after
  // OKAY; unlike the one-shot service it cannot coalesce the payload with the
  // status bytes and strand our deliberately tiny socket reader.
  socket.write(frame("host:track-devices-l"));
  await okay(socket);
  const length = Number.parseInt((await readExactly(socket, 4)).toString(), 16);
  const value = (await readExactly(socket, length)).toString();
  socket.end();
  return value;
}

async function hostService(name) {
  const socket = await connect();
  socket.write(frame(`host:${name}`));
  await okay(socket);
  const length = Number.parseInt((await readExactly(socket, 4)).toString(), 16);
  const value = (await readExactly(socket, length)).toString();
  socket.end();
  return value;
}

async function shell(serial, command) {
  const socket = await connect();
  await select(socket, serial);
  socket.write(frame(`exec:${command}`));
  await okay(socket);
  return (await collect(socket)).toString("utf8");
}

async function install(serial, apkPath) {
  const stat = fs.statSync(apkPath);
  if (!stat.isFile() || stat.size < 1) throw new Error("APK is unavailable.");
  const socket = await connect();
  await select(socket, serial);
  socket.write(frame(`exec:cmd package install -r -S ${stat.size}`));
  await okay(socket);
  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(apkPath);
    input.once("error", reject);
    input.once("end", resolve);
    input.pipe(socket, { end: false });
  });
  socket.end();
  return (await collect(socket)).toString("utf8");
}

async function screenshot(serial, outputPath) {
  const socket = await connect();
  await select(socket, serial);
  socket.write(frame("exec:screencap -p"));
  await okay(socket);
  const bytes = await collect(socket);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pngOffset = bytes.indexOf(pngSignature);
  if (pngOffset < 0) throw new Error(`ADB screencap returned no PNG (${bytes.toString("utf8", 0, 160)})`);
  const png = bytes.subarray(pngOffset);
  fs.writeFileSync(outputPath, png);
  return `${png.length} bytes\n`;
}

const [action = "devices", serial, ...rest] = process.argv.slice(2);
if (action === "devices") console.log(await devices());
else if (action === "server" && serial) console.log(await hostService(serial));
else if (action === "shell" && serial && rest.length) process.stdout.write(await shell(serial, rest.join(" ")));
else if (action === "install" && serial && rest.length === 1) process.stdout.write(await install(serial, rest[0]));
else if (action === "screenshot" && serial && rest.length === 1) process.stdout.write(await screenshot(serial, rest[0]));
else throw new Error("Usage: adb-server-client.mjs devices | server <service> | shell <serial> <command...> | install <serial> <apk> | screenshot <serial> <png>");
