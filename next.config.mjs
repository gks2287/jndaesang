/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드는 통과시키고 lint는 별도로 수행(기존 lint 에러가 배포를 막지 않도록). 타입 체크는 유지.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 비정식 도메인(www + Vercel 자동 프로덕션 도메인) → jnhrcompany.com 영구 리디렉트.
  // 프리뷰 배포 주소(해시 포함)는 목록에 없으므로 영향 없음.
  async redirects() {
    const legacyHosts = [
      'www.jnhrcompany.com',
      'jand-newsletter-admin.vercel.app',
      'jand-newsletter-admin-lee-younghans-projects.vercel.app',
      'jand-newsletter-admin-gks2287-5987-lee-younghans-projects.vercel.app',
    ];
    return legacyHosts.map(host => ({
      source: '/:path*',
      has: [{ type: 'host', value: host }],
      destination: 'https://jnhrcompany.com/:path*',
      permanent: true,
    }));
  },
  // HTTP→HTTPS 리디렉트는 Vercel 엣지에서 자동 처리됨. 추가로 HSTS 헤더를 내려
  // 브라우저가 이후 요청을 항상 HTTPS로 하도록 강제(SSL 스트리핑 방지).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
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
