export type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  Intent: undefined;
  CaptureStatus: undefined;
  ReviewTest: {testId: string};
  Replay: {testId: string};
  Evidence: {testId: string};
  Explorer: undefined;
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
