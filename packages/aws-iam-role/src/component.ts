import { equals, mergeDeepRight } from 'ramda';
import { IAM } from 'aws-sdk';
import { Component } from '@serverless/core';

import { Role, Policy } from '../types';
import {
  createRole,
  deleteRole,
  getRole,
  addRolePolicy,
  removeRolePolicy,
  updateAssumeRolePolicy,
  inputsChanged,
} from './utils';

const defaults: Role = {
  service: 'lambda.amazonaws.com',
  policy: {
    arn: 'arn:aws:iam::aws:policy/AdministratorAccess',
  },
  region: 'us-east-1',
};

class IamRole extends Component {
  async default(
    inputs: Role = {}
  ): Promise<{
    name: string;
    arn: string;
    service: string | string[];
    policy: Policy;
  }> {
    inputs = mergeDeepRight(defaults, inputs) as Role;
    const iam = new IAM({ region: inputs.region, credentials: this.context.credentials.aws });

    this.context.status('Deploying');

    inputs.name = this.state.name || this.context.resourceId();

    this.context.debug(`Syncing role ${inputs.name} in region ${inputs.region}.`);
    const prevRole = await getRole({ iam, name: inputs.name as string });

    if (!prevRole) {
      this.context.debug(`Creating role ${inputs.name}.`);
      this.context.status('Creating');
      inputs.arn = await createRole({
        iam,
        name: inputs.name as string,
        service: inputs.service as string | string[],
        policy: inputs.policy as Policy,
      });
    } else {
      inputs.arn = prevRole.arn;

      if (inputsChanged(prevRole as Role, inputs as Role)) {
        this.context.status(`Updating`);
        if (prevRole.service !== inputs.service) {
          this.context.debug(`Updating service for role ${inputs.name}.`);
          await updateAssumeRolePolicy({
            iam,
            name: inputs.name as string,
            service: inputs.service as string | string[],
          });
        }
        if (!equals(prevRole.policy, inputs.policy)) {
          this.context.debug(`Updating policy for role ${inputs.name}.`);
          await removeRolePolicy({
            iam,
            name: inputs.name as string,
            policy: inputs.policy as Policy,
          });
          await addRolePolicy({
            iam,
            name: inputs.name as string,
            policy: inputs.policy as Policy,
          });
        }
      }
    }

    // todo we probably don't need this logic now that
    // we auto generate unconfigurable names
    if (this.state.name && this.state.name !== inputs.name) {
      this.context.status(`Replacing`);
      this.context.debug(`Deleting/Replacing role ${inputs.name}.`);
      await deleteRole({ iam, name: this.state.name, policy: inputs.policy as Policy });
    }

    this.state.name = inputs.name;
    this.state.arn = inputs.arn;
    this.state.service = inputs.service;
    this.state.policy = inputs.policy;
    this.state.region = inputs.region;

    await this.save();

    this.context.debug(`Saved state for role ${inputs.name}.`);

    const outputs = {
      name: inputs.name as string,
      arn: inputs.arn as string,
      service: inputs.service as string | string[],
      policy: inputs.policy as Policy,
    };

    this.context.debug(`Role ${inputs.name} was successfully deployed to region ${inputs.region}.`);
    this.context.debug(`Deployed role arn is ${inputs.arn}.`);

    return outputs;
  }

  async remove(): Promise<void | {
    name: string;
    arn: string;
    service: string[];
    policy: Policy;
  }> {
    this.context.status('Removing');

    if (!this.state.name) {
      this.context.debug('Aborting removal. Role name not found in state.');
      return;
    }

    const iam = new IAM({
      region: this.state.region,
      credentials: this.context.credentials.aws,
    });

    this.context.debug(`Removing role ${this.state.name} from region ${this.state.region}.`);
    await deleteRole({ iam, ...this.state });
    this.context.debug(
      `Role ${this.state.name} successfully removed from region ${this.state.region}.`
    );

    const outputs = {
      name: this.state.name,
      arn: this.state.arn,
      service: this.state.service,
      policy: this.state.policy,
    };

    this.state = {};
    await this.save();

    return outputs;
  }
}

export default IamRole;
