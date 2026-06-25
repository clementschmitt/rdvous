import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.rdvous.app',
  appName: 'rdvous',
  webDir: 'out',
  server: {
    url: 'https://rdvous.fr',
    cleartext: false,
  },
};

export default config;
