import path from 'path';

import { BaseDeploymentOptions } from '../types';
import { DEFAULT_ENGINE, SUPPORTED_ENGINES } from './config';
import Context from './context';

const METHOD_NAME_MAP = ['default', 'build', 'deploy', 'remove'];

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
    entity: engine.toUpperCase(),
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

    if (!METHOD_NAME_MAP.includes(methodName)) {
      throw Error(`Unsupported method ${methodName}. Try one of: ${METHOD_NAME_MAP.join(', ')}.`);
    }

    onPreDeploy && (await onPreDeploy());

    await component.init();

    context.metrics.lastDebugTime = new Date().getTime();
    context.statusEngineStart();

    const outputs = await component[methodName](componentOptions);

    context.renderOutputs(outputs);

    console.log();

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
