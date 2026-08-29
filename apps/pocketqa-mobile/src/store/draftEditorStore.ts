import { create } from "zustand";
import type { TestDraft } from "@domain";
import { PocketQaNative } from "@native";

interface DraftEditorState {
  base?: TestDraft;
  draft?: TestDraft;
  dirty: boolean;
  saving: boolean;
  warnings: string[];
  errors: string[];
  load(draftId: string): Promise<void>;
  patch(patch: Partial<TestDraft>): void;
  save(): Promise<void>;
  approve(): Promise<void>;
  discard(): void;
}

export const useDraftEditorStore = create<DraftEditorState>((set, get) => ({
  dirty: false,
  saving: false,
  warnings: [],
  errors: [],
  async load(draftId: string) {
    const draft = await PocketQaNative.getDraft(draftId);
    set({ base: draft, draft, dirty: false, warnings: [], errors: [] });
  },
  patch(patch) {
    const current = get().draft;
    if (!current) return;
    set({ draft: { ...current, ...patch }, dirty: true });
  },
  async save() {
    const { draft, base } = get();
    if (!draft || !base) return;
    set({ saving: true });
    try {
      const saved = await PocketQaNative.saveDraft({ draftId: draft.id, baseRevision: 1, patch: draft });
      set({ base: saved, draft: saved, dirty: false, saving: false });
    } catch (err) {
      set({ saving: false, errors: [String(err)] });
    }
  },
  async approve() {
    // Persist first. validateDraft reads the draft from Room, while edits made
    // during review live only in this store until save() runs — so approving
    // straight after adding an assertion validated the *old* draft and reported
    // "At least one end-state assertion is required" with the assertion plainly
    // visible on screen. You cannot validate what you have not persisted.
    if (get().dirty) await get().save();
    const { draft, errors } = get();
    if (!draft) throw new Error("no draft");
    if (errors.length) throw new Error("save failed");
    const validation = await PocketQaNative.validateDraft(draft.id);
    if (!validation.valid) {
      set({ errors: validation.errors, warnings: validation.warnings });
      throw new Error("validation");
    }
    await PocketQaNative.approveDraft(draft.id);
    set({ base: undefined, draft: undefined, dirty: false, warnings: [], errors: [] });
  },
  discard() { set({ base: undefined, draft: undefined, dirty: false, warnings: [], errors: [] }); },
}));
