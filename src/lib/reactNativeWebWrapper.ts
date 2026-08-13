// src/lib/reactNativeWebWrapper.ts
import * as RNWeb from 'react-native-web';

export const TurboModuleRegistry = {
  get: (name: string) => null,
  getEnforcing: (name: string) => null,
};

const ReactNative = {
  ...RNWeb,
  TurboModuleRegistry,
};

export default ReactNative;
export * from 'react-native-web';
