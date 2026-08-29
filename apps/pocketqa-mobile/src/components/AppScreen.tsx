import { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useThemeStyles, type AppTheme } from "@theme";

/** Standard screen frame — safe area, background, keyboard, optional scroll. */
export function AppScreen({
  children,
  scroll = true,
  padded = true,
  safeTop = false,
}: PropsWithChildren<{ scroll?: boolean; padded?: boolean; safeTop?: boolean }>) {
  const styles = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  const topInset = safeTop
    ? Math.max(
        insets.top,
        Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
      )
    : 0;
  const inner = padded ? styles.padded : undefined;
  return (
    <View style={[styles.root, topInset > 0 && { paddingTop: topInset }]}>
      <SafeAreaView style={styles.flex} edges={["left", "right"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {scroll ? (
            <ScrollView
              contentContainerStyle={inner}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentInsetAdjustmentBehavior="never"
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.flex, inner]}>{children}</View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) => ({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  padded: {
    paddingHorizontal: 20,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
});
