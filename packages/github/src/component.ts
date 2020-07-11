import { Component } from '@serverless/core';

import { GithubInputs, DeploymentResult } from '../types';

class GithubComponent extends Component {
  async default(inputs: GithubInputs = {}): Promise<DeploymentResult> {
    return this.deploy(inputs);
  }

  async build(inputs: GithubInputs = {}): Promise<void> {
    // TODO
  }

  async deploy(inputs: GithubInputs = {}): Promise<DeploymentResult> {
    // TODO

    return {};
  }

  async remove(): Promise<void> {
    // TODO
  }
}

export default GithubComponent;
