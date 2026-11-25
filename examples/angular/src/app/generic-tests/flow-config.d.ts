export {};
declare global {
  interface FlowConfig {
    flowProps?: { [k: string]: any; [k: `on${string}`]: (...a: any[]) => void };
    [k: string]: any;
  }
}
