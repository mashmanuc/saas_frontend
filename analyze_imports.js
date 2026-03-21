const fs = require('fs');
const path = require('path');

function getImports(filePath, visited = new Set()) {
  if (visited.has(filePath)) return [];
  visited.add(filePath);
  
  if (!fs.existsSync(filePath)) return [];
  
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }
  
  const importRegex = /import\s+(?:{[^}]*}|[^from]*)\s+from\s+['"]([^'"]+)['"]/g;
  const imports = [];
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

const dashboardTutor = path.join(__dirname, 'src/modules/dashboard/views/TutorHome.vue');
const dashboardStudent = path.join(__dirname, 'src/modules/dashboard/views/StudentHome.vue');

console.log('=== TutorHome.vue imports ===');
getImports(dashboardTutor).forEach(imp => console.log(imp));

console.log('\n=== StudentHome.vue imports ===');
getImports(dashboardStudent).forEach(imp => console.log(imp));
