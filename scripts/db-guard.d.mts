export declare const PRODUCTION_REF: string;
export declare const STAGING_REF: string;

export declare function repoRoot(): string;

export declare function readProjectRef(root: string): string | null;
export declare function findCrlfMigrations(root: string): string[];

export declare function evaluate(options: {
  expectedRef: string;
  currentRef: string | null;
  crlfFiles: string[];
  allowProduction: boolean;
}): { ok: boolean; errors: string[] };

export declare function parseArgs(argv: string[]): {
  expect: string | null;
  allowProduction: boolean;
  help: boolean;
};

export declare function runCli(
  argv: string[],
  deps?: {
    root?: string;
    currentRef?: string | null;
    crlfFiles?: string[];
  },
): { code: number; stdout: string; stderr: string };

export declare function isEntryPoint(entryPath: string | undefined): boolean;
