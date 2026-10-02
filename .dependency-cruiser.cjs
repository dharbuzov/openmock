module.exports = {
  forbidden: [
    {
      name: "engine-independent-of-integrations",
      severity: "error",
      from: { path: "^src/lib/interview/engine\\.ts$" },
      to: {
        path: "^src/lib/(ai|settings|logging)/|(^|/)node_modules/(ai|@ai-sdk)(/|$)",
      },
    },
    {
      name: "storage-independent-of-domains",
      severity: "error",
      from: { path: "^src/lib/storage/" },
      to: {
        path: "^src/lib/(ai|code|diagram|interview|problems|settings|voice)/",
      },
    },
    {
      name: "storage-independent-of-react",
      severity: "error",
      from: { path: "^src/lib/storage/" },
      to: { path: "(^|/)node_modules/(react|react-dom)(/|$)" },
    },
    {
      name: "domains-independent-of-components",
      severity: "error",
      from: { path: "^src/lib/(storage|interview|problems)/" },
      to: { path: "^src/components/" },
    },
    {
      name: "no-circular-dependencies",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-unresolved-dependencies",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    // Excalidraw exposes type-only subpaths and a production-only CSS export.
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["types", "import", "require", "production", "default"],
    },
  },
};
