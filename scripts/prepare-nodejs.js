const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const serverDir = path.join(rootDir, 'server');
const nodejsDir = path.join(clientDir, 'dist', 'nodejs');

console.log('🌱 准备农事专家APK (CapacitorNodeJS 格式)...\n');

try {
  // 清理旧目录
  if (fs.existsSync(nodejsDir)) {
    console.log('🗑️  清理旧的nodejs目录...');
    fs.rmSync(nodejsDir, { recursive: true, force: true });
  }

  // 创建 dist/nodejs/ 目录（这是 CapacitorNodeJS 的 nodeDir）
  console.log('📦 复制服务器代码到 dist/nodejs/ ...');
  fs.mkdirSync(nodejsDir, { recursive: true });

  // 复制服务器文件（不是复制到子目录，而是直接到 nodejs/）
  const items = fs.readdirSync(serverDir);
  for (const item of items) {
    const srcPath = path.join(serverDir, item);
    const destPath = path.join(nodejsDir, item);
    
    if (item !== 'node_modules' && item !== '.git') {
      fs.cpSync(srcPath, destPath, { recursive: true });
    }
  }

  console.log('✅ 服务器代码已复制');

  // 安装生产依赖（在 dist/nodejs/ 目录下）
  console.log('\n📥 安装生产依赖...');
  process.chdir(nodejsDir);

  if (!fs.existsSync('node_modules')) {
    execSync('npm ci --omit=dev', { stdio: 'inherit' });
  } else {
    console.log('   (依赖已存在，跳过安装)');
  }

  // 清理不必要的文件
  console.log('\n🧹 清理不必要的文件...');
  const nodeModulesDir = path.join(nodejsDir, 'node_modules');
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

  // 验证关键文件
  console.log('\n✅ 验证目录结构:');
  const requiredFiles = ['index.js', 'package.json', 'node_modules'];
  for (const file of requiredFiles) {
    const exists = fs.existsSync(path.join(nodejsDir, file));
    console.log(`   ${exists ? '✅' : '❌'} ${file}/`);
  }

  console.log('\n📁 最终结构:');
  console.log(`   client/dist/`);
  console.log(`   ├── index.html, assets/ ... (前端)`);
  console.log(`   └── nodejs/              ← CapacitorNodeJS nodeDir`);
  console.log(`       ├── index.js         ← 服务器入口`);
  console.log(`       ├── package.json`);
  console.log(`       ├── node_modules/     ← ✅ 依赖`);
  console.log(`       ├── routes/`);
  console.log(`       ├── services/`);
  console.log(`       ├── data/`);
  console.log(`       └── knowledge/`);

  console.log('\n🎯 重要说明:');
  console.log('   • startMode 默认为 "auto"，插件会自动启动 Node.js');
  console.log('   • 不需要手动调用 NodeJS.start()');
  console.log('   • 服务器将在 127.0.0.1:3000 启动\n');

} catch (err) {
  console.error('❌ 准备失败:', err.message);
  process.exit(1);
}
