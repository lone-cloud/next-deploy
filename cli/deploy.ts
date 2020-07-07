#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';

import AwsComponent from '@next-deploy/aws-component';

const SUPPORTED_ENGINES = [
  {
    type: 'aws',
    component: '@next-deploy/aws-component',
  },
];
const DEFAULT_ENGINE = 'aws';
const DEPLOY_CONFIG_NAME = 'deploy.config.js';

(async () => {
  const deployConfigPath = path.join(process.cwd(), DEPLOY_CONFIG_NAME);
  const configPathExists = fs.existsSync(deployConfigPath);

  if (!configPathExists) {
    fs.writeFileSync(deployConfigPath, getDefaultConfigData());
  }

  const {
    debug = false,
    engine = DEFAULT_ENGINE,
    ...componentOptions
  }: BaseDeploymentOptions = await import(deployConfigPath);
  const engineIndex = SUPPORTED_ENGINES.findIndex(({ type }) => type === engine);

  if (engineIndex === -1) {
    throw new Error(
      `Engine ${engine} is unsupported. Pick one of: ${SUPPORTED_ENGINES.map(
        ({ type }) => type
      ).join(',')}.`
    );
  }

  const EngineComponent = await import(SUPPORTED_ENGINES[engineIndex].component);
  const engineComponent = new EngineComponent.default();

  if (engine === 'aws') {
    await (engineComponent as AwsComponent).default(componentOptions);
  }
})();

function getDefaultConfigData(): string {
  return `// for configurable options visit: https://github.com/nidratech/next-deploy#options
module.exports = {
  // prints helpful output during deployment
  debug: false,
};
`;
}

type BaseDeploymentOptions = {
  engine?: 'aws';
  debug?: boolean;
};
