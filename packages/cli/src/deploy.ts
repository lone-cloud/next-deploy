import path from 'path';
import ora from 'ora';

import { BaseDeploymentOptions } from '../types';
import { DEFAULT_ENGINE, SUPPORTED_ENGINES } from './config';
import Context from './context';
import { getColor } from './utils';

const METHOD_NAME_MAP = [
  { name: 'default', action: 'Deploying...' },
  { name: 'build', action: 'Building...' },
  { name: 'deploy', action: 'Deploying...' },
  { name: 'remove', action: 'Removing...' },
];

const deploy = async (deployConfigPath: string, methodName = 'default'): Promise<void> => {
  const {
    debug = false,
    engine = DEFAULT_ENGINE,
    onPreDeploy,
    onPostDeploy,
    ...componentOptions
  }: BaseDeploymentOptions = await import(deployConfigPath);
  const engineIndex = SUPPORTED_ENGINES.findIndex(({ type }) => type === engine);
  const context = new Context({
    root: process.cwd(),
    stateRoot: path.join(process.cwd(), '.next-deploy'),
    debug,
    entity: engine,
  });

  if (engineIndex === -1) {
    throw new Error(
      `Engine ${engine} is unsupported. Pick one of: ${SUPPORTED_ENGINES.map(
        ({ type }) => type
      ).join(', ')}.`
    );
  }

  try {
    const EngineComponent = await import(SUPPORTED_ENGINES[engineIndex].component);
    const component = new EngineComponent.default(undefined, context);
    const method = METHOD_NAME_MAP.find(({ name }) => name === methodName);
    const spinner = ora(method?.action);
    let intervalHandle: NodeJS.Timeout | undefined = undefined;

    if (!method) {
      throw Error(
        `Unsupported method ${method}. Try one of: ${METHOD_NAME_MAP.map(({ name }) => name).join(
          ', '
        )}.`
      );
    }

    onPreDeploy && (await onPreDeploy());

    await component.init();

    if (!debug) {
      spinner.color = 'yellow';

      intervalHandle = setInterval(() => {
        spinner.color = getColor(spinner?.color);
      }, 2000);
      spinner.start();
    }

    component.context.instance.metrics.lastDebugTime = new Date().getTime();

    const outputs = await component[method.name](componentOptions);

    intervalHandle && clearInterval(intervalHandle);
    spinner.stop();

    context.renderOutputs(outputs);
    onPostDeploy && (await onPostDeploy());

    context.close('done');
    process.exit(0);
  } catch (e) {
    context.renderError(e);
    context.close('error', e);
    process.exit(1);
  }
};

export default deploy;
