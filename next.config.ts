import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ponytail: IP fija de la red local; cámbiala si tu router asigna otra
  allowedDevOrigins: ["192.168.0.47"],
};

export default nextConfig;
