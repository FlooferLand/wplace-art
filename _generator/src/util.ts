import path from "node:path";
import fs from "node:fs/promises";
import tsj from "ts-json-schema-generator";
import Ajv from "ajv";
import * as md from "ts-markdown-builder";
import type { Json } from "./types";

const ajv = new Ajv();

export async function generateSchema(outPath: string, typeName: string): Promise<any> {
    const schema = tsj.createGenerator({
        path: "types.ts",
        tsconfig: path.join(import.meta.dir, "..", "tsconfig.json"),
        type: typeName
    }).createSchema(typeName);
    const schemaString = JSON.stringify(schema, null, 4);
    await fs.writeFile(outPath, schemaString);
    return schema;
}

/** Returns some JSON, or null if the schema isn't correct */
export async function loadJsonWithSchema<T>(filePath: string, schema: any): Promise<T | null> {
    const data: Json = JSON.parse(await fs.readFile(filePath, { "encoding": "utf8" }));
    if (!ajv.validate(schema, data)) {
        console.error(`Invalid data for ${path.basename(filePath)}; Does not follow schema.`);
        return null;
    }
    return data as T;
}

/** Formats users as markdown */
export function formatUsers(singleName: string, users: string[] | undefined): string {
    if (users == undefined) {
        return ""
    }
    const formatUser = (name: string): string => {
        const split = name.split('#', 2);
        if (split.length != 2) {
            console.warn(`User '${name}' (at '${singleName}') didn't have a valid wplace username.`);
            return name;
        }
        return split.map(s => s.trim()).join(' #');
    }
    
    let maintainers = "";
    if (users.length == 1 && users[0] !== undefined) {
        maintainers = `${singleName}: ${formatUser(users[0])}`
    } else if (users.length > 0) {
        maintainers += md.orderedList(
            users
                .filter(user => !user.startsWith("#"))
                .map(user => `${singleName}s: ${formatUser(user)}`)
        );
    } else {
        maintainers = "";
    }
    return maintainers;
}