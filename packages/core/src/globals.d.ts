// The few web-standard globals the engine uses. Every target (Node, Electron, browsers,
// React Native's Hermes) has them; declaring them here keeps DOM and Node types out of core.
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare class TextDecoder {
  constructor(label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean });
  decode(input?: ArrayBufferView | ArrayBuffer, options?: { stream?: boolean }): string;
}
