export {};

declare global {
  interface Window {
    __hollow?: {
      room: string;
      mode: string;
      speech: string | null;
      choices: { label: string; x: number; y: number }[];
      spots: { id: string; name: string; x: number; y: number }[];
      items: { id: string; x: number; y: number }[];
      player: { x: number; y: number };
      flags: Partial<Record<string, boolean>>;
      moving: boolean;
      busy: boolean;
      dark: boolean;
      envelope: boolean;
      nameField: boolean;
      spirit: boolean;
      moths: number;
      tone: string;
      june: { x: number; y: number; flip: boolean } | null;
    };
  }
}
