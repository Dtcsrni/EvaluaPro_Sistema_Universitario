declare module 'tesseract.js' {
  export type RecognizeResult = {
    data?: {
      text?: string;
    };
  };

  export function recognize(
    image: string | Blob | HTMLCanvasElement | HTMLImageElement,
    languages?: string
  ): Promise<RecognizeResult>;
}
