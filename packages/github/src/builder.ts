import execa from 'execa';
import { writeFileSync } from 'fs';

const NEXT_EXPORT_CMD = ['export'];

const build = async (
  { cmd, cwd, args }: BuildOptions,
  debug?: (message: string) => void
): Promise<void> => {
  if (debug) {
    const { stdout: nextVersion } = await execa(cmd, ['--version'], {
      cwd,
    });

    debug(`Starting a new build with ${nextVersion}`);

    console.log();
  }

  // run the build
  let subprocess = execa(cmd, args, {
    cwd,
  });

  if (debug && subprocess.stdout) {
    subprocess.stdout.pipe(process.stdout);
  }

  await subprocess;

  // export the static assets from the build
  subprocess = execa(cmd, NEXT_EXPORT_CMD, {
    cwd,
  });

  if (debug && subprocess.stdout) {
    subprocess.stdout.pipe(process.stdout);
  }

  await subprocess;

  // needed to be able for gh-pages to serve directories that start with _
  writeFileSync('out/.nojekyll', '');
};

export default build;
