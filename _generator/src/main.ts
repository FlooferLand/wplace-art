import fs from "node:fs/promises";
import path from "node:path";
import type { GeneratorMetadata, GeneratorOverlay } from "./types";
import * as md from "ts-markdown-builder";
import { formatUsers, generateSchema, loadJsonWithSchema } from "./util";

console.clear();

const rootDirPath = path.join(import.meta.dir, "..", "..");

// Generating schemas
const metadataSchema = await generateSchema(path.join(rootDirPath, "metadataSchema.json"), "GeneratorMetadata");
const overlaySchema = await generateSchema(path.join(rootDirPath, "overlaySchema.json"), "GeneratorOverlay");

// Reading everything
for (const dataId of await fs.readdir(rootDirPath)) {
    const rootSubDir = path.join(rootDirPath, dataId);
    const dataStat = await fs.lstat(rootSubDir);
    if (!dataStat.isDirectory()) continue;
    const dataPath = path.join(rootSubDir, "data");
    if (!(await fs.exists(path.join(dataPath, "metadata.json")))) {
        continue;
    }

    // Reading the metadata JSON
    const metadataPath = path.join(dataPath, "metadata.json");
    const metadata = await loadJsonWithSchema<GeneratorMetadata>(metadataPath, metadataSchema);
    if (metadata == null) {
        continue;
    }

    // Reading the overlay JSON (might not exist, thas fine)
    const overlayPath = path.join(dataPath, "overlay.json");
    let overlayMd = "";
    if (await fs.exists(overlayPath)) {
        const overlay = await loadJsonWithSchema<GeneratorOverlay>(overlayPath, overlaySchema);
        if (overlay != null) {
            // Validating the overlay
            const resp = await fetch(overlay.imageUrl, { method: "GET" });
            if (!resp.ok || (await resp.arrayBuffer()).byteLength < 10) {
                console.error(`Invalid imageUrl for '${dataId}'; No valid image found at URL.`);
                continue;
            }

            // Writing the markdown
            overlayMd = md.joinBlocks([
                md.heading("Overlay Pro overlay", { level: 2 }),
                md.codeBlock(JSON.stringify(overlay, null, 4))
            ])
        }
    }

    // License
    let licenseMd = "";
    if (metadata.license != undefined) {
        licenseMd = md.joinBlocks([
            md.heading("License", { level: 2 }),
            "This art is licensed under " + md.link("./LICENSE.md", metadata.license)
        ])
    }

    // Generating README.md
    const header = md.heading(metadata.name);
    const readme = md.joinBlocks([
        header,
        
        // Preview
        `<img src="./${metadata.png}" height="200px" style="image-rendering: pixelated;" />`,
        
        // Coords
        md.heading("Coords", { level: 2 }),
        "Top left pixel: " + md.link(metadata.coords.link, `${metadata.coords.top_left.x}, ${metadata.coords.top_left.y}`),

        // Credits
        md.heading("Credits", { level: 2 }),
        formatUsers("Author", metadata.credits.authors),
        formatUsers("Artist", metadata.credits.artists),
        metadata.credits.additional != undefined ? metadata.credits.additional : "",

        // License
        licenseMd,

        // Overlay
        overlayMd,

        // End note
        md.horizontalRule,
        md.blockquote("[!NOTE]\nThis page is automatically generated via [_generator/](../_generator)")
    ]);
    const outDir = path.join(rootDirPath, dataId);
    await fs.writeFile(path.join(outDir, "README.md"), readme, { encoding: "utf8" });

    // Finished
    console.log(`Wrote to '${dataId}'!`);
}
