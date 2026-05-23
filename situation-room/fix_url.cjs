const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('c:/Users/USER/Desktop/Workstation/situation/situation-room/src');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('window.location.hostname}:8000')) {
        content = content.replace(/import\.meta\.env\.VITE_API_URL\s*\|\|\s*`http:\/\/\$\{window\.location\.hostname\}:8000`/g, 'import.meta.env.VITE_API_URL || "https://situation.chicvill.store"');
        content = content.replace(/import\.meta\.env\.VITE_API_URL\s*\|\|\s*'http:\/\/localhost:8000'/g, 'import.meta.env.VITE_API_URL || "https://situation.chicvill.store"');
        fs.writeFileSync(file, content);
        console.log('Updated ' + file);
    }
});
