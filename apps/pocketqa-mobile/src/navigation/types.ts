import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type RootStackParamList = {
  StartupGate: undefined;
  Welcome: undefined;
  Disclosure: undefined;
  Readiness: { returnTo?: "Intent" | "Settings" } | undefined;
  Home: undefined;
  Intent: { duplicateFromTestId?: string } | undefined;
  // targetName travels with the intent so the pre-capture screen can name the
  // app the operator actually chose instead of assuming Demo Shop.
  CaptureReady: { intentId: string; targetName?: string };
  CaptureStatus: { sessionId: string };
  CompileProgress: { compileJobId: string };
  ReviewTest: { draftId: string };
  SelectorCandidates: { draftId: string; stepId: string };
  EvidenceDetail: { stateId: string };
  ReplayMissionControl: { testId: string; version: number };
  Evidence: { runId: string };
  AgentLab: undefined;
  MissionReview: { missionId: string };
  ExplorerMissionControl: { missionId: string };
  Settings: undefined;
  ProviderSettings: undefined;
  DataAndPrivacy: undefined;
  AboutAndLimits: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

declare global {
  namespace ReactNavigation {
    // Merge our param list into the global type so `useNavigation()` is typed.
    interface RootParamList extends RootStackParamList {}
  }
}
