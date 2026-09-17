import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite ao protocolo de testes de carga (scripts/stress-tests) subir uma
  // segunda instância do servidor num diretório de build separado, sem
  // disputar o .next/ de uma instância "next dev" real que esteja rodando.
  distDir: process.env.STRESS_TEST_DIST_DIR || ".next",
  // Gera .next/standalone: um servidor mínimo com só os node_modules
  // realmente usados em runtime. É o que o empacotador Electron (electron/)
  // roda dentro do .exe, em vez de carregar o projeto inteiro.
  output: "standalone",
  experimental: {
    serverActions: {
      // O maior PDF de homologação tem ~1,9 MB. O backend ainda aplica seu
      // próprio limite de 10 MB e valida o cabeçalho do arquivo.
      bodySizeLimit: "11mb",
    },
  },
  outputFileTracingIncludes: {
    "/*": [
      // O extrator Python é um recurso de runtime, não um módulo importado pelo JS.
      // GENUS-APP/banks/common.py faz `from extract_bank_statements import ...`
      // (scripts/extract_bank_statements.py, fora de GENUS-APP) — sem essa
      // linha o import falha em runtime empacotado (Python sai com código 1,
      // sem stdout) mesmo funcionando normalmente em dev, onde o processo
      // roda a partir da raiz real do projeto e enxerga a pasta scripts/ inteira.
      "./GENUS-APP/**/*.py",
      "./scripts/extract_bank_statements.py",
      "./GENUS-APP/requirements.txt",
      // Binários nativos: o rastreador de dependências às vezes não segue a
      // resolução dinâmica que "bindings"/"better-sqlite3" fazem em runtime,
      // então são incluídos explicitamente para não faltar no build standalone.
      "./node_modules/better-sqlite3/build/Release/*.node",
      "./node_modules/bcrypt/lib/binding/**/*.node",
    ],
  },
};

export default nextConfig;
