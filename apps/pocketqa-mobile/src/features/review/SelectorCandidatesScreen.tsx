import { Text } from "react-native";
import type { ScreenProps } from "@navigation";
import { AppScreen, Card, TopBar } from "@components";
import { typography } from "@theme";

/** Sheet-style screen (§7.9 sub-flow). Placeholder — populated during RN-3. */
export function SelectorCandidatesScreen({ navigation, route }: ScreenProps<"SelectorCandidates">) {
  return (
    <>
      <TopBar title="Selector candidates" subtitle={`Step ${route.params.stepId}`} onBack={() => navigation.goBack()} />
      <AppScreen>
        <Card>
          <Text style={typography.h2}>Grounded candidate list</Text>
          <Text style={typography.bodyMuted}>
            Native repo returns policy-filtered selector candidates ranked by stability. The user
            confirms one; the executor never picks silently.
          </Text>
        </Card>
      </AppScreen>
    </>
  );
}
