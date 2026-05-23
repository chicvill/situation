const fs = require('fs');
const path = require('path');

const srcDir = path.resolve('c:/Users/USER/Desktop/Workstation/situation/situation-room/src');

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

const files = walk(srcDir);

files.forEach(file => {
    // Skip config.ts and utils/apiFetch.ts
    if (file.endsWith('config.ts') || file.endsWith('apiFetch.ts')) return;

    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // Pattern 1: const apiUrl = import.meta.env.VITE_API_URL || "https://situation.chicvill.store";
    const pattern1 = /const\s+apiUrl\s*=\s*import\.meta\.env\.VITE_API_URL\s*\|\|\s*"https:\/\/situation\.chicvill\.store";/g;
    if (pattern1.test(content)) {
        content = content.replace(pattern1, 'const apiUrl = API_BASE;');
        modified = true;
    }

    // Pattern 2: const getApiUrl = () => import.meta.env.VITE_API_URL || "https://situation.chicvill.store";
    const pattern2 = /const\s+getApiUrl\s*=\s*\(\)\s*=>\s*import\.meta\.env\.VITE_API_URL\s*\|\|\s*"https:\/\/situation\.chicvill\.store";/g;
    if (pattern2.test(content)) {
        content = content.replace(pattern2, 'const getApiUrl = () => API_BASE;');
        modified = true;
    }

    // Pattern 3: ReservationManager special case
    const pattern3 = /const\s+getApiUrl\s*=\s*\(\)\s*=>\s*\{\s*return\s*import\.meta\.env\.VITE_API_URL\s*\|\|\s*"https:\/\/situation\.chicvill\.store";\s*\};/g;
    if (pattern3.test(content)) {
        content = content.replace(pattern3, 'const getApiUrl = () => API_BASE;');
        modified = true;
    }

    if (modified) {
        // Calculate relative path to src/config.ts
        const dir = path.dirname(file);
        let relPath = path.relative(dir, path.join(srcDir, 'config'));
        relPath = relPath.replace(/\\/g, '/');
        if (!relPath.startsWith('.')) {
            relPath = './' + relPath;
        }

        // Add import { API_BASE } from '...' if not present
        if (!content.includes('import { API_BASE }')) {
            // find the last import
            const importRegex = /^import\s+.*from\s+['"].*['"];?$/gm;
            let lastImportIndex = 0;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                lastImportIndex = match.index + match[0].length;
            }
            const importStmt = `\nimport { API_BASE } from '${relPath}';`;
            if (lastImportIndex > 0) {
                content = content.slice(0, lastImportIndex) + importStmt + content.slice(lastImportIndex);
            } else {
                content = importStmt + '\n' + content;
            }
        }
        
        fs.writeFileSync(file, content);
        console.log('Refactored ' + file);
    }
});
