// Tiene que ser el primer import del archivo (lo pide react-native-gesture-
// handler, que usa el menú lateral de administrador) — antes de cualquier
// otra cosa, incluido 'expo'.
import 'react-native-gesture-handler';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
