#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import minimist from 'minimist';

import deploy from './deploy';
import { DEPLOY_CONFIG_NAME } from './config';

const deployConfigPath = path.join(process.cwd(), DEPLOY_CONFIG_NAME);
const configPathExists = fs.existsSync(deployConfigPath);
const args = minimist(process.argv.slice(2));
const method = args._[0] || undefined;

// create a default next-deploy config if one doesn't exist yet
if (!configPathExists) {
  fs.writeFileSync(
    deployConfigPath,
    `// for more configurable options see: https://github.com/nidratech/next-deploy#configuration-options
module.exports = {
  debug: true,
  onPreDeploy: () => console.log('⚡ Starting Deployment'),
};
`
  );
}

deploy(deployConfigPath, method);
