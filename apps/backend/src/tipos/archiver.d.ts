declare module 'archiver' {
  import type { Readable } from 'node:stream';

  type Archive = Readable & {
    append(source: Buffer | Readable, options: { name: string }): Archive;
    finalize(): Promise<void>;
  };

  function archiver(format: 'zip', options: { store: boolean }): Archive;
  export default archiver;
}
