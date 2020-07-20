import { CloudFront as AwsCloudFront, S3, Credentials } from 'aws-sdk';
import { equals } from 'ramda';
import { Component } from '@serverless/core';

import {
  createInvalidation,
  createCloudFrontDistribution,
  updateCloudFrontDistribution,
  deleteCloudFrontDistribution,
} from './lib';
import { CloudFrontInputs } from '../types';

class CloudFront extends Component {
  static createInvalidation({
    credentials,
    distributionId,
    paths,
  }: {
    credentials: Credentials;
    distributionId: string;
    paths?: string[];
  }): Promise<AwsCloudFront.CreateInvalidationResult> {
    return createInvalidation({ credentials, distributionId, paths });
  }

  async default(inputs: CloudFrontInputs): Promise<Record<string, any>> {
    this.context.status('Deploying');

    inputs.region = inputs.region || 'us-east-1';
    inputs.enabled = inputs.enabled === false ? false : true;
    inputs.comment =
      inputs.comment === null || inputs.comment === undefined ? '' : String(inputs.comment);
    inputs.priceClass = ['PriceClass_All', 'PriceClass_200', 'PriceClass_100'].includes(
      inputs.priceClass || ''
    )
      ? inputs.priceClass
      : 'PriceClass_All';

    this.context.debug(
      `Starting deployment of CloudFront distribution to the ${inputs.region} region.`
    );

    const cf = new AwsCloudFront({
      credentials: this.context.credentials.aws,
      region: inputs.region,
    });

    const s3 = new S3({
      credentials: this.context.credentials.aws,
      region: inputs.region,
    });

    this.state.id = inputs.distributionId || this.state.id;

    if (this.state.id) {
      if (
        !equals(this.state.origins, inputs.origins) ||
        !equals(this.state.defaults, inputs.defaults) ||
        !equals(this.state.enabled, inputs.enabled) ||
        !equals(this.state.comment, inputs.comment) ||
        !equals(this.state.priceClass, inputs.priceClass)
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
    this.state.priceClass = inputs.priceClass;
    this.state.origins = inputs.origins;
    this.state.defaults = inputs.defaults;

    await this.save();

    this.context.debug(`CloudFront deployed successfully with URL: ${this.state.url}.`);

    return this.state;
  }

  async remove(): Promise<void> {
    this.context.status('Removing');

    if (!this.state.id) {
      return;
    }

    const cf = new AwsCloudFront({
      credentials: this.context.credentials.aws,
      region: this.state.region,
    });

    this.context.debug(
      `Removing CloudFront distribution of ID ${this.state.id}. It could take a while.`
    );

    try {
      await deleteCloudFrontDistribution(cf, this.state.id, this.context.debug);
    } catch (error) {
      this.context.debug(error.message);
    }

    this.state = {};
    await this.save();

    this.context.debug('CloudFront distribution was successfully removed.');
  }
}

export default CloudFront;
