import { Text } from "react-native";
import type { ScreenProps } from "@navigation";
import { AppScreen, Card, TopBar } from "@components";
import { typography } from "@theme";

/** Modal-style state inspection (§7.11 sub-flow). Populated during RN-3. */
export function EvidenceDetailScreen({ navigation, route }: ScreenProps<"EvidenceDetail">) {
  return (
    <>
      <TopBar title="State evidence" subtitle={route.params.stateId} onBack={() => navigation.goBack()} />
      <AppScreen>
        <Card>
          <Text style={typography.h2}>Redacted UI tree and screenshot</Text>
          <Text style={typography.bodyMuted}>
            Native repo returns the redacted UIState + `content://` screenshot URI.  This screen
            renders the accessibility tree, OCR text, and diff overlays.
          </Text>
        </Card>
      </AppScreen>
    </>
  );
}
