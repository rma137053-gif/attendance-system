import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ruilun.attendance',
  appName: '瑞伦打卡',
  webDir: 'dist',
  server: {
    // Allow the app to connect to a remote API server
    // Change this to your actual server URL in production
    cleartext: true, // Allow HTTP in dev
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
