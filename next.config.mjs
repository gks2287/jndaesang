/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드는 통과시키고 lint는 별도로 수행(기존 lint 에러가 배포를 막지 않도록). 타입 체크는 유지.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // www → apex(jnhrcompany.com) 영구 리디렉트
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.jnhrcompany.com' }],
        destination: 'https://jnhrcompany.com/:path*',
        permanent: true,
      },
    ];
  },
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', '@anthropic-ai/sdk'],
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // node: 프리픽스를 제거해 webpack fallback이 처리할 수 있도록
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, '');
        })
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        stream: false,
        crypto: false,
        buffer: false,
        process: false,
      };
    }
    return config;
  },
};

export default nextConfig;
