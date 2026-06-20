const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:3001/devops/maxgraph/index.html');
    
    // wait for vue and maxGraph
    await new Promise(r => setTimeout(r, 2000));
    
    const xml = await page.evaluate(() => {
        const graph = window.__test_graph;
        const Codec = window.__test_Codec;
        const xmlUtils = window.__test_xmlUtils;
        
        graph.getDataModel().beginUpdate();
        try {
            graph.insertVertex(graph.getDefaultParent(), null, 'test', 10, 10, 50, 50, { shape: 'ellipse' });
        } finally {
            graph.getDataModel().endUpdate();
        }
        
        const serializer = new window.__test_ModelXmlSerializer(graph.getDataModel());
        return serializer.export();
    });
    
    console.log("=== XML OUTPUT ===");
    console.log(xml);
    console.log("==================");
    
    await browser.close();
})();
