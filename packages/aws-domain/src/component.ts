import { Component } from '@serverless/core';

import {
  getClients,
  prepareSubdomains,
  getDomainHostedZoneId,
  describeCertificateByArn,
  getCertificateArnByDomain,
  createCertificate,
  validateCertificate,
  configureDnsForCloudFrontDistribution,
  removeCloudFrontDomainDnsRecords,
  addDomainToCloudfrontDistribution,
  removeDomainFromCloudFrontDistribution,
} from './utils';
import { AwsDomainInputs } from '../types';

class Domain extends Component {
  async default(inputs: AwsDomainInputs): Promise<{ domains: string[] }> {
    this.context.status('Deploying');

    this.context.debug(`Starting Domain component deployment.`);

    this.context.debug(`Validating inputs.`);

    inputs.region = inputs.region || 'us-east-1';
    inputs.privateZone = inputs.privateZone || false;
    inputs.domainType = inputs.domainType || 'both';
    inputs.defaultCloudfrontInputs = inputs.defaultCloudfrontInputs || {};

    if (!inputs.domain) {
      throw Error(`"domain" is a required input.`);
    }

    // TODO: Check if domain has changed.
    // On domain change, call remove for all previous state.

    // Get AWS SDK Clients
    const clients = getClients(this.context.credentials.aws, inputs.region);

    this.context.debug(`Formatting domains and identifying cloud services being used.`);
    const subdomains = prepareSubdomains(inputs);
    this.state.region = inputs.region;
    this.state.privateZone = inputs.privateZone;
    this.state.domain = inputs.domain;
    this.state.subdomains = subdomains;

    await this.save();

    this.context.debug(`Getting the Hosted Zone ID for the domain ${inputs.domain}.`);
    const domainHostedZoneId = await getDomainHostedZoneId(
      clients.route53,
      inputs.domain,
      inputs.privateZone
    );

    this.context.debug(
      `Searching for an AWS ACM Certificate based on the domain: ${inputs.domain}.`
    );

    let certificateArn: string | null | undefined = await getCertificateArnByDomain(
      clients.acm,
      inputs.domain
    );

    if (!certificateArn) {
      this.context.debug(
        `No existing AWS ACM Certificates found for the domain: ${inputs.domain}.`
      );
      this.context.debug(`Creating a new AWS ACM Certificate for the domain: ${inputs.domain}.`);
      certificateArn = await createCertificate(clients.acm, inputs.domain);
    }

    if (!certificateArn) {
      throw Error(`Failed getting a certificateArn`);
    }

    this.context.debug(`Checking the status of AWS ACM Certificate.`);
    const certificate = await describeCertificateByArn(clients.acm, certificateArn);

    if (!certificate || !certificate.CertificateArn) {
      throw Error(`Failed getting a certificate for certificateArn = ${certificateArn}`);
    }

    if (certificate.Status === 'PENDING_VALIDATION') {
      this.context.debug(`AWS ACM Certificate Validation Status is "PENDING_VALIDATION".`);
      this.context.debug(`Validating AWS ACM Certificate via Route53 "DNS" method.`);
      await validateCertificate(
        clients.acm,
        clients.route53,
        certificate,
        inputs.domain,
        domainHostedZoneId
      );
      this.context.log(
        'Your AWS ACM Certificate has been created and is being validated via DNS.  This could take up to 30 minutes since it depends on DNS propagation. Continuing deployment, but you may have to wait for DNS propagation.'
      );
    }

    if (certificate.Status !== 'ISSUED' && certificate.Status !== 'PENDING_VALIDATION') {
      // TODO: Should we auto-create a new one in this scenario?
      throw new Error(
        `Your AWS ACM Certificate for the domain "${inputs.domain}" has an unsupported status of: "${certificate.Status}".  Please remove it manually and deploy again.`
      );
    }

    // Setting up domains for different services
    for (const subdomain of subdomains) {
      if (subdomain.type === 'awsS3Website') {
        throw new Error(`Unsupported subdomain type ${subdomain.type}`);
      } else if (subdomain.type === 'awsApiGateway') {
        throw new Error(`Unsupported subdomain type ${subdomain.type}`);
      } else if (subdomain.type === 'awsCloudFront') {
        this.context.debug(
          `Adding ${subdomain.domain} domain to CloudFront distribution with URL "${subdomain.url}"`
        );
        await addDomainToCloudfrontDistribution(
          clients.cf,
          subdomain,
          certificate.CertificateArn,
          inputs.domainType,
          inputs.defaultCloudfrontInputs
        );

        this.context.debug(`Configuring DNS for distribution "${subdomain.url}".`);
        await configureDnsForCloudFrontDistribution(
          clients.route53,
          subdomain,
          domainHostedZoneId,
          subdomain.url.replace('https://', ''),
          inputs.domainType
        );
      } else if (subdomain.type === 'awsAppSync') {
        throw new Error(`Unsupported subdomain type ${subdomain.type}`);
      }
    }

    const outputs = { domains: [] as string[] };
    let hasRoot = false;
    outputs.domains = subdomains.map((subdomain) => {
      if (subdomain.domain.startsWith('www')) {
        hasRoot = true;
      }
      return `https://${subdomain.domain}`;
    });

    if (hasRoot && inputs.domainType !== 'www') {
      outputs.domains.unshift(`https://${inputs.domain.replace('www.', '')}`);
    }

    return outputs;
  }

  async remove(): Promise<void> {
    this.context.status('Deploying');

    if (!this.state.domain) {
      return;
    }

    this.context.debug(`Starting Domain component removal.`);

    // Get AWS SDK Clients
    const clients = getClients(this.context.credentials.aws, this.state.region);

    this.context.debug(`Getting the Hosted Zone ID for the domain ${this.state.domain}.`);
    const domainHostedZoneId = await getDomainHostedZoneId(
      clients.route53,
      this.state.domain,
      this.state.privateZone
    );

    for (const subdomain in this.state.subdomains) {
      const domainState = this.state.subdomains[subdomain];
      if (domainState.type === 'awsS3Website') {
        this.context.debug(`Unsupported subdomain type ${domainState.type}`);
      } else if (domainState.type === 'awsApiGateway') {
        this.context.debug(`Unsupported subdomain type ${domainState.type}`);
      } else if (domainState.type === 'awsCloudFront') {
        try {
          this.context.debug(`Removing domain ${domainState.domain} from CloudFront.`);
          await removeDomainFromCloudFrontDistribution(clients.cf, domainState);
        } catch (error) {
          this.context.debug(error.message);
        }

        this.context.debug(`Removing CloudFront DNS records for domain ${domainState.domain}`);

        await removeCloudFrontDomainDnsRecords(
          clients.route53,
          domainState.domain,
          domainHostedZoneId,
          domainState.url.replace('https://', '')
        );
      } else if (domainState.type === 'awsAppSync') {
        this.context.debug(`Unsupported subdomain type ${domainState.type}`);
      }
    }

    this.state = {};
    await this.save();
  }
}

export default Domain;
