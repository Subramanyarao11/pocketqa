import { View } from "react-native";
import { layout } from "@theme";

/** Flexible gap that pushes siblings apart inside a row — the `flex: 1` filler. */
export function Spacer() {
  return <View style={layout.fill} />;
}
