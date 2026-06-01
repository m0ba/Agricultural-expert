const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const serverDir = path.join(rootDir, 'server');
const nodejsDir = path.join(clientDir, 'nodejs');
const serverInNodejs = path.join(nodejsDir, 'server');

console.log('🌱 准备农事专家APK构建...\n');

try {
  if (fs.existsSync(nodejsDir)) {
    console.log('🗑️  清理旧的nodejs目录...');
    fs.rmSync(nodejsDir, { recursive: true, force: true });
  }

  console.log('📦 复制服务器代码到client/nodejs...');
  fs.mkdirSync(nodejsDir, { recursive: true });
  fs.cpSync(serverDir, serverInNodejs, { recursive: true });

  console.log('📥 安装服务器生产依赖...');
  process.chdir(serverInNodejs);
  execSync('npm ci --omit=dev', { stdio: 'inherit' });

  console.log('🧹 清理不必要的文件（减小APK体积）...');
  const nodeModulesDir = path.join(serverInNodejs, 'node_modules');
  if (fs.existsSync(nodeModulesDir)) {
    const dirsToRemove = ['test', 'tests', '__tests__', 'example', 'examples', 'docs', '.github', 'benchmark'];
    const filesToRemove = ['*.md', '*.ts', '*.map', 'CHANGELOG*', 'LICENSE*', '.npmignore', '.eslintrc*', '.prettierrc*', 'tsconfig*', '*.d.ts'];

    dirsToRemove.forEach(dir => {
      try {
        execSync(`rm -rf ${path.join(nodeModulesDir, dir)}`, { stdio: 'pipe' });
      } catch (e) {}
    });

    filesToRemove.forEach(pattern => {
      try {
        execSync(`find ${nodeModulesDir} -type f -name "${pattern}" -delete`, { stdio: 'pipe' });
      } catch (e) {}
    });

    try {
      execSync(`rm -rf ${path.join(nodeModulesDir, '.cache')}`, { stdio: 'pipe' });
    } catch (e) {}
  }

  console.log('✅ 准备完成！');
  console.log(`\n📁 nodejs目录结构:`);
  console.log(`   ${nodejsDir}/`);
  console.log(`   └── server/`);
  console.log(`       ├── index.js`);
  console.log(`       ├── package.json`);
  console.log(`       ├── node_modules/ (已安装生产依赖)`);
  console.log(`       ├── routes/`);
  console.log(`       ├── services/`);
  console.log(`       ├── data/`);
  console.log(`       └── knowledge/`);

  console.log('\n🔨 构建APK命令:');
  console.log('   cd client && npm run build:apk');

} catch (err) {
  console.error('❌ 构建准备失败:', err.message);
  process.exit(1);
}
