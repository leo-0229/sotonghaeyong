import {defineConfig,devices} from '@playwright/test';

// All requests to this reserved, fake host are intercepted by the tests.
export default defineConfig({
  testDir:'./tests/auth',workers:1,retries:0,
  use:{baseURL:'http://127.0.0.1:3101',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:{
    command:'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3101',
    url:'http://127.0.0.1:3101',reuseExistingServer:false,timeout:60000,
    env:{MPMS_DIST_DIR:'.local/next-auth-e2e',NEXT_PUBLIC_BASE_PATH:'',NEXT_PUBLIC_SUPABASE_URL:'https://auth-test.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fake_browser_test_only'},
  },
});
