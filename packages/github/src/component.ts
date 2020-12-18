import { Component } from '@serverless/core';
import { resolve } from 'path';
import { publish } from 'gh-pages';
import { emptyDir } from 'fs-extra';
import { writeFileSync } from 'fs';

import builder from './builder';
import { GithubInputs, DeploymentResult } from '../types';

class GithubComponent extends Component {
  async default(inputs: GithubInputs = {}): Promise<DeploymentResult> {
    await this.build(inputs);
    return this.deploy(inputs);
  }

  async build({ build, nextConfigDir, domain }: GithubInputs = {}): Promise<void> {
    this.context.status('Building');

    const nextConfigPath = nextConfigDir ? resolve(nextConfigDir) : process.cwd();

    await builder(
      {
        cmd: build?.cmd || 'node_modules/.bin/next',
        cwd: build?.cwd ? resolve(build.cwd) : nextConfigPath,
        args: build?.args || ['build'],
      },
      this.context.instance.debugMode ? this.context.debug : undefined
    );

    if (domain?.length) {
      const computedDomain = getComputedDomain(domain);

      if (computedDomain) {
        writeFileSync('out/CNAME', computedDomain);
      }
    }
  }

  async deploy({ domain, publish: publishOptions }: GithubInputs = {}): Promise<DeploymentResult> {
    this.context.status('Deploying');

    const outputs: DeploymentResult = {};

    if (domain?.length) {
      const computedDomain = getComputedDomain(domain);
      outputs.appUrl = `https://${computedDomain}`;
    }

    const publishPromise = new Promise<void>((resolve, reject) => {
      publish(
        'out',
        { message: 'Next Deployment Update', dotfiles: true, ...publishOptions },
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

    const publishPromise = new Promise<void>((resolve, reject) => {
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

function getComputedDomain(inputDomain: string | string[]): string | undefined {
  let domain;

  if (typeof inputDomain === 'string') {
    domain = inputDomain;
  } else if (inputDomain instanceof Array) {
    domain = inputDomain.join();
  }

  return domain;
}

export default GithubComponent;
