declare module 'crypto-js' {
  export function SHA256(data: string): {
    toString(): string;
  };
}