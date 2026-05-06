import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.kounterpro.app',
  appName: 'KounterPro',
  webDir: 'out',          // Next.js static export output folder
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
}

export default config
