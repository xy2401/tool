const fs = require('fs');
const path = require('path');
const { build } = require('esbuild');

const storiesJsonPath = path.join(__dirname, 'stories.json');
const storiesDir = __dirname;

async function run() {
    const raw = fs.readFileSync(storiesJsonPath, 'utf8');
    const storiesData = JSON.parse(raw);
    
    // We only want actual "story" entries (not docs)
    const entries = storiesData.entries || {};
    const validEntries = Object.values(entries).filter(e => e.type === 'story' && e.importPath.match(/\.(ts|js)$/) && !e.importPath.includes('ImageBundle'));

    let entryFileContent = `window.MaxGraphStories = {};\n\n`;

    validEntries.forEach(entry => {
        // e.g. import * as Story1 from './stories/HelloWorld.stories.ts'
        const varName = entry.id.replace(/[^a-zA-Z0-9]/g, '_');
        entryFileContent += `import * as ${varName} from '${entry.importPath}';\n`;
        // Expose via the entry id
        entryFileContent += `window.MaxGraphStories['${entry.id}'] = ${varName};\n\n`;
    });

    const tempEntryPath = path.join(storiesDir, 'stories-entry.js');
    fs.writeFileSync(tempEntryPath, entryFileContent, 'utf8');

    console.log('Building with esbuild...');
    try {
        await build({
            entryPoints: [tempEntryPath],
            bundle: true,
            outdir: path.join(storiesDir, 'stories.js'),
            format: 'iife',
            loader: {
                '.ts': 'ts',
                '.js': 'js',
                '.css': 'css',
                '.svg': 'dataurl',
                '.png': 'dataurl',
                '.gif': 'dataurl'
            },
            sourcemap: true,
            minify: true,
            logLevel: 'info',
        });
        console.log('Build successful!');
    } catch (e) {
        console.error('Build failed', e);
    } finally {
        if (fs.existsSync(tempEntryPath)) {
            fs.unlinkSync(tempEntryPath);
        }
    }
}

run();
