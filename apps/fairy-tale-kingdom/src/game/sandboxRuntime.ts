import {
  DEFAULT_SANDBOX_SETTINGS,
  loadSandboxSettings,
  normalizeSandboxSettings,
  type SandboxSettings,
} from '../kingdom/sandboxSettings';

/** Module cache so balance helpers without a Scene can read live sandbox knobs. */
let runtime: SandboxSettings = loadSandboxSettings();

export function setSandboxRuntime(settings: SandboxSettings): void {
  runtime = normalizeSandboxSettings(settings);
}

export function getSandboxRuntime(): SandboxSettings {
  return runtime;
}

export function resetSandboxRuntimeDefaults(): void {
  runtime = structuredClone(DEFAULT_SANDBOX_SETTINGS);
}
