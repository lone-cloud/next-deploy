import path from 'path';
import chalk from 'chalk';

import { DEFAULT_ENGINE, SUPPORTED_ENGINES, METHOD_NAME_MAP, STATE_ROOT } from './config';
import Context from './context';
import { createBaseConfig } from './utils';

const deploy = async (deployConfigPath: string, methodName = 'default'): Promise<void> => {
  let options: BaseDeploymentOptions;
  try {
    options = await import(deployConfigPath);
  } catch (e) {
    console.error(chalk.red(`❌ Couldn't find the Next.js config at ${deployConfigPath}`));
    process.exit(1);
  }

  const {
    debug = false,
    engine = DEFAULT_ENGINE,
    onPreDeploy,
    onPostDeploy,
    onShutdown,
    stage,
  } = options;
  const engineIndex = SUPPORTED_ENGINES.findIndex(({ type }) => type === engine);
  const isInit = methodName === 'init';

  onShutdown && handleShutDown(onShutdown);

  if (engineIndex === -1) {
    console.error(
      `❌ ${chalk.red(`Unsupported engine:`)}: ${engine}\nPick one of: ${SUPPORTED_ENGINES.map(
        ({ type }) => type
      ).join(', ')}`
    );

    process.exit(1);
  }

  const EngineComponent = await import(SUPPORTED_ENGINES[engineIndex].component);
  const method = METHOD_NAME_MAP.find(({ name }) => name === methodName);

  if (!method) {
    console.error(
      `❌ ${chalk.red(`Unsupported method:`)} ${methodName}\nPick one of: ${METHOD_NAME_MAP.map(
        ({ name }) => name
      ).join(', ')}`
    );

    process.exit(1);
  }

  createBaseConfig(deployConfigPath, isInit);

  if (isInit) {
    process.exit(0);
  }

  const context = new Context({
    root: process.cwd(),
    stateRoot: path.join(process.cwd(), STATE_ROOT, stage?.name || 'local'),
    debug,
    entity: engine.toUpperCase(),
    message: method.action,
  });
  const component = new EngineComponent.default(undefined, context);

  try {
    context.log(`⚡ Starting ${method.actionNoun} ⚡`);

    onPreDeploy && (await onPreDeploy());

    await component.init();

    context.metrics.lastDebugTime = new Date().getTime();
    context.statusEngineStart();

    const outputs = await component[methodName](options);

    context.renderOutputs(outputs);

    onPostDeploy && (await onPostDeploy());

    context.close('done');
    process.exit(0);
  } catch (e) {
    context.close('error', e);
    process.exit(1);
  }
};

function handleShutDown(onShutdown: () => Promise<void>) {
  const doShutdown = async () => {
    await onShutdown();
    process.exit(1);
  };

  process.on('SIGINT', doShutdown);
  process.on('SIGQUIT', doShutdown);
  process.on('SIGTERM', doShutdown);
}

export default deploy;
