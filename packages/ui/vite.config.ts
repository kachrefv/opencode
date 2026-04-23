import { defineConfig } from "vite"
import solidPlugin from "vite-plugin-solid"
import { iconsSpritesheet } from "vite-plugin-icons-spritesheet"
import fs from "fs"

export default defineConfig({
  plugins: [
    solidPlugin(),
    providerIconsPlugin(),
    iconsSpritesheet([
      {
        withTypes: true,
        inputDir: "src/assets/icons/file-types",
        outputDir: "src/components/file-icons",
        formatter: undefined,
      },
      {
        withTypes: true,
        inputDir: "src/assets/icons/provider",
        outputDir: "src/components/provider-icons",
        formatter: undefined,
        iconNameTransformer: (iconName) => iconName,
      },
    ]),
  ],
  server: { port: 3001 },
  build: {
    target: "esnext",
  },
  worker: {
    format: "es",
  },
})

function providerIconsPlugin() {
  return {
    name: "provider-icons-plugin",
    configureServer() {
      void fetchProviderIcons()
    },
    buildStart() {
      void fetchProviderIcons()
    },
  }
}

async function fetchProviderIcons() {
  const url = process.env.OPENCODE_MODELS_URL || "https://models.dev"
  try {
    const providers = await fetch(`${url}/api.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => Object.keys(json))
    await Promise.all(
      providers.map((provider) =>
        fetch(`${url}/logos/${provider}.svg`)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return res.text()
          })
          .then((svg) => fs.writeFileSync(`./src/assets/icons/provider/${provider}.svg`, svg)),
      ),
    )
  } catch (error: any) {
    console.warn(`Failed to fetch provider icons from ${url}:`, error.message)
    // If it fails, we just keep the existing ones in src/assets/icons/provider.
    // The spritesheet plugin will still work with the existing SVGs.
  }
}
