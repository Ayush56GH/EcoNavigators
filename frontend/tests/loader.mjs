import { resolve as pathResolve } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2);
    let target = pathResolve(process.cwd(), 'src', rel);

    if (existsSync(target + '.ts')) {
      target = target + '.ts';
    } else if (existsSync(target + '.tsx')) {
      target = target + '.tsx';
    } else if (existsSync(pathResolve(target, 'index.ts'))) {
      target = pathResolve(target, 'index.ts');
    }

    return {
      shortCircuit: true,
      url: pathToFileURL(target).href,
    };
  }

  if (specifier.startsWith('.') && context.parentURL) {
    try {
      const parentPath = fileURLToPath(context.parentURL);
      const parentDir = pathResolve(parentPath, '..');
      const target = pathResolve(parentDir, specifier);
      if (existsSync(target + '.ts')) {
        return {
          shortCircuit: true,
          url: pathToFileURL(target + '.ts').href,
        };
      } else if (existsSync(target + '.tsx')) {
        return {
          shortCircuit: true,
          url: pathToFileURL(target + '.tsx').href,
        };
      } else if (existsSync(pathResolve(target, 'index.ts'))) {
        return {
          shortCircuit: true,
          url: pathToFileURL(pathResolve(target, 'index.ts')).href,
        };
      }
    } catch {
      // Fall through to nextResolve
    }
  }

  return nextResolve(specifier, context);
}
