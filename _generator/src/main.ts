import fs from "node:fs/promises";
import path from "node:path";
import type { GeneratorMetadata, GeneratorOverlay } from "./types";
import * as md from "ts-markdown-builder";
import { formatUsers, generateSchema, loadJsonWithSchema } from "./util";
import dedent from "dedent";

console.clear();

const rootDirPath = path.join(import.meta.dir, "..", "..");
const github = {
    link: "https://github.com/FlooferLand/wplace-art",
    issues: "https://github.com/FlooferLand/wplace-art/issues",
    pulls: "https://github.com/FlooferLand/wplace-art/pulls"
}

// Generating schemas
const metadataSchema = await generateSchema(path.join(rootDirPath, "metadataSchema.json"), "GeneratorMetadata");
const overlaySchema = await generateSchema(path.join(rootDirPath, "overlaySchema.json"), "GeneratorOverlay");

// Reading everything
let links: { name: string, repo_link: string, wplace_link: string }[] = [];
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
                md.codeBlock(JSON.stringify(overlay, null, 4), { language: "json" }),
                `> Use this with ${md.link("https://greasyfork.org/en/scripts/545041-wplace-overlay-pro", "Overlay Pro")} in order to view the art as you're painting. It helps with repairs immensely.`
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
        `<img src="./${metadata.png}" height="300px" style="image-rendering: pixelated; height: 300px;" />`,
        
        // Coords
        md.heading("Coords", { level: 2 }),
        "Top left pixel: " + md.link(metadata.coords.link, `${metadata.coords.top_left.x}, ${metadata.coords.top_left.y}`),

        // Credits
        md.heading("Credits", { level: 2 }),
        formatUsers("Artist", metadata.credits.artists),
        formatUsers("Maintainer", metadata.credits.maintainers),
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

    // Adding path to repo links & finished notice
    const id = metadata.name.toLowerCase().trim().replaceAll(' ', '-');
    links.push({
        name: metadata.name,
        repo_link: `./${dataId}#${id}`,
        wplace_link: metadata.coords.link
    });
    console.log(`Wrote to '${dataId}'!`);
}

// Generating main README.md
const mainReadme = md.joinBlocks([
    // Heading
    md.heading("wplace-art"),
    "This repo contains a bunch of art I'm making for wplace, as well as art I'm helping maintain.",

    // Index
    md.heading("Index", { level: 2 }),
    md.orderedList(
        links.map(({ name, repo_link, wplace_link }) => {
            return `${md.link(repo_link, name)} ${md.link(wplace_link, md.italic("[Q]"))}`
        })
    ),
    md.italic("Click the 'Q' for a quick link that takes you directly to the wplace url!"),

    // Grief watch
    md.heading("Grief watch", { level: 3 }),
    "Currently griefed:",
    "- W.I.P SECTION NOT FINISHED",

    // Help!
    md.heading("Help against griefers!", { level: 2 }),
    "If you'd like to help fight against griefers, click the coordinates inside the pages to be sent to their locations on wplace.",
    dedent`
        If you use any overlay mods,
        I've sometimes provided JSON files for ${md.link("https://greasyfork.org/en/scripts/545041-wplace-overlay-pro", "Overlay Pro")}
        inside the README.md of art.
    `,
    `The reference images will update as well due to them being hosted on my Git repo, so its generally just nice to work with.`,

    // Contribute
    md.heading("Contribute art!", { level: 2 }),
    `If you'd like to add art to this repository, you can!\n`,
    `Open up an ${md.link(github.issues, "issue")} (to ask for it to be added), or a ${md.link(github.pulls, "pull request")} (to add it yourself).\n`,
    `Make sure you are ${md.italic("NOT")} modifying any markdown ${md.italic("(md)")} files yourself as those are automatically generated.\n`,

    // License
    md.heading("License", { level: 2 }),
    "Some of these artworks have no license, some do. Always check before using any of them\n",
    "View the `LICENSE.md` of each directory respectively, as some are my own works.",

    // Contact
    md.heading("Other stuff", { level: 2 }),
    md.italic("Feel free to contact me at Discord on \[AT\] flooferland"),
    md.italic("I also recommend you buy or build Aseprite from source to view the aseprite files."),

    // End note
    md.horizontalRule,
    md.blockquote("[!NOTE]\nAll README files in this repo are automatically generated via my [_generator/](./_generator) scripts to keep things consistent.")
]);
await fs.writeFile(path.join(rootDirPath, "README.md"), mainReadme, { encoding: "utf8" });
