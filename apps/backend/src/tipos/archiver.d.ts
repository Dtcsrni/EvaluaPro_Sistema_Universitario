declare module 'archiver' {
  import { Readable, Transform } from 'node:stream';

  export class ZipArchive extends Transform {
    constructor(options: { store: boolean });
    append(source: Buffer | Readable, options: { name: string }): this;
    finalize(): Promise<void>;
    abort(): this;
  }
}
