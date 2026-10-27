export {};

declare global {
  interface Window {
    __hollowmere?: {
      ready: boolean;
      width: number;
      height: number;
      regions: Record<string, { x: number; y: number; w: number; h: number }>;
      beatReady: boolean;
      getSave: () => unknown;
      debugSetLastTick: (ts: number) => void;
      last: { x: number; y: number } | null;
    };
  }
}
