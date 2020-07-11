export const SUPPORTED_ENGINES = [
  {
    type: 'aws',
    component: '@next-deploy/aws-component',
  },
  {
    type: 'github',
    component: '@next-deploy/github',
  },
];
export const DEFAULT_ENGINE = 'aws';
export const DEPLOY_CONFIG_NAME = 'next-deploy.config.js';
export const METHOD_NAME_MAP = [
  { name: 'default', action: 'Deploying' },
  { name: 'build', action: 'Building' },
  { name: 'deploy', action: 'Deploying' },
  { name: 'remove', action: 'Removing' },
];
export const STATE_ROOT = '.next-deploy';
