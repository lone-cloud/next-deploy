import execa from 'execa';
import { writeFileSync } from 'fs';

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
  const subprocess = execa(cmd, args, {
    cwd,
    env: {
      NODE_OPTIONS: '--max_old_space_size=3000',
    },
  });

  if (debug && subprocess.stdout) {
    subprocess.stdout.pipe(process.stdout);
  }

  await subprocess;

  // needed to be able for gh-pages to serve directories that start with _
  writeFileSync('out/.nojekyll', '');
};

export default build;
