import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // El APK se descarga con el tipo MIME correcto para que Android lo instale
        source: "/logistica.apk",
        headers: [
          {
            key: "Content-Type",
            value: "application/vnd.android.package-archive",
          },
          {
            key: "Content-Disposition",
            value: 'attachment; filename="logistica.apk"',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
