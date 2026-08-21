// הצהרת טיפוס מינימלית ל-bidi-js (אין חבילת @types רשמית).
// משמש את src/lib/og/bidi.ts להמרת טקסט עברי לסדר ויזואלי עבור satori/next-og.
declare module 'bidi-js' {
  export interface BidiApi {
    getEmbeddingLevels(
      text: string,
      baseDirection?: 'ltr' | 'rtl' | 'auto',
    ): {
      levels: Uint8Array;
      paragraphs: Array<{ start: number; end: number; level: number }>;
    };
    getReorderSegments(
      text: string,
      embeddingLevels: ReturnType<BidiApi['getEmbeddingLevels']>,
      start?: number,
      end?: number,
    ): Array<[number, number]>;
    getReorderedString(
      text: string,
      embeddingLevels: ReturnType<BidiApi['getEmbeddingLevels']>,
      start?: number,
      end?: number,
    ): string;
    getReorderedIndices(
      text: string,
      embeddingLevels: ReturnType<BidiApi['getEmbeddingLevels']>,
      start?: number,
      end?: number,
    ): number[];
    getMirroredCharacter(char: string): string | null;
  }
  export default function bidiFactory(): BidiApi;
}
