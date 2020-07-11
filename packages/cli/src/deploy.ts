import path from 'path';

import { BaseDeploymentOptions } from '../types';
import { DEFAULT_ENGINE, SUPPORTED_ENGINES } from './config';
import Context from './context';

const METHOD_NAME_MAP = [
  { name: 'default', action: 'Deploying' },
  { name: 'build', action: 'Building' },
  { name: 'deploy', action: 'Deploying' },
  { name: 'remove', action: 'Removing' },
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

  if (engineIndex === -1) {
    throw new Error(
      `Engine ${engine} is unsupported. Pick one of: ${SUPPORTED_ENGINES.map(
        ({ type }) => type
      ).join(', ')}.`
    );
  }

  const EngineComponent = await import(SUPPORTED_ENGINES[engineIndex].component);
  const method = METHOD_NAME_MAP.find(({ name }) => name === methodName);

  if (!method) {
    throw Error(
      `Unsupported method ${methodName}. Try one of: ${METHOD_NAME_MAP.map(({ name }) => name).join(
        ', '
      )}.`
    );
  }

  const context = new Context({
    root: process.cwd(),
    stateRoot: path.join(process.cwd(), '.next-deploy'),
    debug,
    entity: engine.toUpperCase(),
    message: method.action,
  });
  const component = new EngineComponent.default(undefined, context);

  try {
    onPreDeploy && (await onPreDeploy());

    await component.init();

    context.metrics.lastDebugTime = new Date().getTime();
    context.statusEngineStart();

    const outputs = await component[methodName](componentOptions);

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
