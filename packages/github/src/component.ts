import { Component } from '@serverless/core';
import { resolve } from 'path';
import { publish } from 'gh-pages';
import { emptyDir } from 'fs-extra';
import { writeFileSync } from 'fs';

import build from './builder';
import { GithubInputs, DeploymentResult } from '../types';

class GithubComponent extends Component {
  async default(inputs: GithubInputs = {}): Promise<DeploymentResult> {
    if (inputs.build !== false) {
      await this.build(inputs);
    }

    return this.deploy(inputs);
  }

  async build(inputs: GithubInputs = {}): Promise<void> {
    const nextConfigPath = inputs.nextConfigDir ? resolve(inputs.nextConfigDir) : process.cwd();
    const buildCwd =
      typeof inputs.build === 'boolean' || typeof inputs.build === 'undefined' || !inputs.build.cwd
        ? nextConfigPath
        : resolve(inputs.build.cwd);
    const buildConfig: BuildOptions = {
      enabled: inputs.build
        ? // @ts-ignore
          inputs.build !== false && inputs.build.enabled !== false
        : true,
      cmd: 'node_modules/.bin/next',
      args: ['build'],
      ...(typeof inputs.build === 'object' ? inputs.build : {}),
      cwd: buildCwd,
    };

    if (buildConfig.enabled) {
      await build(buildConfig, this.context.instance.debugMode ? this.context.debug : undefined);

      if (inputs?.domain?.length) {
        const domain = getDomains(inputs.domain);

        if (domain) {
          writeFileSync('out/CNAME', domain);
        }
      }
    }
  }

  async deploy(inputs: GithubInputs = {}): Promise<DeploymentResult> {
    let outputs: DeploymentResult = {};

    if (inputs?.domain?.length) {
      const domain = getDomains(inputs.domain);
      outputs.appUrl = `https://${domain}`;
    }

    const publishPromise = new Promise((resolve, reject) => {
      publish(
        'out',
        { message: 'Next Deployment Update', ...inputs.publishOptions, dotfiles: true },
        (err) => {
          if (err) {
            return reject(err);
          }

          resolve();
        }
      );
    });

    await publishPromise;

    return outputs;
  }

  async remove(): Promise<void> {
    await emptyDir('out');
    writeFileSync('out/empty', '');

    const publishPromise = new Promise((resolve, reject) => {
      publish('out', { message: 'Next Deployment Removal', remove: '*' }, (err) => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    });

    await publishPromise;
  }
}

function getDomains(inputDomain: string | string[]): string | undefined {
  let domain;

  if (typeof inputDomain === 'string') {
    domain = inputDomain;
  } else if (inputDomain instanceof Array) {
    domain = inputDomain.join();
  }

  return domain;
}

export default GithubComponent;
