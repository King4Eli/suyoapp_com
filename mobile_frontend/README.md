## Generate Android apk
- cd android; ./gradlew assembleRelease; cd ..;

## Generate Android bundle
- npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output _app/php/static_page/generated/index.android.bundle --assets-dest _app/php/static_page/generated/assets/

## Generate IOS bundle
- npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output _app/php/static_page/generated/main.jsbundle --assets-dest ios

xed .
- npx react-native run-ios --mode Release
