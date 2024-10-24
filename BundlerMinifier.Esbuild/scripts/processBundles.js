import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { basename, dirname, extname, join, relative, resolve, sep } from 'path';
import { sync } from 'glob';
import { createHash } from 'crypto';

/**
 * Discover all bundleconfig.json files in the consuming project.
 * Assumes that the script is executed from the project root.
 */
function discoverBundleConfigs() {
    const configs = sync('**/bundleconfig*.json', {
        ignore: ['**/node_modules/**', '**/bin/**', '**/obj/**']
    });

    // Sort files by directory depth (number of path separators)
    return configs.sort((a, b) => {
        const depthA = a.split(sep).length;
        const depthB = b.split(sep).length;
        if (depthA !== depthB)
            return depthA - depthB;
        return a.localeCompare(b);
    });
}

/**
 * Process a single bundleconfig.json file.
 * @param {string} configPath - Path to the bundleconfig.json file.
 */
async function processBundleConfig(configPath) {
    console.log(`Bundler: Begin processing ${configPath}`);
    try {
        const data = await readFile(configPath, 'utf8');
        // Remove BOM if present
        const content = data.replace(/^\uFEFF/, '');

        const configs = JSON.parse(content);

        if (!Array.isArray(configs)) {
            throw new Error(` Invalid format in ${configPath}: Expected an array of configurations.`);
        }

        for (const config of configs) {
            const inputFiles = (config.inputFiles || []).map(file => relative('./', resolve(dirname(configPath), file)));
            const outputFileName = relative('./', resolve(dirname(configPath), config.outputFileName));

            if (!outputFileName) {
                throw new Error(` Missing outputFileName in a configuration in ${configPath}.`);
            }

            await minifyAndBundle(inputFiles, outputFileName);
        }
        console.log(`Bundler: Done processing ${configPath}`);
    } catch (err) {
        console.error(` Error processing ${configPath}:`, err);
        process.exit(2);
    }
}

const resolvePathPlugin = {
    name: 'resolvePath',
    setup(build) {
        //console.log('build: ', { entryPoints: build.initialOptions.entryPoints, outdir: build.initialOptions.outdir });

        // Mark all paths starting with "http://" or "https://" as external
        build.onResolve({ filter: /^https?:\/\// }, args => {
            if (args.kind === 'entry-point')
                return null;
            return { path: args.path, external: true }
        })

        build.onResolve({ filter: /.*/ }, async (args) => {
            if (args.kind === 'entry-point')
                return null;
            //console.log('args: ', args);
            const absolutePath = resolve(args.resolveDir, args.path);
            return { path: relative(build.initialOptions.outdir, absolutePath), external: true }
        })
    },
}

/**
 * Minify and concatenate files into a single output file.
 * @param {string[]} entryPoints - The input files to minify and concatenate.
 * @param {string} outfile - The output file.
 */
async function minifyAndBundle(entryPoints, outfile) {
    const cleanedEntryPoints = entryPoints.map(e => e.replace(/^~\//, ''));
    const outfileClean = outfile.replace(/^~\//, '');
    const outdir = dirname(outfileClean);

    const options = {
        minify: true,
        bundle: outfileClean.endsWith('.css'),
        write: false,
        entryPoints: cleanedEntryPoints,
        outdir: outdir,
        plugins: [resolvePathPlugin]
    };

    try {
        const outfileExt = extname(outfileClean);
        const outfileBaseName = basename(outfileClean, outfileExt);
        const minifyOutfile = outfileBaseName.endsWith('.min')
            ? outfileClean : join(outdir, `${outfileBaseName}.min${outfileExt}`);

        const fileHashPromise = getFileHash(minifyOutfile);
        const result = await build(options);
        if (!result.outputFiles)
            return;
        const minifyBundledContent = result.outputFiles.map(o => o.text).join('');
        const fileHash = await fileHashPromise;
        if (fileHash === null || fileHash !== getStringHash(minifyBundledContent)) {
            console.log(` Bundling ${outfileClean}`);
            await mkdir(outdir, { recursive: true });
            await writeFile(minifyOutfile, minifyBundledContent);
            if (outfileClean !== minifyOutfile) {
                const bundledContent = (
                    await Promise.all(cleanedEntryPoints.map(file => readFile(file, 'utf-8')))
                ).join('\n');
                await writeFile(outfileClean, bundledContent);
            }
        }
    } catch (err) {
        console.error('  Bundling failed:', err);
        process.exit(1);
    }
}

async function getFileHash(filePath) {
    try {
        const content = await readFile(filePath, 'utf8');
        return getStringHash(content);
    } catch {
        return null; // File doesn't exist
    }
}

function getStringHash(content) {
    return createHash('sha256').update(content).digest('hex');
}

// Main Execution
(async () => {
    const bundleConfigs = discoverBundleConfigs();

    if (bundleConfigs.length === 0) {
        console.log('Bundler: No bundleconfig.json files found. Skipping bundling.');
        process.exit(0);
    }

    console.time('Bundling Time');
    for (const bundleConfig of bundleConfigs) {
        await processBundleConfig(bundleConfig);
    }
    console.timeEnd('Bundling Time');
})();
