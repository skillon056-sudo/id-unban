/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Builds go to a separate folder (see deploy.sh) so the live server keeps
  // serving the current one until the new build is complete and swapped in.
  // Building into .next directly wipes the running site's CSS and JS for the
  // whole build, and visitors get an unstyled page.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

module.exports = nextConfig;
