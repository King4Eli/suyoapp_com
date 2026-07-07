/**
 * @format
 */
import 'react-native-reanimated'; // FIRST LINE
import { AppRegistry } from 'react-native';
import App from './_app/screens/App'; 
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
