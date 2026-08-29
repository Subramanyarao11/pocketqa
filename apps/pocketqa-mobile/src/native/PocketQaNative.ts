import { NativeEventEmitter, NativeModules, Platform } from "react-native";
import type { PocketQaEvent, PocketQaNativeApi } from "./types";
import { createMockPocketQaNative } from "./mock";

/**
 * PocketQaNative — the single façade every feature imports (§11).
 *
 * At runtime we look for the real Kotlin module `PocketQaModule`; if it isn't
 * registered (dev or unit-test) we fall back to a deterministic mock that
 * reuses the shared domain modules.  Features never branch on this.
 */

interface NativeShape {
  addListener?: (event: string) => void;
  removeListeners?: (count: number) => void;
  [command: string]: unknown;
}

const nativeModule = (NativeModules as { PocketQaModule?: NativeShape }).PocketQaModule;

function buildRealFacade(mod: NativeShape): PocketQaNativeApi {
  const emitter = new NativeEventEmitter(mod as never);
  const call = <T = unknown>(name: string, arg?: unknown) =>
    Promise.resolve((mod[name] as ((a?: unknown) => Promise<T>) | undefined)?.(arg) as Promise<T>);

  const listener = (cb: (e: PocketQaEvent) => void) => {
    const sub = emitter.addListener("PocketQaEvent", cb);
    return () => sub.remove();
  };

  return new Proxy({} as PocketQaNativeApi, {
    get(_target, prop: string) {
      if (prop === "addListener") return listener;
      return (arg?: unknown) => call(prop, arg);
    },
  });
}

const impl: PocketQaNativeApi = nativeModule
  ? buildRealFacade(nativeModule)
  : createMockPocketQaNative();

if (!nativeModule && Platform.OS !== "web") {
  // eslint-disable-next-line no-console
  console.warn(
    "[PocketQA] Native PocketQaModule not linked — using deterministic mock. " +
      "Build android/app to enable device-backed capture and replay."
  );
}

export const PocketQaNative = impl;
