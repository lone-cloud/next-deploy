import fs from 'fs-extra';

import { DEPLOY_CONFIG_NAME } from './config';

export const createBaseConfig = (deployConfigPath: string, displayWarning?: boolean): void => {
  const configPathExists = fs.existsSync(deployConfigPath);

  if (displayWarning && configPathExists) {
    console.warn(`⚠️  The ${DEPLOY_CONFIG_NAME} configuration already exists.`);
  }

  // create a default next-deploy config if one doesn't exist yet
  if (!configPathExists) {
    fs.writeFileSync(
      deployConfigPath,
      `// for more configurable options see: https://github.com/nidratech/next-deploy#configuration-options
module.exports = {
  engine: 'aws',
  debug: true,
};
`
    );
  }
};
