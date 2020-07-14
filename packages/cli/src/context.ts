import os from 'os';
import chalk from 'chalk';
import ansiEscapes from 'ansi-escapes';
import stripAnsi from 'strip-ansi';
import figures from 'figures';
import path from 'path';
import prettyoutput from 'prettyoutput';
import { utils } from '@serverless/core';

import { ContextMetrics, ContextConfig } from '../types';

const { red, green, blue, dim: grey } = chalk;

class Context {
  root: string;
  stateRoot: string;
  debugMode: boolean;
  state: Record<string, unknown>;
  credentials: Record<string, unknown>;
  id: string;
  outputs: Record<string, unknown>;
  metrics: ContextMetrics;

  constructor(config: ContextConfig) {
    this.root = path.resolve(config.root) || process.cwd();
    this.stateRoot = config.stateRoot
      ? path.resolve(config.stateRoot)
      : path.join(this.root, '.next-deploy');

    this.credentials = config.credentials || {};
    this.debugMode = config.debug || false;
    this.state = { id: utils.randomId() };
    this.id = this.state.id as string;
    this.outputs = {};

    this.metrics = {
      entity: config.entity || 'Components',
      lastDebugTime: undefined,
      useTimer: true,
      seconds: 0,
      status: {
        running: false,
        message: config.message || 'Running',
        loadingDots: '',
        loadingDotCount: 0,
      },
    };

    // Hide cursor always, to keep it clean
    process.stdout.write(ansiEscapes.cursorHide);

    // Event Handler: Control + C
    process.on('SIGINT', () => {
      if (this.isStatusEngineActive()) {
        return this.statusEngineStop('cancel');
      }
      process.exit(1);
    });

    // Count seconds
    setInterval(() => {
      this.metrics.seconds++;
    }, 1000);
  }

  async init(): Promise<void> {
    const contextStatePath = path.join(this.stateRoot, `_.json`);

    if (await utils.fileExists(contextStatePath)) {
      this.state = await utils.readFile(contextStatePath);
    } else {
      await utils.writeFile(contextStatePath, this.state);
    }

    this.id = this.state.id as string;

    await this.setCredentials();
  }

  resourceId(): string {
    return `${this.id}-${utils.randomId()}`;
  }

  async readState(id: string): Promise<any> {
    const stateFilePath = path.join(this.stateRoot, `${id}.json`);

    if (await utils.fileExists(stateFilePath)) {
      return utils.readFile(stateFilePath);
    }
    return {};
  }

  async writeState(id: string, state: Record<string, unknown>): Promise<any> {
    const stateFilePath = path.join(this.stateRoot, `${id}.json`);
    await utils.writeFile(stateFilePath, state);
    return state;
  }

  async setCredentials(): Promise<Record<string, any>> {
    // Load env vars
    const envVars = process.env;

    // Known Provider Environment Variables and their SDK configuration properties
    const providers: Record<string, any> = {};

    providers.aws = {};
    providers.aws.AWS_ACCESS_KEY_ID = 'accessKeyId';
    providers.aws.AWS_SECRET_ACCESS_KEY = 'secretAccessKey';
    providers.aws.AWS_REGION = 'region';

    const credentials: Record<string, any> = {};

    for (const provider in providers) {
      const providerEnvVars = providers[provider];
      for (const providerEnvVar in providerEnvVars) {
        if (!envVars.hasOwnProperty(providerEnvVar)) {
          continue;
        }

        if (!credentials[provider]) {
          credentials[provider] = {};
        }

        credentials[provider][providerEnvVars[providerEnvVar]] = envVars[providerEnvVar];
      }
    }

    this.credentials = credentials;

    return credentials;
  }

  close(reason: string, error?: Error): void {
    // Skip if not active
    process.stdout.write(ansiEscapes.cursorShow);
    if (!this.isStatusEngineActive()) {
      console.log();
      process.exit(0);
    }

    return this.statusEngineStop(reason, error);
  }

  getRelativeVerticalCursorPosition(contentString: string): number {
    const base = 1;
    const terminalWidth = process.stdout.columns;
    const contentWidth = stripAnsi(contentString).length;
    const nudges = Math.ceil(Number(contentWidth) / Number(terminalWidth));
    return base + nudges;
  }

  async statusEngine(): Promise<void> {
    this.renderStatus();

    await utils.sleep(100);

    if (this.isStatusEngineActive()) {
      return this.statusEngine();
    }
  }

  isStatusEngineActive(): boolean {
    return this.metrics.status.running;
  }

  statusEngineStart(): Promise<void> {
    if (this.debugMode) {
      this.log();
    }
    this.metrics.status.running = true;
    // Start Status engine
    return this.statusEngine();
  }

