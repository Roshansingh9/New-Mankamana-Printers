import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load .env from server/ dir explicitly so ts-node/tsx resolves it correctly
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SUPABASE_URL   = process.env.SUPABASE_URL   || "";
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET         = process.env.SUPABASE_BUCKET || "printing-assets";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — check server/.env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Free Designs folder is at repo root (two levels above server/prisma/)
const FREE_DESIGNS_DIR = path.resolve(__dirname, "../../Free Designs");

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const base = path.basename(filename, path.extname(filename));
  // "155_Templat 27" → "template-27", "297-atm-2" → "atm-2", etc.
  const tplMatch = base.match(/^\d+_Templat\s+(\d+)$/i);
  if (tplMatch) return `template-${tplMatch[1]}${ext}`;
  return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + ext;
}

async function ensureBucket(): Promise<void> {
  const { data: list, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.warn(`  [warn] Cannot list buckets: ${listErr.message} — proceeding anyway`);
    return;
  }
  const exists = (list ?? []).some((b) => b.name === BUCKET);
  if (!exists) {
    console.log(`  Bucket '${BUCKET}' not found — creating it as public…`);
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error && !error.message.toLowerCase().includes("already exists")) {
      throw new Error(`Cannot create bucket '${BUCKET}': ${error.message}`);
    }
    console.log(`  Bucket '${BUCKET}' created.\n`);
  } else {
    console.log(`  Bucket '${BUCKET}' confirmed.\n`);
  }
}

async function uploadFile(localPath: string, bucketPath: string): Promise<string | null> {
  const buffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : "image/jpeg";

  const { error } = await supabase.storage.from(BUCKET).upload(bucketPath, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    console.error(`    ✗ ${path.basename(bucketPath)}: ${error.message}`);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(bucketPath);
  return data.publicUrl;
}

async function main() {
  console.log("=== Free Designs Seeder ===");
  console.log(`Bucket : ${BUCKET}`);
  console.log(`Source : ${FREE_DESIGNS_DIR}\n`);

  if (!fs.existsSync(FREE_DESIGNS_DIR)) {
    console.error("Free Designs folder not found at:", FREE_DESIGNS_DIR);
    process.exit(1);
  }

  await ensureBucket();

  const categories = fs
    .readdirSync(FREE_DESIGNS_DIR)
    .filter((n) => fs.statSync(path.join(FREE_DESIGNS_DIR, n)).isDirectory());

  const summary: Record<string, { preview: boolean; designs: number }> = {};

  for (const category of categories) {
    const categoryDir = path.join(FREE_DESIGNS_DIR, category);
    const slug = toSlug(category);
    console.log(`▶ ${category}  →  free-designs/${slug}/`);

    // Upload preview (download.jpg or download.png at category root)
    let previewOk = false;
    for (const previewName of ["download.jpg", "download.png", "Download.jpg"]) {
      const previewLocal = path.join(categoryDir, previewName);
      if (fs.existsSync(previewLocal)) {
        const url = await uploadFile(previewLocal, `free-designs/${slug}/preview.jpg`);
        previewOk = !!url;
        console.log(`    preview → ${previewOk ? "✓" : "✗"}`);
        break;
      }
    }

    // Upload designs from all subfolders (handles one-level and two-level structures)
    let designCount = 0;
    const entries = fs.readdirSync(categoryDir);

    for (const entry of entries) {
      const entryPath = path.join(categoryDir, entry);
      if (!fs.statSync(entryPath).isDirectory()) continue;

      const entrySlug = toSlug(entry);
      const designsSubdir = path.join(entryPath, "Designs");
      const hasDesignsSubdir =
        fs.existsSync(designsSubdir) && fs.statSync(designsSubdir).isDirectory();

      // Upload subfolder-level preview (download.jpg/png) to a stable namespaced path
      for (const previewName of ["download.jpg", "download.png", "Download.jpg"]) {
        const previewLocal = path.join(entryPath, previewName);
        if (fs.existsSync(previewLocal)) {
          const bucketPath = `free-designs/${slug}/${entrySlug}/preview.jpg`;
          const url = await uploadFile(previewLocal, bucketPath);
          console.log(`    ${entry}/preview → ${url ? "✓" : "✗"}`);
          break;
        }
      }

      if (hasDesignsSubdir) {
        // Two-level: upload from <entry>/Designs/ → free-designs/{slug}/{entrySlug}/designs/
        const designFiles = fs
          .readdirSync(designsSubdir)
          .filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
        console.log(`    ${entry}/Designs/ → ${designFiles.length} file(s)`);
        for (const file of designFiles) {
          const normalized = normalizeFilename(file);
          const url = await uploadFile(
            path.join(designsSubdir, file),
            `free-designs/${slug}/${entrySlug}/designs/${normalized}`
          );
          if (url) designCount++;
        }
      } else {
        // One-level: image files sit directly in the subfolder (excluding the preview)
        const files = fs
          .readdirSync(entryPath)
          .filter((f) => /\.(jpg|jpeg|png)$/i.test(f) && !/^download\./i.test(f));
        if (files.length > 0) {
          console.log(`    ${entry}/ → ${files.length} file(s)`);
          for (const file of files) {
            const normalized = normalizeFilename(file);
            const url = await uploadFile(
              path.join(entryPath, file),
              `free-designs/${slug}/designs/${normalized}`
            );
            if (url) designCount++;
          }
        }
      }
    }

    summary[category] = { preview: previewOk, designs: designCount };
    console.log(`    Done. ${designCount} design(s) uploaded.\n`);
  }

  console.log("=== Summary ===");
  let totalDesigns = 0;
  for (const [cat, info] of Object.entries(summary)) {
    console.log(`  ${cat.padEnd(30)} preview=${info.preview ? "✓" : "✗"}  designs=${info.designs}`);
    totalDesigns += info.designs;
  }
  console.log(`\nTotal designs uploaded: ${totalDesigns}`);
  console.log(`\nPublic base URL: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/free-designs/`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
