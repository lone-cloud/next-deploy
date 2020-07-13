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
  { name: 'init' },
  { name: 'default', action: 'Deploying', actionNoun: 'Deployment' },
  { name: 'build', action: 'Building', actionNoun: 'Build' },
  { name: 'deploy', action: 'Deploying', actionNoun: 'Deployment' },
  { name: 'remove', action: 'Removing', actionNoun: 'Removal' },
];
export const STATE_ROOT = '.next-deploy';
