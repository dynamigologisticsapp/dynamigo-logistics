import { spawn } from "node:child_process";
import os from "node:os";

function getLanAddress() {
  const interfaces = os.networkInterfaces();
  const preferredNames = ["en0", "en1", "bridge100"];

  for (const name of preferredNames) {
    const address = interfaces[name]?.find(
      (item) => item.family === "IPv4" && !item.internal,
    );
    if (address?.address) {
      return address.address;
    }
  }

  for (const addresses of Object.values(interfaces)) {
    const address = addresses?.find(
      (item) => item.family === "IPv4" && !item.internal,
    );
    if (address?.address) {
      return address.address;
    }
  }

  return null;
}

const lanAddress = getLanAddress();
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL
  || (lanAddress ? `http://${lanAddress}:3000` : "");

if (apiBaseUrl) {
  console.log(`[expo] API URL for Expo Go: ${apiBaseUrl}`);
} else {
  console.warn("[expo] Could not detect a LAN API URL. Set EXPO_PUBLIC_API_BASE_URL manually if the app cannot load data.");
}

const child = spawn(
  "npx",
  ["expo", "start", "--lan", "--clear", "--port", "19000"],
  {
    env: {
      ...process.env,
      EXPO_USE_METRO_WORKSPACE_ROOT: "1",
      EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
    },
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 0);
});
