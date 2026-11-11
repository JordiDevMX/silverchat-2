export declare const PRODUCTION_REF: string;
export declare const STAGING_REF: string;

export declare function readProjectRef(root: string): string | null;
export declare function findCrlfMigrations(root: string): string[];

export declare function evaluate(options: {
  expectedRef: string;
  currentRef: string | null;
  crlfFiles: string[];
  allowProduction: boolean;
}): { ok: boolean; errors: string[]; warnings: string[] };
