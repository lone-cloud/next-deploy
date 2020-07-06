import { CloudFront, S3 } from 'aws-sdk';
import { equals } from 'ramda';
import { Component } from '@serverless/core';

import {
  createInvalidation,
  createCloudFrontDistribution,
  updateCloudFrontDistribution,
  deleteCloudFrontDistribution,
} from './lib';
import { Credentials, CloudFrontInputs } from '../types';

class CloudFrontComponent extends Component {
  static createInvalidation({
    credentials,
    distributionId,
    paths,
  }: {
    credentials: Credentials;
    distributionId: string;
    paths?: string[];
  }) {
    createInvalidation({ credentials, distributionId, paths });
  }

  async default(inputs: CloudFrontInputs) {
    this.context.status('Deploying');

    inputs.region = inputs.region || 'us-east-1';
    inputs.enabled = inputs.enabled === false ? false : true;
    inputs.comment =
      inputs.comment === null || inputs.comment === undefined ? '' : String(inputs.comment);

    this.context.debug(
      `Starting deployment of CloudFront distribution to the ${inputs.region} region.`
    );

    const cf = new CloudFront({
      credentials: this.context.credentials.aws,
      region: inputs.region,
    });

    const s3 = new S3({
      credentials: this.context.credentials.aws,
      region: inputs.region,
    });

    if (this.state.id) {
      if (
        !equals(this.state.origins, inputs.origins) ||
        !equals(this.state.defaults, inputs.defaults) ||
        !equals(this.state.enabled, inputs.enabled) ||
        !equals(this.state.comment, inputs.comment)
      ) {
        this.context.debug(`Updating CloudFront distribution of ID ${this.state.id}.`);
        this.state = await updateCloudFrontDistribution(cf, s3, this.state.id, inputs);
      }
    } else {
      this.context.debug(`Creating CloudFront distribution in the ${inputs.region} region.`);
      this.state = await createCloudFrontDistribution(cf, s3, inputs);
    }

    this.state.region = inputs.region;
    this.state.enabled = inputs.enabled;
    this.state.comment = inputs.comment;
    this.state.origins = inputs.origins;
    this.state.defaults = inputs.defaults;
    await this.save();

    this.context.debug(`CloudFront deployed successfully with URL: ${this.state.url}.`);

    return this.state;
  }

  async remove() {
    this.context.status('Removing');

    if (!this.state.id) {
      return;
    }

    const cf = new CloudFront({
      credentials: this.context.credentials.aws,
      region: this.state.region,
    });

    await deleteCloudFrontDistribution(cf, this.state.id);

    this.state = {};
    await this.save();

    this.context.debug(`CloudFront distribution was successfully removed.`);
    return {};
  }
}

export default CloudFrontComponent;
