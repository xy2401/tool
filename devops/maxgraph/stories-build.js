const fs = require('fs');
const path = require('path');
const { build } = require('esbuild');

const storiesJsonPath = path.join(__dirname, 'stories.json');
const storiesDir = __dirname;

async function run() {
    const injectGraphHookPlugin = {
        name: 'inject-graph-hook',
        setup(build) {
            build.onLoad({ filter: /Graph\.js$/ }, async (args) => {
                if (args.path.replace(/\\/g, '/').includes('@maxgraph/core/lib/esm/view/Graph.js')) {
                    let contents = await fs.promises.readFile(args.path, 'utf8');
                    contents = contents.replace(
                        `super({ container, model, plugins, stylesheet: stylesheet ?? undefined });`,
                        `super({ container, model, plugins, stylesheet: stylesheet ?? undefined });\n        window.__demo_graph = this;`
                    );
                    return { contents, loader: 'js' };
                }
            });
        }
    };

    const raw = fs.readFileSync(storiesJsonPath, 'utf8');
    const storiesData = JSON.parse(raw);
    
    // We only want actual "story" entries (not docs)
    const entries = storiesData.entries || {};
    const validEntries = Object.values(entries).filter(e => e.type === 'story' && e.importPath.match(/\.(ts|js)$/) && !e.importPath.includes('ImageBundle'));

    let entryFileContent = `window.MaxGraphStories = {};\nwindow.MaxGraphCore = {};\n\n`;
    entryFileContent += `import {
  Cell,
  cellArrayUtils,
  CircleLayout,
  Client,
  CompactTreeLayout,
  ConnectionHandler,
  DragSource,
  FastOrganicLayout,
  Geometry,
  gestureUtils,
  getDefaultPlugins,
  Graph,
  GraphDataModel,
  HierarchicalLayout,
  ImageBox,
  InternalEvent,
  MaxToolbar,
  ModelXmlSerializer,
  Outline,
  PanningHandler,
  Point,
  RubberBandHandler
} from '@maxgraph/core';\n`;
    entryFileContent += `Object.assign(window.MaxGraphCore, {
  Cell,
  cellArrayUtils,
  CircleLayout,
  Client,
  CompactTreeLayout,
  ConnectionHandler,
  DragSource,
  FastOrganicLayout,
  Geometry,
  gestureUtils,
  getDefaultPlugins,
  Graph,
  GraphDataModel,
  HierarchicalLayout,
  ImageBox,
  InternalEvent,
  MaxToolbar,
  ModelXmlSerializer,
  Outline,
  PanningHandler,
  Point,
  RubberBandHandler
});\n`;
    entryFileContent += `window.MaxGraphStories.ModelXmlSerializer = ModelXmlSerializer;\n\n`;

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
            plugins: [injectGraphHookPlugin],
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
