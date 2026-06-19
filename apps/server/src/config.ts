import path from "node:path";
import process from "node:process";

/** Root directory under which every notebook (vault) lives. */
export const DATA_ROOT = path.resolve(
  process.env.NBLLMVAULT_DATA ?? path.resolve(process.cwd(), "../../data")
);

/** Directory holding one sub-directory per notebook vault. */
export const VAULTS_DIR = path.join(DATA_ROOT, "vaults");

/** Registry file mapping notebook ids -> metadata. */
export const REGISTRY_PATH = path.join(DATA_ROOT, "notebooks.json");

/** Per-notebook inbox where uploaded files land before ingest. */
export const UPLOAD_TMP = path.join(DATA_ROOT, "uploads");

export const PORT = Number(process.env.PORT ?? 8787);

/** Max upload size accepted per file (50 MB). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
