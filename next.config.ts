import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // O maior PDF de homologação tem ~1,9 MB. O backend ainda aplica seu
      // próprio limite de 10 MB e valida o cabeçalho do arquivo.
      bodySizeLimit: "11mb",
    },
  },
  // O extrator Python é um recurso de runtime, não um módulo importado pelo JS.
  outputFileTracingIncludes: {
    "/*": ["./GENUS-APP/**/*.py", "./GENUS-APP/requirements.txt"],
  },
};

export default nextConfig;
