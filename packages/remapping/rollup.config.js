import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

function configure(esm) {
  return {
    input: 'src/remapping.ts',
    output: esm
      ? { format: 'es', dir: 'dist', entryFileNames: '[name].mjs', sourcemap: true }
      : { format: 'umd', name: 'remapping', dir: 'dist', entryFileNames: '[name].umd.js', sourcemap: true },
    plugins: [
      typescript({ tsconfig: './tsconfig.build.json' }),
      resolve(),
    ],
    watch: {
      include: 'src/**',
    },
  };
}

export default [configure(false), configure(true)];
