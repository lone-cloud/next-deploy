export type BaseDeploymentOptions = {
  engine?: 'aws';
  debug?: boolean;
  onPreDeploy?: () => Promise<void>;
  onPostDeploy?: () => Promise<void>;
};

type ContextConfig = {
  root: string;
  stateRoot: string;
  credentials?: Record<string, unknown>;
  debug?: boolean;
  entity?: string;
  message?: string;
};

type ContextMetrics = {
  entity: string;
  lastDebugTime?: number;
  useTimer: boolean;
  seconds: 0;
  status: MetricsStatus;
};

type MetricsStatus = {
  running: boolean;
  message: string;
  loadingDots: string;
  loadingDotCount: number;
};
