export type OperationPhase = 'idle' | 'capturing' | 'processing' | 'reviewing';

export type TestResult = 'pass' | 'fail' | 'error';

export type MissionStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TestStep {
  action: string;
  selector?: string;
  value?: string;
}

export interface DeviceInfo {
  model: string;
  manufacturer: string;
  androidVersion: string;
  sdkVersion: number;
}
