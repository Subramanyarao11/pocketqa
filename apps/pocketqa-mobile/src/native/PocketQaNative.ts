import { NativeEventEmitter, Platform } from "react-native";
import NativePocketQaModule from "./NativePocketQaModule";
import type { PocketQaEvent, PocketQaNativeApi } from "./types";
import { createMockPocketQaNative } from "./mock";

/**
 * PocketQaNative — the single façade every feature imports (§11).
 *
 * The Kotlin side is a TurboModule; at runtime we resolve it via
 * `TurboModuleRegistry.get<Spec>("PocketQaModule")` (see
 * `./NativePocketQaModule.ts`).  When the module isn't registered — in unit
 * tests or when the app runs against the JS mock harness — we fall back to a
 * deterministic mock that reuses the shared domain modules.
 *
 * Callers never branch on which path is active.
 */

interface EventShape {
  addListener?: (name: string) => void;
  removeListeners?: (count: number) => void;
  [command: string]: unknown;
}

function buildRealFacade(mod: NonNullable<typeof NativePocketQaModule>): PocketQaNativeApi {
  const emitter = new NativeEventEmitter(mod as unknown as EventShape as never);
  const listener = (cb: (e: PocketQaEvent) => void) => {
    const sub = emitter.addListener("PocketQaEvent", cb);
    return () => sub.remove();
  };

  // Every method on the TurboModule spec returns a Promise. We proxy through
  // to keep the JS surface identical to the mock — `PocketQaNative.doThing()`
  // works whether `doThing` is a Kotlin method or a mock function.
  return new Proxy({} as PocketQaNativeApi, {
    get(_target, prop: string) {
      if (prop === "addListener") return listener;
      const fn = (mod as unknown as Record<string, unknown>)[prop];
      if (typeof fn === "function") {
        return (...args: unknown[]) => (fn as (...a: unknown[]) => unknown).apply(mod, args);
      }
      return undefined;
    },
  });
}

const impl: PocketQaNativeApi = NativePocketQaModule
  ? buildRealFacade(NativePocketQaModule)
  : createMockPocketQaNative();

if (!NativePocketQaModule && Platform.OS !== "web") {
  // eslint-disable-next-line no-console
  console.warn(
    "[PocketQA] TurboModule PocketQaModule not linked — using deterministic mock. " +
      "Build android/app with newArchEnabled=true to enable device-backed capture and replay."
  );
}

export const PocketQaNative = impl;