  statusEngineStop(reason: string, error?: Error): void {
    this.metrics.status.running = false;
    let message = '';

    if (reason === 'error' && error) {
      message = red(`❌ ${error.stack || error.message}`);
    } else if (reason === 'cancel') {
      message = red('Cancelled ❌');
    } else if (reason === 'done') {
      message = green('Done ✔');
    }

    // Clear any existing content
    process.stdout.write(ansiEscapes.cursorLeft);
    process.stdout.write(ansiEscapes.eraseDown);

    // Write content
    this.log();
    let content = '';

    if (this.metrics.useTimer) {
      content += `${grey(`${this.metrics.seconds}s`)}`;
      content += ` ${blue(figures.pointerSmall)}`;
    }
    content += ` ${message}`;
    process.stdout.write(content);

    // Put cursor to starting position for next view
    console.log(os.EOL);
    process.stdout.write(ansiEscapes.cursorLeft);
    process.stdout.write(ansiEscapes.cursorShow);

    if (reason === 'error') {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }

  renderStatus(status?: string, entity?: string): void {
    // Start Status engine, if it isn't running yet
    if (!this.isStatusEngineActive()) {
      this.statusEngineStart();
    }

    // Set global status
    if (status) {
      this.metrics.status.message = status;
    }

    // Set global status
    if (entity) {
      this.metrics.entity = entity;
    }

    // Loading dots
    if (this.metrics.status.loadingDotCount === 0) {
      this.metrics.status.loadingDots = `.`;
    } else if (this.metrics.status.loadingDotCount === 2) {
      this.metrics.status.loadingDots = `..`;
    } else if (this.metrics.status.loadingDotCount === 4) {
      this.metrics.status.loadingDots = `...`;
    } else if (this.metrics.status.loadingDotCount === 6) {
      this.metrics.status.loadingDots = '';
    }
    this.metrics.status.loadingDotCount++;
    if (this.metrics.status.loadingDotCount > 8) {
      this.metrics.status.loadingDotCount = 0;
    }

    // Clear any existing content
    process.stdout.write(ansiEscapes.eraseDown);

    // Write content
    console.log();
    let content = '';
    if (this.metrics.useTimer) {
      content += `${grey(this.metrics.seconds + 's')}`;
      content += ` ${blue(figures.pointerSmall)}`;
    }

    content += ` ${grey(this.metrics.status.message)}`;
    content += `${blue(this.metrics.status.loadingDots)}`;
    process.stdout.write(content);
    console.log();

    // Get cursor starting position according to terminal & content width
    const startingPosition = this.getRelativeVerticalCursorPosition(content);

    // Put cursor to starting position for next view
    process.stdout.write(ansiEscapes.cursorUp(startingPosition));
    process.stdout.write(ansiEscapes.cursorLeft);
  }

  renderLog(msg?: string): void {
    if (!msg || msg == '') {
      console.log();
      return;
    }

    // Clear any existing content
    process.stdout.write(ansiEscapes.eraseDown);
    console.log();

    console.log(msg);

    // Put cursor to starting position for next view
    process.stdout.write(ansiEscapes.cursorLeft);
  }

  renderDebug(msg: string): void {
    if (!this.debugMode || !msg || msg == '') {
      return;
    }

    this.metrics.lastDebugTime = this.metrics.lastDebugTime || new Date().getTime();

    const now = new Date().getTime();
    const elapsedMs = now - this.metrics.lastDebugTime;
    const elapsedTimeSuffix =
      elapsedMs > 1000
        ? chalk.red(`(${Math.floor(elapsedMs / 1000)}s)`)
        : grey.bold(`(${elapsedMs}ms)`);

    this.metrics.lastDebugTime = now;

    // Clear any existing content
    process.stdout.write(ansiEscapes.eraseDown);

    console.log(`${blue.bold(`DEBUG ${figures.line}`)} ${chalk.white(msg)} ${elapsedTimeSuffix}`);

    // Put cursor to starting position for next view
    process.stdout.write(ansiEscapes.cursorLeft);
  }

  renderError(errorProp?: string | Error): void {
    let error: Error;

    // If no argument, skip
    if (!errorProp) {
      return;
    }

    if (typeof errorProp === 'string') {
      error = new Error(errorProp);
    } else {
      error = errorProp;
    }

    // Clear any existing content
    process.stdout.write(ansiEscapes.eraseDown);
    console.log();

    // Write Error
    console.log(`${red('Error:')}`);

    console.log(` `, error);

    // Put cursor to starting position for next view
    process.stdout.write(ansiEscapes.cursorLeft);
  }

  renderOutputs(outputs: Record<string, unknown>): void {
    if (typeof outputs !== 'object' || Object.keys(outputs).length === 0) {
      return;
    }
    // Clear any existing content
    process.stdout.write(ansiEscapes.eraseDown);
    console.log();
    process.stdout.write(prettyoutput(outputs, {}, 2));
  }

  // basic CLI utilities
  log(msg?: string): void {
    this.renderLog(msg);
  }

  debug(msg: string): void {
    this.renderDebug(msg);
  }

  status(status: string, entity: string): void {
    this.renderStatus(status, entity);
  }
}

export default Context;
