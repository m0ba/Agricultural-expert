const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const distNodejsServer = path.join(clientDir, 'dist', 'nodejs', 'server');

console.log('🌱 准备农事专家APK - 安装Node.js依赖...\n');

try {
  if (!fs.existsSync(distNodejsServer)) {
    console.error('❌ 错误: dist/nodejs/server/ 目录不存在！');
    console.error('请先运行: cd client && npm run build\n');
    process.exit(1);
  }

  console.log('📥 安装服务器生产依赖...');
  process.chdir(distNodejsServer);

  if (!fs.existsSync('node_modules')) {
    execSync('npm ci --omit=dev', { stdio: 'inherit' });
  }

  console.log('\n🧹 清理不必要的文件（减小APK体积）...');
  const nodeModulesDir = path.join(distNodejsServer, 'node_modules');
  if (fs.existsSync(nodeModulesDir)) {
    const dirsToRemove = ['test', 'tests', '__tests__', 'example', 'examples', 'docs', '.github', 'benchmark'];
    const filesToRemove = ['*.md', '*.ts', '*.map', 'CHANGELOG*', 'LICENSE*', '.npmignore', '.eslintrc*', '.prettierrc*', 'tsconfig*', '*.d.ts'];

    dirsToRemove.forEach(dir => {
      try { execSync(`rm -rf ${path.join(nodeModulesDir, dir)}`, { stdio: 'pipe' }); } catch (e) {}
    });

    filesToRemove.forEach(pattern => {
      try { execSync(`find ${nodeModulesDir} -type f -name "${pattern}" -delete`, { stdio: 'pipe' }); } catch (e) {}
    });

    try { execSync(`rm -rf ${path.join(nodeModulesDir, '.cache')}`, { stdio: 'pipe' }); } catch (e) {}
  }

  console.log('✅ 准备完成！\n');
  console.log('📁 目录结构:');
  console.log(`   client/dist/`);
  console.log(`   ├── index.html, assets/ ...`);
  console.log(`   └── nodejs/`);
  console.log(`       └── server/`);
  console.log(`           ├── index.js`);
  console.log(`           ├── package.json`);
  console.log(`           ├── node_modules/ ✅`);
  console.log(`           └── routes/, services/, data/, knowledge/`);

  console.log('\n🔨 下一步: 构建APK');
  console.log('   npx cap sync android && cd android && ./gradlew assembleDebug\n');

} catch (err) {
  console.error('❌ 失败:', err.message);
  process.exit(1);
}
