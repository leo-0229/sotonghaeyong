import type { NextConfig } from 'next';
import { validatePublicConfig } from './scripts/release-audit.mjs';

validatePublicConfig(process.env);

const config: NextConfig = {
  output: 'export',
  distDir: process.env.MPMS_DIST_DIR ?? '.next',
  trailingSlash: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  images: { unoptimized: true },
  poweredByHeader: false,
  devIndicators: false,
};
export default config;
