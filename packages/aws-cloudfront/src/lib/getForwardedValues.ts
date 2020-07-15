import { CloudFront } from 'aws-sdk';

import { Forward } from '../../types';

const forwardDefaults = {
  cookies: 'none',
  queryString: false,
};

/**
 * @param config User-defined config
 * @param defaults Default framework values (default cache behavior and custom cache behavior have different default values)
 * @returns Object
 */
export default function getForwardedValues(config: Forward = {}, defaults?: Forward) {
  const defaultValues = { ...forwardDefaults, ...defaults };
  const {
    cookies,
    queryString = defaultValues.queryString,
    headers,
    queryStringCacheKeys,
  } = config;

  // Cookies
  const forwardCookies: CloudFront.CookiePreference = {
    Forward: defaultValues.cookies as string,
  };

  if (typeof cookies === 'string') {
    forwardCookies.Forward = cookies;
  } else if (Array.isArray(cookies)) {
    forwardCookies.Forward = 'whitelist';
    forwardCookies.WhitelistedNames = {
      Quantity: cookies.length,
      Items: cookies,
    };
  }

  // Headers
  const forwardHeaders: CloudFront.Headers = {
    Quantity: 0,
    Items: [],
  };

  if (typeof headers === 'string' && headers === 'all') {
    forwardHeaders.Quantity = 1;
    forwardHeaders.Items = ['*'];
  } else if (Array.isArray(headers)) {
    forwardHeaders.Quantity = headers.length;
    forwardHeaders.Items = headers;
  }

  // QueryStringCacheKeys
  const forwardQueryKeys: CloudFront.QueryStringCacheKeys = {
    Quantity: 0,
    Items: [],
  };

  if (Array.isArray(queryStringCacheKeys)) {
    forwardQueryKeys.Quantity = queryStringCacheKeys.length;
    forwardQueryKeys.Items = queryStringCacheKeys;
  }

  return {
    QueryString: queryString,
    Cookies: forwardCookies,
    Headers: forwardHeaders,
    QueryStringCacheKeys: forwardQueryKeys,
  };
}
