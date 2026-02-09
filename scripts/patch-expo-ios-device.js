#!/usr/bin/env node
/**
 * iOS 실기기 빌드 시 -allowProvisioningUpdates 가 항상 넘어가도록 Expo CLI 파일을 수정합니다.
 * npm install 후 postinstall 에서 실행됩니다.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo',
  'node_modules',
  '@expo',
  'cli',
  'build',
  'src',
  'run',
  'ios',
  'XcodeBuild.js'
);

const search = `if (developmentTeamId) {
            args.push(\`DEVELOPMENT_TEAM=\${developmentTeamId}\`, '-allowProvisioningUpdates', '-allowProvisioningDeviceRegistration');
        }
    }`;

const replace = `if (developmentTeamId) {
            args.push(\`DEVELOPMENT_TEAM=\${developmentTeamId}\`);
        }
        // Always allow provisioning updates when building for device (patch-expo-ios-device.js)
        if (!props.isSimulator) {
            args.push('-allowProvisioningUpdates', '-allowProvisioningDeviceRegistration');
        }
    }`;

if (!fs.existsSync(filePath)) {
  console.warn('patch-expo-ios-device: XcodeBuild.js not found, skipping (expo version may have changed).');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');
if (content.includes("// Always allow provisioning updates when building for device (patch-expo-ios-device.js)")) {
  process.exit(0); // already patched
}
if (!content.includes(search)) {
  console.warn('patch-expo-ios-device: Could not find expected code block, skipping (expo version may have changed).');
  process.exit(0);
}
content = content.replace(search, replace);
fs.writeFileSync(filePath, content);
console.log('patch-expo-ios-device: Applied iOS device provisioning fix.');
