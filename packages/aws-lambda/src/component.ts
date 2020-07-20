import { Lambda } from 'aws-sdk';
import { Component, utils } from '@serverless/core';
import { mergeDeepRight, pick } from 'ramda';

import {
  createLambda,
  updateLambdaCode,
  updateLambdaConfig,
  getLambda,
  deleteLambda,
  configChanged,
  pack,
  load,
} from './utils';
import AwsIamRole from '@next-deploy/aws-iam-role';
import { AwsLambdaInputs } from '../types';

const outputsList = [
  'name',
  'hash',
  'description',
  'memory',
  'timeout',
  'code',
  'bucket',
  'shims',
  'handler',
  'runtime',
  'env',
  'role',
  'arn',
  'region',
];

const SUPPORTED_RUNTIMES = ['nodejs10.x', 'nodejs12.x'];
const LATEST_RUNTIME = SUPPORTED_RUNTIMES[1];

const defaults: Partial<AwsLambdaInputs> = {
  description: 'AWS Lambda Component',
  memory: 512,
  timeout: 10,
  code: process.cwd(),
  bucket: undefined,
  shims: [],
  handler: 'handler.hello',
  runtime: LATEST_RUNTIME,
  env: {},
  region: 'us-east-1',
};

class LambdaComponent extends Component {
  async default(inputs: Partial<AwsLambdaInputs> = {}) {
    this.context.status('Deploying');

    const config = mergeDeepRight(defaults, inputs) as AwsLambdaInputs;

    config.name = inputs.name || (this.state.name as string) || this.context.resourceId();

    this.context.debug(
      `Starting deployment of lambda ${config.name} to the ${config.region} region.`
    );

    const lambda = new Lambda({
      region: config.region,
      credentials: this.context.credentials.aws,
    });

    const awsIamRole = await load<AwsIamRole>('@next-deploy/aws-iam-role', this);
    const outputsAwsIamRole = await awsIamRole.default(config.role);
    config.role = { arn: outputsAwsIamRole.arn };

    this.context.status('Packaging');
    this.context.debug(`Packaging lambda code from ${config.code}.`);
    config.zipPath = (await pack(config.code, config.shims)) as string;

    config.hash = await utils.hashFile(config.zipPath as string);

    const prevLambda = await getLambda({ lambda, ...config });

    if (!prevLambda) {
      this.context.status('Creating');
      this.context.debug(`Creating lambda ${config.name} in the ${config.region} region.`);

      //@ts-ignore
      const createResult = await createLambda({ lambda, ...config });
      config.arn = createResult.arn;
      config.hash = createResult.hash;
    } else {
      config.arn = prevLambda.arn;

      if (configChanged(prevLambda, config)) {
        if (prevLambda.hash !== config.hash) {
          this.context.status(`Uploading code`);
          this.context.debug(`Uploading ${config.name} lambda code.`);
          await updateLambdaCode({ lambda, ...config });
        }

        this.context.status(`Updating`);
        this.context.debug(`Updating ${config.name} lambda config.`);

        const updateResult = await updateLambdaConfig({ lambda, ...config });
        config.hash = updateResult.hash;
      }
    }

    // todo we probably don't need this logic now that we auto generate names
    if (this.state.name && this.state.name !== config.name) {
      this.context.status(`Replacing`);
      await deleteLambda({ lambda, name: this.state.name as string });
    }

    this.context.debug(
      `Successfully deployed lambda ${config.name} in the ${config.region} region.`
    );

    const outputs = pick(outputsList, config);

    this.state = outputs;
    await this.save();

    return outputs;
  }

  async publishVersion(): Promise<{ version: string | undefined }> {
    const { name, region, hash } = this.state;

    const lambda = new Lambda({
      region: region as string,
      credentials: this.context.credentials.aws,
    });

    const { Version } = await lambda
      .publishVersion({
        FunctionName: name as string,
        CodeSha256: hash as string,
      })
      .promise();

    return { version: Version };
  }

  async remove() {
    this.context.status(`Removing`);

    if (!this.state.name) {
      this.context.debug(`Aborting removal. Function name not found in state.`);
      return;
    }

    const { name, region } = this.state;

    const lambda = new Lambda({
      region: region as string,
      credentials: this.context.credentials.aws,
    });

    const awsIamRole = await load<AwsIamRole>('@next-deploy/aws-iam-role', this);

    await awsIamRole.remove();

    this.context.debug(`Removing lambda ${name} from the ${region} region.`);
    await deleteLambda({ lambda, name: name as string });
    this.context.debug(`Successfully removed lambda ${name} from the ${region} region.`);

    const outputs = pick(outputsList, this.state);

    this.state = {};
    await this.save();

    return outputs;
  }
}

export default LambdaComponent;
