#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

let allPassed = true;

function check(name, fn) {
  try {
    const result = fn();
    console.log(`✅ ${name}: ${result}`);
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    allPassed = false;
  }
}

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', timeout: 10000 }).trim();
}

check('Node.js >= 22.11', () => {
  const version = process.versions.node;
  const [major, minor] = version.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 11)) {
    throw new Error(`Found ${version}, need >= 22.11`);
  }
  return version;
});

check('Java 17', () => {
  const output = run('java -version 2>&1');
  const match = output.match(/version "(\d+)/);
  const major = match ? parseInt(match[1], 10) : 0;
  if (major !== 17) {
    throw new Error(`Found Java ${major}, need 17`);
  }
  return `Java ${major}`;
});

check('ANDROID_HOME set', () => {
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!androidHome) {
    throw new Error('ANDROID_HOME / ANDROID_SDK_ROOT not set');
  }
  return androidHome;
});

check('SDK Platform 35', () => {
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!androidHome) throw new Error('ANDROID_HOME not set');
  const platformDir = resolve(androidHome, 'platforms', 'android-35');
  if (!existsSync(platformDir)) {
    throw new Error(`${platformDir} not found`);
  }
  return 'installed';
});

check('adb available', () => {
  const output = run('adb version 2>&1');
  const match = output.match(/Android Debug Bridge version ([\d.]+)/);
  return match ? match[1] : output.split('\n')[0];
});

check('Gradle wrapper (PocketQA Mobile)', () => {
  const gradlew = resolve(rootDir, 'apps', 'pocketqa-mobile', 'android', 'gradlew');
  if (!existsSync(gradlew)) {
    throw new Error('gradlew not found');
  }
  return 'present';
});

check('Gradle wrapper (Demo Shop)', () => {
  const gradlew = resolve(rootDir, 'apps', 'demo-shop', 'gradlew');
  if (!existsSync(gradlew)) {
    throw new Error('gradlew not found');
  }
  return 'present';
});

console.log('');
if (allPassed) {
  console.log('🎉 All checks passed!');
  process.exit(0);
} else {
  console.log('⚠️  Some checks failed. Please fix the issues above.');
  process.exit(1);
}
