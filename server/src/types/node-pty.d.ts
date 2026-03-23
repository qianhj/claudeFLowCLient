// Minimal node-pty type declarations for build compatibility
declare module "node-pty" {
  export interface IPty {
    onData(callback: (data: string) => void): void;
    onExit(callback: (e: { exitCode: number; signal?: number }) => void): void;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(signal?: string): void;
    pid: number;
    process: string;
  }

  export interface IPtyForkOptions {
    name?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
    encoding?: string;
    useConpty?: boolean;
    [key: string]: unknown;
  }

  export function spawn(
    file: string,
    args: string[],
    options: IPtyForkOptions
  ): IPty;
}
