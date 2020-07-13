#!/usr/bin/env node

import path from 'path';
import minimist from 'minimist';

import deploy from './deploy';
import { DEPLOY_CONFIG_NAME } from './config';

const deployConfigPath = path.join(process.cwd(), DEPLOY_CONFIG_NAME);
const args = minimist(process.argv.slice(2));
const method = args._[0] || undefined;

deploy(deployConfigPath, method);
