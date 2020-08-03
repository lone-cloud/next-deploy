import { pathToRegexp } from 'path-to-regexp';

/**
 * Dynamic routes: /[param]/ -> /:param
 * Catch all routes: /[...param]/ -> /:param+
 * Optional catch all routes: /[...param]/ -> /:param*
 *
 * @param dynamicRoute - route to expressify.
 */
export const expressifyDynamicRoute = (dynamicRoute: string): string => {
  // replace any catch all group first
  let expressified = dynamicRoute.replace(/\[\.\.\.(.*)]$/, ':$1+');

  // replace other dynamic route groups
  expressified = expressified.replace(/\[(.*?)]/g, ':$1');

  // check if this is actually an optional catch all group
  if (expressified.includes('/::')) {
    expressified = expressified.replace('/::', '/:').replace(/\+$/, '*');
  }

  return expressified;
};
export const normalizeNodeModules = (path: string): string =>
  path.substring(path.indexOf('node_modules'));
// Identify /[param]/ in route string
export const isDynamicRoute = (route: string): boolean => /\/\[[^\/]+?\](?=\/|$)/.test(route);
export const pathToRegexStr = (path: string): string =>
  pathToRegexp(path)
    .toString()
    .replace(/\/(.*)\/\i/, '$1');
