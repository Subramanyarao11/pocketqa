export interface CaptureResult {
  sessionId: string;
  frameCount: number;
  durationMs: number;
}

export interface PocketQaNative {
  startCapture(packageName: string): Promise<string>;
  stopCapture(sessionId: string): Promise<CaptureResult>;
  getAccessibilityTree(packageName: string): Promise<string>;
  isAccessibilityEnabled(): Promise<boolean>;
}

class MockPocketQaNative implements PocketQaNative {
  async startCapture(_packageName: string): Promise<string> {
    return 'mock-session-id';
  }

  async stopCapture(_sessionId: string): Promise<CaptureResult> {
    return {sessionId: _sessionId, frameCount: 0, durationMs: 0};
  }

  async getAccessibilityTree(_packageName: string): Promise<string> {
    return '{"type": "mock", "children": []}';
  }

  async isAccessibilityEnabled(): Promise<boolean> {
    return false;
  }
}

export const pocketQaNative: PocketQaNative = new MockPocketQaNative();
