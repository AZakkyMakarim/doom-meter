/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { startDetection } from './src/detection/runtime';

AppRegistry.registerComponent(appName, () => App);

// Runs at module scope, not inside App, so detection also works when the
// AccessibilityService starts the app process with no screen open.
startDetection();
