import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.hiu.yhctsocial',
  appName: 'YHCT Social',
  webDir: 'mobile-shell',
  server: {
    url: 'https://yhct-social.vercel.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
