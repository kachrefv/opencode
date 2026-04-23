import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { Configuration } from "electron-builder"

const execFileAsync = promisify(execFile)
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const signScript = path.join(rootDir, "script", "sign-windows.ps1")

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

const getBase = (): Configuration => ({
  artifactName: "carthis-electron-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  files: ["out/**/*", "resources/**/*"],
  extraResources: [
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: `resources/icons/icon.icns`,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    notarize: true,
    target: ["dmg", "zip"],
  },
  dmg: {
    sign: true,
  },
  protocols: {
    name: "Carthis",
    schemes: ["carthis"],
  },
  win: {
    icon: `resources/icons/icon.png`,
    signtoolOptions: {
      sign: signWindows,
    },
    target: ["nsis"],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
  linux: {
    icon: `resources/icons`,
    category: "Development",
    target: ["AppImage", "deb", "rpm"],
  },
})

function getConfig() {
  const base = getBase()

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId: "ai.carthis.desktop.dev",
        productName: "Carthis",
        rpm: { packageName: "carthis-dev" },
      }
    }
    case "beta": {
      return {
        ...base,
        appId: "ai.carthis.desktop.beta",
        productName: "Carthis Beta",
        protocols: { name: "Carthis Beta", schemes: ["carthis"] },
        publish: { provider: "github", owner: "anomalyco", repo: "carthis-beta", channel: "latest" },
        rpm: { packageName: "carthis-beta" },
      }
    }
    case "prod": {
      return {
        ...base,
        appId: "ai.carthis.desktop",
        productName: "Carthis",
        protocols: { name: "Carthis", schemes: ["carthis"] },
        publish: { provider: "github", owner: "anomalyco", repo: "carthis", channel: "latest" },
        rpm: { packageName: "carthis" },
      }
    }
  }
}

export default getConfig()
