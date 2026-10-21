import type { NextConfig } from "next";

// El sitio se sirve en edgarsierra.com/analisis-cana-azucar (el dominio principal reescribe esa ruta a este proyecto).
const nextConfig: NextConfig = {
  basePath: "/analisis-cana-azucar",
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
