export const getDomains = (
  domains: string | string[] | undefined
): { domain?: string; subdomain?: string } => {
  if (typeof domains === 'string') {
    return { domain: domains, subdomain: 'www' };
  }

  if (domains instanceof Array && domains.length) {
    return {
      domain: domains.length > 1 ? domains[1] : domains[0],
      subdomain: domains.length > 1 && domains[0] ? domains[0] : 'www',
    };
  }

  return { domain: undefined, subdomain: undefined };
};
