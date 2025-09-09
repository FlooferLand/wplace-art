export type Json = Record<string, any>;

export type GeneratorMetadata = {
    name: string,
    credits: {
        /** The maintainers / helpers of the drawing */
        authors: Array<string>,

        /** The people who actually made the art */
        artists: Array<string> | undefined,

        /** Any additional credits */
        additional: string | undefined
    },
    license: string | undefined,
    png: string,
    coords: {
        /** The Wplace link */
        link: string,

        /** The top left pixel */
        top_left: { x: number, y: number }
    }
}

export type GeneratorOverlay = {
    version: number,
    name: string,
    imageUrl: string,
    pixelUrl: string,
    offsetX: number,
    offsetY: number,
    opacity: number,
}
